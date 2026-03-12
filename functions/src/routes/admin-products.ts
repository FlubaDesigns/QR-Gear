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
  // ============ ALLOWED PRODUCTS ============

app.get('/admin/stores/:storeId/allowed-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const doc = await db.collection('storeAllowedProducts').doc(storeId).get();
    if (!doc.exists) { res.json({ storeId, products: [] }); return; }
    const data = doc.data();
    res.json({ storeId, products: data?.products || [], updatedAt: data?.updatedAt });
  } catch (error: any) {
    console.error('[AllowedProducts] GET error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/stores/:storeId/allowed-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId } = req.params;
    const { products } = req.body;
    if (!Array.isArray(products)) { res.status(400).json({ error: 'products must be an array' }); return; }
    await db.collection('storeAllowedProducts').doc(storeId).set({
      storeId,
      products,
      updatedAt: new Date().toISOString(),
    });
    res.json({ success: true, storeId, productCount: products.length });
  } catch (error: any) {
    console.error('[AllowedProducts] POST error:', error);
    res.status(500).json({ error: error.message });
  }
});


// ============ ADMIN PRODUCT VARIANTS ============

app.get('/admin/products/:id/variants', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const snapshot = await db.collection('productVariants')
      .where('productId', '==', id)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/variants/:id/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const doc = await db.collection('productVariants').doc(id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Variant not found' });
      return;
    }
    const current = doc.data()!;
    await db.collection('productVariants').doc(id).update({
      isEnabled: !current.isEnabled,
    });
    const updated = await db.collection('productVariants').doc(id).get();
    res.json(docToObject(updated));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ ADMIN CATALOG ============

app.get('/admin/catalog/blueprints', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('printifyBlueprints').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog/blueprints/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('printifyBlueprints').doc(req.params.id).get();
    if (!doc.exists) {
      res.status(404).json({ error: 'Blueprint not found' });
      return;
    }
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ CUSTOM DESIGNS (ADMIN) ============

app.get('/admin/designs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('customDesigns')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/designs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('customDesigns').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).update({
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await db.collection('customDesigns').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('customDesigns').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ QR TEMPLATES ============

app.post('/admin/qr-templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('qrTemplates').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/admin/qr-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('qrTemplates').doc(req.params.id).update(req.body);
    const doc = await db.collection('qrTemplates').doc(req.params.id).get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/qr-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('qrTemplates').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ LIBRARY ASSETS (TEST - NO AUTH) ============



// Test DELETE endpoint (no auth)

// ============ TEST PRODUCTS ENDPOINTS (no auth) ============

// Get fulfillment provider status (which providers are configured)

// Get all products (test endpoint) - supports provider filter

// Sync products from Printify (test endpoint - placeholder)

// Update product (test endpoint - no auth required)

// Get stores by role type (test endpoint - no /admin segment for test routes) - uses Firestore

// Create a new store (test endpoint) - uses Firestore

// Delete a store (test endpoint) - uses Firestore

// Get store by ID (test endpoint) - checks both stores and partnerStores collections

// Get channels for a store (test endpoint)

// Create a new channel for a store

// Delete a channel

// Test endpoint: stores by type (internal/external/member) for store library

// Test endpoint: partner-stores (no auth required) - mirrors admin endpoint for save funnel testing

// Test endpoint: Get products for a partner store (no auth required)

// Test endpoint: Sync products to a partner store (no auth required)

// Brands known to manufacture garments in the USA
const TEST_USA_MADE_BRANDS = [
  'american apparel', 'royal apparel', 'bayside', 'los angeles apparel',
  'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage',
  'shaka wear', 'backpacks usa', 'american giant', 'next level',
];

// Known Printify Blueprint IDs that have proper Printful mockup mappings (not fallback)
const KNOWN_MOCKUP_BLUEPRINT_IDS: Set<number> = new Set([
  // T-SHIRTS (US-MADE)
  6, 12,    // Bella+Canvas 3001
  5,        // Next Level 3600
  48,       // Bella+Canvas 3005 V-Neck
  184,      // Bella+Canvas 3413 Tri-Blend
  420,      // Bella+Canvas 3001Y Youth
  580,      // Bella+Canvas 3001T Toddler
  472,      // Bella+Canvas 6400 Women's
  145,      // Gildan 64000
  // TANK TOPS (US-MADE)
  39, 91,   // Bella+Canvas 3480 Unisex Tank
  47,       // Bella+Canvas 8803 Women's Muscle Tank
  18,       // Next Level 1533 Women's Racerback
  141,      // Next Level 6733 Women's Tri-Blend Racerback
  // LONG SLEEVES (US-MADE)
  41, 301,  // Bella+Canvas 3501
  45,       // Next Level 3601
  66,       // Gildan 2400
  // HOODIES & SWEATSHIRTS (US-MADE)
  175, 394, // Bella+Canvas 3719 Pullover Hoodie
  439,      // Lane Seven LS14001 Hoodie
  445,      // Lane Seven LS14003 Zip Hoodie
  446,      // Lane Seven LS14004 Crewneck
  77,       // Gildan 18500 Heavy Blend Hoodie
  76,       // Gildan 18000 Crewneck Sweatshirt
  // HATS
  384,      // Yupoong 6245CM Dad Hat
  297,      // Yupoong 6089M Snapback
  // MUGS
  68,       // 11oz White Mug
  69,       // 15oz White Mug
  // BAGS
  456,      // Liberty Bags 8502 Canvas Tote
  // ACCESSORIES
  502, 503, // Stickers
]);

// Test endpoint: Printify catalog (no auth required) - v2 with price fields from providers

// Helper to normalize Printful product types into proper categories
function normalizePrintfulCategory(type: string, title: string): string {
  const text = `${type} ${title}`.toLowerCase();
  
  // Check for specific product types (order matters - more specific first)
  if (text.includes('hoodie') || text.includes('hood')) return 'Hoodies';
  if (text.includes('sweatshirt') || text.includes('crewneck') || text.includes('crew neck')) return 'Sweatshirts';
  if (text.includes('sweatpants') || text.includes('jogger')) return 'Sweatpants';
  if (text.includes('tank top') || text.includes('tank')) return 'Tank Tops';
  if (text.includes('long sleeve') || text.includes('longsleeve')) return 'Long Sleeve Shirts';
  if (text.includes('t-shirt') || text.includes('tee') || text.includes('tshirt')) return 'T-Shirts';
  if (text.includes('polo')) return 'Polos';
  if (text.includes('jacket') || text.includes('windbreaker')) return 'Jackets';
  if (text.includes('hat') || text.includes('cap') || text.includes('beanie') || text.includes('trucker')) return 'Hats';
  if (text.includes('bag') || text.includes('tote') || text.includes('backpack') || text.includes('duffel')) return 'Bags';
  if (text.includes('mug') || text.includes('tumbler') || text.includes('bottle')) return 'Drinkware';
  if (text.includes('poster') || text.includes('print') || text.includes('canvas') || text.includes('wall art')) return 'Wall Art';
  if (text.includes('sticker')) return 'Stickers';
  if (text.includes('phone case') || text.includes('iphone') || text.includes('samsung')) return 'Phone Cases';
  if (text.includes('mouse pad') || text.includes('mousepad')) return 'Mouse Pads';
  if (text.includes('pillow') || text.includes('cushion')) return 'Pillows';
  if (text.includes('blanket') || text.includes('throw')) return 'Blankets';
  if (text.includes('towel')) return 'Towels';
  if (text.includes('apron')) return 'Aprons';
  if (text.includes('shorts')) return 'Shorts';
  if (text.includes('dress')) return 'Dresses';
  if (text.includes('legging')) return 'Leggings';
  if (text.includes('socks')) return 'Socks';
  if (text.includes('jersey')) return 'Jerseys';
  if (text.includes('calendar')) return 'Calendars';
  if (text.includes('notebook') || text.includes('journal')) return 'Notebooks';
  if (text.includes('flag') || text.includes('banner')) return 'Flags & Banners';
  if (text.includes('patch')) return 'Patches';
  if (text.includes('embroidered') || text.includes('embroidery')) return 'Embroidered Items';
  
  // Default to the original type if no match, but clean it up
  return type || 'Other';
}

// Test endpoint: Printful catalog (no auth required)

// Sync Printful catalog from their API (includes lifestyle images)

// Sync Printify catalog from their API (blueprints, providers, and print areas)

// Test endpoint: Get blueprint details (colors/sizes) for configuration

// Test endpoint: GET products for a store channel (for Store Library) - uses storeProductLinks

// Test endpoint: Assign configured products to store channel


  }
  