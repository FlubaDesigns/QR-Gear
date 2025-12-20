import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateTextQRCode, generateImageQRCode, validateQRContent } from "./lib/qr-generator";
import { insertQrDesignSchema, insertCartItemSchema, insertOrderSchema, insertOrderItemSchema, insertPricingRuleSchema, insertAdminSettingsSchema, insertProductSchema } from "@shared/schema";
import { verifyWidgetToken, signWidgetToken, widgetTokenSchema } from "./lib/widget-auth";
import { printify, getUSAPrintProviders } from "./lib/printify";
import { uploadImage, getImageBuffer, deleteImage, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "./lib/image-upload";
import { insertHostedImageSchema } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup Replit Auth
  await setupAuth(app);

  // Auth routes - returns null if not authenticated (no 401)
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      if (!req.isAuthenticated() || !req.user?.claims?.sub) {
        return res.json(null);
      }
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user || null);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.json(null);
    }
  });

  // Browsing history routes
  app.get('/api/browsing-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const history = await storage.getBrowsingHistory(userId);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/browsing-history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { productId } = req.body;
      const entry = await storage.addBrowsingHistory({ userId, productId });
      res.json(entry);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Widget API
  app.get("/api/widget/session", async (req, res) => {
    try {
      const token = req.query.token as string;
      
      if (!token) {
        return res.status(400).json({ error: "Token required" });
      }

      const payload = verifyWidgetToken(token);
      
      if (!payload) {
        return res.status(401).json({ error: "Invalid or expired token" });
      }

      // Get featured products (limit to 6 for widget)
      const allProducts = await storage.getAllProducts();
      const featuredProducts = allProducts.slice(0, 6).map(p => ({
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl || "",
        basePrice: p.basePrice,
        category: p.category,
      }));

      // Generate QR code linking to KC business listing
      const qrCodeDataUrl = await generateTextQRCode(payload.kcListingUrl, {
        color: "#1e40af",
        backgroundColor: "#ffffff",
      });

      res.json({
        businessName: payload.businessName,
        businessLogoUrl: payload.businessLogoUrl,
        kcListingUrl: payload.kcListingUrl,
        qrCodeDataUrl,
        products: featuredProducts,
      });
    } catch (error: any) {
      console.error("Widget session error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Widget Token Generation (for embed script - requires API key)
  app.post("/api/widget/token", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      const expectedKey = process.env.WIDGET_API_KEY;
      
      if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid or missing API key" });
      }

      const allowedOrigins = (process.env.ALLOWED_WIDGET_ORIGINS || 'https://kingdomconnects.com').split(',');
      const origin = req.headers.origin || req.headers.referer || '';
      const isAllowedOrigin = allowedOrigins.some(allowed => origin.startsWith(allowed.trim()));
      
      if (!isAllowedOrigin && origin) {
        console.warn("Widget token request from unauthorized origin:", origin);
      }

      const validated = widgetTokenSchema.parse(req.body);
      const token = signWidgetToken(validated);
      
      res.json({ 
        token,
        expiresIn: 3600
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid widget configuration", details: error.errors });
      }
      console.error("Widget token error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // QR Code Generation
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

  // QR Designs
  app.get("/api/designs", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(401).json({ error: "User ID required" });
      }

      const designs = await storage.getQrDesignsByUser(userId);
      res.json(designs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/designs", async (req, res) => {
    try {
      const validatedData = insertQrDesignSchema.parse(req.body);
      const design = await storage.createQrDesign(validatedData);
      res.json(design);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/designs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const design = await storage.updateQrDesign(id, req.body);
      
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      
      res.json(design);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/designs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQrDesign(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
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

  // Hosted Images API
  app.post("/api/images/upload", async (req, res) => {
    try {
      const { imageData, originalName, mimeType, title, description, businessName, businessLogo, userId } = req.body;

      if (!imageData || !originalName || !mimeType) {
        return res.status(400).json({ error: "Missing required fields: imageData, originalName, mimeType" });
      }

      const uploadResult = await uploadImage(imageData, originalName, mimeType);

      const hostedImage = await storage.createHostedImage({
        userId: userId || null,
        fileName: uploadResult.fileName,
        originalName,
        mimeType: uploadResult.mimeType,
        sizeBytes: uploadResult.sizeBytes,
        storageUrl: uploadResult.storageUrl,
        publicUrl: uploadResult.publicUrl,
        title: title || null,
        description: description || null,
        businessName: businessName || null,
        businessLogo: businessLogo || null,
        isActive: true,
        expiresAt: null,
      });

      res.json({
        id: hostedImage.id,
        publicUrl: `/view/${hostedImage.id}`,
        directUrl: uploadResult.publicUrl,
        landingUrl: `/view/${hostedImage.id}`,
      });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      
      const images = await storage.getHostedImagesByUser("");
      const allImages = images.length > 0 ? images : [];
      
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage) {
        const fileName = `hosted-images/${imageId}.jpeg`;
        const imageBuffer = await getImageBuffer(fileName);
        
        if (!imageBuffer) {
          const pngFileName = `hosted-images/${imageId}.png`;
          const pngBuffer = await getImageBuffer(pngFileName);
          
          if (!pngBuffer) {
            return res.status(404).json({ error: "Image not found" });
          }
          
          res.setHeader("Content-Type", pngBuffer.mimeType);
          res.setHeader("Cache-Control", "public, max-age=31536000");
          return res.send(pngBuffer.buffer);
        }
        
        res.setHeader("Content-Type", imageBuffer.mimeType);
        res.setHeader("Cache-Control", "public, max-age=31536000");
        return res.send(imageBuffer.buffer);
      }

      const imageBuffer = await getImageBuffer(hostedImage.storageUrl);
      
      if (!imageBuffer) {
        return res.status(404).json({ error: "Image file not found" });
      }

      await storage.incrementImageViews(imageId);

      res.setHeader("Content-Type", imageBuffer.mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000");
      res.send(imageBuffer.buffer);
    } catch (error: any) {
      console.error("Image serve error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/info/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage || !hostedImage.isActive) {
        return res.status(404).json({ error: "Image not found" });
      }

      res.json({
        id: hostedImage.id,
        title: hostedImage.title,
        description: hostedImage.description,
        businessName: hostedImage.businessName,
        businessLogo: hostedImage.businessLogo,
        views: hostedImage.views,
        createdAt: hostedImage.createdAt,
      });
    } catch (error: any) {
      console.error("Image info error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/images/user/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const images = await storage.getHostedImagesByUser(userId);
      res.json(images);
    } catch (error: any) {
      console.error("User images error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/images/:imageId", async (req, res) => {
    try {
      const { imageId } = req.params;
      const hostedImage = await storage.getHostedImage(imageId);
      
      if (!hostedImage) {
        return res.status(404).json({ error: "Image not found" });
      }

      await deleteImage(hostedImage.storageUrl);
      await storage.deleteHostedImage(imageId);

      res.json({ success: true });
    } catch (error: any) {
      console.error("Image delete error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Cart - protected routes using session user
  app.get("/api/cart", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const items = await storage.getCartItemsByUser(userId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/cart", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertCartItemSchema.parse({
        ...req.body,
        userId,
      });
      const item = await storage.addCartItem(validatedData);
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/cart/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { quantity } = req.body;
      const item = await storage.updateCartItem(id, quantity);
      
      if (!item) {
        return res.status(404).json({ error: "Cart item not found" });
      }
      
      res.json(item);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/cart/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCartItem(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Orders - protected routes using session user
  app.get("/api/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getOrdersByUser(userId);
      
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          return { ...order, items };
        })
      );
      
      res.json(ordersWithItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      if (order.userId !== userId) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const items = await storage.getOrderItems(id);
      res.json({ ...order, items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orders", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedOrder = insertOrderSchema.parse({
        ...req.body.order,
        userId,
      });
      const order = await storage.createOrder(validatedOrder);

      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          const validatedItem = insertOrderItemSchema.parse({
            ...item,
            orderId: order.id,
          });
          await storage.createOrderItem(validatedItem);
        }
      }

      res.json(order);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ADMIN ROUTES ============

  // Admin Settings
  app.get("/api/admin/settings", isAuthenticated, async (req: any, res) => {
    try {
      let settings = await storage.getAdminSettings();
      if (!settings) {
        settings = await storage.upsertAdminSettings({});
      }
      res.json(settings);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/settings", isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertAdminSettingsSchema.partial().parse(req.body);
      const settings = await storage.upsertAdminSettings(validated);
      res.json(settings);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Pricing Rules
  app.get("/api/admin/pricing-rules", isAuthenticated, async (req: any, res) => {
    try {
      const rules = await storage.getPricingRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/pricing-rules", isAuthenticated, async (req: any, res) => {
    try {
      const validated = insertPricingRuleSchema.parse(req.body);
      const rule = await storage.createPricingRule(validated);
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/pricing-rules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validated = insertPricingRuleSchema.partial().parse(req.body);
      const rule = await storage.updatePricingRule(id, validated);
      if (!rule) {
        return res.status(404).json({ error: "Pricing rule not found" });
      }
      res.json(rule);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/pricing-rules/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePricingRule(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Products - Get all products with admin fields
  app.get("/api/admin/products", isAuthenticated, async (req: any, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle product enabled/disabled
  app.patch("/api/admin/products/:id/toggle", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const product = await storage.toggleProductEnabled(id, enabled);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update product admin settings (markup, production cost, etc.)
  app.patch("/api/admin/products/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const validated = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, validated);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      res.json(product);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Printify Catalog Browsing - Get blueprints
  app.get("/api/admin/printify/blueprints", isAuthenticated, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const blueprints = await printify.getCatalogBlueprints();
      res.json(blueprints);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get print providers for a blueprint
  app.get("/api/admin/printify/blueprints/:id/providers", isAuthenticated, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const { id } = req.params;
      const providers = await printify.getPrintProviders(parseInt(id));
      res.json(providers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get variants for a blueprint + provider combination
  app.get("/api/admin/printify/blueprints/:blueprintId/providers/:providerId/variants", isAuthenticated, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const { blueprintId, providerId } = req.params;
      const variants = await printify.getVariants(parseInt(blueprintId), parseInt(providerId));
      res.json(variants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add product from Printify catalog
  app.post("/api/admin/products/from-printify", isAuthenticated, async (req: any, res) => {
    try {
      const { blueprintId, printProviderId, name, description, category, basePrice, imageUrl, manufacturer, madeInUSA, availablePlacements, availableColors, metadata } = req.body;
      
      const productId = `printify_${blueprintId}_${printProviderId}_${Date.now()}`;
      
      const product = await storage.createProduct({
        id: productId,
        printifyId: null,
        blueprintId,
        printProviderId,
        name,
        description,
        category,
        basePrice: basePrice.toString(),
        imageUrl,
        manufacturer,
        madeInUSA: madeInUSA || false,
        availablePlacements,
        availableColors,
        metadata,
        isEnabled: false,
        markupPercent: "0",
        markupFixed: "0",
        qrProductionCost: "0",
        sortOrder: 0,
      });
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ HOSTING TIERS ENDPOINTS ============
  
  // Get all hosting tiers
  app.get("/api/hosting-tiers", async (req, res) => {
    try {
      const tiers = await storage.getHostingTiers();
      res.json(tiers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Seed default hosting tiers (admin only)
  app.post("/api/admin/hosting-tiers/seed", isAuthenticated, async (req, res) => {
    try {
      const existingTiers = await storage.getHostingTiers();
      if (existingTiers.length > 0) {
        return res.json({ message: "Hosting tiers already exist", tiers: existingTiers });
      }

      const defaultTiers = [
        { code: "1_year", name: "1 Year Hosting", description: "Included with purchase", durationDays: 365, isIncluded: true, priceUpcharge: "0", sortOrder: 1 },
        { code: "3_year", name: "3 Year Hosting", description: "Extended hosting for 3 years", durationDays: 1095, isIncluded: false, priceUpcharge: "10", sortOrder: 2 },
        { code: "5_year", name: "5 Year Hosting", description: "Extended hosting for 5 years", durationDays: 1825, isIncluded: false, priceUpcharge: "20", sortOrder: 3 },
        { code: "permanent", name: "Permanent Hosting", description: "Lifetime hosting - never expires", durationDays: 36500, isIncluded: false, priceUpcharge: "50", sortOrder: 4 },
      ];

      const createdTiers = [];
      for (const tier of defaultTiers) {
        const created = await storage.createHostingTier(tier);
        createdTiers.push(created);
      }

      res.json({ message: "Default hosting tiers created", tiers: createdTiers });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ QR TEMPLATES ENDPOINTS ============
  
  // Get active templates for customers
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getActiveQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get all templates
  app.get("/api/admin/templates", isAuthenticated, async (req, res) => {
    try {
      const templates = await storage.getQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRICING QUOTE ENDPOINT ============
  
  // Calculate final price for a product with customizations (supports all 3 product lines)
  app.post("/api/pricing/quote", async (req, res) => {
    try {
      const { 
        productId, 
        productLine = "text", // 'text', 'template', 'custom'
        hasTextAbove, 
        hasTextBelow, 
        templateId,
        hostingTierCode = "1_year",
      } = req.body;
      
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const settings = await storage.getAdminSettings();
      
      const basePrice = parseFloat(product.basePrice);
      const markupPercent = parseFloat(product.markupPercent || "0") || parseFloat(settings?.globalMarkupPercent || "25");
      const markupFixed = parseFloat(product.markupFixed || "0") || parseFloat(settings?.globalMarkupFixed || "0");
      const qrCost = parseFloat(product.qrProductionCost || "0") || parseFloat(settings?.globalQrProductionCost || "2");
      
      let price = basePrice + qrCost;
      price = price * (1 + markupPercent / 100) + markupFixed;
      
      const breakdown: Record<string, number> = {
        base: basePrice,
        qrProduction: qrCost,
        markup: (basePrice + qrCost) * (markupPercent / 100) + markupFixed,
        textAboveUpcharge: 0,
        textBelowUpcharge: 0,
        templateUpcharge: 0,
        hostingUpcharge: 0,
      };

      // Add text upcharges (applicable to all lines)
      if (hasTextAbove) {
        const upcharge = parseFloat(settings?.textAboveUpcharge || "2");
        price += upcharge;
        breakdown.textAboveUpcharge = upcharge;
      }
      if (hasTextBelow) {
        const upcharge = parseFloat(settings?.textBelowUpcharge || "2");
        price += upcharge;
        breakdown.textBelowUpcharge = upcharge;
      }

      // Template upcharge (Line 2)
      if (productLine === "template" && templateId) {
        const template = await storage.getQrTemplate(templateId);
        if (template) {
          const upcharge = parseFloat(template.priceUpcharge || "0");
          price += upcharge;
          breakdown.templateUpcharge = upcharge;
        }
      }

      // Hosting tier upcharge (Line 2 & 3 - for image hosting)
      if ((productLine === "template" || productLine === "custom") && hostingTierCode !== "1_year") {
        const tier = await storage.getHostingTierByCode(hostingTierCode);
        if (tier && !tier.isIncluded) {
          const upcharge = parseFloat(tier.priceUpcharge || "0");
          price += upcharge;
          breakdown.hostingUpcharge = upcharge;
        }
      }
      
      res.json({
        productLine,
        basePrice,
        finalPrice: Math.round(price * 100) / 100,
        breakdown,
        hostingTier: hostingTierCode,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get enabled products only (for store front)
  app.get("/api/store/products", async (req, res) => {
    try {
      const products = await storage.getEnabledProducts();
      // Don't expose admin pricing fields to storefront
      const safeProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        imageUrl: p.imageUrl,
        manufacturer: p.manufacturer,
        madeInUSA: p.madeInUSA,
        availablePlacements: p.availablePlacements,
        availableColors: p.availableColors,
      }));
      res.json(safeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
