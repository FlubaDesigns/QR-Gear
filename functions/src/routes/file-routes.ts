import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
import { buildGraphicId, grfCounterKey, GRF_TYPE_MAP } from '../../../shared/graphicCodes';
import type { GrfTypeCode, GrfRoleCode } from '../../../shared/graphicCodes';
import { printfulClient } from '../services/printful';
  import { printifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE } from '../services/printify';
  import { generateSignedUrl, addSignedUrlsToAssets, downloadAndStoreImage } from '../services/storage-helpers';
  import { calculateAuthoritativePrice, getAuthoritativePrice } from '../services/pricing';
  import { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS } from '../services/mockup-generator';
  import type { MockupRequest, MockupResult } from '../services/mockup-generator';
  import { getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulStoreId, PRINTFUL_API_BASE } from '../services/printful';
  import type { PrintfulMockupTask, PrintfulVariant } from '../services/printful';
  import { getResendClient, QR_GEAR_FROM_EMAIL } from '../services/email';
  import { cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE, getCanvas, getQRCode } from '../services/composite-image';

export async function processQueueInBackground(): Promise<void> {
  const processLimit = 10;
  
  const pendingSnapshot = await db.collection('mockup_jobs')
    .where('status', '==', 'pending')
    .limit(processLimit)
    .get();

  if (pendingSnapshot.empty) {
    console.log('[Queue Background] No pending jobs');
    return;
  }

  console.log(`[Queue Background] Processing ${pendingSnapshot.size} jobs`);

  for (const jobDoc of pendingSnapshot.docs) {
    const job = jobDoc.data();
    const jobId = jobDoc.id;

    try {
      const claimed = await db.runTransaction(async (transaction: any) => {
        const jobRef = db.collection('mockup_jobs').doc(jobId);
        const freshDoc = await transaction.get(jobRef);
        
        if (!freshDoc.exists || freshDoc.data()?.status !== 'pending') {
          return false;
        }
        
        transaction.update(jobRef, {
          status: 'processing',
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          processorId: `bg-${Date.now()}`,
        });
        return true;
      });

      if (!claimed) continue;

      await new Promise(resolve => setTimeout(resolve, 10000));

      let effectiveProvider: string;
      let resolvedBlueprintId: number;
      let artworkUrl: string;
      let artworkVariant: string;
      let printProviderId: number;

      if (job.templateId) {
        const templateDoc = await db.collection('productTemplates').doc(job.templateId).get();
        if (!templateDoc.exists) {
          throw new Error(`Template ${job.templateId} not found`);
        }
        const template = templateDoc.data()!;
        effectiveProvider = template.fulfillmentProvider || job.fulfillmentProvider || 'printify';
        if (effectiveProvider === 'printful') {
          resolvedBlueprintId = template.productId || template.blueprintId || 71;
        } else {
          resolvedBlueprintId = template.blueprintId || template.productId || 5;
        }
        artworkUrl = template.artworkUrl;
        artworkVariant = template.artworkVariant || 'black';
        printProviderId = template.printProviderId || 39;
      } else if (job.jobData) {
        effectiveProvider = job.jobData.fulfillmentProvider || 'printify';
        if (effectiveProvider === 'printful') {
          resolvedBlueprintId = job.jobData.blueprintId || 71;
        } else {
          resolvedBlueprintId = job.jobData.blueprintId || 5;
        }
        artworkUrl = job.jobData.artworkUrl;
        artworkVariant = job.jobData.artworkVariant || 'black';
        printProviderId = job.jobData.printProviderId || 39;
      } else {
        throw new Error(`Job ${jobId} has no templateId or jobData`);
      }

      const mockupResult = await generateMockupFromPrintful({
        blueprintId: resolvedBlueprintId,
        printProviderId,
        colorName: job.colorName,
        colorHex: job.colorHex || '#000000',
        artworkUrl,
        artworkVariant: artworkVariant as 'black' | 'white',
        fulfillmentProvider: effectiveProvider as 'printify' | 'printful',
        placement: job.placement || 'front',
        printMethod: job.printMethod,
        qrSize: job.qrSize as 'small' | 'medium' | 'large' || 'medium',
        hasCompositeGraphic: true,
      });

      if (job.templateId) {
        const colorKey = job.colorName.replace(/\s+/g, '_').toLowerCase();
        const placementKey = job.placement || 'front';
        const sizeKey = job.qrSize || 'large';
        
        await db.collection('productTemplates').doc(job.templateId).update({
          [`mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`]: mockupResult.mockupUrl,
          [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleMockupUrl || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      await db.collection('mockup_jobs').doc(jobId).update({
        status: 'completed',
        mockupUrl: mockupResult.mockupUrl,
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // If this job belongs to a packet, write the best mockup URL back to the
      // packet document so template cards always display a real printer mockup,
      // AND write the full mockupsByColor 3-level structure so the store can
      // serve per-color swatches via extractPacketMockups().
      if (job.productId && typeof job.productId === 'string' && job.productId.startsWith('packet_')) {
        const packetId = job.productId.slice('packet_'.length);
        try {
          const packetRef = db.collection('productPackets').doc(packetId);
          const packetSnap = await packetRef.get();
          if (packetSnap.exists) {
            const packetData = packetSnap.data() || {};
            const existingUrl: string | null = packetData.priorityMockupUrl || null;
            const bestUrl = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl || null;

            // Always write mockupsByColor so per-color swatches appear in the store.
            const colorKey = job.colorName.replace(/\s+/g, '_').toLowerCase();
            const placementKey = job.placement || 'front';
            const sizeKey = job.qrSize || 'large';
            await packetRef.update({
              [`mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`]: mockupResult.mockupUrl,
              [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleMockupUrl || null,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            console.log(`[Queue Background] Wrote mockupsByColor to packet ${packetId}: ${colorKey}/${placementKey}/${sizeKey}`);

            const isUpgrade =
              bestUrl &&
              (!existingUrl || (mockupResult.lifestyleMockupUrl && existingUrl !== mockupResult.lifestyleMockupUrl));
            if (isUpgrade) {
              await packetRef.update({ priorityMockupUrl: bestUrl });
              console.log(`[Queue Background] Updated packet ${packetId} priorityMockupUrl with ${mockupResult.lifestyleMockupUrl ? 'lifestyle' : 'flat'} mockup`);

              // Also prepend the mockup into the committed admin_catalog_instance, if one exists.
              // Chain: packet.ownerInstanceId → admin_catalog_instances doc → resolved.images
              const ownerInstanceId: string | null = packetData.ownerInstanceId || null;
              if (ownerInstanceId) {
                try {
                  const instanceRef = db.collection('admin_catalog_instances').doc(ownerInstanceId);
                  const instanceSnap = await instanceRef.get();
                  if (instanceSnap.exists) {
                    const instanceData = instanceSnap.data() || {};
                    const existingImages: string[] = instanceData.resolved?.images || [];
                    if (!existingImages[0] || existingImages[0] !== bestUrl) {
                      const filtered = existingImages.filter((img: string) => img !== bestUrl);
                      const newImages = [bestUrl, ...filtered];
                      await instanceRef.update({
                        'resolved.images': newImages,
                        'baseSnapshot.images': newImages,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                      });
                      console.log(`[Queue Background] Updated instance ${ownerInstanceId} resolved.images with mockup`);
                    }
                  }
                } catch (instanceErr: any) {
                  console.error(`[Queue Background] Failed to write-back mockup to instance ${ownerInstanceId}:`, instanceErr.message);
                }
              }
            }
          }
        } catch (packetErr: any) {
          console.error(`[Queue Background] Failed to write-back mockup to packet ${packetId}:`, packetErr.message);
        }
      }

      console.log(`[Queue Background] Completed: ${job.colorName}/${job.placement}/${job.qrSize}`);

    } catch (error: any) {
      console.error(`[Queue Background] Job ${jobId} failed:`, error.message);
      await db.collection('mockup_jobs').doc(jobId).update({
        status: 'failed',
        error: error.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  }
}

  export function register(app: express.Express): void {
  // ============ FILE UPLOAD (Firebase Storage) ============

app.post('/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await verifyAuth(req);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    res.json({
      success: false,
      message: 'File uploads should be done directly to Firebase Storage from the client using Firebase SDK',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ LIBRARY ASSETS (ADMIN) ============

app.get('/admin/background-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const typeFilter = (req.query.type as string) || 'source';
    const validTypes = ['source', 'cropped', 'background', 'template', 'design'];
    if (!validTypes.includes(typeFilter)) {
      res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      return;
    }
    console.log('[BackgroundAssets] GET request - type:', typeFilter);
    const snapshot = await db.collection('library_assets')
      .where('assetType', '==', typeFilter)
      .get();
    console.log('[BackgroundAssets] Raw docs for type', typeFilter, ':', snapshot.size);
    
    const assets = snapshot.docs
      .map(doc => docToObject(doc))
      .filter(doc => doc.isActive === true)
      .sort((a: any, b: any) => {
        const getTime = (val: any): number => {
          if (!val) return 0;
          if (typeof val === 'string') return new Date(val).getTime() || 0;
          if (val.toDate) return val.toDate().getTime();
          if (val._seconds) return val._seconds * 1000;
          if (val instanceof Date) return val.getTime();
          return 0;
        };
        return getTime(a.createdAt) - getTime(b.createdAt);
      })
      .map(data => {
        const storageUrl = data.storageUrl || '';
        const filename = storageUrl.split('/').pop() || data.fileName || '';
        return {
          ...data,
          proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
          publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
        };
      });
    
    console.log('[BackgroundAssets] Filtered assets:', assets.length);
    res.json(assets);
  } catch (error: any) {
    console.error('[BackgroundAssets] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/background-assets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  console.log('[BackgroundAssets] POST request received');
  try {
    const { name, assetType, imageData, mimeType, sourceAssetId, cropData, tags, fromZip } = req.body;
    console.log(`[BackgroundAssets] Uploading: ${name}, type: ${assetType}, fromZip: ${fromZip}, dataSize: ${imageData?.length || 0}`);
    
    if (!name || !assetType || !imageData) {
      console.log('[BackgroundAssets] Missing required fields');
      res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      return;
    }
    
    if (assetType !== 'source' && assetType !== 'cropped') {
      res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      return;
    }
    
    // Upload to Firebase Storage with organized paths
    // library/backgrounds/raw/ for individual uploads
    // library/backgrounds/raw/zip/ for ZIP uploads
    // library/backgrounds/cropped/ for cropped versions
    const bucket = storage.bucket();
    let folderPath: string;
    if (assetType === 'cropped') {
      folderPath = 'library/backgrounds/cropped';
    } else if (fromZip) {
      folderPath = 'library/backgrounds/raw/zip';
    } else {
      folderPath = 'library/backgrounds/raw';
    }
    const fileName = `${folderPath}/${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const ext = (mimeType || 'image/png').split('/')[1] || 'png';
    const fullPath = `${fileName}.${ext}`;
    
    const file = bucket.file(fullPath);
    const buffer = Buffer.from(imageData, 'base64');
    
    await file.save(buffer, {
      metadata: {
        contentType: mimeType || 'image/png',
      },
    });
    
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fullPath}`;
    
    // Save metadata to Firestore library_assets collection
    const fileNameOnly = fullPath.split('/').pop() || name;
    const proxyUrl = `/api/library-files/${encodeURIComponent(fileNameOnly)}`;
    const docRef = await db.collection('library_assets').add({
      ownerType: 'admin',
      assetType: assetType, // Use the requested type (source/cropped), not hardcoded
      mediaType: 'image',
      name,
      fileName: fullPath.split('/').pop() || name,
      originalName: name,
      mimeType: mimeType || 'image/png',
      sizeBytes: buffer.length,
      storageUrl: fullPath, // Relative path without gs:// prefix
      publicUrl: proxyUrl,
      sourceAssetId: sourceAssetId || null,
      cropData: cropData || null,
      tags: tags || null,
      isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    if (assetType === 'cropped' && sourceAssetId) {
      try {
        await db.collection('library_assets').doc(sourceAssetId).update({
          assetType: 'background',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`[BackgroundAssets] Source ${sourceAssetId} moved to background after crop`);
      } catch (moveErr: any) {
        console.error(`[BackgroundAssets] Failed to move source to background:`, moveErr.message);
      }
    }

    const doc = await docRef.get();
    console.log(`[BackgroundAssets] Upload complete: ${doc.id}`);
    res.json(docToObject(doc));
  } catch (error: any) {
    console.error("[BackgroundAssets] Upload error:", error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/background-assets/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    // Soft delete (set isActive to false)
    await db.collection('library_assets').doc(req.params.id).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync storage folder with database - creates DB records for existing files
app.post('/admin/background-assets/sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const folder = req.body.folder || 'library/backgrounds/raw';
    const assetType = folder.includes('cropped') ? 'cropped' : 'source';
    
    console.log(`[BackgroundAssets] Syncing folder: ${folder}`);
    
    // List all files in the storage folder
    const bucket = storage.bucket();
    const [files] = await bucket.getFiles({ prefix: folder + '/' });
    
    const storageFiles = files
      .filter(f => !f.name.endsWith('/'))
      .map(f => ({
        name: f.name.split('/').pop() || f.name,
        fullPath: f.name,
        contentType: f.metadata.contentType || 'application/octet-stream',
      }));
    
    console.log(`[BackgroundAssets] Found ${storageFiles.length} files in storage`);
    
    // Get existing records from Firestore library_assets - filter in memory to avoid index
    const existingSnapshot = await db.collection('library_assets').get();
    const existingPaths = new Set(
      existingSnapshot.docs
        .map(d => d.data())
        .filter(data => data.isActive === true && data.assetType === 'source')
        .map(data => data.storageUrl)
    );
    
    // Find files that don't have database records
    const newFiles = storageFiles.filter(f => !existingPaths.has(`gs://${bucket.name}/${f.fullPath}`));
    console.log(`[BackgroundAssets] ${newFiles.length} files need database records`);
    
    // Create database records for new files
    const createdAssets: any[] = [];
    for (const file of newFiles) {
      if (!file.contentType.startsWith('image/')) continue;
      
      try {
        const displayName = file.name.replace(/\.[^/.]+$/, '');
        const proxyUrl = `/api/library-files/${encodeURIComponent(file.name)}`;
        
        const docRef = await db.collection('library_assets').add({
          ownerType: 'admin',
          assetType: 'background',
          mediaType: 'image',
          name: displayName,
          fileName: file.name,
          originalName: file.name,
          mimeType: file.contentType,
          sizeBytes: 0,
          storageUrl: `gs://${bucket.name}/${file.fullPath}`,
          publicUrl: proxyUrl,
          sourceAssetId: null,
          cropData: null,
          tags: null,
          isActive: true,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        const doc = await docRef.get();
        createdAssets.push(docToObject(doc));
        console.log(`[BackgroundAssets] Created record for: ${file.name}`);
      } catch (err) {
        console.error(`[BackgroundAssets] Failed to create record for ${file.name}:`, err);
      }
    }
    
    res.json({
      scanned: storageFiles.length,
      existing: existingSnapshot.size,
      created: createdAssets.length,
      assets: createdAssets,
    });
  } catch (error: any) {
    console.error("Error syncing background assets:", error);
    res.status(500).json({ error: error.message });
  }
});


// ============ ADMIN LIBRARY ENDPOINTS ============

// Admin: Get admin-owned library assets
app.get('/admin/library/admin', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { assetType, mediaType, category, season, event } = req.query;
    let query: FirebaseFirestore.Query = db.collection('library_assets').where('ownerType', '==', 'admin');
    
    if (assetType) query = query.where('assetType', '==', assetType);
    if (mediaType) query = query.where('mediaType', '==', mediaType);
    if (category) query = query.where('category', '==', category);
    if (season) query = query.where('season', '==', season);
    if (event) query = query.where('event', '==', event);
    
    const snapshot = await query.get();
    const assets = docsToArray(snapshot);
    const assetsWithSignedUrls = await addSignedUrlsToAssets(assets);
    res.json(assetsWithSignedUrls);
  } catch (error: any) {
    console.error('[Library] Error fetching admin assets:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get library templates (custom designs saved to library)
app.get('/admin/library/templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('customDesigns')
      .where('savedToLibrary', '==', true)
      .get();
    const templates = docsToArray(snapshot);
    res.json(templates);
  } catch (error: any) {
    console.error('[Library] Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Update library asset
app.put('/admin/library/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('library_assets').doc(id).update(updateData);
    const doc = await db.collection('library_assets').doc(id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    console.error('[Library] Error updating asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Delete library asset
app.delete('/admin/library/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await db.collection('library_assets').doc(id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Library] Error deleting asset:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUBLIC TEST: Save graphics (QR-only and/or composite) to library - NO AUTH REQUIRED

// PUBLIC TEST: Get all templates - NO AUTH REQUIRED

// PUBLIC TEST: Create template linked to packet - NO AUTH REQUIRED

// PUBLIC TEST: Full template save with batch mockup generation - NO AUTH REQUIRED

// PUBLIC TEST: Create product packet (master record) - NO AUTH REQUIRED

// PUBLIC TEST: Get all product packets - NO AUTH REQUIRED

// PUBLIC TEST: Get product packet by ID - NO AUTH REQUIRED

// PUBLIC TEST: Update packet with final URLs - NO AUTH REQUIRED

// PUBLIC TEST: Delete packet - NO AUTH REQUIRED

// PUBLIC TEST: Get landing page by slug - NO AUTH REQUIRED

// PUBLIC TEST: Delete template - NO AUTH REQUIRED

// PUBLIC TEST: Upload content (composite or media) to Firebase Storage - NO AUTH REQUIRED

// PUBLIC TEST: Get mockups for a template - NO AUTH REQUIRED

// PUBLIC TEST: Get mockup queue status - NO AUTH REQUIRED

// PUBLIC TEST: Process pending mockup jobs - NO AUTH REQUIRED

// PUBLIC TEST: Get all store-product links (for debugging) - NO AUTH REQUIRED

// PUBLIC TEST: Create store-product link (package linking) - NO AUTH REQUIRED

// PUBLIC TEST: Update a store product link - NO AUTH REQUIRED

// PUBLIC TEST: Delete a store product link - NO AUTH REQUIRED


// Admin: Mint a GRF code and save a graphic asset to grf_assets
app.post('/admin/graphics/save-grf', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { typeCode, roleCode, imageUrl, name, description, mimeType, storagePath, sourceGrfId, relatedPacketId, tags } = req.body;

    if (!typeCode || !roleCode || !imageUrl) {
      res.status(400).json({ error: 'Missing required fields: typeCode, roleCode, imageUrl' });
      return;
    }

    const validTypeCodes = Object.keys(GRF_TYPE_MAP) as GrfTypeCode[];
    if (!validTypeCodes.includes(typeCode as GrfTypeCode)) {
      res.status(400).json({ error: `Invalid typeCode. Must be one of: ${validTypeCodes.join(', ')}` });
      return;
    }

    const entry = GRF_TYPE_MAP[typeCode as GrfTypeCode];
    if (!entry.validRoles.includes(roleCode as GrfRoleCode)) {
      res.status(400).json({
        error: `Role "${roleCode}" is not valid for typeCode "${typeCode}". Valid roles: ${entry.validRoles.join(', ')}`,
      });
      return;
    }

    // Atomically mint the next sequence number for this typeCode+roleCode pair
    const counterKey = grfCounterKey(typeCode as GrfTypeCode, roleCode as GrfRoleCode);
    const counterRef = db.collection('grf_counters').doc(counterKey);
    let newSeq = 0;
    await db.runTransaction(async (transaction: any) => {
      const doc = await transaction.get(counterRef);
      newSeq = (doc.exists ? (doc.data()!.count as number) : 0) + 1;
      transaction.set(counterRef, {
        count: newSeq,
        typeCode,
        roleCode,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    const grfId = buildGraphicId(typeCode as GrfTypeCode, roleCode as GrfRoleCode, newSeq);

    const now = admin.firestore.FieldValue.serverTimestamp();
    const assetData: Record<string, any> = {
      grfId,
      typeCode,
      roleCode,
      typeName: entry.label,
      name: name || `${entry.label} ${grfId}`,
      description: description || null,
      mimeType: mimeType || 'image/png',
      storagePath: storagePath || null,
      publicUrl: imageUrl,
      sourceGrfId: sourceGrfId || null,
      relatedPacketId: relatedPacketId || null,
      tags: tags || null,
      createdAt: now,
      createdBy: 'admin',
      isActive: true,
    };

    // Document ID = grfId (stable, human-readable key)
    await db.collection('grf_assets').doc(grfId).set(assetData);
    const doc = await db.collection('grf_assets').doc(grfId).get();

    console.log(`[GRF] Minted ${grfId} → grf_assets/${grfId}`);
    res.json({ success: true, grfId, asset: docToObject(doc) });
  } catch (error: any) {
    console.error('[GRF] Error saving graphic:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get GRF assets, optionally filtered by typeCode and/or roleCode.
// typeCode/roleCode are filtered in memory to avoid requiring composite Firestore indexes.
app.get('/admin/graphics', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { typeCode, roleCode } = req.query;
    const snapshot = await db.collection('grf_assets').where('isActive', '==', true).get();
    const getTime = (val: any): number => {
      if (!val) return 0;
      if (typeof val === 'string') return new Date(val).getTime() || 0;
      if (val.toDate) return val.toDate().getTime();
      if (val._seconds) return val._seconds * 1000;
      return 0;
    };
    const assets = snapshot.docs
      .map((doc: any) => docToObject(doc))
      .filter((a: any) => (!typeCode || a.typeCode === typeCode) && (!roleCode || a.roleCode === roleCode))
      .sort((a: any, b: any) => getTime(b.createdAt) - getTime(a.createdAt));
    res.json(assets);
  } catch (error: any) {
    console.error('[GRF] Error fetching graphics:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Archive (soft-delete) a GRF asset
app.patch('/admin/graphics/:grfId/archive', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { grfId } = req.params;
    const docRef = db.collection('grf_assets').doc(grfId);
    const doc = await docRef.get();
    if (!doc.exists) {
      res.status(404).json({ error: `GRF asset not found: ${grfId}` });
      return;
    }
    await docRef.update({ isActive: false, archivedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`[GRF] Archived ${grfId}`);
    res.json({ success: true, grfId });
  } catch (error: any) {
    console.error('[GRF] Error archiving graphic:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Get mockups for a template
app.get('/admin/templates/:templateId/mockups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId } = req.params;
    const jobsSnapshot = await db.collection('mockup_jobs')
      .where('templateId', '==', templateId)
      .get();

    const mockups = jobsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        status: data.status,
        color: data.color,
        size: data.size,
        placement: data.placement,
        mockupUrl: data.mockupUrl || null,
        error: data.error || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
      };
    });

    const completed = mockups.filter(m => m.status === 'completed');
    const pending = mockups.filter(m => m.status === 'pending');
    const processing = mockups.filter(m => m.status === 'processing');
    const failed = mockups.filter(m => m.status === 'failed');

    res.json({
      success: true,
      templateId,
      summary: {
        total: mockups.length,
        completed: completed.length,
        pending: pending.length,
        processing: processing.length,
        failed: failed.length,
      },
      mockups,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Admin: Full template save with batch mockup generation
app.post('/admin/templates/full-save', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { colors = [], placements = ['front', 'back'], placementMethods = {}, ...templateFields } = req.body;

    const templateKeys = ['name', 'description', 'category', 'productId', 'blueprintId', 'printProviderId',
      'fulfillmentProvider', 'artworkUrl', 'artworkVariant', 'thumbnailUrl', 'qrContent', 'pricing', 'packetId',
      'graphicLayoutMode', 'qrSizePercent', 'qrPositionX', 'qrPositionY',
      'productName', 'headerText', 'footerText', 'headerStyle', 'footerStyle',
      'subBottomEnabled', 'subBottomText', 'subBottomFontFamily', 'subBottomFontSize', 'subBottomFontWeight', 'subBottomColor',
      'backgroundUrl', 'qrProductState', 'areaImageUrl', 'areaImageMode', 'areaImageOffsetX', 'areaImageOffsetY', 'areaImageScale',
      'placements', 'placementConfig', 'placementSizes', 'placementMethods',
      'defaultColor', 'defaultColorHex', 'landingPageTitle', 'landingPageDescription'];
    const template: Record<string, any> = {};
    for (const key of templateKeys) {
      if (templateFields[key] !== undefined) template[key] = templateFields[key];
    }

    if (!template.name && !template.productId) {
      res.status(400).json({ error: 'Template data is required' });
      return;
    }

    const now = admin.firestore.FieldValue.serverTimestamp();

    const templateData = {
      ...template,
      placements,
      placementMethods,
      createdAt: now,
      updatedAt: now,
    };
    const templateRef = await db.collection('productTemplates').add(templateData);
    const templateId = templateRef.id;

    // Queue mockup generation jobs for each color × placement × qr size combo
    const qrSizes = ['small', 'medium', 'large'];
    let jobsQueued = 0;

    for (const color of colors) {
      for (const placement of placements) {
        // For front/back, generate all 3 QR sizes; for other placements, only large
        const sizesToGenerate = (placement === 'front' || placement === 'back') ? qrSizes : ['large'];
        
        for (const qrSize of sizesToGenerate) {
          const jobData: Record<string, any> = {
            templateId,
            colorName: color.name,
            colorHex: color.hex,
            placement,
            qrSize,
            status: 'pending',
            createdAt: now,
            fulfillmentProvider: template.fulfillmentProvider || 'printify',
          };
          if (placementMethods[placement]) {
            jobData.printMethod = placementMethods[placement];
          }
          await db.collection('mockup_jobs').add(jobData);
          jobsQueued++;
        }
      }
    }

    console.log(`[Templates] Full save complete: template=${templateId}, ${jobsQueued} mockup jobs queued`);

    // Trigger queue processing in background (fire and forget)
    if (jobsQueued > 0) {
      processQueueInBackground().catch(err => {
        console.error('[Templates] Background queue processing error:', err.message);
      });
    }

    res.json({
      success: true,
      templateId,
      jobsQueued,
      message: `Template saved with ${jobsQueued} mockup jobs queued`,
    });
  } catch (error: any) {
    console.error('[Templates] Error in full save:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============ ADMIN IMAGE LIBRARY (with folders) ============

app.get('/admin/images', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const folder = (req.query.folder as string) || '';
    console.log('[AdminImages] GET request - folder filter:', folder || '(all)');
    const snap = await db.collection('admin_images').get();
    console.log('[AdminImages] Raw docs:', snap.size);
    const images = snap.docs
      .map(doc => {
        const data = doc.data();
        const filename = (data.storageUrl || '').split('/').pop() || '';
        return {
          id: doc.id,
          ...data,
          proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
        };
      })
      .filter((img: any) => img.isActive !== false)
      .filter((img: any) => !folder || img.folder === folder)
      .sort((a: any, b: any) => {
        const getTime = (val: any): number => {
          if (!val) return 0;
          if (val._seconds) return val._seconds * 1000;
          if (val.toDate) return val.toDate().getTime();
          if (typeof val === 'string') return new Date(val).getTime() || 0;
          return 0;
        };
        return getTime(b.createdAt) - getTime(a.createdAt);
      });
    console.log('[AdminImages] Filtered images:', images.length);
    res.json(images);
  } catch (error: any) {
    console.error('[AdminImages] List error:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/images/folders', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const [imgSnap, folderSnap] = await Promise.all([
      db.collection('admin_images').get(),
      db.collection('admin_image_folders').get(),
    ]);
    const folderSet = new Set<string>();
    folderSnap.docs.forEach(doc => {
      const name = doc.data().name;
      if (name) folderSet.add(name);
    });
    imgSnap.docs.forEach(doc => {
      const data = doc.data();
      if (data.isActive === false) return;
      const f = data.folder;
      if (f) folderSet.add(f);
    });
    const folders = Array.from(folderSet).sort();
    res.json(folders);
  } catch (error: any) {
    console.error('[AdminImages] Folders error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/images/folders', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Folder name is required' });
      return;
    }
    const trimmed = name.trim().replace(/\s{2,}/g, ' ');
    if (trimmed.length > 80) {
      res.status(400).json({ error: 'Folder name must be 80 characters or less' });
      return;
    }
    const normalizedName = trimmed.toLowerCase();
    const allFolders = await db.collection('admin_image_folders').get();
    const match = allFolders.docs.find(doc => (doc.data().name || '').trim().toLowerCase() === normalizedName);
    if (match) {
      const existingName = match.data().name;
      res.json({ ok: true, folder: existingName, created: false });
      return;
    }
    await db.collection('admin_image_folders').add({ name: trimmed, normalizedName, createdAt: new Date().toISOString() });
    console.log('[AdminImages] Folder created:', trimmed);
    res.json({ ok: true, folder: trimmed, created: true });
  } catch (error: any) {
    console.error('[AdminImages] Create folder error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/images', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) { res.status(400).json({ error: 'Expected multipart/form-data' }); return; }
    const boundary = boundaryMatch[1];
    const rawBody = (req as any).rawBody || Buffer.from(req.body || '');
    if (!rawBody || rawBody.length === 0) { res.status(400).json({ error: 'No request body' }); return; }
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts: Buffer[] = [];
    let start = 0;
    while (true) {
      const idx = rawBody.indexOf(boundaryBuffer, start);
      if (idx === -1) break;
      if (start > 0) parts.push(rawBody.slice(start, idx - 2));
      start = idx + boundaryBuffer.length + 2;
    }
    let fileBuffer: Buffer | null = null;
    let fileMimeType = 'image/png';
    let fieldName = '';
    let fieldFolder = 'general';
    for (const part of parts) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;
      const hdrs = part.slice(0, headerEnd).toString();
      const body = part.slice(headerEnd + 4);
      const filenameMatch = hdrs.match(/filename="([^"]+)"/);
      const ctMatch = hdrs.match(/Content-Type:\s*([^\r\n]+)/i);
      const nameMatch = hdrs.match(/name="([^"]+)"/);
      if (filenameMatch) {
        fileBuffer = body;
        if (ctMatch) fileMimeType = ctMatch[1].trim();
      } else if (nameMatch) {
        const val = body.toString().trim();
        if (nameMatch[1] === 'name') fieldName = val;
        if (nameMatch[1] === 'folder') fieldFolder = val;
      }
    }
    if (!fileBuffer || fileBuffer.length === 0) { res.status(400).json({ error: 'No file in upload' }); return; }
    const name = fieldName || `image-${Date.now()}`;
    const folder = fieldFolder || 'general';
    const bucket = storage.bucket();
    const ext = fileMimeType.split('/')[1] || 'png';
    const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fullPath = `library/images/${folder}/${Date.now()}-${safeName}.${ext}`;
    console.log(`[AdminImages] Upload native file: ${name} -> ${fullPath} (${fileBuffer.length} bytes)`);
    const file = bucket.file(fullPath);
    await file.save(fileBuffer, { metadata: { contentType: fileMimeType } });
    await file.makePublic();
    const fileNameOnly = fullPath.split('/').pop() || safeName;
    const proxyUrl = `/api/library-files/${encodeURIComponent(fileNameOnly)}`;
    const docRef = await db.collection('admin_images').add({
      name, folder, mimeType: fileMimeType, sizeBytes: fileBuffer.length,
      storageUrl: fullPath, publicUrl: proxyUrl, isActive: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json({ id: doc.id, ...doc.data(), proxyUrl });
  } catch (error: any) {
    console.error('[AdminImages] Native upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/images/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { folder, name } = req.body;
    const updates: Record<string, any> = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    if (folder !== undefined) updates.folder = folder;
    if (name !== undefined) updates.name = name;
    await db.collection('admin_images').doc(req.params.id).update(updates);
    res.json({ success: true });
  } catch (error: any) {
    console.error('[AdminImages] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/images/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('admin_images').doc(req.params.id).update({
      isActive: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true });
  } catch (error: any) {
    console.error('[AdminImages] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});


  }
  