import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import * as jwt from 'jsonwebtoken';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF, WIDGET_JWT_SECRET, WIDGET_API_KEY, KC_API_KEY } from '../core';
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
  // ============ WIDGET API ============

function signWidgetToken(payload: any): string {
  if (!WIDGET_JWT_SECRET) {
    throw new Error('WIDGET_JWT_SECRET not configured');
  }
  return jwt.sign(payload, WIDGET_JWT_SECRET, { expiresIn: '1h' });
}

function verifyWidgetToken(token: string): any {
  try {
    if (!WIDGET_JWT_SECRET) {
      return null;
    }
    return jwt.verify(token, WIDGET_JWT_SECRET);
  } catch {
    return null;
  }
}

app.get('/widget/session', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.query.token as string;
    
    if (!token) {
      res.status(400).json({ error: 'Token required' });
      return;
    }

    const payload = verifyWidgetToken(token);
    
    if (!payload) {
      res.status(401).json({ error: 'Invalid or expired token' });
      return;
    }

    const snapshot = await db.collection('products')
      .where('isEnabled', '==', true)
      .limit(6)
      .get();
    
    const featuredProducts = snapshot.docs.map(doc => {
      const p = doc.data();
      return {
        id: doc.id,
        name: p.name,
        imageUrl: p.imageUrl || '',
        basePrice: p.basePrice,
        category: p.category,
      };
    });

    res.json({
      businessName: payload.businessName,
      businessLogoUrl: payload.businessLogoUrl,
      kcListingUrl: payload.kcListingUrl,
      products: featuredProducts,
    });
  } catch (error: any) {
    console.error('Widget session error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/widget/token', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKey = req.headers['x-api-key'] || (req.headers['authorization'] as string)?.replace('Bearer ', '');
    
    if (!WIDGET_API_KEY || apiKey !== WIDGET_API_KEY) {
      res.status(401).json({ error: 'Invalid or missing API key' });
      return;
    }

    const { businessName, businessLogoUrl, kcListingUrl } = req.body;
    
    if (!businessName || !kcListingUrl) {
      res.status(400).json({ error: 'businessName and kcListingUrl are required' });
      return;
    }

    const token = signWidgetToken({ businessName, businessLogoUrl, kcListingUrl });
    
    res.json({ 
      token,
      expiresIn: 3600
    });
  } catch (error: any) {
    console.error('Widget token error:', error);
    res.status(500).json({ error: error.message });
  }
});

// KC Widget Items endpoint - used by Kingdom Connects widget embed
app.get('/widget/items', async (req: Request, res: Response): Promise<void> => {
  try {
    // Check KC_API_KEY authentication
    const authHeader = req.headers.authorization;
    const apiKey = req.headers['x-api-key'] as string;
    
    const providedKey = apiKey || (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader);
    
    if (!KC_API_KEY || providedKey !== KC_API_KEY) {
      res.status(401).json({ error: 'Invalid or missing API key' });
      return;
    }
    
    const channelId = req.query.channelId as string;
    const storeId = req.query.storeId as string || 'kingdom_connects';
    
    if (!channelId) {
      res.status(400).json({ error: 'channelId is required' });
      return;
    }
    
    // Query channel items from Firestore
    const snapshot = await db.collection('catalogItemLinks')
      .where('channelId', '==', channelId)
      .where('status', '==', 'published')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    
    const items = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        title: data.title || data.name,
        description: data.description,
        previewUrl: data.previewUrl || data.thumbnailUrl,
        publicUrl: data.publicUrl,
        createdAt: data.createdAt?.toDate?.() || data.createdAt,
        shareImageSquareUrl: data.shareImageSquareUrl,
        shareImageLinkUrl: data.shareImageLinkUrl,
        shareCaption: data.shareCaption,
      };
    });
    
    res.json({
      channelId,
      storeId,
      items,
      count: items.length,
    });
  } catch (error: any) {
    console.error('Widget items error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============ BATCH: WIDGET ROUTES ============

app.get('/widget/events', async (req: Request, res: Response): Promise<void> => {
  res.json({ events: [
    { type: 'qrgear:ready', description: 'Widget loaded' },
    { type: 'qrgear:height', description: 'Height changed' },
    { type: 'qrgear:navigate', description: 'User clicked return' },
    { type: 'qrgear:item_click', description: 'User clicked item' },
    { type: 'qrgear:item_share', description: 'User shared item' },
    { type: 'qrgear:publish_success', description: 'Product published' },
  ]});
});

app.get('/widget/mosaics/:mosaicId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('site_programs').doc(req.params.mosaicId).get();
    if (!doc.exists) { res.status(404).json({ ok: false, error: "Mosaic not found" }); return; }
    res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() }, program: { id: doc.id, ...doc.data() } });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/mosaics/:mosaicId/moments', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('site_programs').doc(req.params.mosaicId).get();
    if (!doc.exists) { res.status(404).json({ ok: false, error: "Mosaic not found" }); return; }
    const entries = doc.data()?.entries || [];
    const moments = entries.sort((a: any, b: any) => a.day - b.day);
    res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() }, program: { id: doc.id, ...doc.data() }, moments });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/widget/mosaics', async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await db.collection('site_programs').add({ ...req.body, createdAt: new Date(), status: 'draft' });
    const doc = await ref.get();
    res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() }, program: { id: doc.id, ...doc.data() } });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/widget/mosaics/:mosaicId', async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('site_programs').doc(req.params.mosaicId).update(req.body);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/stores/:storeId/mosaics', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('site_programs').where('storeId', '==', req.params.storeId).get();
    res.json({ ok: true, mosaics: snap.docs.map(d => ({ id: d.id, ...d.data() })), programs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/programs/:programId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('site_programs').doc(req.params.programId).get();
    if (!doc.exists) { res.status(404).json({ ok: false, error: "Mosaic not found" }); return; }
    res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() }, program: { id: doc.id, ...doc.data() } });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/programs/:programId/moments', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('site_programs').doc(req.params.programId).get();
    if (!doc.exists) { res.status(404).json({ ok: false, error: "Mosaic not found" }); return; }
    const entries = doc.data()?.entries || [];
    const moments = entries.sort((a: any, b: any) => a.day - b.day);
    res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() }, program: { id: doc.id, ...doc.data() }, moments });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/widget/programs', async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await db.collection('site_programs').add({ ...req.body, createdAt: new Date(), status: 'draft' });
    const doc = await ref.get();
    res.json({ ok: true, mosaic: { id: doc.id, ...doc.data() }, program: { id: doc.id, ...doc.data() } });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/widget/programs/:programId', async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('site_programs').doc(req.params.programId).update(req.body);
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/stores/:storeId/programs', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('site_programs').where('storeId', '==', req.params.storeId).get();
    res.json({ ok: true, mosaics: snap.docs.map(d => ({ id: d.id, ...d.data() })), programs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/widget/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.query.token as string;
    if (!token) { res.json({ valid: false, error: "No token" }); return; }
    res.json({ valid: true, payload: { token } });
  } catch (e: any) { res.json({ valid: false, error: e.message }); }
});


  }
  