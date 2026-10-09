import { resolveSaleItem } from '../services/order-fulfillment';
import { registerStoreProductRoutes } from "../services/store-products";
import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
  import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
  import { printfulClient } from '../services/printful';
  import type { CustomizationPricing } from '../services/pricing';
  import { printifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE } from '../services/printify';
  import { generateSignedUrl, addSignedUrlsToAssets, downloadAndStoreImage } from '../services/storage-helpers';
  import { calculateAuthoritativePrice, getAuthoritativePrice } from '../services/pricing';
  import { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS } from '../services/mockup-generator';
  import type { MockupRequest, MockupResult } from '../services/mockup-generator';
  import { getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulStoreId, PRINTFUL_API_BASE } from '../services/printful';
  import type { PrintfulMockupTask, PrintfulVariant } from '../services/printful';
  import { getResendClient, QR_GEAR_FROM_EMAIL } from '../services/email';
  import { cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE, getCanvas, getQRCode } from '../services/composite-image';
  import Stripe from 'stripe';
  import { registerCoreCheckoutRoutes } from './core-routes-checkout';

  export function register(app: express.Express): void {
  registerCoreCheckoutRoutes(app);
  registerStoreProductRoutes(app, "", requireAdmin, () => db);
  app.get('/health', (_req: Request, res: Response): void => {
  res.json({ 
    status: 'ok', 
    mode: 'firebase-functions', 
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    buildId: process.env.QRGEAR_BUILD_ID || 'unknown',
  });
});


app.get('/products', async (req: Request, res: Response): Promise<void> => {
  try {
    const featured = req.query.featured === 'true';
    let query: FirebaseFirestore.Query = db.collection('products').where('isEnabled', '==', true);
    if (featured) {
      query = query.where('isFeatured', '==', true);
    }
    const snapshot = await query.get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/products/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('products').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/designs/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Design not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/auth/user', async (req: Request, res: Response): Promise<void> => {
  try {
    const decodedToken = await verifyAuth(req);
    if (!decodedToken) {
      // Return null instead of 401 for unauthenticated requests
      res.json(null);
      return;
    }

    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    
    if (!userDoc.exists) {
      const newUser = {
        // Engine/custom-token accounts may have neither optional identity field.
        // Firestore rejects undefined values, which otherwise leaves /auth/user null.
        email: decodedToken.email || null,
        displayName: decodedToken.name || decodedToken.email?.split('@')[0] || null,
        isAdmin: ADMIN_USER_IDS.includes(decodedToken.uid),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('users').doc(decodedToken.uid).set(newUser);
      res.json({ ...newUser, id: decodedToken.uid });
      return;
    }

    // Merge Firestore data with isAdmin check from both sources
    const userData = docToObject(userDoc);
    const isAdmin = userData.isAdmin === true || ADMIN_USER_IDS.includes(decodedToken.uid);
    res.json({ ...userData, isAdmin });
  } catch (error: any) {
    // Return null on error instead of 401
    console.error('[/auth/user] Error:', error.message);
    res.json(null);
  }
});

app.get('/cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('cartItems').where('userId', '==', userId).get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/cart', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const { customization, quantity = 1 } = req.body;
    const resolved = await resolveSaleItem({ customization, quantity });
    const cartItem = { customization: { ...customization, ...resolved.customization }, productId: resolved.productId,
      quantity: resolved.quantity, price: resolved.price, userId, createdAt: admin.firestore.FieldValue.serverTimestamp() };

    const docRef = await db.collection('cartItems').add(cartItem);
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/cart/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { quantity } = req.body;
    if (!Number.isSafeInteger(quantity) || quantity <= 0) { res.status(400).json({ error: 'Choose a positive whole-number quantity.' }); return; }
    const current = await db.collection('cartItems').doc(req.params.id).get();
    if (!current.exists || current.data()?.userId !== (req as any).user.uid) { res.status(404).json({ error: 'Cart item not found' }); return; }
    await current.ref.update({ quantity });
    const doc = await db.collection('cartItems').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/cart/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const current = await db.collection('cartItems').doc(req.params.id).get();
    if (!current.exists || current.data()?.userId !== (req as any).user.uid) { res.status(404).json({ error: 'Cart item not found' }); return; }
    await current.ref.delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.uid;
    const snapshot = await db.collection('orders')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/orders/:id', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    if (doc.data()?.userId !== (req as any).user.uid) { res.status(403).json({ error: 'This order belongs to another account.' }); return; }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/orders', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  res.status(409).json({ error: 'Orders are created by checkout after server-side product validation.' });
});

app.get('/qr-templates', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('qrTemplates').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/qr-templates/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('qrTemplates').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'QR Template not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/hosting-tiers', async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('hostingTiers').orderBy('sortOrder', 'asc').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/stores/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('partnerStores')
      .where('slug', '==', req.params.slug)
      .limit(1)
      .get();
    if (snapshot.empty) {
      res.status(404).json({ error: 'Store not found' });
      return;
    }
    res.json(docToObject(snapshot.docs[0]));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('settings').doc('admin').get();
    res.json(doc.exists ? doc.data() : {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



app.get('/stripe/publishable-key', async (_req: Request, res: Response): Promise<void> => {
  const key = process.env.STRIPE_PUBLISHABLE_KEY || process.env.VITE_STRIPE_PUBLISHABLE_KEY;
  if (!key) {
    res.status(500).json({ error: 'Stripe not configured' });
    return;
  }
  res.json({ publishableKey: key });
});

}
