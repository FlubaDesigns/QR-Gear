import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { fsQuery } from "../lib/firestore-crud";
import { registerMockupJobsRoutes } from "./mockup-jobs.routes";
import { registerDesignPublishRoutes } from "./design-publish.routes";

export function registerMockupRoutes(app: Express): void {
  registerMockupJobsRoutes(app);
  registerDesignPublishRoutes(app);

  app.get("/api/placements", async (req, res) => {
    try {
      const { category } = req.query;
      const { getCanonicalPlacements } = await import("../lib/mockup-service");
      const placements = await getCanonicalPlacements(category as string | undefined);
      res.json(placements);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get mockup with database-first lookup, Printify fallback
  // Used by frontend to get mockup for a specific product/color/placement
  app.post("/api/mockups/get-or-generate", async (req, res) => {
    try {
      const { 
        blueprintId, 
        printProviderId, 
        colorName, 
        colorHex,
        canonicalPlacementId = "front",
        artworkUrl,
        artworkVariant = "black"
      } = req.body;

      if (!blueprintId || !printProviderId || !colorName || !artworkUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, printProviderId, colorName, artworkUrl" 
        });
      }

      const { getMockupWithFallback } = await import("../lib/mockup-service");
      
      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId),
        colorName,
        colorHex,
        canonicalPlacementId,
        artworkUrl,
        artworkVariant,
      }, storage);

      res.json(result);
    } catch (error: any) {
      console.error("[MockupAPI] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all cached mockups for a product (for instant color switching)
  app.get("/api/mockups/cached/:blueprintId/:printProviderId", async (req, res) => {
    try {
      const { blueprintId, printProviderId } = req.params;
      const { getCachedMockupsForProduct } = await import("../lib/mockup-service");
      
      const mockups = await getCachedMockupsForProduct(
        parseInt(blueprintId),
        parseInt(printProviderId)
      );

      res.json({ mockups, count: Object.keys(mockups).length });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get lifestyle mockup for a specific color (with AI composite fallback)
  // Used by frontend when customer clicks a color swatch
  app.post("/api/mockups/lifestyle", async (req, res) => {
    try {
      const { 
        blueprintId, 
        printProviderId, 
        colorName, 
        colorHex,
        qrContent = "https://qrgear.shop",
        productType = 'shirt'
      } = req.body;

      if (!blueprintId || !printProviderId || !colorName) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, printProviderId, colorName" 
        });
      }

      const { getLifestyleMockupForColor } = await import("../lib/mockup-service");
      
      const result = await getLifestyleMockupForColor({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId),
        colorName,
        colorHex,
        qrContent,
        productType,
      }, storage);

      res.json(result);
    } catch (error: any) {
      console.error("[LifestyleMockupAPI] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Pre-generate mockups for all colors of a product
  app.post("/api/admin/mockups/pre-generate", isAdmin, async (req: any, res) => {
    try {
      const { blueprintId, printProviderId, artworkBlackUrl, artworkWhiteUrl } = req.body;

      if (!blueprintId || !printProviderId || !artworkBlackUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, printProviderId, artworkBlackUrl" 
        });
      }

      // Get colors from provider
      const { getProviderColorsWithFallback } = await import("../lib/printify");
      const colors = await getProviderColorsWithFallback(
        parseInt(blueprintId), 
        parseInt(printProviderId), 
        storage
      );

      if (!colors.length) {
        return res.status(400).json({ error: "No colors found for this provider" });
      }

      const { preGenerateMockupsForProduct } = await import("../lib/mockup-service");
      
      // This runs async - respond immediately
      res.json({ 
        message: `Pre-generating mockups for ${colors.length} colors...`,
        colors: colors.map((c: any) => c.name)
      });

      // Generate in background
      preGenerateMockupsForProduct(
        parseInt(blueprintId),
        parseInt(printProviderId),
        artworkBlackUrl,
        artworkWhiteUrl || null,
        storage,
        colors
      ).then(result => {
        console.log(`[MockupAPI] Pre-generation complete: ${result.generated} generated, ${result.failed} failed`);
      }).catch(err => {
        console.error("[MockupAPI] Pre-generation error:", err);
      });

    } catch (error: any) {
      console.error("[MockupAPI] Pre-generate error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PUBLIC STOREFRONT MOCKUP GENERATION ============
  
  // Public: Generate mockup for a store product color (no admin required)
  // Database-first: checks mockup_cache before generating via Printify
  app.post("/api/storefront/generate-mockup", async (req, res) => {
    try {
      const { productId, color, storeId, qrSize, qrSizePercent } = req.body;
      
      if (!productId || !color) {
        return res.status(400).json({ error: "productId and color are required" });
      }
      
      // Convert qrSizePercent to qrSize name, or use provided qrSize
      let resolvedQrSize: 'small' | 'medium' | 'large' = 'medium';
      if (qrSize && ['small', 'medium', 'large'].includes(qrSize)) {
        resolvedQrSize = qrSize;
      } else if (qrSizePercent) {
        if (qrSizePercent <= 30) resolvedQrSize = 'small';
        else if (qrSizePercent <= 50) resolvedQrSize = 'medium';
        else resolvedQrSize = 'large';
      }
      
      console.log(`[StorefrontMockup] QR size: ${resolvedQrSize} (from percent: ${qrSizePercent || 'default'})`);
      
      // For custom designs, productId comes as either "hello-world" or "custom_hello-world"
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
      
      // Get the product from products table
      const product = await storage.getProduct(canonicalProductId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const blueprintId = product.blueprintId;
      const printProviderId = product.printProviderId;
      
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }
      
      // Check if mockup already exists in product's mockupsByColor
      // Normalize color names for comparison (case-insensitive, trim whitespace)
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
        console.log(`[StorefrontMockup] Using ${usedFallback ? 'fallback' : 'cached'} mockup for "${matchedColorKey}"`);
        
        // Update product's default image and color to show this mockup
        const defaultImage = existingMockup.lifestyle || existingMockup.front;
        await storage.updateProduct(canonicalProductId, {
          defaultColor: color,
          imageUrl: defaultImage,
        });
        console.log(`[StorefrontMockup] Updated product defaultColor=${color}, imageUrl=${defaultImage}`);
        
        return res.json({ 
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
      }
      
      // Get artwork URL from custom design
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Parse placement images safely
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
      
      // Get color hex with fallback chain
      let colorHex: string | null = null;
      
      if (product.availableColors && Array.isArray(product.availableColors)) {
        const colorInfo = (product.availableColors as any[]).find(
          (c: any) => c.name?.toLowerCase() === color.toLowerCase()
        );
        colorHex = colorInfo?.hex || null;
      }
      
      if (!colorHex) {
        const { getProviderColorsWithFallback } = await import('../lib/printify.js');
        const colors = await getProviderColorsWithFallback(blueprintId, printProviderId, storage);
        const colorInfo = colors.find(
          (c: any) => c.name?.toLowerCase() === color.toLowerCase()
        );
        colorHex = colorInfo?.hex || null;
      }
      
      // Determine which artwork to use based on shirt color
      const { isColorDark } = await import('../lib/mockup-service.js');
      const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
      
      // Support multiple naming conventions: front-chest, front-center, or just "front"
      const blackArtwork = designPlacements["front"] || 
                           designPlacements["front-chest"] || 
                           designPlacements["front-chest-black"] || 
                           designPlacements["front-center"] ||
                           designPlacements["front-center-black"];
      const whiteArtwork = designPlacements["front-white"] ||
                           designPlacements["front-chest-white"] || 
                           designPlacements["front-center-white"];
      
      let artworkUrl: string;
      let artworkVariant: "black" | "white" = "black";
      
      console.log(`[StorefrontMockup] Color ${color} hex=${colorHex}, needsWhiteQR=${needsWhiteQR}`);
      console.log(`[StorefrontMockup] Available placements: ${Object.keys(designPlacements).join(', ')}`);
      console.log(`[StorefrontMockup] Black artwork: ${blackArtwork}, White artwork: ${whiteArtwork}`);
      
      if (needsWhiteQR && whiteArtwork) {
        artworkUrl = whiteArtwork;
        artworkVariant = "white";
        console.log(`[StorefrontMockup] Using WHITE artwork for dark shirt: ${color}`);
      } else if (blackArtwork) {
        artworkUrl = blackArtwork;
        artworkVariant = "black";
        console.log(`[StorefrontMockup] Using BLACK artwork for light shirt: ${color}`);
      } else {
        artworkUrl = design.printifyCompositeUrl || Object.values(designPlacements)[0] as string;
        console.log(`[StorefrontMockup] Using fallback artwork: ${artworkUrl}`);
      }
      
      // Mockup not found in database - check if it's pending in the job queue
      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      const pendingJobs = await mockupJobQueue.getJobsByProduct(canonicalProductId);
      const colorJobs = pendingJobs.filter(j => 
        j.colorName.toLowerCase() === color.toLowerCase() && 
        ['pending', 'processing', 'delayed'].includes(j.status)
      );
      
      if (colorJobs.length > 0) {
        // Mockup is being generated, return pending status
        console.log(`[StorefrontMockup] Mockup for ${color} is pending (${colorJobs.length} jobs in queue)`);
        return res.json({ 
          success: false, 
          pending: true,
          color, 
          message: `Mockup for ${color} is being generated. Please wait.`,
          jobCount: colorJobs.length
        });
      }
      
      // No mockup exists and none pending - this color wasn't queued
      console.log(`[StorefrontMockup] No mockup found for ${color} and none pending`);
      return res.status(404).json({ 
        error: `No mockup available for ${color}. Mockups are generated when the product is saved.`,
        color 
      });
    } catch (error: any) {
      console.error("[StorefrontMockup] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/test-mockup-sizes", isAdmin, async (req: any, res) => {
    try {
      const { productId, color } = req.body;
      
      if (!productId || !color) {
        return res.status(400).json({ error: "productId and color are required" });
      }
      
      const canonicalProductId = productId.startsWith('custom_') ? productId : `custom_${productId}`;
      const designId = productId.startsWith('custom_') ? productId.replace('custom_', '') : productId;
      
      const product = await storage.getProduct(canonicalProductId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const { blueprintId, printProviderId } = product;
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "Product missing blueprint or print provider" });
      }
      
      const design = await storage.getCustomDesign(designId);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Get artwork
      let designPlacements: Record<string, string> = {};
      if (typeof design.placementImages === 'string') {
        designPlacements = JSON.parse(design.placementImages);
      } else if (design.placementImages && typeof design.placementImages === 'object') {
        designPlacements = design.placementImages as Record<string, string>;
      }
      
      // Get color hex
      let colorHex: string | null = null;
      if (product.availableColors && Array.isArray(product.availableColors)) {
        const colorInfo = (product.availableColors as any[]).find(
          (c: any) => c.name?.toLowerCase() === color.toLowerCase()
        );
        colorHex = colorInfo?.hex || null;
      }
      
      const { isColorDark } = await import('../lib/mockup-service.js');
      const needsWhiteQR = colorHex ? isColorDark(colorHex) : false;
      
      const blackArtwork = designPlacements["front"] || designPlacements["front-chest"] || designPlacements["front-center"];
      const whiteArtwork = designPlacements["front-white"] || designPlacements["front-chest-white"] || designPlacements["front-center-white"];
      
      const artworkUrl = needsWhiteQR && whiteArtwork ? whiteArtwork : blackArtwork;
      
      if (!artworkUrl) {
        return res.status(400).json({ error: "No artwork found" });
      }
      
      // Generate mockups at all 3 sizes with delays to avoid rate limits
      const { printfulClient } = await import('../lib/printful.js');
      
      // Get Printful mapping from Firestore
      const mapping = await fsQuery('printify_printful_mapping', [
        ['printifyBlueprintId', '==', blueprintId],
        ['isActive', '==', true]
      ], undefined, 'asc', 1);
      
      if (mapping.length === 0) {
        return res.status(400).json({ error: "No Printful mapping for this blueprint" });
      }
      
      const printfulProductId = mapping[0].printfulProductId;
      const variants = await printfulClient.getVariantsByColor(printfulProductId, color);
      
      if (variants.length === 0) {
        return res.status(400).json({ error: `No Printful variants for color: ${color}` });
      }
      
      const targetVariant = variants.find(v => v.size === 'M') || variants[0];
      const printfiles = await printfulClient.getPrintfiles(printfulProductId);
      const frontPrintfile = printfiles.printfiles?.find((p: any) => p.printfile_id === 1) || printfiles.printfiles?.[0];
      
      const areaWidth = frontPrintfile?.width || 4500;
      const areaHeight = frontPrintfile?.height || 5400;
      
      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : "http://localhost:5000";
      const absoluteArtworkUrl = artworkUrl.startsWith("http") ? artworkUrl : `${baseUrl}${artworkUrl}`;
      
      const sizes = [
        { name: 'small', percent: 0.25 },
        { name: 'medium', percent: 0.45 },
        { name: 'large', percent: 0.65 },
      ];
      
      const results: { size: string; qrPixels: number; mockupUrl?: string; lifestyleUrl?: string; error?: string }[] = [];
      
      for (const sizeConfig of sizes) {
        try {
          console.log(`[TestMockupSizes] Generating ${sizeConfig.name} (${Math.round(sizeConfig.percent * 100)}%)...`);
          
          const qrSize = Math.round(areaWidth * sizeConfig.percent);
          
          const position = {
            area_width: areaWidth,
            area_height: areaHeight,
            width: qrSize,
            height: qrSize,
            top: Math.round(areaHeight * 0.15),
            left: Math.round((areaWidth - qrSize) / 2),
          };
          
          const task = await printfulClient.createMockupTask(
            printfulProductId,
            [targetVariant.id],
            [{
              placement: 'front',
              image_url: absoluteArtworkUrl,
              position,
            }],
            'jpg',
            ["Men's Lifestyle"]
          );
          
          if (!task.task_key) {
            results.push({ size: sizeConfig.name, qrPixels: qrSize, error: 'Task creation failed' });
            continue;
          }
          
          const result = await printfulClient.waitForMockupTask(task.task_key, 60000);
          
          if (!result.mockups || result.mockups.length === 0) {
            results.push({ size: sizeConfig.name, qrPixels: qrSize, error: 'No mockups returned' });
            continue;
          }
          
          const mainMockup = result.mockups[0];
          let lifestyleUrl = mainMockup.extra?.find((e: any) => 
            e.option_group?.toLowerCase().includes('lifestyle')
          )?.url;
          
          results.push({
            size: sizeConfig.name,
            qrPixels: qrSize,
            mockupUrl: mainMockup.mockup_url,
            lifestyleUrl: lifestyleUrl || mainMockup.mockup_url,
          });
          
          // Rate limit delay between sizes
          if (sizeConfig !== sizes[sizes.length - 1]) {
            console.log(`[TestMockupSizes] Waiting 3 seconds for rate limit...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
          }
        } catch (err: any) {
          results.push({ size: sizeConfig.name, qrPixels: 0, error: err.message });
        }
      }
      
      res.json({
        success: true,
        color,
        areaWidth,
        areaHeight,
        results,
      });
    } catch (error: any) {
      console.error("[TestMockupSizes] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ MOCKUP JOB QUEUE ENDPOINTS ============
  // Portable job queue for rate-limited mockup generation

  // Create batch mockup jobs for a product
  // Public - anyone can create a shirt without login
  // Options:
  //   fullGeneration: true = all placements × all QR sizes (for admin catalog products)
  //   placements: ["front", "back"] = specific placements to generate
}
