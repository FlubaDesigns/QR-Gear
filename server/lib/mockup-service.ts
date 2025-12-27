/**
 * Mockup Service - Database-first with Printify fallback
 * 
 * Architecture:
 * 1. Check mockup_cache table for existing mockup
 * 2. If not found, generate via Printify and cache result
 * 3. Return cached URL for instant display
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { mockupCache, canonicalPlacements, providerPlacementMappings, productPlacementAvailability } from "../../shared/schema";
import type { IStorage } from "../storage";

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

  // Poll for mockups
  let attempts = 0;
  const maxAttempts = 10;
  let mockupImages: { flat?: string; lifestyle?: string } = {};

  while (attempts < maxAttempts && !mockupImages.flat) {
    const delay = Math.min(2000 * Math.pow(1.5, attempts), 8000);
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempts++;

    const productDetails = await printify.getProduct(printifyProduct.id);
    if (productDetails.images && productDetails.images.length > 0) {
      // Printify returns images with different types
      // Parse through all images to find flat and lifestyle versions
      for (const img of productDetails.images) {
        const src = img.src || img;
        const isDefault = img.is_default || false;
        const position = (img.position || "").toLowerCase();
        
        // First image or default image is typically the flat product shot
        if (!mockupImages.flat && (isDefault || productDetails.images.indexOf(img) === 0)) {
          mockupImages.flat = typeof src === 'string' ? src : src.src;
        }
        
        // Look for lifestyle indicators in position or other metadata
        // Printify uses various naming conventions for lifestyle shots
        if (!mockupImages.lifestyle && position.includes('lifestyle')) {
          mockupImages.lifestyle = typeof src === 'string' ? src : src.src;
        }
      }
      
      // If we found more than one image, the additional ones might be lifestyle
      if (productDetails.images.length > 1 && !mockupImages.lifestyle) {
        // Check if any subsequent images look like lifestyle shots
        for (let i = 1; i < productDetails.images.length; i++) {
          const img = productDetails.images[i];
          const src = img.src || img;
          // Often the 2nd or 3rd image is a lifestyle shot
          if (typeof src === 'string' && src.includes('lifestyle')) {
            mockupImages.lifestyle = src;
            break;
          }
        }
      }
      
      if (mockupImages.flat) {
        console.log(`[MockupService] Got mockup URLs after ${attempts} attempts (lifestyle: ${!!mockupImages.lifestyle})`);
      }
    }
  }

  // Cleanup: delete temp product
  await printify.deleteProduct(printifyProduct.id).catch((err: Error) => {
    console.warn(`[MockupService] Failed to delete temp product: ${err.message}`);
  });

  return mockupImages;
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
