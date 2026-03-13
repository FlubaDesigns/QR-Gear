import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";
import { fsQuery } from "../lib/firestore-crud";

export function registerDesignPublishRoutes(app: Express): void {
  app.post("/api/admin/designs/:id/publish", isAdmin, async (req, res) => {
    const { id } = req.params;
    const { selectedColors, defaultColor, blueprintId, printProviderId } = req.body;
    
    try {
      // Validate request
      if (!selectedColors || !Array.isArray(selectedColors) || selectedColors.length === 0) {
        return res.status(400).json({ error: "selectedColors array is required" });
      }
      if (!defaultColor) {
        return res.status(400).json({ error: "defaultColor is required" });
      }
      // Ensure defaultColor is in selectedColors
      if (!selectedColors.includes(defaultColor)) {
        return res.status(400).json({ error: "defaultColor must be one of the selectedColors" });
      }
      if (!blueprintId || !printProviderId) {
        return res.status(400).json({ error: "blueprintId and printProviderId are required" });
      }
      
      // Get the design
      const design = await storage.getCustomDesign(id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      // Check print-ready artwork exists
      const printReadyArtUrl = design.printifyCompositeUrl || 
        (design.placementImages as any)?.["front"] || (design.placementImages as any)?.["front-chest"] ||
        Object.values(design.placementImages || {})[0];
      
      if (!printReadyArtUrl) {
        return res.status(400).json({ error: "No print-ready artwork found. Save the design first." });
      }
      
      // Update status to processing
      await storage.updateCustomDesign(id, {
        publishStatus: "processing",
        publishError: null,
        selectedColors,
        defaultColor,
        blueprintId,
        printProviderId,
      });
      
      // Import Printify client
      const { syncProductVariants, printify } = await import("../lib/printify");
      
      console.log(`[Publish] Starting mockup generation for design ${id}`);
      console.log(`[Publish] Blueprint: ${blueprintId}, Provider: ${printProviderId}`);
      console.log(`[Publish] Colors: ${selectedColors.join(", ")}, Default: ${defaultColor}`);
      
      // Get all variants for this blueprint/provider
      const { variants } = await syncProductVariants(blueprintId, printProviderId);
      
      // Filter variants to only include selected colors
      const selectedVariants = variants.filter(v => 
        v.options?.color && selectedColors.includes(v.options.color)
      );
      
      if (selectedVariants.length === 0) {
        await storage.updateCustomDesign(id, {
          publishStatus: "failed",
          publishError: "No matching variants found for selected colors",
        });
        return res.status(400).json({ error: "No matching variants found for selected colors" });
      }
      
      const variantIds = selectedVariants.map(v => v.id);
      console.log(`[Publish] Found ${variantIds.length} variants for selected colors`);
      
      // Upload artwork to Printify
      console.log(`[Publish] Uploading artwork to Printify: ${printReadyArtUrl}`);
      const imageUpload = await printify.uploadImage(printReadyArtUrl, `design-${id}.png`);
      console.log(`[Publish] Uploaded image ID: ${imageUpload.id}`);
      
      // Get placement info
      const { syncProductPlacements } = await import("../lib/printify");
      const { placements: providerPlacements } = await syncProductPlacements(blueprintId, printProviderId);
      const placement = providerPlacements[0]?.position || "front";
      
      // Create Printify product with all selected variants
      const productData = {
        title: design.projectName || `QR Design - ${id}`,
        description: `Custom QR design: ${design.projectName || id}`,
        blueprint_id: blueprintId,
        print_provider_id: printProviderId,
        variants: variantIds.map(vid => ({
          id: vid,
          price: 2500, // $25 placeholder price
          is_enabled: true,
        })),
        print_areas: [{
          variant_ids: variantIds,
          placeholders: [{
            position: placement,
            images: [{
              id: imageUpload.id,
              x: 0.5,
              y: 0.5,
              scale: 1.0,
              angle: 0,
            }],
          }],
        }],
      };
      
      console.log(`[Publish] Creating Printify product...`);
      const printifyProduct = await printify.createProduct(productData);
      console.log(`[Publish] Created Printify product: ${printifyProduct.id}`);
      
      // Poll for product to get mockup images (Printify generates them async)
      let attempts = 0;
      const maxAttempts = 15;
      let productWithMockups: any = null;
      let mockupsReady = false;
      
      while (attempts < maxAttempts && !mockupsReady) {
        // Exponential backoff: 2s, 3s, 4.5s, etc (cap at 10s)
        const delay = Math.min(2000 * Math.pow(1.5, attempts), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        try {
          productWithMockups = await printify.getProduct(printifyProduct.id);
          
          if (productWithMockups.images && productWithMockups.images.length > 0) {
            console.log(`[Publish] Mockups ready: ${productWithMockups.images.length} images`);
            mockupsReady = true;
          }
        } catch (pollError: any) {
          // Check for rate limiting
          if (pollError.message?.includes('429') || pollError.message?.includes('rate')) {
            console.warn(`[Publish] Rate limited, backing off... attempt ${attempts}/${maxAttempts}`);
            await new Promise(resolve => setTimeout(resolve, 5000)); // Extra delay on rate limit
          } else {
            console.error(`[Publish] Poll error: ${pollError.message}`);
          }
        }
        
        attempts++;
        if (!mockupsReady) {
          console.log(`[Publish] Waiting for mockups... attempt ${attempts}/${maxAttempts}`);
        }
      }
      
      // Check if mockups were generated
      if (!mockupsReady || !productWithMockups?.images?.length) {
        console.error(`[Publish] Mockups not ready after ${maxAttempts} attempts`);
        await storage.updateCustomDesign(id, {
          printifyProductId: printifyProduct.id,
          publishStatus: "failed",
          publishError: "Mockups not ready after timeout. Try again later.",
        });
        return res.status(504).json({ 
          error: "Mockups not ready after timeout", 
          printifyProductId: printifyProduct.id,
          message: "Product created on Printify but mockups not yet available. Try publishing again."
        });
      }
      
      // Extract mockups organized by color
      const mockupsByColor: Record<string, { front?: string; angles?: string[] }> = {};
      const selectedVariantIds: Record<string, number> = {};
      
      if (productWithMockups?.images) {
        // Printify returns images with variant_ids, organize by color
        for (const img of productWithMockups.images) {
          // Find which color this image belongs to
          for (const variantId of (img.variant_ids || [])) {
            const variant = selectedVariants.find(v => v.id === variantId);
            if (variant?.options?.color) {
              const color = variant.options.color;
              if (!mockupsByColor[color]) {
                mockupsByColor[color] = { angles: [] };
              }
              // First image for this color becomes the "front"
              if (!mockupsByColor[color].front) {
                mockupsByColor[color].front = img.src;
              }
              mockupsByColor[color].angles?.push(img.src);
            }
          }
        }
      }
      
      // Build variant ID lookup for order fulfillment
      for (const variant of selectedVariants) {
        if (variant.options?.color && variant.options?.size) {
          const key = `${variant.options.color}-${variant.options.size}`;
          selectedVariantIds[key] = variant.id;
        }
      }
      
      console.log(`[Publish] Extracted mockups for ${Object.keys(mockupsByColor).length} colors`);
      
      // Update design with all the mockup data
      await storage.updateCustomDesign(id, {
        printifyProductId: printifyProduct.id,
        printReadyArtUrl,
        mockupsByColor,
        selectedVariantIds,
        publishStatus: "complete",
        publishError: null,
      });
      
      console.log(`[Publish] Design ${id} published successfully`);
      
      res.json({
        success: true,
        printifyProductId: printifyProduct.id,
        mockupsByColor,
        selectedVariantIds,
        imagesCount: productWithMockups?.images?.length || 0,
      });
      
    } catch (error: any) {
      console.error(`[Publish] Error publishing design ${id}:`, error);
      
      // Update status to failed
      await storage.updateCustomDesign(id, {
        publishStatus: "failed",
        publishError: error.message,
      });
      
      res.status(500).json({ error: error.message });
    }
  });
  
  // Admin: Get publish status for a design
  app.get("/api/admin/designs/:id/publish-status", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const design = await storage.getCustomDesign(id);
      
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      res.json({
        status: (design as any).publishStatus || "draft",
        error: (design as any).publishError,
        mockupsByColor: (design as any).mockupsByColor,
        defaultColor: (design as any).defaultColor,
        printifyProductId: (design as any).printifyProductId,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
