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
import { mockupCache, canonicalPlacements, providerPlacementMappings, productPlacementAvailability } from "../../shared/schema";
import type { IStorage } from "../storage";
import { Client as ObjectStorageClient } from "@replit/object-storage";

interface MockupRequest {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  colorHex?: string;
  canonicalPlacementId: string; // Required - must be explicitly provided
  artworkUrl: string;
  artworkVariant?: "black" | "white";
  productId?: string; // Optional - for placement availability validation
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
 * Download image from URL and upload to Object Storage for permanent storage
 * Returns the permanent Object Storage URL
 */
async function downloadAndStoreImage(
  imageUrl: string,
  storagePath: string
): Promise<string | null> {
  try {
    console.log(`[MockupService] Downloading image from ${imageUrl.substring(0, 80)}...`);
    
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`[MockupService] Failed to download image: ${response.status}`);
      return null;
    }
    
    const contentLength = response.headers.get('content-length');
    if (contentLength === '0') {
      console.error(`[MockupService] Image has zero content length`);
      return null;
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length < 1000) {
      console.error(`[MockupService] Image too small (${buffer.length} bytes), likely invalid`);
      return null;
    }
    
    console.log(`[MockupService] Downloaded ${buffer.length} bytes, uploading to Object Storage...`);
    
    const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
    if (!bucketId) {
      console.error(`[MockupService] DEFAULT_OBJECT_STORAGE_BUCKET_ID not set`);
      return null;
    }
    
    const client = new ObjectStorageClient({ bucketId });
    // Use custom-designs folder - same as QR artwork - served via /api/files/:filename
    const filename = `mockup-${storagePath.replace(/\//g, '-')}`;
    const fullPath = `custom-designs/${filename}`;
    
    await client.uploadFromBytes(fullPath, buffer);
    
    // Return URL that works through existing /api/files route
    const publicUrl = `/api/files/${filename}`;
    
    console.log(`[MockupService] Stored permanently at: ${publicUrl}`);
    return publicUrl;
  } catch (err) {
    console.error(`[MockupService] Failed to download/store image:`, err);
    return null;
  }
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

  console.log(`[MockupService] Cache MISS: ${colorName} ${canonicalPlacementId} - generating via Printify`);

  // Step 2: Generate via Printify
  const mockupResult = await generatePrintifyMockup({
    blueprintId,
    printProviderId,
    colorName,
    artworkUrl,
    canonicalPlacementId,
  });

  if (!mockupResult || !mockupResult.flat) {
    throw new Error("Failed to generate mockup from Printify");
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
 * Generate mockup via Printify API
 * Creates temporary product, waits for mockup, then deletes product
 * Returns both flat product shot and lifestyle mockup (with model) if available
 */
async function generatePrintifyMockup(params: {
  blueprintId: number;
  printProviderId: number;
  colorName: string;
  artworkUrl: string;
  canonicalPlacementId: string;
}): Promise<{ flat?: string; lifestyle?: string } | null> {
  const { blueprintId, printProviderId, colorName, artworkUrl, canonicalPlacementId } = params;

  // Import Printify client
  const { printify, syncProductVariants, syncProductPlacements } = await import("./printify");

  // Make artwork URL absolute
  const baseUrl = process.env.REPLIT_DEV_DOMAIN
    ? `https://${process.env.REPLIT_DEV_DOMAIN}`
    : "http://localhost:5000";
  const absoluteArtworkUrl = artworkUrl.startsWith("http") ? artworkUrl : `${baseUrl}${artworkUrl}`;

  // Get variants for this color
  const { variants } = await syncProductVariants(blueprintId, printProviderId);
  const colorVariants = variants.filter(
    (v) => v.options?.color && v.options.color.toLowerCase() === colorName.toLowerCase()
  );

  if (colorVariants.length === 0) {
    console.error(`[MockupService] No variants found for color: ${colorName}`);
    return null;
  }

  const variantIds = colorVariants.slice(0, 1).map((v) => v.id);

  // Upload artwork to Printify
  const imageUpload = await printify.uploadImage(absoluteArtworkUrl, `mockup-${blueprintId}-${colorName}.png`);
  console.log(`[MockupService] Uploaded artwork, ID: ${imageUpload.id}`);

  // Get provider placement key from canonical mapping
  const placementMapping = await db
    .select()
    .from(providerPlacementMappings)
    .where(
      and(
        eq(providerPlacementMappings.podProviderId, "printify"),
        eq(providerPlacementMappings.canonicalPlacementId, canonicalPlacementId)
      )
    )
    .limit(1);

  // Get provider placements to determine what's available for this product
  const { placements: providerPlacements } = await syncProductPlacements(blueprintId, printProviderId);
  const availablePositions = providerPlacements.map((p) => p.position);
  
  // Validate placement key against available positions
  let placementKey: string;
  
  if (placementMapping.length > 0) {
    // Have a mapping - check if that position is available for this product
    const mappedKey = placementMapping[0].providerPlacementKey;
    if (availablePositions.includes(mappedKey)) {
      placementKey = mappedKey;
      console.log(`[MockupService] Using mapped placement: ${canonicalPlacementId} → ${placementKey}`);
    } else {
      // Mapped position not available - log warning and use fallback
      console.warn(`[MockupService] Mapped placement "${mappedKey}" not available for blueprint ${blueprintId}. Available: [${availablePositions.join(', ')}]. Using first available.`);
      placementKey = availablePositions[0] || "front";
    }
  } else {
    // No mapping found - use first available
    console.warn(`[MockupService] No placement mapping for ${canonicalPlacementId}. Using first available: ${availablePositions[0] || "front"}`);
    placementKey = availablePositions[0] || "front";
  }

  // Create Printify product to generate mockups
  const productData = {
    title: `Mockup Gen - ${blueprintId} - ${colorName}`,
    description: `Auto-generated mockup`,
    blueprint_id: blueprintId,
    print_provider_id: printProviderId,
    variants: variantIds.map((vid) => ({
      id: vid,
      price: 2500,
      is_enabled: true,
    })),
    print_areas: [
      {
        variant_ids: variantIds,
        placeholders: [
          {
            position: placementKey,
            images: [
              {
                id: imageUpload.id,
                x: 0.5,
                y: 0.5,
                scale: 1.0,
                angle: 0,
              },
            ],
          },
        ],
      },
    ],
  };

  const printifyProduct = await printify.createProduct(productData);
  console.log(`[MockupService] Created temp Printify product: ${printifyProduct.id}`);

  // NEW APPROACH: Use Printify's publishing preview to trigger mockup rendering
  // The is_rendered flag NEVER becomes true for draft products - we must use publishing preview
  let mockupImages: { flat?: string; lifestyle?: string } = {};
  let hasRenderedMockups = false;
  const startTime = Date.now();
  const maxWaitTimeMs = 120000; // 2 minute max wait

  // Step 1: Wait a moment for product to be created, then force a refresh
  console.log(`[MockupService] Waiting for product initialization...`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 2: Try to force mockup refresh and request publishing preview
  try {
    console.log(`[MockupService] Requesting publishing preview to trigger mockup rendering...`);
    const previewResult = await printify.requestPublishingPreview(printifyProduct.id);
    
    // Check if preview returned mockups directly
    if (previewResult.images && previewResult.images.length > 0) {
      console.log(`[MockupService] Got ${previewResult.images.length} images from publishing preview`);
      for (const img of previewResult.images) {
        const src = img.src || '';
        const position = (img.position || "").toLowerCase();
        const isDefault = img.is_default || false;
        
        if (!mockupImages.flat && (isDefault || position === 'front' || position === '')) {
          mockupImages.flat = src;
          console.log(`[MockupService] Got flat mockup from preview: ${src.substring(0, 80)}...`);
        }
        
        const lifestyleKeywords = ['lifestyle', 'model', 'worn', 'person', 'other'];
        if (!mockupImages.lifestyle && lifestyleKeywords.some(kw => position.includes(kw))) {
          mockupImages.lifestyle = src;
          console.log(`[MockupService] Got lifestyle mockup from preview: ${src.substring(0, 80)}...`);
        }
      }
      
      if (mockupImages.flat) {
        hasRenderedMockups = true;
      }
    }
  } catch (previewErr: any) {
    console.log(`[MockupService] Publishing preview attempt: ${previewErr.message}`);
  }

  // Step 3: If preview didn't work, poll product.images with longer wait
  // Sometimes Printify takes time to render even after product creation
  if (!hasRenderedMockups) {
    console.log(`[MockupService] Preview didn't return mockups, polling product.images...`);
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts && !hasRenderedMockups && (Date.now() - startTime) < maxWaitTimeMs) {
      const delay = Math.min(5000 * Math.pow(1.2, attempts), 15000);
      await new Promise((resolve) => setTimeout(resolve, delay));
      attempts++;

      const productDetails = await printify.getProduct(printifyProduct.id);
      const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
      
      console.log(`[MockupService] Attempt ${attempts} (${elapsedSec}s): Checking product images...`);
      
      if (productDetails.images && productDetails.images.length > 0) {
        // Reset for this attempt
        mockupImages = {};
        
        for (let i = 0; i < productDetails.images.length; i++) {
          const img = productDetails.images[i];
          const src = typeof img === 'string' ? img : (img.src || '');
          const imgVariantIds: number[] = img.variant_ids || [];
          const isDefault = img.is_default || false;
          const position = (img.position || "").toLowerCase();
          
          // Check if this image is for our variant
          const matchesOurVariant = imgVariantIds.length === 0 || imgVariantIds.some(vid => variantIds.includes(vid));
          if (!matchesOurVariant) continue;
          
          // Check various rendering indicators
          const isRendered = img.is_rendered === true || img.render_status === "completed" || 
                            img.artwork_status === "fulfilled" || img.status === "rendered";
          
          console.log(`[MockupService] Image ${i}: position="${position}", is_rendered=${isRendered}, src_preview=${src.substring(0, 60)}...`);
          
          // Take front/default image as flat mockup (even if not marked rendered - try anyway)
          const isFrontPosition = position === '' || position === 'front' || position.includes('front');
          if (!mockupImages.flat && (isDefault || isFrontPosition || i === 0)) {
            // For Printify, if src contains 'images-api' or specific rendered URL patterns, it's likely rendered
            const looksRendered = src.includes('images-api.printify.com') || src.includes('/mockups/') || isRendered;
            if (looksRendered || attempts >= 5) {  // After 5 attempts, try anyway
              mockupImages.flat = src;
              console.log(`[MockupService] Selected flat mockup (attempt ${attempts}): ${src.substring(0, 80)}...`);
            }
          }
          
          // Look for lifestyle (model wearing it)
          const lifestyleKeywords = ['lifestyle', 'model', 'worn', 'person', 'other'];
          const isLifestylePosition = lifestyleKeywords.some(kw => position.includes(kw));
          
          if (!mockupImages.lifestyle && isLifestylePosition) {
            mockupImages.lifestyle = src;
            console.log(`[MockupService] Selected lifestyle mockup: ${src.substring(0, 80)}...`);
          }
        }
        
        if (mockupImages.flat) {
          hasRenderedMockups = true;
          console.log(`[MockupService] Got mockup URLs after ${attempts} attempts / ${elapsedSec}s`);
        }
      }
    }
  }
  
  // FALLBACK: If Printify didn't render in time, use local mockup generator
  if (!mockupImages.flat) {
    console.warn(`[MockupService] Printify did not render mockups in ${maxWaitTimeMs/1000}s - using local generator fallback`);
    
    // Delete the temp product before falling back
    await printify.deleteProduct(printifyProduct.id).catch((err: Error) => {
      console.warn(`[MockupService] Failed to delete temp product: ${err.message}`);
    });
    
    // Use local mockup generator
    const { generateLocalMockup } = await import("./local-mockup-generator");
    
    // Determine artwork variant based on color
    const colorHex = colorVariants[0]?.options?.color_code || "#FFFFFF";
    const isDarkColor = isColorDark(colorHex);
    
    const localMockup = await generateLocalMockup({
      shirtColor: colorName,
      shirtHex: colorHex,
      artworkUrl: absoluteArtworkUrl,
      artworkVariant: isDarkColor ? 'white' : 'black'
    }, blueprintId, printProviderId);
    
    if (localMockup) {
      console.log(`[MockupService] Generated local fallback mockup: ${localMockup.flatUrl}`);
      return { flat: localMockup.flatUrl, lifestyle: localMockup.lifestyleUrl || undefined };
    }
    
    return null;
  }

  // CRITICAL: Download and store images in Object Storage BEFORE deleting the temp product
  // Printify URLs expire after the product is deleted!
  const permanentImages: { flat?: string; lifestyle?: string } = {};
  
  if (mockupImages.flat) {
    const flatPath = `${blueprintId}/${printProviderId}/${colorName.replace(/\s+/g, '-').toLowerCase()}-flat.jpg`;
    const permanentFlatUrl = await downloadAndStoreImage(mockupImages.flat, flatPath);
    if (permanentFlatUrl) {
      permanentImages.flat = permanentFlatUrl;
      console.log(`[MockupService] Stored flat mockup permanently`);
    } else {
      // Fall back to Printify URL (may expire)
      permanentImages.flat = mockupImages.flat;
      console.warn(`[MockupService] Could not store flat mockup, using Printify URL (may expire)`);
    }
  }
  
  if (mockupImages.lifestyle) {
    const lifestylePath = `${blueprintId}/${printProviderId}/${colorName.replace(/\s+/g, '-').toLowerCase()}-lifestyle.jpg`;
    const permanentLifestyleUrl = await downloadAndStoreImage(mockupImages.lifestyle, lifestylePath);
    if (permanentLifestyleUrl) {
      permanentImages.lifestyle = permanentLifestyleUrl;
      console.log(`[MockupService] Stored lifestyle mockup permanently`);
    } else {
      // Fall back to Printify URL (may expire)
      permanentImages.lifestyle = mockupImages.lifestyle;
      console.warn(`[MockupService] Could not store lifestyle mockup, using Printify URL (may expire)`);
    }
  }

  // Cleanup: delete temp product (now safe because images are stored permanently)
  await printify.deleteProduct(printifyProduct.id).catch((err: Error) => {
    console.warn(`[MockupService] Failed to delete temp product: ${err.message}`);
  });

  return permanentImages;
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
