import { createAdminImageLibrary } from '../services/admin-image-library';
import { registerAdminImageRoutes } from '../services/admin-image-routes';
import { buildPacketImageOrder, instanceCatalogImages } from "../../../shared/productImages";
import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
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
              await packetRef.update({
                priorityMockupUrl: bestUrl,
                ...(mockupResult.lifestyleMockupUrl ? { lifestyleMockupUrl: mockupResult.lifestyleMockupUrl } : {}),
              });
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
                    const newImages = buildPacketImageOrder({
                      ...packetData,
                      priorityMockupUrl: bestUrl,
                      lifestyleMockupUrl: mockupResult.lifestyleMockupUrl || packetData.lifestyleMockupUrl,
                    }, instanceCatalogImages(instanceData));
                    await instanceRef.update({
                      'resolved.images': newImages,
                      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
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


// GRF asset routes live exclusively in admin-graphics.ts (registered after this file).
// admin-graphics.ts is the single source of truth — imports from GRF_engine,
// handles GET /admin/graphics, POST /admin/graphics/save-grf,
// and PATCH /admin/graphics/:grfId/archive.

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

    const templateKeys = ['builderSnapshot', 'name', 'description', 'category', 'productId', 'blueprintId', 'printProviderId',
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


registerAdminImageRoutes(app, '/admin', requireAdmin, createAdminImageLibrary({ db, bucket: () => storage.bucket(), now: () => admin.firestore.FieldValue.serverTimestamp() }));

}
