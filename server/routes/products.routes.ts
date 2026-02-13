import type { Express } from "express";
import { storage } from "../storage";
import { generateTextQRCode, generateImageQRCode, validateQRContent } from "../lib/qr-generator";
import { printify, getUSAPrintProviders } from "../lib/printify";

export function registerProductRoutes(app: Express): void {
  app.post("/api/qr/generate", async (req, res) => {
    try {
      const { content, type, style } = req.body;

      if (!validateQRContent(content, type)) {
        return res.status(400).json({ error: "Invalid QR code content" });
      }

      const qrCodeDataUrl =
        type === "text"
          ? await generateTextQRCode(content, style)
          : await generateImageQRCode(content, style);

      res.json({ qrCode: qrCodeDataUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Image (GET - returns actual PNG image for canvas/img loading)
  app.get("/api/qr/image", async (req, res) => {
    try {
      const { text, color = "black" } = req.query;

      if (!text || typeof text !== "string") {
        return res.status(400).json({ error: "Missing 'text' query parameter" });
      }

      const qrColor = color === "white" ? "#FFFFFF" : "#000000";
      const qrCodeDataUrl = await generateTextQRCode(text, { color: qrColor, backgroundColor: "transparent" });
      
      // Convert data URL to buffer
      const base64Data = qrCodeDataUrl.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.send(buffer);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Note: QR Designs endpoints moved to authenticated section (see SAVED DESIGNS ENDPOINTS)

  // Products - Public endpoint returns only enabled products
  app.get("/api/products", async (req, res) => {
    try {
      const { store, segment, featured } = req.query;
      
      // If store is provided, use the proper store filtering via partner_store_products
      if (store && typeof store === "string") {
        const products = await storage.getProductsForStore(
          store,
          segment && typeof segment === "string" ? segment : undefined
        );
        return res.json(products);
      }
      
      // Get all enabled products
      const products = await storage.getAllProducts();
      let enabledProducts = products.filter(p => p.isEnabled);
      
      // Filter by featured if requested
      if (featured === "true") {
        enabledProducts = enabledProducts.filter(p => p.isFeatured);
        
        // Fetch admin settings for pricing calculations
        const settings = await storage.getAdminSettings();
        const globalMarkupPercent = parseFloat(settings?.globalMarkupPercent || "25");
        const globalMarkupFixed = parseFloat(settings?.globalMarkupFixed || "0");
        const globalQrCost = parseFloat(settings?.globalQrProductionCost || "2");
        const additionalPlacementCost = parseFloat(settings?.additionalPlacementCost || "4");
        
        // For featured products, enrich with mockups and QR artwork from custom_designs
        const designs = await storage.getCustomDesigns();
        
        const enrichedProducts = enabledProducts.map((product) => {
          // IMPORTANT: Use customerPrice set by admin in Admin Products section
          // Only fall back to calculation if customerPrice is not set
          let retailPrice: number;
          if (product.customerPrice) {
            retailPrice = parseFloat(product.customerPrice);
          } else {
            // Fallback calculation only if admin hasn't set customerPrice
            const baseCost = parseFloat(product.basePrice) || 0;
            const qrCost = parseFloat(product.qrProductionCost || "0") || globalQrCost;
            const markupFixed = parseFloat(product.markupFixed || "0") || globalMarkupFixed;
            const markupPercent = parseFloat(product.markupPercent || "0") || globalMarkupPercent;
            const placements = product.availablePlacements || [];
            const extraPlacementCount = Math.max(0, placements.length - 1);
            const placementUpcharge = extraPlacementCount * additionalPlacementCost;
            const totalCost = baseCost + qrCost + placementUpcharge;
            retailPrice = Math.ceil((totalCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
          }
          
          // Try to find the matching custom design by the product ID pattern
          // Custom design IDs are like "qr-gear-main-home-tee-dec2025" 
          // Product IDs are like "custom_qr-gear-main-home-tee-dec2025-1"
          const customDesignId = product.id.replace(/^custom_/, '').replace(/-\d+$/, '');
          const matchingDesign = designs.find(d => d.id === customDesignId || d.productId?.toString() === product.blueprintId?.toString());
          
          // Get all placement images (includes black and white variants for each placement)
          let placementImages: Record<string, string> | null = null;
          let frontChestImage: string | null = null;
          let frontChestImageWhite: string | null = null;
          if (matchingDesign?.placementImages) {
            const placements = typeof matchingDesign.placementImages === 'string' 
              ? JSON.parse(matchingDesign.placementImages) 
              : matchingDesign.placementImages;
            placementImages = placements;
            frontChestImage = placements?.["front-chest"] || null;
            frontChestImageWhite = placements?.["front-chest-white"] || null;
          }
          
          // Get Printify mockups if available (realistic product images)
          // First check product.mockupsByColor, then fall back to custom_design.mockupsByColor
          // Normalize mockupsByColor - handle string (older rows), null, or object
          let mockupsByColor: Record<string, any> | null = null;
          // First try the product's own mockupsByColor (populated by star button mockup generation)
          const productMockups = (product as any)?.mockupsByColor;
          const rawMockups = productMockups || (matchingDesign as any)?.mockupsByColor;
          if (rawMockups) {
            if (typeof rawMockups === 'string') {
              try {
                mockupsByColor = JSON.parse(rawMockups);
              } catch {
                mockupsByColor = null;
              }
            } else if (typeof rawMockups === 'object') {
              mockupsByColor = rawMockups;
            }
          }
          
          // Normalize selectedColors - handle string (older rows), null, or array
          let selectedColors: string[] | null = null;
          const rawSelectedColors = (matchingDesign as any)?.selectedColors;
          if (rawSelectedColors) {
            if (typeof rawSelectedColors === 'string') {
              try {
                const parsed = JSON.parse(rawSelectedColors);
                selectedColors = Array.isArray(parsed) ? parsed : null;
              } catch {
                selectedColors = null;
              }
            } else if (Array.isArray(rawSelectedColors)) {
              selectedColors = rawSelectedColors;
            }
          }
          // Fallback to mockupsByColor keys if no selectedColors
          if (!selectedColors && mockupsByColor) {
            selectedColors = Object.keys(mockupsByColor);
          }
          
          // Normalize defaultColor
          const rawDefaultColor = (matchingDesign as any)?.defaultColor;
          let defaultColor: string | null = typeof rawDefaultColor === 'string' ? rawDefaultColor : null;
          
          // Validate defaultColor is in selectedColors or mockupsByColor
          const validDefaultColor = 
            (defaultColor && selectedColors?.includes(defaultColor)) ? defaultColor :
            (defaultColor && mockupsByColor && mockupsByColor[defaultColor]) ? defaultColor :
            (mockupsByColor ? Object.keys(mockupsByColor)[0] : null);
          
          // Get the default mockup image (from validated color or first available)
          let defaultMockupImage: string | null = null;
          if (mockupsByColor && validDefaultColor && mockupsByColor[validDefaultColor]?.front) {
            defaultMockupImage = mockupsByColor[validDefaultColor].front;
          } else if (mockupsByColor) {
            // Fallback to first available color
            const firstColor = Object.keys(mockupsByColor)[0];
            if (firstColor) {
              defaultMockupImage = mockupsByColor[firstColor]?.front || null;
            }
          }
          
          // Get availableColors with hex values from product data
          let availableColorsWithHex: Array<{name: string, hex?: string}> = [];
          const rawAvailableColors = product.availableColors;
          if (rawAvailableColors) {
            if (Array.isArray(rawAvailableColors)) {
              availableColorsWithHex = rawAvailableColors as Array<{name: string, hex?: string}>;
            }
          }
          
          // Determine if this is a customizable product or store template
          // Store templates (pre-made designs) are not customizable
          const metadata = typeof product.metadata === 'object' ? product.metadata as Record<string, any> : {};
          const isCustomizable = metadata?.allowCustomization !== false && 
            !product.id.startsWith('custom_') && 
            !product.id.includes('-template-');
          
          return {
            ...product,
            retailPrice, // Calculated final price with markup and QR cost
            qrCodeUrl: matchingDesign?.qrCodeUrl || null,
            frontChestImage,
            frontChestImageWhite,
            placementImages, // All placements including white variants (e.g., back, back-white, left-sleeve, left-sleeve-white)
            // New mockup fields (normalized and validated)
            mockupsByColor,
            defaultColor: validDefaultColor, // Use validated color that exists in mockups
            selectedColors,
            defaultMockupImage, // Pre-computed default image for quick display
            availableColorsWithHex, // Colors with hex values for color swatches
            isCustomizable, // Whether user can customize the design
          };
        });
        
        return res.json(enrichedProducts);
      }
      
      res.json(enabledProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/products/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const product = await storage.getProduct(id);
      
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Printify Catalog API
  app.get("/api/printify/status", async (req, res) => {
    res.json({ 
      configured: printify.isConfigured,
      message: printify.isConfigured 
        ? "Printify API is connected" 
        : "Printify API key or Shop ID not configured"
    });
  });

  app.get("/api/printify/catalog", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const blueprints = await printify.getCatalogBlueprints();
      res.json(blueprints);
    } catch (error: any) {
      console.error("Printify catalog error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/catalog/:blueprintId", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      const [blueprint, providers] = await Promise.all([
        printify.getBlueprintDetails(blueprintId),
        getUSAPrintProviders(blueprintId),
      ]);
      res.json({ blueprint, providers });
    } catch (error: any) {
      console.error("Printify blueprint error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/catalog/:blueprintId/variants", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      const printProviderId = parseInt(req.query.providerId as string);
      
      if (!printProviderId) {
        return res.status(400).json({ error: "providerId query param required" });
      }
      
      const variants = await printify.getVariants(blueprintId, printProviderId);
      res.json(variants);
    } catch (error: any) {
      console.error("Printify variants error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/products", async (req, res) => {
    try {
      if (!printify.isConfigured) {
        return res.status(503).json({ error: "Printify not configured" });
      }
      const products = await printify.getShopProducts();
      res.json(products);
    } catch (error: any) {
      console.error("Printify products error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/printify/local-blueprints", async (req: any, res) => {
    try {
      const localBlueprints = await storage.getPrintifyBlueprints();
      res.json({ blueprints: localBlueprints.map(bp => ({ id: bp.id, title: bp.title })) });
    } catch (error: any) {
      console.error('[LocalBlueprints] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
