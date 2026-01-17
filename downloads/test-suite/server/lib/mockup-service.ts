/**
 * Mockup Service - Database-first with Printify fallback
 * 
 * Architecture:
 * 1. Check mockup_cache table for existing mockup
 * 2. If not found, generate via Printify and cache result
 * 3. Download images and store in Object Storage for permanent URLs
 * 4. Return cached URL for instant display
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { mockupCache, canonicalPlacements, providerPlacementMappings, productPlacementAvailability, printifyPrintfulMapping } from "../../shared/schema";
import type { IStorage } from "../storage";
import { downloadAndStoreFromUrl } from "./firebase-storage-service";
import { printfulClient } from "./printful";

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
  } = request;

  // Validate canonicalPlacementId is provided
  if (!canonicalPlacementId) {
    throw new Error("canonicalPlacementId is required");
  }

  // Validate placement exists
  const placementExists = await db
    .select({ id: canonicalPlacements.id })
    .from(canonicalPlacements)
    .where(eq(canonicalPlacements.id, canonicalPlacementId))
    .limit(1);

  if (placementExists.length === 0) {
    throw new Error(`Unknown canonical placement: ${canonicalPlacementId}`);
  }

  // If productId provided, validate placement is available for this product
  if (productId) {
    const placementAvailable = await db
      .select({ id: productPlacementAvailability.id })
      .from(productPlacementAvailability)
      .where(
        and(
          eq(productPlacementAvailability.productId, productId),
          eq(productPlacementAvailability.canonicalPlacementId, canonicalPlacementId),
          eq(productPlacementAvailability.isEnabled, true)
        )
      )
      .limit(1);

    if (placementAvailable.length === 0) {
      console.warn(`[MockupService] Placement ${canonicalPlacementId} not available for product ${productId}. Proceeding anyway for blueprint-level cache.`);
      // Note: We log but don't block since mockups are cached at blueprint level
    }
  }

  // Step 1: Check cache
  const cached = await db
    .select()
    .from(mockupCache)
    .where(
      and(
        eq(mockupCache.blueprintId, blueprintId),
        eq(mockupCache.printProviderId, printProviderId),
        eq(mockupCache.colorName, colorName),
        eq(mockupCache.canonicalPlacementId, canonicalPlacementId),
        eq(mockupCache.artworkVariant, artworkVariant)
      )
    )
    .limit(1);

  if (cached.length > 0 && cached[0].status === "active") {
    console.log(`[MockupService] Cache HIT: ${colorName} ${canonicalPlacementId}`);
    return {
      mockupUrl: cached[0].mockupUrl,
      lifestyleMockupUrl: cached[0].lifestyleMockupUrl,
      fromCache: true,
      generatedAt: cached[0].generatedAt,
    };
  }

  console.log(`[MockupService] Cache MISS: ${colorName} ${canonicalPlacementId} - generating via Printful`);

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
  });

  if (!mockupResult || !mockupResult.flat) {
    throw new Error("Failed to generate mockup from Printful");
  }

  const mockupUrl = mockupResult.flat;
  const lifestyleMockupUrl = mockupResult.lifestyle || null;

  // Step 3: Cache the result
  const now = new Date();
  await db
    .insert(mockupCache)
    .values({
      blueprintId,
      printProviderId,
      colorName,
      colorHex,
      canonicalPlacementId,
      artworkUrl,
      artworkVariant,
      mockupUrl,
      lifestyleMockupUrl,
      podProviderId: "printify",
      status: "active",
      generatedAt: now,
    })
    .onConflictDoUpdate({
      target: [
        mockupCache.blueprintId,
        mockupCache.printProviderId,
        mockupCache.colorName,
        mockupCache.canonicalPlacementId,
        mockupCache.artworkVariant,
      ],
      set: {
        mockupUrl,
        lifestyleMockupUrl,
        colorHex,
        artworkUrl,
        status: "active",
        generatedAt: now,
      },
    });

  console.log(`[MockupService] Generated and cached mockup for ${colorName} (lifestyle: ${!!lifestyleMockupUrl})`);

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
}): Promise<{ flat?: string; lifestyle?: string } | null> {
  const { blueprintId, printProviderId, colorName, colorHex, artworkUrl, canonicalPlacementId } = params;

  console.log(`[MockupService/Printful] Generating mockup for blueprint ${blueprintId}, color ${colorName}`);

  // Step 1: Look up the Printify-to-Printful mapping
  const mapping = await db
    .select()
    .from(printifyPrintfulMapping)
    .where(
      and(
        eq(printifyPrintfulMapping.printifyBlueprintId, blueprintId),
        eq(printifyPrintfulMapping.isActive, true)
      )
    )
    .limit(1);

  if (mapping.length === 0) {
    console.warn(`[MockupService/Printful] No mapping found for blueprint ${blueprintId}. Creating auto-mapping...`);
    
    // Try to auto-create mapping for common products
    const autoMapping = await createAutoMapping(blueprintId);
    if (!autoMapping) {
      console.error(`[MockupService/Printful] Could not create auto-mapping for blueprint ${blueprintId}`);
      return null;
    }
    mapping.push(autoMapping);
  }

  const printfulProductId = mapping[0].printfulProductId;
  const colorMappingData = mapping[0].colorMapping as Record<string, string> | null;
  
  // Map Printify color name to Printful color name if needed
  let printfulColorName = colorName;
  if (colorMappingData && colorMappingData[colorName]) {
    printfulColorName = colorMappingData[colorName];
    console.log(`[MockupService/Printful] Mapped color: ${colorName} → ${printfulColorName}`);
  }

  // Make artwork URL absolute
  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "http://localhost:5000";
  const absoluteArtworkUrl = artworkUrl.startsWith("http") ? artworkUrl : `${baseUrl}${artworkUrl}`;

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

  // Step 4: Map canonical placement to Printful placement
  let printfulPlacement = 'front';
  if (canonicalPlacementId === 'BACK_FULL' || canonicalPlacementId === 'BACK_UPPER') {
    printfulPlacement = 'back';
  }

  // Step 5: Create mockup task with lifestyle option groups
  const lifestyleOptionGroups = ["Men's Lifestyle", "Women's Lifestyle"];
  
  const task = await printfulClient.createMockupTask(
    printfulProductId,
    [targetVariant.id],
    [{
      placement: printfulPlacement,
      image_url: absoluteArtworkUrl,
      position,
    }],
    'jpg',
    lifestyleOptionGroups
  );

  if (!task.task_key) {
    console.error(`[MockupService/Printful] Mockup task creation failed`);
    return null;
  }

  console.log(`[MockupService/Printful] Task created: ${task.task_key}`);

  // Step 6: Wait for task completion
  const result = await printfulClient.waitForMockupTask(task.task_key, 60000);

  if (!result.mockups || result.mockups.length === 0) {
    console.error(`[MockupService/Printful] No mockups returned`);
    return null;
  }

  // Step 7: Extract mockup URLs
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

  // Step 8: Download and store in Object Storage for permanent URLs
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

/**
 * Auto-create a mapping between Printify blueprint and Printful product
 * Uses common product mappings for known blueprints
 */
async function createAutoMapping(printifyBlueprintId: number): Promise<typeof printifyPrintfulMapping.$inferSelect | null> {
  // Common mappings: Printify Blueprint ID → Printful Product ID
  const knownMappings: Record<number, { printfulId: number; brand: string; model: string; colorMapping?: Record<string, string> }> = {
    // Bella+Canvas 3001 Unisex Short Sleeve Jersey T-Shirt
    6: { printfulId: 71, brand: 'Bella+Canvas', model: '3001', colorMapping: { 'Solid Black': 'Black', 'Solid White': 'White' } },
    // Gildan 64000 Unisex Softstyle T-Shirt
    5: { printfulId: 145, brand: 'Gildan', model: '64000' },
    // Add more mappings as needed
  };

  const mapping = knownMappings[printifyBlueprintId];
  if (!mapping) {
    console.warn(`[MockupService/Printful] No known mapping for blueprint ${printifyBlueprintId}`);
    return null;
  }

  console.log(`[MockupService/Printful] Creating auto-mapping: Blueprint ${printifyBlueprintId} → Printful ${mapping.printfulId}`);

  // Insert the mapping
  const [inserted] = await db
    .insert(printifyPrintfulMapping)
    .values({
      printifyBlueprintId,
      printfulProductId: mapping.printfulId,
      printfulBrand: mapping.brand,
      printfulModel: mapping.model,
      colorMapping: mapping.colorMapping || null,
      matchConfidence: 'auto',
      isActive: true,
    })
    .returning();

  return inserted;
}

/**
 * Get all cached mockups for a product
 */
export async function getCachedMockupsForProduct(
  blueprintId: number,
  printProviderId: number
): Promise<Record<string, { front?: string; back?: string; lifestyle?: string }>> {
  const cached = await db
    .select()
    .from(mockupCache)
    .where(
      and(
        eq(mockupCache.blueprintId, blueprintId),
        eq(mockupCache.printProviderId, printProviderId),
        eq(mockupCache.status, "active")
      )
    );

  const result: Record<string, { front?: string; back?: string; lifestyle?: string }> = {};

  for (const entry of cached) {
    if (!result[entry.colorName]) {
      result[entry.colorName] = {};
    }

    // Map canonical placement to front/back
    if (entry.canonicalPlacementId === "FRONT_CHEST" || entry.canonicalPlacementId === "FRONT_CENTER") {
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
          canonicalPlacementId: "FRONT_CHEST",
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
  let query = db.select().from(canonicalPlacements);
  
  if (category) {
    query = query.where(eq(canonicalPlacements.category, category)) as typeof query;
  }
  
  return query.orderBy(canonicalPlacements.sortOrder);
}

/**
 * Get placement mapping for a provider
 */
export async function getProviderPlacementKey(
  providerId: string,
  canonicalPlacementId: string
): Promise<string | null> {
  const mapping = await db
    .select()
    .from(providerPlacementMappings)
    .where(
      and(
        eq(providerPlacementMappings.podProviderId, providerId),
        eq(providerPlacementMappings.canonicalPlacementId, canonicalPlacementId)
      )
    )
    .limit(1);

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
  const cached = await db
    .select()
    .from(mockupCache)
    .where(
      and(
        eq(mockupCache.blueprintId, blueprintId),
        eq(mockupCache.printProviderId, printProviderId),
        eq(mockupCache.colorName, colorName),
        eq(mockupCache.artworkVariant, qrVariant)
      )
    )
    .limit(1);
  
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
}): Promise<{ mockupUrl?: string; lifestyleUrl?: string; error?: string }> {
  try {
    const result = await generatePrintfulMockupInternal({
      blueprintId: params.blueprintId,
      printProviderId: params.printProviderId,
      colorName: params.colorName,
      artworkUrl: params.artworkUrl,
      canonicalPlacementId: "FRONT_CHEST",
      qrSize: params.qrSize,
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
