import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateTextQRCode, generateImageQRCode, validateQRContent } from "./lib/qr-generator";
import { insertQrDesignSchema, insertCartItemSchema, insertOrderSchema, insertOrderItemSchema } from "@shared/schema";
import { verifyWidgetToken, signWidgetToken, widgetTokenSchema } from "./lib/widget-auth";
import { printify, getUSAPrintProviders } from "./lib/printify";
import { uploadImage, getImageBuffer, deleteImage, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "./lib/image-upload";
import { insertHostedImageSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
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

  // Cart
  app.get("/api/cart", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(401).json({ error: "User ID required" });
      }

      const items = await storage.getCartItemsByUser(userId);
      res.json(items);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/cart", async (req, res) => {
    try {
      const validatedData = insertCartItemSchema.parse(req.body);
      const item = await storage.addCartItem(validatedData);
      res.json(item);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/cart/:id", async (req, res) => {
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

  app.delete("/api/cart/:id", async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCartItem(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const userId = req.query.userId as string;
      if (!userId) {
        return res.status(401).json({ error: "User ID required" });
      }

      const orders = await storage.getOrdersByUser(userId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const order = await storage.getOrder(id);
      
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const items = await storage.getOrderItems(id);
      res.json({ ...order, items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      const validatedOrder = insertOrderSchema.parse(req.body.order);
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

  const httpServer = createServer(app);
  return httpServer;
}
