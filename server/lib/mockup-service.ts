/**
 * Mockup Service - Database-first with Printify fallback
 * 
 * Architecture:
 * 1. Check mockup_cache table for existing mockup
 * 2. If not found, generate via Printify and cache result
 * 3. Download images and store in Object Storage for permanent URLs
 * 4. Return cached URL for instant display
 */

import { fsGet, fsGetAll, fsQuery, fsInsert, fsUpdate, fsUpsert } from "./firestore-crud";
import type { IStorage } from "../storage";
import { downloadAndStoreFromUrl, uploadImageFromBuffer } from "./firebase-storage-service";
import { printfulClient } from "./printful";
import { toProviderPlacement } from '../../shared/placements';

export const QR_GEAR_BRANDED_TAG_URL = 'https://qrgear-c1ffd.web.app/img/qr-gear-neck-tag-600.png';
const LABEL_PLACEMENTS_PRINTFUL = ['label_outside', 'label_inside'];
const LABEL_PLACEMENTS_PRINTIFY = ['neck_label', 'label'];

/**
 * Upload a data URI to Firebase Storage and return public URL
 * Used for member-generated productGraphics that need to be sent to Printful
 */
async function uploadDataUriToStorage(dataUri: string): Promise<string | null> {
  try {
    const match = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      console.error("[MockupService] Invalid data URI format");
      return null;
    }
    
    const mimeType = match[1];
    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Generate unique filename
    const ext = mimeType.includes('png') ? 'png' : 'jpg';
    const filename = `product-graphic-${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
    
    const result = await uploadImageFromBuffer(buffer, filename, mimeType, 'member-graphics/temp');
    
    if (result.publicUrl) {
      console.log(`[MockupService] Uploaded data URI to storage: ${result.publicUrl}`);
      return result.publicUrl;
    }
    
    console.error("[MockupService] Failed to upload data URI: no publicUrl returned");
    return null;
  } catch (error) {
    console.error("[MockupService] Error uploading data URI:", error);
    return null;
  }
}

interface MockupRequest {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  colorHex?: string;
  canonicalPlacementId: string; // Required - must be explicitly provided
  artworkUrl: string;
  artworkVariant?: "black" | "white";
  productId?: string; // Optional - for placement availability validation
  qrSize?: 'small' | 'medium' | 'large'; // QR code size: small=25%, medium=45%, large=65%
  fulfillmentProvider?: 'printify' | 'printful'; // Source catalog - skip mapping for native Printful products
  printMethod?: 'dtg' | 'dtf'; // Print method selection - affects which provider placement name is used
}

interface MockupResult {
  mockupUrl: string;
  lifestyleMockupUrl?: string | null;
  fromCache: boolean;
  generatedAt: Date;
}

/**
 * Validate hex color format
 * Returns true if valid 6-character hex (with or without #)
 */
export function isValidHexColor(hexColor: string | undefined | null): boolean {
  if (!hexColor) return false;
  const hex = hexColor.replace("#", "");
  return /^[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Determine if a color is dark using sRGB luminance formula
 * Returns true if the color is dark (needs white QR)
 * Returns false for invalid hex colors (default to light/black QR)
 */
export function isColorDark(hexColor: string | undefined | null): boolean {
  if (!isValidHexColor(hexColor)) {
    console.warn(`[MockupService] Invalid hex color "${hexColor}", defaulting to light (black QR)`);
    return false;
  }
  
  const hex = hexColor!.replace("#", "");
  const r = parseInt(hex.substr(0, 2), 16) / 255;
  const g = parseInt(hex.substr(2, 2), 16) / 255;
  const b = parseInt(hex.substr(4, 2), 16) / 255;
  
  // Validate parsed values
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    console.warn(`[MockupService] Failed to parse hex color "${hexColor}", defaulting to light`);
    return false;
  }
  
  // sRGB to linear RGB conversion
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  
  // Calculate relative luminance
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
  
  return luminance < 0.5;
}

/**
 * Download image from URL and upload to Firebase Storage for permanent storage
 * Returns the permanent Firebase Storage URL
 */
async function downloadAndStoreImage(
  imageUrl: string,
  storagePath: string
): Promise<string | null> {
  return downloadAndStoreFromUrl(imageUrl, storagePath);
}

/**
 * Get mockup from cache or generate via Printify
 * This is the main entry point - always use this function
 */
export async function getMockupWithFallback(
  request: MockupRequest,
  storage: IStorage
): Promise<MockupResult> {
  const {
    blueprintId,
    printProviderId,
    colorName,
    colorHex,
    canonicalPlacementId,
    artworkUrl,
    artworkVariant = "black",
    productId,
    qrSize = "medium",
    fulfillmentProvider = "printify",
  } = request;

  // Validate canonicalPlacementId is provided
  if (!canonicalPlacementId) {
    throw new Error("canonicalPlacementId is required");
  }

  // Validate placement exists
  const placementDoc = await fsGet('canonical_placements', canonicalPlacementId);

  if (!placementDoc) {
    throw new Error(`Unknown canonical placement: ${canonicalPlacementId}`);
  }

  // If productId provided, validate placement is available for this product
  if (productId) {
    const placementAvailable = await fsQuery('product_placement_availability', [
      ['productId', '==', productId],
      ['canonicalPlacementId', '==', canonicalPlacementId],
      ['isEnabled', '==', true],
    ], undefined, 'asc', 1);

    if (placementAvailable.length === 0) {
      console.warn(`[MockupService] Placement ${canonicalPlacementId} not available for product ${productId}. Proceeding anyway for blueprint-level cache.`);
      // Note: We log but don't block since mockups are cached at blueprint level
    }
  }

  // Step 1: Check cache (includes qrSize and artworkUrl to get exact mockup)
  // For member-generated productGraphics (data URIs), artworkUrl is unique per composite
  // so we must include it in the cache lookup to avoid returning stale mockups
  const cached = await fsQuery('mockup_cache', [
    ['blueprintId', '==', blueprintId],
    ['printProviderId', '==', printProviderId],
    ['colorName', '==', colorName],
    ['canonicalPlacementId', '==', canonicalPlacementId],
    ['artworkVariant', '==', artworkVariant],
    ['qrSize', '==', qrSize],
    ['artworkUrl', '==', artworkUrl],
  ], undefined, 'asc', 1);

  if (cached.length > 0 && cached[0].status === "active") {
    console.log(`[MockupService] Cache HIT: ${colorName} ${canonicalPlacementId} ${qrSize}`);
    return {
      mockupUrl: cached[0].mockupUrl,
      lifestyleMockupUrl: cached[0].lifestyleMockupUrl,
      fromCache: true,
      generatedAt: cached[0].generatedAt,
    };
  }

  console.log(`[MockupService] Cache MISS: ${colorName} ${canonicalPlacementId} ${qrSize} - generating via Printful`);

  // Step 2: Generate via Printful's Mockup Generator API
  // Printful has a dedicated mockup generator that works without publishing products
  const mockupResult = await generatePrintfulMockupInternal({
    blueprintId,
    printProviderId,
    colorName,
    colorHex,
    artworkUrl,
    canonicalPlacementId,
    qrSize,
    fulfillmentProvider,
    printMethod: request.printMethod,
  });

  if (!mockupResult || !mockupResult.flat) {
    throw new Error("Failed to generate mockup from Printful");
  }

  const mockupUrl = mockupResult.flat;
  const lifestyleMockupUrl = mockupResult.lifestyle || null;

  // Step 3: Cache the result (includes qrSize for size-specific caching)
  const now = new Date();
  const existingCache = await fsQuery('mockup_cache', [
    ['blueprintId', '==', blueprintId],
    ['printProviderId', '==', printProviderId],
    ['colorName', '==', colorName],
    ['canonicalPlacementId', '==', canonicalPlacementId],
    ['artworkVariant', '==', artworkVariant],
    ['qrSize', '==', qrSize],
  ], undefined, 'asc', 1);

  if (existingCache.length > 0) {
    await fsUpdate('mockup_cache', existingCache[0].id, {
      mockupUrl,
      lifestyleMockupUrl,
      colorHex,
      artworkUrl,
      status: "active",
      generatedAt: now.toISOString(),
    });
  } else {
    await fsInsert('mockup_cache', {
      blueprintId,
      printProviderId,
      colorName,
      colorHex,
      canonicalPlacementId,
      qrSize,
      artworkUrl,
      artworkVariant,
      mockupUrl,
      lifestyleMockupUrl,
      podProviderId: "printify",
      status: "active",
      generatedAt: now.toISOString(),
    });
  }

  console.log(`[MockupService] Generated and cached mockup for ${colorName} ${qrSize} (lifestyle: ${!!lifestyleMockupUrl})`);

  return {
    mockupUrl,
    lifestyleMockupUrl,
    fromCache: false,
    generatedAt: now,
  };
}

/**
 * Internal: Generate mockup via Printful's Mockup Generator API
 * Printful has a dedicated mockup generator that works without publishing products.
 * This is more reliable than Printify's approach which requires temporary product creation.
 */
async function generatePrintfulMockupInternal(params: {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  colorHex?: string;
  artworkUrl: string;
  canonicalPlacementId: string;
  qrSize?: 'small' | 'medium' | 'large';
  fulfillmentProvider?: 'printify' | 'printful';
  printMethod?: 'dtg' | 'dtf';
}): Promise<{ flat?: string; lifestyle?: string; isFallback?: boolean } | null> {
  const { blueprintId, printProviderId, colorName, colorHex, artworkUrl, canonicalPlacementId, fulfillmentProvider = 'printify' } = params;

  console.log(`[MockupService/Printful] Generating mockup for blueprint ${blueprintId}, color ${colorName}, provider: ${fulfillmentProvider}`);

  let printfulProductId: number;
  let printfulColorName = colorName;
  let isFallbackMapping = false;

  // If the product is already from Printful catalog, use the blueprintId directly as the Printful product ID
  if (fulfillmentProvider === 'printful') {
    console.log(`[MockupService/Printful] Native Printful product - using blueprintId ${blueprintId} directly (no mapping needed)`);
    printfulProductId = blueprintId;
  } else {
    // Step 1: Look up the Printify-to-Printful mapping for Printify products
    const mapping = await fsQuery('printify_printful_mapping', [
      ['printifyBlueprintId', '==', blueprintId],
      ['isActive', '==', true],
    ], undefined, 'asc', 1);

    if (mapping.length === 0) {
      console.warn(`[MockupService/Printful] No mapping found for blueprint ${blueprintId}. Creating auto-mapping...`);
      
      // Try to auto-create mapping for common products
      const autoMapping = await createAutoMapping(blueprintId);
      if (!autoMapping) {
        console.error(`[MockupService/Printful] Could not create auto-mapping for blueprint ${blueprintId}`);
        return null;
      }
      mapping.push(autoMapping);
      
      // Check if this was a fallback mapping (brand contains "fallback")
      if (autoMapping.printfulBrand?.includes('fallback')) {
        isFallbackMapping = true;
        console.log(`[MockupService/Printful] Using FALLBACK mapping - will add indicator to mockup`);
      }
    }

    printfulProductId = mapping[0].printfulProductId;
    const colorMappingData = mapping[0].colorMapping as Record<string, string> | null;
    
    // Map Printify color name to Printful color name if needed
    if (colorMappingData && colorMappingData[colorName]) {
      printfulColorName = colorMappingData[colorName];
      console.log(`[MockupService/Printful] Mapped color: ${colorName} → ${printfulColorName}`);
    }
  }

  // Make artwork URL absolute - handle data URIs by uploading to Firebase Storage
  let absoluteArtworkUrl: string;
  
  if (artworkUrl.startsWith("data:")) {
    // Data URI (member-generated productGraphic) - must upload to get public URL
    console.log(`[MockupService/Printful] Uploading data URI to Firebase Storage...`);
    const uploadedUrl = await uploadDataUriToStorage(artworkUrl);
    if (!uploadedUrl) {
      console.error(`[MockupService/Printful] Failed to upload data URI to storage`);
      return null;
    }
    absoluteArtworkUrl = uploadedUrl;
  } else if (artworkUrl.startsWith("http")) {
    // Convert Firebase Storage URLs to signed URLs - Printful can't fetch ?alt=media format
    const storageMatch = artworkUrl.match(/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/(.+?)(\?|$)/);
    if (storageMatch) {
      try {
        const { getFirestoreDb } = await import('./firebase-admin');
        const admin = (await import('firebase-admin')).default;
        const filePath = decodeURIComponent(storageMatch[2]);
        const bucket = admin.storage().bucket();
        const file = bucket.file(filePath);
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 30 * 60 * 1000,
        });
        absoluteArtworkUrl = signedUrl;
        console.log(`[MockupService/Printful] Converted storage URL to signed URL for: ${filePath}`);
      } catch (e: any) {
        console.warn(`[MockupService/Printful] Failed to sign URL: ${e.message}, using original`);
        absoluteArtworkUrl = artworkUrl;
      }
    } else {
      absoluteArtworkUrl = artworkUrl;
    }
  } else {
    // Relative URL - make absolute
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "http://localhost:5000";
    absoluteArtworkUrl = `${baseUrl}${artworkUrl}`;
  }

  console.log(`[MockupService/Printful] Using Printful product ${printfulProductId} for color ${printfulColorName}`);
  console.log(`[MockupService/Printful] Artwork URL: ${absoluteArtworkUrl}`);

  // Step 2: Get Printful variants for this color
  const variants = await printfulClient.getVariantsByColor(printfulProductId, printfulColorName);
  
  if (variants.length === 0) {
    console.error(`[MockupService/Printful] No Printful variants found for color: ${printfulColorName}`);
    return null;
  }

  // Take one variant (typically M size for best mockup)
  const targetVariant = variants.find(v => v.size === 'M') || variants[0];
  console.log(`[MockupService/Printful] Using variant: ${targetVariant.id} (${targetVariant.size}, ${targetVariant.color})`);

  // Step 3: Get printfile info for positioning
  const printfiles = await printfulClient.getPrintfiles(printfulProductId);
  const frontPrintfile = printfiles.printfiles?.find((p: any) => p.printfile_id === 1) || printfiles.printfiles?.[0];
  
  // Position for front chest - QR code size based on user preference
  const areaWidth = frontPrintfile?.width || 4500;  // Printful's actual area for t-shirts
  const areaHeight = frontPrintfile?.height || 5400;
  
  // QR size based on size preference: small=25%, medium=45%, large=65% of print area
  const sizePercentages: Record<string, number> = {
    small: 0.25,   // ~4" on a 12"x16" area
    medium: 0.45,  // ~8" on a 12"x16" area  
    large: 0.65,   // ~12" on a 12"x16" area (near max)
  };
  const sizePercent = sizePercentages[params.qrSize || 'medium'] || sizePercentages.medium;
  // Minimum QR size is 15% of print area (ensures visibility without overriding user choice)
  const minQrSize = Math.round(areaWidth * 0.15);
  const qrSize = Math.max(Math.round(areaWidth * sizePercent), minQrSize);
  
  console.log(`[MockupService/Printful] Print area: ${areaWidth}x${areaHeight}, QR size: ${qrSize}px (${Math.round(qrSize/areaWidth*100)}%)`);
  
  const position = {
    area_width: areaWidth,
    area_height: areaHeight,
    width: qrSize,
    height: qrSize,
    top: Math.round(areaHeight * 0.15),  // ~15% from top for chest placement
    left: Math.round((areaWidth - qrSize) / 2),  // Centered horizontally
  };

  // Step 4: Map internal placement to Printful placement using bridge (respecting DTG/DTF method choice)
  const availPlacements = printfiles?.available_placements ? Object.keys(printfiles.available_placements) : [];
  const printfulPlacement = toProviderPlacement('printful', canonicalPlacementId, availPlacements, params.printMethod);

  // Step 5: Build files array - main artwork + auto-branding tag
  const mockupFiles: Array<{ placement: string; image_url: string; position?: any }> = [{
    placement: printfulPlacement,
    image_url: absoluteArtworkUrl,
    position,
  }];

  // Hardcoded label_inside for QR Gear branded neck tag
  if (availPlacements.includes('label_inside')) {
    mockupFiles.push({
      placement: 'label_inside',
      image_url: QR_GEAR_BRANDED_TAG_URL,
    });
    console.log(`[MockupService/Printful] Auto-attaching branded tag to label_inside`);
  }

  // Step 6: Create mockup task with lifestyle option groups
  const lifestyleOptionGroups = ["Men's Lifestyle", "Women's Lifestyle"];
  
  const task = await printfulClient.createMockupTask(
    printfulProductId,
    [targetVariant.id],
    mockupFiles,
    'jpg',
    lifestyleOptionGroups
  );

  if (!task.task_key) {
    console.error(`[MockupService/Printful] Mockup task creation failed`);
    return null;
  }

  console.log(`[MockupService/Printful] Task created: ${task.task_key}`);

  // Step 7: Wait for task completion
  const result = await printfulClient.waitForMockupTask(task.task_key, 60000);

  if (!result.mockups || result.mockups.length === 0) {
    console.error(`[MockupService/Printful] No mockups returned`);
    return null;
  }

  // Step 8: Extract mockup URLs
  const mockupImages: { flat?: string; lifestyle?: string } = {};
  
  const mainMockup = result.mockups[0];
  mockupImages.flat = mainMockup.mockup_url;
  console.log(`[MockupService/Printful] Got flat mockup: ${mockupImages.flat.substring(0, 80)}...`);

  // Look for lifestyle mockup in extra images
  if (mainMockup.extra && mainMockup.extra.length > 0) {
    // Prefer images with option_group "Model" or "Lifestyle" 
    const lifestyleExtra = mainMockup.extra.find((e: any) => 
      e.option_group?.toLowerCase().includes('model') || 
      e.option_group?.toLowerCase().includes('lifestyle') ||
      e.title?.toLowerCase().includes('lifestyle')
    );
    
    if (lifestyleExtra?.url) {
      mockupImages.lifestyle = lifestyleExtra.url;
      console.log(`[MockupService/Printful] Got lifestyle mockup: ${lifestyleExtra.url.substring(0, 80)}...`);
    }
  }

  // Step 9: Download and store in Object Storage for permanent URLs
  const permanentImages: { flat?: string; lifestyle?: string } = {};
  
  if (mockupImages.flat) {
    const flatPath = `printful/${blueprintId}/${colorName.replace(/\s+/g, '-').toLowerCase()}-flat.jpg`;
    const permanentFlatUrl = await downloadAndStoreImage(mockupImages.flat, flatPath);
    if (permanentFlatUrl) {
      permanentImages.flat = permanentFlatUrl;
      console.log(`[MockupService/Printful] Stored flat mockup permanently: ${permanentFlatUrl}`);
    } else {
      permanentImages.flat = mockupImages.flat;
      console.warn(`[MockupService/Printful] Could not store, using Printful S3 URL directly`);
    }
  }
  
  if (mockupImages.lifestyle) {
    const lifestylePath = `printful/${blueprintId}/${colorName.replace(/\s+/g, '-').toLowerCase()}-lifestyle.jpg`;
    const permanentLifestyleUrl = await downloadAndStoreImage(mockupImages.lifestyle, lifestylePath);
    if (permanentLifestyleUrl) {
      permanentImages.lifestyle = permanentLifestyleUrl;
      console.log(`[MockupService/Printful] Stored lifestyle mockup permanently`);
    } else {
      permanentImages.lifestyle = mockupImages.lifestyle;
    }
  }

  return permanentImages;
}

// Known Printify Blueprint IDs that have proper Printful mappings (not fallback)
// Export this so catalog can show "Preview Only" indicator for unmapped products
export const KNOWN_MOCKUP_BLUEPRINT_IDS: Set<number> = new Set([
  // ============ T-SHIRTS (US-MADE) ============
  6,    // Bella+Canvas 3001 → Printful 71
  12,   // Bella+Canvas 3001 (duplicate blueprint) → Printful 71
  5,    // Next Level 3600 → Printful 108
  48,   // Bella+Canvas 3005 V-Neck → Printful 223
  184,  // Bella+Canvas 3413 Tri-Blend → Printful 162
  420,  // Bella+Canvas 3001Y Youth → Printful 307
  580,  // Bella+Canvas 3001T Toddler → Printful 306
  472,  // Bella+Canvas 6400 Women's → Printful 360
  
  // ============ TANK TOPS (US-MADE) ============
  39,   // Bella+Canvas 3480 Unisex Tank → Printful 248
  47,   // Bella+Canvas 8803 Women's Muscle Tank → Printful 271
  18,   // Next Level 1533 Women's Racerback → Printful 857
  141,  // Next Level 6733 Women's Tri-Blend Racerback → Printful 163
  
  // ============ LONG SLEEVES (US-MADE) ============
  41,   // Bella+Canvas 3501 → Printful 356
  45,   // Next Level 3601 → Printful 116
  66,   // Gildan 2400 → Printful 57
  301,  // Bella+Canvas 3501 (duplicate) → Printful 356
  
  // ============ HOODIES & SWEATSHIRTS (US-MADE) ============
  175,  // Bella+Canvas 3719 Pullover Hoodie → Printful 294
  394,  // Bella+Canvas 3719 (duplicate) → Printful 294
  439,  // Lane Seven LS14001 Hoodie → Printful 844
  445,  // Lane Seven LS14003 Zip Hoodie → Printful 943
  446,  // Lane Seven LS14004 Crewneck → Printful 845
  77,   // Gildan 18500 Heavy Blend Hoodie → Printful 146
  76,   // Gildan 18000 Crewneck Sweatshirt → Printful 145
  
  // ============ HATS ============
  384,  // Yupoong 6245CM Dad Hat → Printful 206
  297,  // Yupoong 6089M Snapback → Printful 99
  
  // ============ MUGS ============
  68,   // 11oz White Mug → Printful 19
  69,   // 15oz White Mug → Printful 88
  
  // ============ BAGS ============
  456,  // Liberty Bags 8502 Canvas Tote → Printful 97
  
  // ============ ACCESSORIES ============
  502,  // Sticker → Printful 358
  503,  // Sticker → Printful 358
  
  // ============ GILDAN T-SHIRTS ============
  145,  // Gildan 64000 → Printful 12
]);

/**
 * Check if a blueprint has a known mockup mapping (not fallback)
 */
export function hasKnownMockupMapping(blueprintId: number): boolean {
  return KNOWN_MOCKUP_BLUEPRINT_IDS.has(blueprintId);
}

/**
 * Auto-create a mapping between Printify blueprint and Printful product
 * Uses common product mappings for known blueprints
 */
async function createAutoMapping(printifyBlueprintId: number): Promise<any | null> {
  // Common mappings: Printify Blueprint ID → Printful Product ID
  // References: https://www.printful.com/custom-products
  const knownMappings: Record<number, { printfulId: number; brand: string; model: string; colorMapping?: Record<string, string> }> = {
    // ============ T-SHIRTS (US-MADE) ============
    // Bella+Canvas 3001 Unisex Short Sleeve Jersey T-Shirt
    6: { printfulId: 71, brand: 'Bella+Canvas', model: '3001', colorMapping: { 'Solid Black': 'Black', 'Solid White': 'White', 'Sport Grey': 'Athletic Heather' } },
    12: { printfulId: 71, brand: 'Bella+Canvas', model: '3001', colorMapping: { 'Solid Black': 'Black', 'Solid White': 'White' } },
    // Next Level 3600 Premium Fitted T-Shirt
    5: { printfulId: 108, brand: 'Next Level', model: '3600' },
    // Bella+Canvas 3005 V-Neck
    48: { printfulId: 223, brand: 'Bella+Canvas', model: '3005' },
    // Bella+Canvas 3413 Tri-Blend
    184: { printfulId: 162, brand: 'Bella+Canvas', model: '3413' },
    // Bella+Canvas 3001Y Youth Tee
    420: { printfulId: 307, brand: 'Bella+Canvas', model: '3001Y' },
    // Bella+Canvas 3001C Unisex Jersey Short Sleeve
    577: { printfulId: 71, brand: 'Bella+Canvas', model: '3001', colorMapping: { 'Solid Black': 'Black', 'Solid White': 'White', 'Sport Grey': 'Athletic Heather' } },
    // Bella+Canvas 3001T Toddler Tee
    580: { printfulId: 306, brand: 'Bella+Canvas', model: '3001T' },
    // Bella+Canvas 6400 Women's Relaxed T-Shirt
    472: { printfulId: 360, brand: 'Bella+Canvas', model: '6400' },
    // Gildan 64000 Softstyle
    145: { printfulId: 12, brand: 'Gildan', model: '64000' },
    
    // ============ TANK TOPS (US-MADE) ============
    // Bella+Canvas 3480 Unisex Jersey Tank
    39: { printfulId: 248, brand: 'Bella+Canvas', model: '3480' },
    91: { printfulId: 248, brand: 'Bella+Canvas', model: '3480' },
    // Bella+Canvas 8803 Women's Flowy Muscle Tank
    47: { printfulId: 271, brand: 'Bella+Canvas', model: '8803' },
    // Next Level 1533 Women's Ideal Racerback Tank
    18: { printfulId: 857, brand: 'Next Level', model: '1533' },
    // Next Level 6733 Women's Tri-Blend Racerback Tank
    141: { printfulId: 163, brand: 'Next Level', model: '6733' },
    
    // ============ LONG SLEEVES (US-MADE) ============
    // Bella+Canvas 3501 Unisex Jersey Long Sleeve
    41: { printfulId: 356, brand: 'Bella+Canvas', model: '3501' },
    301: { printfulId: 356, brand: 'Bella+Canvas', model: '3501' },
    // Next Level 3601 Men's Long Sleeve
    45: { printfulId: 116, brand: 'Next Level', model: '3601' },
    // Gildan 2400 Ultra Cotton Long Sleeve
    66: { printfulId: 57, brand: 'Gildan', model: '2400' },
    
    // ============ HOODIES & SWEATSHIRTS (US-MADE) ============
    // Bella+Canvas 3719 Unisex Sponge Fleece Hoodie
    175: { printfulId: 294, brand: 'Bella+Canvas', model: '3719' },
    394: { printfulId: 294, brand: 'Bella+Canvas', model: '3719' },
    // Lane Seven LS14001 Premium Mid-Weight Hoodie
    439: { printfulId: 844, brand: 'Lane Seven', model: 'LS14001' },
    // Lane Seven LS14003 Premium Full Zip Hoodie
    445: { printfulId: 943, brand: 'Lane Seven', model: 'LS14003' },
    // Lane Seven LS14004 Premium Crew Neck Sweatshirt
    446: { printfulId: 845, brand: 'Lane Seven', model: 'LS14004' },
    // Gildan 18500 Heavy Blend Hoodie
    77: { printfulId: 146, brand: 'Gildan', model: '18500' },
    // Gildan 18000 Heavy Blend Crewneck Sweatshirt
    76: { printfulId: 145, brand: 'Gildan', model: '18000' },
    
    // ============ HATS ============
    // Yupoong 6245CM Dad Hat
    384: { printfulId: 206, brand: 'Yupoong', model: '6245CM' },
    // Yupoong 6089M Snapback
    297: { printfulId: 99, brand: 'Yupoong', model: '6089M' },
    
    // ============ MUGS ============
    // 11oz White Mug
    68: { printfulId: 19, brand: 'Generic', model: '11oz Mug' },
    // 15oz White Mug
    69: { printfulId: 88, brand: 'Generic', model: '15oz Mug' },
    
    // ============ BAGS ============
    // Liberty Bags 8502 Canvas Tote
    456: { printfulId: 97, brand: 'Liberty Bags', model: '8502' },
    
    // ============ ACCESSORIES ============
    // Stickers (multiple Printify blueprints map to Printful stickers)
    502: { printfulId: 358, brand: 'Generic', model: 'Sticker' },
    503: { printfulId: 358, brand: 'Generic', model: 'Sticker' },
  };

  let mapping = knownMappings[printifyBlueprintId];
  
  // FALLBACK: If no specific mapping exists, use Bella+Canvas 3001 as a generic t-shirt mockup
  // This ensures mockups always work even for unmapped products
  if (!mapping) {
    console.warn(`[MockupService/Printful] No known mapping for blueprint ${printifyBlueprintId}, using fallback Bella+Canvas 3001`);
    mapping = { printfulId: 71, brand: 'Bella+Canvas (fallback)', model: '3001', colorMapping: { 'Solid Black': 'Black', 'Solid White': 'White' } };
  }

  console.log(`[MockupService/Printful] Creating auto-mapping: Blueprint ${printifyBlueprintId} → Printful ${mapping.printfulId}`);

  // Insert the mapping
  const inserted = await fsInsert('printify_printful_mapping', {
    printifyBlueprintId,
    printfulProductId: mapping.printfulId,
    printfulBrand: mapping.brand,
    printfulModel: mapping.model,
    colorMapping: mapping.colorMapping || null,
    matchConfidence: 'auto',
    isActive: true,
  });

  return inserted;
}

/**
 * Get all cached mockups for a product
 */
export async function getCachedMockupsForProduct(
  blueprintId: number,
  printProviderId: number
): Promise<Record<string, { front?: string; back?: string; lifestyle?: string }>> {
  const cached = await fsQuery('mockup_cache', [
    ['blueprintId', '==', blueprintId],
    ['printProviderId', '==', printProviderId],
    ['status', '==', 'active'],
  ]);

  const result: Record<string, { front?: string; back?: string; lifestyle?: string }> = {};

  for (const entry of cached) {
    if (!result[entry.colorName]) {
      result[entry.colorName] = {};
    }

    // Map canonical placement to front/back
    if (entry.canonicalPlacementId === "front" || entry.canonicalPlacementId === "FRONT_CHEST" || entry.canonicalPlacementId === "FRONT_CENTER") {
      result[entry.colorName].front = entry.mockupUrl;
      // Include lifestyle mockup if available
      if (entry.lifestyleMockupUrl) {
        result[entry.colorName].lifestyle = entry.lifestyleMockupUrl;
      }
    } else if (entry.canonicalPlacementId === "BACK_FULL" || entry.canonicalPlacementId === "BACK_UPPER") {
      result[entry.colorName].back = entry.mockupUrl;
    }
  }

  return result;
}

/**
 * Pre-generate mockups for all colors of a product
 * Used for non-customizable products to cache all variants upfront
 */
export async function preGenerateMockupsForProduct(
  blueprintId: number,
  printProviderId: number,
  artworkBlackUrl: string,
  artworkWhiteUrl: string | null,
  storage: IStorage,
  colors: Array<{ name: string; hex?: string }>
): Promise<{ generated: number; failed: number }> {
  let generated = 0;
  let failed = 0;

  for (const color of colors) {
    try {
      // Determine which artwork to use based on color
      const useWhiteArtwork = color.hex ? isColorDark(color.hex) : false;
      const artworkUrl = useWhiteArtwork && artworkWhiteUrl ? artworkWhiteUrl : artworkBlackUrl;
      const artworkVariant = useWhiteArtwork && artworkWhiteUrl ? "white" : "black";

      await getMockupWithFallback(
        {
          blueprintId,
          printProviderId,
          colorName: color.name,
          colorHex: color.hex,
          canonicalPlacementId: "front",
          artworkUrl,
          artworkVariant,
        },
        storage
      );

      generated++;
      console.log(`[MockupService] Pre-generated mockup for ${color.name} (${generated}/${colors.length})`);
    } catch (err) {
      failed++;
      console.error(`[MockupService] Failed to generate mockup for ${color.name}:`, err);
    }
  }

  return { generated, failed };
}

/**
 * Get canonical placements with preview coordinates
 */
export async function getCanonicalPlacements(category?: string) {
  if (category) {
    return fsQuery('canonical_placements', [['category', '==', category]], 'sortOrder', 'asc');
  }
  return fsGetAll('canonical_placements', 'sortOrder');
}

/**
 * Get placement mapping for a provider
 */
export async function getProviderPlacementKey(
  providerId: string,
  canonicalPlacementId: string
): Promise<string | null> {
  const mapping = await fsQuery('provider_placement_mappings', [
    ['podProviderId', '==', providerId],
    ['canonicalPlacementId', '==', canonicalPlacementId],
  ], undefined, 'asc', 1);

  return mapping[0]?.providerPlacementKey || null;
}

/**
 * Get lifestyle mockup for a specific color with AI composite fallback
 * Workflow: 1. Check cache 2. Try POD lifestyle 3. AI base + composite QR graphic
 */
export async function getLifestyleMockupForColor(
  params: {
    blueprintId: number;
    printProviderId: number;
    colorName: string;
    colorHex?: string;
    qrContent: string; // Text/URL to encode in QR (we generate artwork in-memory)
    productType?: 'shirt' | 'hat' | 'bag' | 'mug' | 'other';
  },
  storage: IStorage
): Promise<{ lifestyleUrl: string | null; fromCache: boolean; qrVariant: 'black' | 'white' }> {
  const { blueprintId, printProviderId, colorName, colorHex, qrContent, productType = 'shirt' } = params;
  
  // Determine QR color based on shirt luminance
  const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
  const qrVariant = needsWhiteQR ? 'white' : 'black';
  
  console.log(`[LifestyleMockup] Getting lifestyle for ${colorName} (hex: ${colorHex}, qrVariant: ${qrVariant})`);
  
  // Step 1: Check mockup_cache for existing lifestyle
  const cached = await fsQuery('mockup_cache', [
    ['blueprintId', '==', blueprintId],
    ['printProviderId', '==', printProviderId],
    ['colorName', '==', colorName],
    ['artworkVariant', '==', qrVariant],
  ], undefined, 'asc', 1);
  
  if (cached.length > 0 && cached[0].lifestyleMockupUrl) {
    console.log(`[LifestyleMockup] Cache HIT: ${colorName} has lifestyle mockup`);
    return {
      lifestyleUrl: cached[0].lifestyleMockupUrl,
      fromCache: true,
      qrVariant,
    };
  }
  
  // Step 2: Skip POD for now - Printify rarely has lifestyle images
  // Go directly to AI composite fallback for consistent results
  console.log(`[LifestyleMockup] Using AI composite (POD lifestyle rarely available)`);
  
  // Step 3: AI fallback - composite QR onto base lifestyle image
  console.log(`[LifestyleMockup] No POD lifestyle, using AI composite fallback`);
  
  try {
    const { overlayGraphicOnProduct } = await import("./composite-image-generator");
    const { generateTextQRCode } = await import("./qr-generator");
    
    // Get base lifestyle image from local filesystem
    const path = await import("path");
    const fs = await import("fs");
    
    const basePath = path.join(process.cwd(), "attached_assets", "lifestyle-bases", `${productType}-model.png`);
    
    if (!fs.existsSync(basePath)) {
      console.warn(`[LifestyleMockup] No base lifestyle image for ${productType} at ${basePath}, using flat mockup`);
      return {
        lifestyleUrl: null,
        fromCache: false,
        qrVariant,
      };
    }
    
    // Generate QR artwork as data URL in-memory (no network calls needed!)
    // Use contrasting background for visibility - qrcode library doesn't support transparency
    const qrColor = qrVariant === 'white' ? '#FFFFFF' : '#000000';
    const qrBackground = qrVariant === 'white' ? '#000000' : '#FFFFFF';
    const qrDataUrl = await generateTextQRCode(qrContent, { 
      color: qrColor, 
      backgroundColor: qrBackground 
    });
    
    console.log(`[LifestyleMockup] Generated ${qrVariant} QR data URL, compositing onto ${productType} base`);
    
    // Composite the QR graphic onto the base (canvas loadImage accepts data URLs!)
    const compositeBuffer = await overlayGraphicOnProduct({
      baseImageUrl: basePath,
      graphicUrl: qrDataUrl,
      productType,
      position: 'chest',
      graphicScale: 0.25,
    });
    
    // Return as data URL (faster for previews, no storage needed)
    const lifestyleDataUrl = `data:image/png;base64,${compositeBuffer.toString('base64')}`;
    
    console.log(`[LifestyleMockup] AI composite complete for ${colorName} (${qrVariant} QR)`);
    
    return {
      lifestyleUrl: lifestyleDataUrl,
      fromCache: false,
      qrVariant,
    };
  } catch (err) {
    console.error(`[LifestyleMockup] AI composite failed:`, err);
    return {
      lifestyleUrl: null,
      fromCache: false,
      qrVariant,
    };
  }
}

/**
 * Exported wrapper for job queue - generates a Printful mockup with standard parameters
 * This is the interface the job queue uses, abstracting internal implementation details
 */
export async function generatePrintfulMockup(params: {
  productId: string;
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  artworkUrl: string;
  artworkVariant: "black" | "white";
  qrSize: "small" | "medium" | "large";
  fulfillmentProvider?: "printify" | "printful";
  placement?: string;
  printMethod?: "dtg" | "dtf";
}): Promise<{ mockupUrl?: string; lifestyleUrl?: string; error?: string }> {
  try {
    const result = await generatePrintfulMockupInternal({
      blueprintId: params.blueprintId,
      printProviderId: params.printProviderId,
      colorName: params.colorName,
      artworkUrl: params.artworkUrl,
      canonicalPlacementId: params.placement || "front",
      qrSize: params.qrSize,
      fulfillmentProvider: params.fulfillmentProvider || "printify",
      printMethod: params.printMethod,
    });

    if (!result) {
      return { error: "Mockup generation failed - no result returned" };
    }

    return {
      mockupUrl: result.flat,
      lifestyleUrl: result.lifestyle,
    };
  } catch (err: any) {
    return { error: err.message || "Unknown error during mockup generation" };
  }
}
