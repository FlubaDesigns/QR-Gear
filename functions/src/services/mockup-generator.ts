import { admin, db, storage, FulfillmentProvider, PrintMethod, normalizePlacement, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isColorDark } from '../core';
  import { printfulClient } from './printful';
  import { downloadAndStoreImage } from './storage-helpers';

  // ============ MOCKUP GENERATION (Full Implementation) ============

interface MockupRequest {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  colorHex?: string;
  artworkUrl: string;
  artworkVariant?: 'black' | 'white';
  fulfillmentProvider?: 'printify' | 'printful';
  placement?: string;
  printMethod?: PrintMethod;
  qrSize?: 'small' | 'medium' | 'large';
  hasCompositeGraphic?: boolean;
}

interface MockupResult {
  mockupUrl: string;
  lifestyleMockupUrl?: string | null;
  fromCache: boolean;
}

// Default Printify blueprint to Printful product mappings (fallback)
const DEFAULT_BLUEPRINT_MAPPINGS: Record<number, number> = {
  // T-Shirts (all 8 currently allowed member products)
  5: 71,      // Unisex Cotton Crew Tee -> Printful Bella Canvas 3001
  6: 71,      // Gildan 5000 -> Printful Bella Canvas 3001
  9: 71,      // Women's Favorite Tee -> Printful Bella Canvas 3001
  11: 71,     // Women's Jersey Short Sleeve Deep V-Neck Tee -> Printful Bella Canvas 3001
  12: 71,     // Gildan 64000 -> Printful Bella Canvas 3001
  45: 71,     // Men's Long Sleeve Crew Tee -> Printful Bella Canvas 3001
  145: 380,   // Heavyweight tee -> Printful Gildan 5000
  460: 71,    // Women's Triblend Tee -> Printful Bella Canvas 3001
  472: 71,    // Women's Cotton Tee -> Printful Bella Canvas 3001
  474: 71,    // Cotton Crew -> Printful Bella Canvas 3001
  498: 71,    // Unisex Deluxe T-shirt -> Printful Bella Canvas 3001
  577: 71,    // Men's Jersey Curved Hem Tee -> Printful Bella Canvas 3001
  578: 71,    // Alternative to Bella Canvas
  
  // Hoodies & Sweatshirts
  77: 380,    // Gildan 18500 Hoodie -> Printful Gildan 18500
  80: 380,    // Unisex Hoodie -> Printful Gildan 18500
  81: 380,    // Pullover Hoodie -> Printful Gildan 18500
  91: 380,    // Heavyweight Hoodie -> Printful Gildan 18500
  
  // Long Sleeve
  26: 71,     // Long Sleeve Tee -> Printful equivalent
  39: 71,     // Long Sleeve -> Printful equivalent
  
  // Tank Tops
  14: 71,     // Tank Top -> Printful equivalent
  15: 71,     // Women's Tank -> Printful equivalent
  
  // Mugs
  66: 19,     // White Mug 11oz -> Printful White Mug 11oz
  
  // Hats/Caps  
  88: 206,    // Dad Hat -> Printful Dad Hat
  
  // Posters/Canvas
  33: 1,      // Poster -> Printful Poster
  36: 1,      // Art Print -> Printful Poster
  
  // Bags
  49: 84,     // Tote Bag -> Printful Tote Bag
  
  // Phone Cases
  48: 226,    // iPhone Case -> Printful iPhone Case
};

// Look up Printful product ID from Firestore mapping or fallback
async function getPrintfulProductId(blueprintId: number): Promise<number | null> {
  // Check Firestore mapping first
  const mappingSnapshot = await db.collection('printify_printful_mapping')
    .where('printifyBlueprintId', '==', blueprintId)
    .where('isActive', '==', true)
    .limit(1)
    .get();
  
  if (!mappingSnapshot.empty) {
    const mapping = mappingSnapshot.docs[0].data();
    return mapping.printfulProductId;
  }
  
  // Fallback to hardcoded defaults
  return DEFAULT_BLUEPRINT_MAPPINGS[blueprintId] || null;
}

async function toPublicUrl(url: string): Promise<string> {
  if (!url) return url;
  let filePath: string | null = null;
  
  const fbMatch = url.match(/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/(.+?)(\?|$)/);
  if (fbMatch) {
    filePath = decodeURIComponent(fbMatch[2]);
  }
  
  const gcsMatch = url.match(/storage\.googleapis\.com\/([^/]+)\/(.+?)(\?|$)/);
  if (!filePath && gcsMatch) {
    filePath = decodeURIComponent(gcsMatch[2]);
  }
  
  if (filePath) {
    try {
      const bucket = admin.storage().bucket();
      const file = bucket.file(filePath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 30 * 60 * 1000,
      });
      console.log(`[Mockup] Converted to signed URL: ${filePath}`);
      return signedUrl;
    } catch (e: any) {
      console.warn(`[Mockup] Failed to sign URL for ${filePath}: ${e.message}`);
      // Use direct GCS public URL - the file was made public via makePublic()
      const bucket = admin.storage().bucket();
      const gcsUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
      console.log(`[Mockup] Falling back to GCS public URL: ${gcsUrl}`);
      return gcsUrl;
    }
  }
  return url;
}

async function generateMockupFromPrintful(request: MockupRequest): Promise<MockupResult> {
  const { blueprintId, colorName, colorHex, artworkVariant = 'black', fulfillmentProvider = 'printify' } = request;
  const artworkUrl = await toPublicUrl(request.artworkUrl);
  
  const crypto = require('crypto');
  const artworkHash = crypto.createHash('md5').update(artworkUrl).digest('hex').substring(0, 12);
  const sizeSuffix = request.hasCompositeGraphic ? 'comp' : (request.qrSize || 'medium');
  const cacheKey = `${blueprintId}_${colorName.replace(/\s+/g, '_')}_${artworkVariant}_${artworkHash}_${sizeSuffix}`;
  const cacheDoc = await db.collection('mockup_cache').doc(cacheKey).get();
  
  if (cacheDoc.exists) {
    const cached = cacheDoc.data()!;
    if (cached.status === 'active' && cached.mockupUrl) {
      console.log(`[Mockup] Cache HIT: ${colorName}`);
      return {
        mockupUrl: cached.mockupUrl,
        lifestyleMockupUrl: cached.lifestyleMockupUrl,
        fromCache: true,
      };
    }
  }
  
  console.log(`[Mockup] Cache MISS: ${colorName} - generating via Printful`);
  
  if (!printfulClient.isConfigured) {
    throw new Error('Printful API key not configured');
  }
  
  // For Printful native products, blueprintId IS the Printful product ID
  // For Printify products, we need to map blueprint to Printful product
  let printfulProductId: number;
  if (fulfillmentProvider === 'printful') {
    // Native Printful product - use ID directly
    printfulProductId = blueprintId;
    console.log(`[Mockup] Printful native product: ${printfulProductId}`);
  } else {
    // Map Printify blueprint to Printful product (from Firestore or fallback)
    const mappedId = await getPrintfulProductId(blueprintId);
    if (!mappedId) {
      throw new Error(`No Printful mapping for blueprint ${blueprintId}. Add mapping to printify_printful_mapping collection.`);
    }
    printfulProductId = mappedId;
  }
  
  // Get variants for this color
  const variants = await printfulClient.getVariantsByColor(printfulProductId, colorName);
  console.log(`[Mockup] Got ${variants.length} variants for color: ${colorName}`);
  if (variants.length === 0) {
    throw new Error(`No Printful variants found for color: ${colorName}`);
  }
  
  const variantId = variants[0].id;
  console.log(`[Mockup] Using variant ID: ${variantId} (color: ${variants[0].color})`);
  
  if (!variantId) {
    throw new Error(`Variant missing ID for color: ${colorName}`);
  }
  
  // Get printfile specs to get position info
  const printfileData = await printfulClient.getPrintfiles(printfulProductId);
  const availPlacements = printfileData?.available_placements ? Object.keys(printfileData.available_placements) : [];

  // Build printfile ID to dimensions lookup
  const printfileById: Record<number, { width: number; height: number }> = {};
  if (printfileData?.printfiles) {
    for (const pf of printfileData.printfiles) {
      printfileById[pf.printfile_id] = { width: pf.width, height: pf.height };
    }
  }

  // Build placement to printfile ID mapping from variant_printfiles
  const placementToPrintfileId: Record<string, number> = {};
  if (printfileData?.variant_printfiles) {
    const firstVariantKey = Object.keys(printfileData.variant_printfiles)[0];
    const firstVariant = printfileData.variant_printfiles[firstVariantKey];
    if (firstVariant?.placements) {
      for (const [pName, pfId] of Object.entries(firstVariant.placements)) {
        placementToPrintfileId[pName] = pfId as number;
      }
    }
  }

  // Helper to get dimensions for a placement
  function getDimensionsForPlacement(placementName: string): { width: number; height: number } {
    const pfId = placementToPrintfileId[placementName];
    if (pfId && printfileById[pfId]) return printfileById[pfId];
    return { width: 1800, height: 2400 };
  }

  const canonicalPlacement = request.placement || 'front';
  const placement = toProviderPlacement('printful', canonicalPlacement, availPlacements, request.printMethod);
  const dims = getDimensionsForPlacement(placement);
  
  let artWidth = dims.width;
  let artHeight = dims.height;
  let artTop = 0;
  let artLeft = 0;

  if (!request.hasCompositeGraphic) {
    const sizeScales: Record<string, number> = { small: 0.30, medium: 0.45, large: 0.60 };
    const scale = sizeScales[request.qrSize || 'medium'] || 0.45;
    const artSize = Math.round(Math.min(dims.width, dims.height) * scale);
    artWidth = artSize;
    artHeight = artSize;
    artLeft = Math.round((dims.width - artSize) / 2);
    artTop = Math.round((dims.height - artSize) / 2 * 0.7);
    console.log(`[Mockup] QR-only artwork scaled: qrSize=${request.qrSize || 'medium'}, scale=${scale}, artSize=${artSize}, top=${artTop}, left=${artLeft}`);
  }

  const mockupFiles: Array<{ placement: string; image_url: string; position?: any }> = [{
    placement: placement, 
    image_url: artworkUrl,
    position: {
      area_width: dims.width,
      area_height: dims.height,
      width: artWidth,
      height: artHeight,
      top: artTop,
      left: artLeft
    }
  }];

  // Hardcoded label_inside for QR Gear branded neck tag
  if (availPlacements.includes('label_inside')) {
    const labelDims = getDimensionsForPlacement('label_inside');
    mockupFiles.push({
      placement: 'label_inside',
      image_url: QR_GEAR_BRANDED_TAG_URL,
      position: {
        area_width: labelDims.width,
        area_height: labelDims.height,
        width: labelDims.width,
        height: labelDims.height,
        top: 0,
        left: 0
      }
    });
    console.log(`[Mockup] Auto-attaching branded tag to label_inside (${labelDims.width}x${labelDims.height})`);
  }
  
  console.log('[Printful] Creating mockup with files:', JSON.stringify(mockupFiles));
  
  // Retry logic - short delays to stay under Cloud Function gateway timeout
  const maxRetries = 2;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 1) {
        const delayMs = 15000; // 15s between retries
        console.log(`[Printful] Retry ${attempt}/${maxRetries} - waiting ${delayMs/1000}s`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
      
      // Create mockup task - don't pass option_groups as it filters out variants
      const task = await printfulClient.createMockupTask(
        printfulProductId,
        [variantId],
        mockupFiles,
        'jpg'
      );
      
      // Wait for completion with longer timeout
      const result = await printfulClient.waitForMockupTask(task.task_key, 120000);
      
      if (!result.mockups || result.mockups.length === 0) {
        throw new Error('No mockups returned from Printful');
      }
      
      // Success - continue with the rest of the function
      return await processMockupResult(result, blueprintId, colorName, artworkVariant, cacheKey);
      
    } catch (err: any) {
      lastError = err;
      const errorMsg = err.message || String(err);
      
      // Check if it's a retryable error
      if (errorMsg.includes('429') || errorMsg.includes('TooManyRequests') || 
          errorMsg.includes('Internal Server Error') || errorMsg.includes('timeout')) {
        console.log(`[Printful] Attempt ${attempt} failed with retryable error: ${errorMsg}`);
        continue;
      }
      
      // Non-retryable error - throw immediately
      throw err;
    }
  }
  
  throw lastError || new Error('Mockup generation failed after retries');
}

// Helper function to process mockup result
async function processMockupResult(
  result: any,
  blueprintId: number,
  colorName: string,
  artworkVariant: string,
  cacheKey: string
): Promise<{ mockupUrl: string; lifestyleMockupUrl: string | null; fromCache: boolean }> {
  // Find flat and lifestyle mockups
  let flatMockup = result.mockups.find((m: any) => !m.placement.includes('lifestyle'));
  let lifestyleMockup = result.mockups.find((m: any) => m.placement.includes('lifestyle'));
  
  if (!flatMockup) flatMockup = result.mockups[0];
  
  // Download and store in Firebase Storage
  const timestamp = Date.now();
  const storagePath = `mockups/${blueprintId}/${colorName.replace(/\s+/g, '_')}_${artworkVariant}_${timestamp}.jpg`;
  const permanentUrl = await downloadAndStoreImage(flatMockup.mockup_url, storagePath);
  
  let lifestyleUrl: string | null = null;
  if (lifestyleMockup) {
    const lifestylePath = `mockups/${blueprintId}/${colorName.replace(/\s+/g, '_')}_${artworkVariant}_lifestyle_${timestamp}.jpg`;
    lifestyleUrl = await downloadAndStoreImage(lifestyleMockup.mockup_url, lifestylePath);
  }
  
  // Cache in Firestore
  await db.collection('mockup_cache').doc(cacheKey).set({
    blueprintId,
    colorName,
    artworkVariant,
    mockupUrl: permanentUrl || flatMockup.mockup_url,
    lifestyleMockupUrl: lifestyleUrl,
    status: 'active',
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  
  return {
    mockupUrl: permanentUrl || flatMockup.mockup_url,
    lifestyleMockupUrl: lifestyleUrl,
    fromCache: false,
  };
}

export { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS };
export type { MockupRequest, MockupResult };
