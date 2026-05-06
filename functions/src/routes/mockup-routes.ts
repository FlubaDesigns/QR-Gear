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
  import { processQueueInBackground } from './file-routes';

  export function register(app: express.Express): void {
  // ============ STOREFRONT MOCKUP GENERATION ============

app.post('/storefront/generate-mockup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId, color, qrSize, qrSizePercent } = req.body;
    
    if (!productId || !color) {
      res.status(400).json({ error: 'productId and color are required' });
      return;
    }
    
    let resolvedQrSize: 'small' | 'medium' | 'large' = 'medium';
    if (qrSize && ['small', 'medium', 'large'].includes(qrSize)) {
      resolvedQrSize = qrSize;
    } else if (qrSizePercent) {
      if (qrSizePercent <= 30) resolvedQrSize = 'small';
      else if (qrSizePercent <= 50) resolvedQrSize = 'medium';
      else resolvedQrSize = 'large';
    }
    
    const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
    const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
    
    const productDoc = await db.collection('products').doc(canonicalProductId).get();
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    const existingMockups = (product.mockupsByColor as Record<string, any>) || {};
    const normalizeColor = (c: string) => c.toLowerCase().trim();
    const requestColorNorm = normalizeColor(color);
    
    // Build keys for lookup: color_size_placement (full), color_size, color-only
    const placement = 'front';
    const fullKey = `${color}_${resolvedQrSize}_${placement}`;
    const colorSizeKey = `${color}_${resolvedQrSize}`;
    const fullKeyNorm = `${requestColorNorm}_${resolvedQrSize}_${placement}`;
    const colorSizeKeyNorm = `${requestColorNorm}_${resolvedQrSize}`;
    
    console.log(`[StorefrontMockup] Looking for mockup: full="${fullKey}", size="${colorSizeKey}", color="${color}"`);
    
    // Priority 1: Exact match for color + size + placement
    let existingMockup: any = null;
    let matchedColorKey: string = fullKey;
    let usedFallback = false;
    
    for (const [storedKey, mockup] of Object.entries(existingMockups)) {
      const storedKeyNorm = storedKey.toLowerCase().trim();
      if (storedKeyNorm === fullKeyNorm && mockup && (mockup as any).front) {
        existingMockup = mockup;
        matchedColorKey = storedKey;
        console.log(`[StorefrontMockup] Found EXACT match: "${storedKey}"`);
        break;
      }
    }
    
    // Priority 2: Match color + size (any placement)
    if (!existingMockup) {
      for (const [storedKey, mockup] of Object.entries(existingMockups)) {
        const storedKeyNorm = storedKey.toLowerCase().trim();
        if (storedKeyNorm === colorSizeKeyNorm && mockup && (mockup as any).front) {
          existingMockup = mockup;
          matchedColorKey = storedKey;
          usedFallback = true;
          console.log(`[StorefrontMockup] Found SIZE match: "${storedKey}" (requested: ${fullKey})`);
          break;
        }
      }
    }
    
    // Priority 3: Fallback to any mockup for this color
    if (!existingMockup) {
      for (const [storedKey, mockup] of Object.entries(existingMockups)) {
        const storedKeyNorm = storedKey.toLowerCase().trim();
        const matchesColor = storedKeyNorm === requestColorNorm || 
                             storedKeyNorm.startsWith(`${requestColorNorm}_`);
        if (matchesColor && mockup && (mockup as any).front) {
          existingMockup = mockup;
          matchedColorKey = storedKey;
          usedFallback = true;
          console.log(`[StorefrontMockup] Using COLOR fallback: "${storedKey}" (requested: ${fullKey})`);
          break;
        }
      }
    }
    
    if (existingMockup && existingMockup.front) {
      const defaultImage = existingMockup.lifestyle || existingMockup.front;
      await db.collection('products').doc(canonicalProductId).update({
        defaultColor: color,
        imageUrl: defaultImage,
      });
      
      res.json({ 
        success: true, 
        color, 
        graphicSize: resolvedQrSize,
        mockupUrl: existingMockup.front,
        lifestyleMockupUrl: existingMockup.lifestyle || null,
        fromCache: true,
        usedFallback,
        matchedKey: matchedColorKey,
        mockupsByColor: existingMockups 
      });
      return;
    }
    
    const designDoc = await db.collection('customDesigns').doc(designId).get();
    if (!designDoc.exists) {
      res.status(404).json({ error: 'Design not found' });
      return;
    }
    
    const design = designDoc.data()!;
    let designPlacements: Record<string, string> = {};
    try {
      if (typeof design.placementImages === 'string') {
        designPlacements = JSON.parse(design.placementImages);
      } else if (design.placementImages && typeof design.placementImages === 'object') {
        designPlacements = design.placementImages as Record<string, string>;
      }
    } catch (e) {
      console.error('[StorefrontMockup] Failed to parse placementImages:', e);
    }
    
    let colorHex: string | null = null;
    if (product.availableColors && Array.isArray(product.availableColors)) {
      const colorInfo = (product.availableColors as any[]).find(
        (c: any) => c.name?.toLowerCase() === color.toLowerCase()
      );
      colorHex = colorInfo?.hex || null;
    }
    
    const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
    
    const blackArtwork = designPlacements['front'] || 
                         designPlacements['front-chest'] || 
                         designPlacements['front-chest-black'] || 
                         designPlacements['front-center'];
    const whiteArtwork = designPlacements['front-white'] || 
                         designPlacements['front-chest-white'] || 
                         designPlacements['front-center-white'];
    
    let artworkUrl: string;
    let artworkVariant: 'black' | 'white' = 'black';
    
    if (needsWhiteQR && whiteArtwork) {
      artworkUrl = whiteArtwork;
      artworkVariant = 'white';
    } else if (blackArtwork) {
      artworkUrl = blackArtwork;
      artworkVariant = 'black';
    } else {
      artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0] as string;
    }
    
    // Generate mockup via Printful if not cached
    if (!printfulClient.isConfigured) {
      let fallbackUrl: string | null = null;
      try {
        const bpDoc = await db.collection('printify_blueprints').doc(String(product.blueprintId)).get();
        if (bpDoc.exists) {
          const bpData = bpDoc.data()!;
          fallbackUrl = bpData.images?.[0] || bpData.image || null;
        }
      } catch (fbErr: any) { /* ignore */ }
      if (fallbackUrl) {
        res.json({ success: true, color, mockupUrl: fallbackUrl, lifestyleMockupUrl: null, fromCache: false, fallback: true });
        return;
      }
      res.status(404).json({ 
        error: `No mockup available for ${color}. Printful API key not configured.`,
        color 
      });
      return;
    }
    
    try {
      console.log(`[StorefrontMockup] Generating mockup for ${color} via Printful...`);
      const mockupResult = await generateMockupFromPrintful({
        blueprintId: product.blueprintId,
        printProviderId: product.printProviderId || 0,
        colorName: color,
        colorHex: colorHex || undefined,
        artworkUrl,
        artworkVariant,
        hasCompositeGraphic: true,
      });
      
      // Update product with new mockup
      const updatedMockups = {
        ...existingMockups,
        [color]: {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
        },
      };
      
      const defaultImage = mockupResult.lifestyleMockupUrl || mockupResult.mockupUrl;
      await db.collection('products').doc(canonicalProductId).update({
        mockupsByColor: updatedMockups,
        defaultColor: color,
        imageUrl: defaultImage,
      });
      
      res.json({
        success: true,
        color,
        mockupUrl: mockupResult.mockupUrl,
        lifestyleMockupUrl: mockupResult.lifestyleMockupUrl,
        fromCache: mockupResult.fromCache,
        mockupsByColor: updatedMockups,
      });
    } catch (genError: any) {
      console.error(`[StorefrontMockup] Printful generation failed:`, genError.message);
      let fallbackUrl: string | null = null;
      try {
        const bpDoc = await db.collection('printify_blueprints').doc(String(product.blueprintId)).get();
        if (bpDoc.exists) {
          const bpData = bpDoc.data()!;
          fallbackUrl = bpData.images?.[0] || bpData.image || null;
        }
        if (fallbackUrl) {
          console.log(`[StorefrontMockup] Using catalog fallback image for blueprint ${product.blueprintId}`);
          res.json({ success: true, color, mockupUrl: fallbackUrl, lifestyleMockupUrl: null, fromCache: false, fallback: true });
          return;
        }
      } catch (fbErr: any) {
        console.error("[StorefrontMockup] Fallback lookup failed:", fbErr.message);
      }
      res.status(500).json({ 
        error: `Failed to generate mockup for ${color}: ${genError.message}`,
        color 
      });
    }
  } catch (error: any) {
    console.error('[StorefrontMockup] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============ MOCKUP API ============

app.get('/placements', async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('canonicalPlacements').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/mockups/get-or-generate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      blueprintId, 
      printProviderId, 
      colorName, 
      colorHex,
      canonicalPlacementId = 'front',
      artworkUrl,
      artworkVariant = 'black'
    } = req.body;

    if (!blueprintId || !printProviderId || !colorName || !artworkUrl) {
      res.status(400).json({ 
        error: 'Missing required fields: blueprintId, printProviderId, colorName, artworkUrl' 
      });
      return;
    }

    const cacheKey = `${blueprintId}-${printProviderId}-${colorName}-${canonicalPlacementId}-${artworkVariant}`;
    const cacheSnapshot = await db.collection('mockup_cache')
      .where('cacheKey', '==', cacheKey)
      .limit(1)
      .get();
    
    if (!cacheSnapshot.empty) {
      const cached = cacheSnapshot.docs[0].data();
      res.json({
        success: true,
        mockupUrl: cached.mockupUrl,
        lifestyleUrl: cached.lifestyleUrl,
        fromCache: true,
      });
      return;
    }
    
    // Generate via Printful if not in cache
    if (!printfulClient.isConfigured) {
      res.json({
        success: false,
        message: 'Mockup not in cache and Printful API key not configured.',
        fromCache: false,
      });
      return;
    }
    
    try {
      const mockupResult = await generateMockupFromPrintful({
        blueprintId,
        printProviderId,
        colorName,
        colorHex,
        artworkUrl,
        artworkVariant: artworkVariant as 'black' | 'white',
        hasCompositeGraphic: true,
      });
      
      res.json({
        success: true,
        mockupUrl: mockupResult.mockupUrl,
        lifestyleUrl: mockupResult.lifestyleMockupUrl,
        fromCache: mockupResult.fromCache,
      });
    } catch (genError: any) {
      res.status(500).json({
        success: false,
        error: genError.message,
        fromCache: false,
      });
    }
  } catch (error: any) {
    console.error('[MockupAPI] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint: Generate priority mockup for digital proof

app.get('/mockups/cached/:blueprintId/:printProviderId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId } = req.params;
    
    const snapshot = await db.collection('mockup_cache')
      .where('blueprintId', '==', parseInt(blueprintId))
      .where('printProviderId', '==', parseInt(printProviderId))
      .get();
    
    const mockups: Record<string, any> = {};
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (!mockups[data.colorName]) {
        mockups[data.colorName] = {};
      }
      mockups[data.colorName][data.placementId] = {
        mockupUrl: data.mockupUrl,
        lifestyleUrl: data.lifestyleUrl,
      };
    });

    res.json({ mockups, count: Object.keys(mockups).length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ ADMIN MOCKUP REGENERATION ============

app.post('/admin/products/:id/regenerate-mockups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { color } = req.body;
    
    const productDoc = await db.collection('products').doc(id).get();
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    if (!product.blueprintId) {
      res.status(400).json({ error: 'Product missing blueprint info' });
      return;
    }
    
    if (!printfulClient.isConfigured) {
      res.status(500).json({ error: 'Printful API key not configured' });
      return;
    }
    
    const metadata = product.metadata as { customDesignId?: string } | null;
    const designId = metadata?.customDesignId || id.replace('custom_', '');
    
    const designDoc = await db.collection('customDesigns').doc(designId).get();
    if (!designDoc.exists) {
      res.status(404).json({ error: 'Custom design not found' });
      return;
    }
    
    const design = designDoc.data()!;
    let designPlacements: Record<string, string> = {};
    if (typeof design.placementImages === 'object') {
      designPlacements = design.placementImages as Record<string, string>;
    }
    
    const blackArtwork = designPlacements['front'] || designPlacements['front-chest'];
    const whiteArtwork = designPlacements['front-white'] || designPlacements['front-chest-white'];
    
    // Get colors to regenerate
    const allColors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
    const colorsToProcess = color ? allColors.filter(c => c.name === color) : allColors;
    
    if (colorsToProcess.length === 0) {
      res.status(400).json({ error: 'No colors to process' });
      return;
    }
    
    const results: any[] = [];
    const mockupsByColor: Record<string, any> = product.mockupsByColor || {};
    
    for (const colorInfo of colorsToProcess) {
      try {
        const needsWhiteQR = isColorDark(colorInfo.hex);
        const artworkUrl = (needsWhiteQR && whiteArtwork) ? whiteArtwork : blackArtwork;
        const artworkVariant = (needsWhiteQR && whiteArtwork) ? 'white' as const : 'black' as const;
        
        const mockupResult = await generateMockupFromPrintful({
          blueprintId: product.blueprintId,
          printProviderId: product.printProviderId || 0,
          colorName: colorInfo.name,
          colorHex: colorInfo.hex,
          artworkUrl,
          artworkVariant,
          hasCompositeGraphic: true,
        });
        
        // Save with full key: color_size_placement (e.g., "Black_medium_front")
        const graphicSize = 'medium';
        const placement = 'front';
        const fullKey = `${colorInfo.name}_${graphicSize}_${placement}`;
        mockupsByColor[fullKey] = {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
          qrSize: graphicSize,
          placement,
          generatedAt: new Date().toISOString(),
        };
        
        // Also store color_size shorthand key
        const colorSizeKey = `${colorInfo.name}_${graphicSize}`;
        mockupsByColor[colorSizeKey] = {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
          qrSize: graphicSize,
          placement,
          generatedAt: new Date().toISOString(),
        };
        
        mockupsByColor[colorInfo.name] = {
          front: mockupResult.mockupUrl,
          lifestyle: mockupResult.lifestyleMockupUrl,
          qrSize: graphicSize,
          placement,
          generatedAt: new Date().toISOString(),
        };
        
        results.push({ color: colorInfo.name, success: true, mockupUrl: mockupResult.mockupUrl });
        
        // Rate limit between colors
        if (colorsToProcess.indexOf(colorInfo) < colorsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (err: any) {
        results.push({ color: colorInfo.name, success: false, error: err.message });
      }
    }
    
    // Update product with new mockups
    await db.collection('products').doc(id).update({ mockupsByColor });
    
    res.json({
      success: true,
      message: `Regenerated mockups for ${results.filter(r => r.success).length}/${colorsToProcess.length} colors`,
      results,
      mockupsByColor,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/products/:id/generate-all-mockups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const productDoc = await db.collection('products').doc(id).get();
    
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    
    const product = productDoc.data()!;
    const allColors = (product.availableColors as Array<{ name: string; hex: string }>) || [];
    
    if (allColors.length === 0) {
      res.status(400).json({ error: 'No colors available for this product' });
      return;
    }
    
    if (!printfulClient.isConfigured) {
      res.status(500).json({ error: 'Printful API key not configured' });
      return;
    }
    
    // Start generation in background (respond immediately for long operations)
    res.json({
      success: true,
      message: `Mockup generation started for ${allColors.length} colors. Use regenerate-mockups endpoint for synchronous generation.`,
      productId: id,
      colors: allColors.map((c: any) => c.name),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ MOCKUP QUEUE PROCESSOR ============

app.post('/admin/mockup/queue-process', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    console.log('[Queue Process] Manually triggered');
    processQueueInBackground().catch((err: any) => {
      console.error('[Queue Process] Background error:', err.message);
    });
    res.json({ success: true, message: 'Queue processing triggered' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});



  }
  