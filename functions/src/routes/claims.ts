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

  export function register(app: express.Express): void {
  // ============ CLAIM CODE SYSTEM ============

interface ClaimCode {
  claimCode: string;
  templateId: string;
  packetType: 'qr_canvas' | 'qr_play' | 'qr_doc' | 'qr_basics' | 'qr_plus';
  productName: string;
  productDescription?: string;
  previewImageUrl?: string;
  status: 'unclaimed' | 'claimed' | 'expired';
  instanceId?: string;
  claimedByUserId?: string;
  claimedAt?: string;
  createdAt: string;
  expiresAt?: string;
  metadata?: Record<string, any>;
}

function generateNanoId(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Validate claim code
app.get('/claim/validate/:claimCode', async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimCode } = req.params;
    const doc = await db.collection('claimCodes').doc(claimCode).get();
    
    if (!doc.exists) {
      res.json({ valid: false, reason: 'Claim code not found' });
      return;
    }
    
    const claimData = doc.data() as ClaimCode;
    
    if (claimData.status === 'claimed') {
      res.json({ valid: false, reason: 'This item has already been claimed' });
      return;
    }
    
    if (claimData.status === 'expired') {
      res.json({ valid: false, reason: 'This claim code has expired' });
      return;
    }
    
    if (claimData.expiresAt && new Date(claimData.expiresAt) < new Date()) {
      await db.collection('claimCodes').doc(claimCode).update({ status: 'expired' });
      res.json({ valid: false, reason: 'This claim code has expired' });
      return;
    }
    
    res.json({ valid: true, claimData });
  } catch (error: any) {
    console.error('[Claim] Validation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim an item
app.post('/claim/:claimCode', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { claimCode } = req.params;
    const userId = (req as any).user?.uid;
    const userEmail = (req as any).user?.email;
    
    const doc = await db.collection('claimCodes').doc(claimCode).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Claim code not found' });
      return;
    }
    
    const claimData = doc.data() as ClaimCode;
    
    if (claimData.status !== 'unclaimed') {
      res.status(400).json({ error: 'This item has already been claimed or expired' });
      return;
    }
    
    const instanceId = generateNanoId(16);
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
    
    const instanceData = {
      instanceId,
      claimCode,
      templateId: claimData.templateId || '',
      packetType: claimData.packetType,
      ownerUserId: userId,
      ownerEmail: userEmail || null,
      productName: claimData.productName,
      productDescription: claimData.productDescription || null,
      previewImageUrl: claimData.previewImageUrl || null,
      destinationUrl: null,
      customConfig: null,
      status: 'active',
      hostingExpiresAt: oneYearFromNow.toISOString(),
      remindersSent: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      claimedAt: now.toISOString(),
      metadata: claimData.metadata || null,
    };
    
    const batch = db.batch();
    batch.set(db.collection('claimedInstances').doc(instanceId), instanceData);
    batch.update(db.collection('claimCodes').doc(claimCode), {
      status: 'claimed',
      instanceId,
      claimedByUserId: userId,
      claimedAt: now.toISOString(),
    });
    
    await batch.commit();
    
    console.log(`[Claim] Item claimed: ${claimCode} -> Instance: ${instanceId} by User: ${userId}`);
    res.json({ success: true, instanceId });
  } catch (error: any) {
    console.error('[Claim] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's claimed instances
app.get('/claimed-instances', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const snapshot = await db.collection('claimedInstances')
      .where('ownerUserId', '==', userId)
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const instances = snapshot.docs.map(doc => doc.data());
    res.json(instances);
  } catch (error: any) {
    console.error('[Claim] Get instances error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single claimed instance
app.get('/claimed-instances/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection('claimedInstances').doc(instanceId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }
    
    const instance = doc.data();
    const isActive = instance?.status === 'active' && new Date(instance?.hostingExpiresAt) > new Date();
    
    res.json({ ...instance, isActive });
  } catch (error: any) {
    console.error('[Claim] Get instance error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update claimed instance destination
app.patch('/claimed-instances/:instanceId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { destinationUrl } = req.body;
    const userId = (req as any).user?.uid;
    
    const doc = await db.collection('claimedInstances').doc(instanceId).get();
    
    if (!doc.exists) {
      res.status(404).json({ error: 'Instance not found' });
      return;
    }
    
    const instance = doc.data();
    if (instance?.ownerUserId !== userId) {
      res.status(403).json({ error: 'Not authorized to modify this instance' });
      return;
    }
    
    await db.collection('claimedInstances').doc(instanceId).update({
      destinationUrl,
      updatedAt: new Date().toISOString(),
    });
    
    res.json({ success: true });
  } catch (error: any) {
    console.error('[Claim] Update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Admin: Generate claim codes
app.post('/admin/claim-codes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { templateId, packetType, productName, productDescription, previewImageUrl, count = 1 } = req.body;
    
    if (!templateId || !packetType || !productName) {
      res.status(400).json({ error: 'templateId, packetType, and productName are required' });
      return;
    }
    
    const codes: ClaimCode[] = [];
    const batch = db.batch();
    
    for (let i = 0; i < Math.min(count, 100); i++) {
      const claimCode = generateNanoId(12);
      const claimData: ClaimCode = {
        claimCode,
        templateId,
        packetType,
        productName,
        productDescription,
        previewImageUrl,
        status: 'unclaimed',
        createdAt: new Date().toISOString(),
      };
      
      batch.set(db.collection('claimCodes').doc(claimCode), claimData);
      codes.push(claimData);
    }
    
    await batch.commit();
    
    console.log(`[Claim] Generated ${codes.length} claim codes for template: ${templateId}`);
    res.json({ 
      message: `Generated ${codes.length} claim codes`,
      codes: count === 1 ? codes[0] : codes,
    });
  } catch (error: any) {
    console.error('[Claim] Generate codes error:', error);
    res.status(500).json({ error: error.message });
  }
});


  }
  