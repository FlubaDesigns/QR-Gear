import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { generateTextQRCode, generateImageQRCode, validateQRContent } from "./lib/qr-generator";
import { insertQrDesignSchema, insertCartItemSchema, insertOrderSchema, insertOrderItemSchema, insertPricingRuleSchema, insertAdminSettingsSchema, insertProductSchema, insertPartnerStoreSchema, insertPartnerStoreProductSchema } from "@shared/schema";
import { verifyWidgetToken, signWidgetToken, widgetTokenSchema } from "./lib/widget-auth";
import { printify, getUSAPrintProviders, syncProductPlacements, syncProductVariants, detectCategory } from "./lib/printify";
import { uploadImage, getImageBuffer, deleteImage, ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from "./lib/image-upload";
import { insertHostedImageSchema } from "@shared/schema";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { sendOrderConfirmationEmail } from "./lib/email";
import { submitOrderToPrintify, checkPrintifyOrderStatus } from "./lib/printify-orders";
import { startCronJobs } from "./lib/cron-jobs";
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

  // Partner API - Simple endpoint for partners to fetch their products
  // Requires X-API-Key header with WIDGET_API_KEY value
  app.get("/api/partner/products", async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      const expectedKey = process.env.WIDGET_API_KEY;
      
      if (!expectedKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: "Invalid or missing API key" });
      }
      
      const { partnerId, context, slug } = req.query;
      
      if (!partnerId || typeof partnerId !== 'string') {
        return res.status(400).json({ error: "partnerId query parameter required" });
      }
      
      // Find partner store by slug (partnerId is their slug)
      const store = await storage.getPartnerStoreBySlug(partnerId);
      if (!store || !store.isActive) {
        return res.status(404).json({ error: "Partner not found or inactive" });
      }
      
      // Get partner's products
      const storeProducts = await storage.getPartnerStoreProducts(store.id);
      const enabledProducts = storeProducts.filter(sp => sp.isEnabled);
      
      // Fetch actual product details
      const productDetails = await Promise.all(
        enabledProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          if (!product || !product.isEnabled) return null;
          
          return {
            id: product.id,
            blueprintId: product.blueprintId,
            name: sp.customName || product.name,
            description: product.description,
            imageUrl: product.imageUrl,
            basePrice: sp.customPrice || product.basePrice,
            category: product.category,
            kcBusinessSlug: sp.kcBusinessSlug,
            sortOrder: sp.sortOrder,
          };
        })
      );
      
      let filteredProducts = productDetails.filter(Boolean);
      
      // Filter by context
      if (context === 'listing' && slug && typeof slug === 'string') {
        // Show only products linked to this specific business
        filteredProducts = filteredProducts.filter((p: any) => p.kcBusinessSlug === slug);
      } else if (context === 'homepage') {
        // Show only products NOT linked to a specific business (standalone store products)
        filteredProducts = filteredProducts.filter((p: any) => !p.kcBusinessSlug);
      }
      // 'dashboard' context shows all products (no filtering)
      
      res.json({
        partner: {
          id: store.id,
          name: store.name,
          slug: store.slug,
          primaryColor: store.primaryColor,
          accentColor: store.accentColor,
        },
        products: filteredProducts.sort((a: any, b: any) => (a?.sortOrder || 0) - (b?.sortOrder || 0)),
      });
    } catch (error: any) {
      console.error("Partner API error:", error);
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

  // Note: QR Designs endpoints moved to authenticated section (see SAVED DESIGNS ENDPOINTS)

  // Products - Public endpoint returns only enabled products
  app.get("/api/products", async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      // Only return enabled products for customers
      const enabledProducts = products.filter(p => p.isEnabled);
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

  // ============ STRIPE CHECKOUT ============
  
  // Get Stripe publishable key for frontend
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const { getStripePublishableKey } = await import('./stripeClient');
      const key = await getStripePublishableKey();
      res.json({ publishableKey: key });
    } catch (error: any) {
      res.status(500).json({ error: "Stripe not configured" });
    }
  });

  // Create Stripe checkout session from cart
  app.post("/api/checkout", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cartItems = await storage.getCartItemsByUser(userId);
      
      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();

      // Build line items from cart - customization contains product details
      const lineItems = cartItems.map((item) => {
        const customization = item.customization as any || {};
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: customization.productName || 'QR Gear Product',
              description: `${customization.productLine || 'Custom'} QR - ${customization.variantName || 'Standard'}`,
            },
            unit_amount: Math.round(parseFloat(item.price || '0') * 100),
          },
          quantity: item.quantity || 1,
        };
      });

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cart`,
        metadata: {
          userId,
        },
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify checkout session and create order
  app.get("/api/checkout/verify/:sessionId", isAuthenticated, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      const userId = req.user.claims.sub;

      const { getUncachableStripeClient } = await import('./stripeClient');
      const stripe = await getUncachableStripeClient();
      
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }

      // Check if order already exists for this session
      const existingOrder = await storage.getOrderByStripeSession(sessionId);
      if (existingOrder) {
        const items = await storage.getOrderItems(existingOrder.id);
        return res.json({ order: existingOrder, items, alreadyProcessed: true });
      }

      // Create order from cart
      const cartItems = await storage.getCartItemsByUser(userId);
      const totalAmount = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.price || '0') * (item.quantity || 1);
      }, 0);

      const order = await storage.createOrder({
        userId,
        status: 'paid',
        totalAmount: totalAmount.toFixed(2),
        stripeSessionId: sessionId,
        stripePaymentIntentId: session.payment_intent as string,
      });

      // Create order items from cart - customization contains all product details
      for (const item of cartItems) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity || 1,
          price: item.price,
          customization: item.customization as Record<string, unknown>,
        });
      }

      // Clear the cart
      for (const item of cartItems) {
        await storage.deleteCartItem(item.id);
      }

      const orderItems = await storage.getOrderItems(order.id);

      // Send order confirmation email
      const user = await storage.getUser(userId);
      if (user?.email) {
        sendOrderConfirmationEmail({
          orderId: order.id,
          customerEmail: user.email,
          customerName: user.firstName || 'Customer',
          items: orderItems.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            price: parseFloat(item.price),
          })),
          totalAmount,
          orderDate: new Date(),
        }).catch(err => console.error('Failed to send order confirmation:', err));
      }

      res.json({ order, items: orderItems });
    } catch (error: any) {
      console.error('Verify checkout error:', error);
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

  // Submit order to Printify for fulfillment
  app.post("/api/orders/:id/submit-printify", isAuthenticated, async (req: any, res) => {
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

      const { shippingAddress } = req.body;
      if (!shippingAddress) {
        return res.status(400).json({ error: "Shipping address required" });
      }

      const result = await submitOrderToPrintify(id, shippingAddress);
      if (result.success) {
        res.json({ success: true, printifyOrderId: result.printifyOrderId });
      } else {
        res.status(500).json({ error: result.error });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check order status from Printify
  app.get("/api/orders/:id/status", isAuthenticated, async (req: any, res) => {
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

      const status = await checkPrintifyOrderStatus(id);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ADMIN ROUTES ============

  // Admin Settings
  app.get("/api/admin/settings", isAdmin, async (req: any, res) => {
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

  app.put("/api/admin/settings", isAdmin, async (req: any, res) => {
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
  app.get("/api/admin/pricing-rules", isAdmin, async (req: any, res) => {
    try {
      const rules = await storage.getPricingRules();
      res.json(rules);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/pricing-rules", isAdmin, async (req: any, res) => {
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

  app.put("/api/admin/pricing-rules/:id", isAdmin, async (req: any, res) => {
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

  app.delete("/api/admin/pricing-rules/:id", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deletePricingRule(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin Products - Get all products with admin fields
  app.get("/api/admin/products", isAdmin, async (req: any, res) => {
    try {
      const products = await storage.getAllProducts();
      // Enrich products with their assigned category IDs
      const enrichedProducts = await Promise.all(
        products.map(async (product) => {
          const assignments = await storage.getProductCategoryAssignments(product.id);
          return {
            ...product,
            categoryIds: assignments.map((a) => a.categoryId),
          };
        })
      );
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle product enabled/disabled
  app.patch("/api/admin/products/:id/toggle", isAdmin, async (req: any, res) => {
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

  // Update product size/color options (stored in metadata)
  app.patch("/api/admin/products/:id/options", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabledSizes, enabledColors } = req.body;
      
      // Get current product to preserve other metadata
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      // Merge with existing metadata
      const existingMetadata = (currentProduct.metadata as Record<string, unknown>) || {};
      const newMetadata = {
        ...existingMetadata,
        enabledSizes,
        enabledColors,
      };
      
      const product = await storage.updateProduct(id, { metadata: newMetadata });
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update product admin settings (markup, production cost, etc.)
  app.patch("/api/admin/products/:id", isAdmin, async (req: any, res) => {
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

  // Get product variants
  app.get("/api/admin/products/:id/variants", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const variants = await storage.getProductVariants(id);
      res.json(variants);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Toggle variant enabled/disabled
  app.patch("/api/admin/variants/:id/toggle", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabled } = req.body;
      const variant = await storage.toggleVariantEnabled(id, enabled);
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.json(variant);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Printify Catalog Browsing - Get blueprints
  app.get("/api/admin/printify/blueprints", isAdmin, async (req: any, res) => {
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

  // Brands known to manufacture garments in the USA
  // This list should be updated periodically by checking Printify's catalog
  const USA_MADE_BRANDS = [
    'american apparel',
    'royal apparel',
    'bayside',
    'los angeles apparel',
    'bella+canvas',
    'bella canvas',
    'lane seven',
    'cotton heritage',
    'shaka wear',
    'backpacks usa',
    'american giant',
    'next level',  // Some Next Level products made in USA
  ];

  // Get full catalog grouped by category with images and provider info
  // Loads from local DB for speed, prices come from Printify on-demand
  app.get("/api/admin/printify/catalog", isAdmin, async (req: any, res) => {
    try {
      // First try to load from local database (fast!)
      const localBlueprints = await storage.getPrintifyBlueprints();
      
      let blueprints: any[];
      
      if (localBlueprints.length > 0) {
        // Use local cache - much faster!
        blueprints = localBlueprints.map(bp => ({
          id: bp.id,
          title: bp.title,
          brand: bp.brand,
          model: bp.model,
          images: bp.images || [],
        }));
      } else {
        // Fall back to Printify API if no local data
        if (!printify) {
          return res.status(503).json({ error: "Printify API not configured. Please sync catalog first." });
        }
        blueprints = await printify.getCatalogBlueprints();
      }
      
      // Categorize blueprints by product type
      const categories: Record<string, any[]> = {
        "T-Shirts": [],
        "Sweatshirts & Hoodies": [],
        "Hats & Caps": [],
        "Drinkware": [],
        "Bags": [],
        "Other": [],
      };
      
      for (const bp of blueprints) {
        const title = bp.title.toLowerCase();
        const brandLower = (bp.brand || '').toLowerCase();
        
        // Check if brand is a known USA manufacturer
        const isUSABrand = USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        
        const item = {
          id: bp.id,
          title: bp.title,
          brand: bp.brand,
          model: bp.model,
          imageUrl: bp.images?.[0] || null,
          madeInUSA: isUSABrand,
          usaProviderCount: isUSABrand ? 1 : 0,
          otherCountries: isUSABrand ? [] : ['Imported'],
        };
        
        if (title.includes('t-shirt') || title.includes('tee') || title.includes('tank')) {
          categories["T-Shirts"].push(item);
        } else if (title.includes('hoodie') || title.includes('sweatshirt') || title.includes('crew') || title.includes('pullover')) {
          categories["Sweatshirts & Hoodies"].push(item);
        } else if (title.includes('hat') || title.includes('cap') || title.includes('beanie') || title.includes('visor')) {
          categories["Hats & Caps"].push(item);
        } else if (title.includes('mug') || title.includes('tumbler') || title.includes('bottle') || title.includes('cup') || title.includes('glass')) {
          categories["Drinkware"].push(item);
        } else if (title.includes('bag') || title.includes('tote') || title.includes('backpack') || title.includes('pouch')) {
          categories["Bags"].push(item);
        } else {
          categories["Other"].push(item);
        }
      }
      
      // Convert to array format, filter empty categories
      const result = Object.entries(categories)
        .filter(([_, items]) => items.length > 0)
        .map(([name, items]) => ({ 
          name, 
          items, 
          count: items.length,
          usaCount: items.filter(i => i.madeInUSA).length,
          otherCount: items.filter(i => !i.madeInUSA).length,
        }));
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get full catalog item details with USA providers and pricing
  // In-memory cache for individual blueprint details (shared with batch endpoint)
  const individualBlueprintCache = new Map<number, { data: any; timestamp: number }>();
  const INDIVIDUAL_CACHE_TTL = 1000 * 60 * 30; // 30 minutes

  app.get("/api/admin/printify/catalog/:blueprintId", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      const blueprintId = parseInt(req.params.blueprintId);
      
      // Check cache first
      const cached = individualBlueprintCache.get(blueprintId);
      if (cached && Date.now() - cached.timestamp < INDIVIDUAL_CACHE_TTL) {
        return res.json(cached.data);
      }
      
      // Fetch blueprint details, providers, and find USA providers
      const [blueprint, providers] = await Promise.all([
        printify.getBlueprintDetails(blueprintId),
        printify.getPrintProviders(blueprintId),
      ]);
      
      // Filter for USA providers
      const usaProviders = providers.filter(p => 
        p.location?.country === 'US' || p.location?.country === 'USA'
      );
      
      // Get variants for first USA provider (for pricing/colors/sizes)
      let variants: any[] = [];
      let selectedProvider = usaProviders[0] || providers[0];
      
      if (selectedProvider) {
        const variantData = await printify.getVariants(blueprintId, selectedProvider.id);
        variants = variantData.variants || [];
      }
      
      // Extract unique colors and sizes
      const colors = Array.from(new Set(variants.map(v => v.options?.color).filter(Boolean)));
      const sizes = Array.from(new Set(variants.map(v => v.options?.size).filter(Boolean)));
      
      // Get base price from first variant (lowest)
      const prices = variants.map(v => v.price || 0).filter(p => p > 0);
      const basePrice = prices.length > 0 ? Math.min(...prices) / 100 : 0;
      
      const responseData = {
        blueprint,
        providers: usaProviders.length > 0 ? usaProviders : providers,
        selectedProvider,
        madeInUSA: usaProviders.length > 0,
        variants,
        colors,
        sizes,
        basePrice,
        imageUrl: blueprint.images?.[0] || null,
      };
      
      // Cache the result
      individualBlueprintCache.set(blueprintId, { data: responseData, timestamp: Date.now() });
      
      res.json(responseData);
    } catch (error: any) {
      console.error(`Printify API error for blueprint ${req.params.blueprintId}:`, error.message);
      res.status(500).json({ error: `Printify API error: ${error.message}` });
    }
  });

  // In-memory cache for blueprint details
  const blueprintDetailsCache = new Map<number, { data: any; timestamp: number }>();
  const CACHE_TTL = 1000 * 60 * 30; // 30 minutes
  
  // Batch fetch blueprint details (for efficient loading)
  app.post("/api/admin/printify/catalog/batch-details", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      const { blueprintIds } = req.body;
      if (!Array.isArray(blueprintIds) || blueprintIds.length === 0) {
        return res.status(400).json({ error: "blueprintIds array required" });
      }
      
      // Limit batch size
      const limitedIds = blueprintIds.slice(0, 20);
      const results: Record<number, any> = {};
      
      for (const blueprintId of limitedIds) {
        // Check cache first
        const cached = blueprintDetailsCache.get(blueprintId);
        if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
          results[blueprintId] = cached.data;
          continue;
        }
        
        try {
          // Fetch blueprint details and providers
          const [blueprint, providers] = await Promise.all([
            printify.getBlueprintDetails(blueprintId),
            printify.getPrintProviders(blueprintId),
          ]);
          
          // Filter for USA providers
          const usaProviders = providers.filter((p: any) => 
            p.location?.country === 'US' || p.location?.country === 'USA'
          );
          
          // Get variants from first USA provider (or first available)
          let variants: any[] = [];
          const selectedProvider = usaProviders[0] || providers[0];
          
          if (selectedProvider) {
            try {
              const variantData = await printify.getVariants(blueprintId, selectedProvider.id);
              variants = variantData.variants || [];
            } catch {
              // Provider may not have variants - continue with empty
            }
          }
          
          // Extract colors and sizes
          const colors = Array.from(new Set(variants.map((v: any) => v.options?.color).filter(Boolean)));
          const sizes = Array.from(new Set(variants.map((v: any) => v.options?.size).filter(Boolean)));
          
          // First try to get costs from local database (cached from placeholder products)
          let basePrice = 0;
          let maxPrice = 0;
          let costsFromDatabase = false;
          
          if (selectedProvider) {
            const storedProvider = await storage.getPrintifyPrintProvider(blueprintId, selectedProvider.id);
            if (storedProvider?.minCost && storedProvider.minCost > 0) {
              basePrice = storedProvider.minCost / 100;
              maxPrice = (storedProvider.maxCost || storedProvider.minCost) / 100;
              costsFromDatabase = true;
            }
          }
          
          // Fallback: try Printify API (usually returns 0 for catalog items)
          if (basePrice === 0) {
            const costs = variants.map((v: any) => v.cost || 0).filter((c: number) => c > 0);
            basePrice = costs.length > 0 ? Math.min(...costs) / 100 : 0;
            maxPrice = costs.length > 0 ? Math.max(...costs) / 100 : 0;
          }
          
          const data = {
            blueprintId,
            basePrice,
            maxPrice,
            costsAvailable: basePrice > 0,
            costsFromDatabase,
            colors,
            sizes,
            madeInUSA: usaProviders.length > 0,
            providerId: selectedProvider?.id,
            providerName: selectedProvider?.title,
          };
          
          // Cache the result
          blueprintDetailsCache.set(blueprintId, { data, timestamp: Date.now() });
          results[blueprintId] = data;
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          // Mark this item as having an error but continue
          results[blueprintId] = { 
            blueprintId, 
            error: true, 
            message: err.message || "Failed to fetch details" 
          };
        }
      }
      
      res.json(results);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get print providers for a blueprint
  app.get("/api/admin/printify/blueprints/:id/providers", isAdmin, async (req: any, res) => {
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
  app.get("/api/admin/printify/blueprints/:blueprintId/providers/:providerId/variants", isAdmin, async (req: any, res) => {
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

  // ========================================
  // LOCAL CATALOG SYNC ENDPOINTS
  // ========================================

  // Get local catalog blueprints (fast, from database)
  app.get("/api/admin/catalog/blueprints", isAdmin, async (req: any, res) => {
    try {
      const blueprints = await storage.getPrintifyBlueprints();
      const usaFilter = req.query.usaOnly === 'true';
      const category = req.query.category as string | undefined;
      
      // Get providers for filtering
      let filteredBlueprints = blueprints;
      
      if (category) {
        filteredBlueprints = filteredBlueprints.filter(bp => bp.category === category);
      }
      
      if (usaFilter) {
        // Get all providers and filter blueprints that have USA providers
        const blueprintIds = new Set<number>();
        for (const bp of filteredBlueprints) {
          const providers = await storage.getPrintifyPrintProviders(bp.id);
          if (providers.some(p => p.isUSA)) {
            blueprintIds.add(bp.id);
          }
        }
        filteredBlueprints = filteredBlueprints.filter(bp => blueprintIds.has(bp.id));
      }
      
      res.json({
        blueprints: filteredBlueprints,
        total: filteredBlueprints.length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get local catalog blueprint details
  app.get("/api/admin/catalog/blueprints/:id", isAdmin, async (req: any, res) => {
    try {
      const blueprintId = parseInt(req.params.id);
      const blueprint = await storage.getPrintifyBlueprint(blueprintId);
      
      if (!blueprint) {
        return res.status(404).json({ error: "Blueprint not found in local catalog" });
      }
      
      const providers = await storage.getPrintifyPrintProviders(blueprintId);
      
      res.json({
        ...blueprint,
        providers,
        usaProviders: providers.filter(p => p.isUSA),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get catalog sync status
  app.get("/api/admin/catalog/sync-status", isAdmin, async (req: any, res) => {
    try {
      const latestSync = await storage.getLatestCatalogSync();
      const totalBlueprints = (await storage.getPrintifyBlueprints()).length;
      
      res.json({
        latestSync,
        totalBlueprints,
        isConfigured: printify?.isConfigured || false,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get catalog sync history
  app.get("/api/admin/catalog/sync-history", isAdmin, async (req: any, res) => {
    try {
      const history = await storage.getCatalogSyncHistory();
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Start catalog sync from Printify
  app.post("/api/admin/catalog/sync", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      // Check if sync is already running
      const latestSync = await storage.getLatestCatalogSync();
      if (latestSync?.status === 'running') {
        return res.status(409).json({ error: "Sync already in progress" });
      }
      
      // Create sync record
      const syncRecord = await storage.createCatalogSync({
        syncType: 'full',
        status: 'running',
        blueprintsCount: 0,
        providersCount: 0,
      });
      
      // Return immediately, sync runs in background
      res.json({ syncId: syncRecord.id, status: 'started' });
      
      // Run sync in background
      (async () => {
        try {
          console.log('[Catalog Sync] Starting full catalog sync...');
          
          // Fetch all blueprints from Printify
          const blueprints = await printify.getCatalogBlueprints();
          console.log(`[Catalog Sync] Found ${blueprints.length} blueprints`);
          
          let blueprintsCount = 0;
          let providersCount = 0;
          
          for (const bp of blueprints) {
            try {
              // Upsert blueprint
              await storage.upsertPrintifyBlueprint({
                id: bp.id,
                title: bp.title,
                description: bp.description || null,
                brand: bp.brand || null,
                model: bp.model || null,
                images: bp.images || null,
                primaryImageUrl: bp.images?.[0] || null,
                category: detectCategory(bp.title, bp.brand || ''),
              });
              blueprintsCount++;
              
              // Fetch and store providers for this blueprint
              const providers = await printify.getPrintProviders(bp.id);
              
              for (const provider of providers) {
                const isUSA = provider.location?.country === 'US' || 
                              provider.location?.country === 'USA';
                
                await storage.upsertPrintifyPrintProvider({
                  blueprintId: bp.id,
                  providerId: provider.id,
                  title: provider.title,
                  country: provider.location?.country || null,
                  isUSA,
                });
                providersCount++;
              }
              
              // Rate limiting - small delay between blueprints
              await new Promise(r => setTimeout(r, 100));
              
            } catch (bpError: any) {
              console.error(`[Catalog Sync] Error syncing blueprint ${bp.id}:`, bpError.message);
            }
          }
          
          // Update sync record with completion
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'completed',
            blueprintsCount,
            providersCount,
            completedAt: new Date(),
          });
          
          console.log(`[Catalog Sync] Completed. ${blueprintsCount} blueprints, ${providersCount} providers`);
          
        } catch (error: any) {
          console.error('[Catalog Sync] Error:', error.message);
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'failed',
            errorMessage: error.message,
            completedAt: new Date(),
          });
        }
      })();
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Clear local catalog (for testing/reset)
  app.delete("/api/admin/catalog/clear", isAdmin, async (req: any, res) => {
    try {
      await storage.clearPrintifyPrintProviders();
      await storage.clearPrintifyBlueprints();
      res.json({ success: true, message: "Local catalog cleared" });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Fetch production costs for a specific blueprint/provider combo
  // Creates a placeholder product in Printify to extract costs, then stores them locally
  app.post("/api/admin/catalog/fetch-costs", isAdmin, async (req: any, res) => {
    try {
      const { blueprintId, providerId, deleteAfter = true } = req.body;
      
      if (!blueprintId || !providerId) {
        return res.status(400).json({ error: "blueprintId and providerId are required" });
      }
      
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      console.log(`[Cost Fetch] Fetching costs for blueprint ${blueprintId}, provider ${providerId}...`);
      
      // First, get the variants for this blueprint/provider
      const variantsResult = await printify.getVariants(blueprintId, providerId);
      const variantIds = variantsResult.variants.map(v => v.id);
      
      if (variantIds.length === 0) {
        return res.status(404).json({ error: "No variants found for this blueprint/provider combo" });
      }
      
      // Get a placement that works for these variants (finds common placement)
      const { placement, variantIds: compatibleVariantIds } = await printify.getCommonPlacement(blueprintId, providerId);
      console.log(`[Cost Fetch] Using placement '${placement}' with ${compatibleVariantIds.length} compatible variants`);
      
      // Upload a placeholder image to Printify (cached after first upload)
      const imageId = await printify.getOrCreatePlaceholderImage();
      console.log(`[Cost Fetch] Using placeholder image: ${imageId}`);
      
      // Create a placeholder product WITH the image to get real costs (item + one print)
      const placeholderProduct = await printify.createPlaceholderProduct(
        blueprintId,
        providerId,
        compatibleVariantIds,
        imageId,
        placement
      );
      
      console.log(`[Cost Fetch] Created placeholder product ${placeholderProduct.id}, extracting costs...`);
      
      // Extract costs from the product
      const costs = printify.extractCostsFromProduct(placeholderProduct);
      
      console.log(`[Cost Fetch] Extracted costs: min=$${(costs.minCost / 100).toFixed(2)}, max=$${(costs.maxCost / 100).toFixed(2)}`);
      
      // Store costs in the local database
      const updatedProvider = await storage.updatePrintifyProviderCosts(
        blueprintId,
        providerId,
        {
          minCost: costs.minCost,
          maxCost: costs.maxCost,
          placeholderProductId: deleteAfter ? undefined : placeholderProduct.id,
        }
      );
      
      // Optionally delete the placeholder product
      if (deleteAfter) {
        try {
          await printify.deleteProduct(placeholderProduct.id);
          console.log(`[Cost Fetch] Deleted placeholder product ${placeholderProduct.id}`);
        } catch (deleteError: any) {
          console.warn(`[Cost Fetch] Could not delete placeholder product: ${deleteError.message}`);
        }
      }
      
      res.json({
        success: true,
        blueprintId,
        providerId,
        placement,
        minCost: costs.minCost,
        maxCost: costs.maxCost,
        minCostFormatted: `$${(costs.minCost / 100).toFixed(2)}`,
        maxCostFormatted: `$${(costs.maxCost / 100).toFixed(2)}`,
        variantsChecked: compatibleVariantIds.length,
        placeholderDeleted: deleteAfter,
        note: `Cost includes: blank item + one print on '${placement}' position`,
      });
      
    } catch (error: any) {
      console.error('[Cost Fetch] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Sync ALL costs in background - runs through all cached providers
  app.post("/api/admin/catalog/sync-all-costs", isAdmin, async (req: any, res) => {
    try {
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      // Get all cached providers from the database
      const providers = await storage.getPrintifyPrintProviders();
      
      if (providers.length === 0) {
        return res.status(400).json({ error: "No providers cached. Run catalog sync first." });
      }
      
      // Respond immediately - sync runs in background
      res.json({ 
        success: true, 
        message: "Cost sync started in background",
        totalProviders: providers.length,
      });
      
      // Run the sync in background (don't await)
      (async () => {
        console.log(`[Cost Sync] Starting background sync for ${providers.length} providers...`);
        
        let synced = 0;
        let failed = 0;
        
        // Upload placeholder image once
        let imageId: string | null = null;
        try {
          imageId = await printify.getOrCreatePlaceholderImage();
          console.log(`[Cost Sync] Using placeholder image: ${imageId}`);
        } catch (err: any) {
          console.error(`[Cost Sync] Failed to upload placeholder image:`, err.message);
          return;
        }
        
        for (const provider of providers) {
          // Skip if already has costs
          if (provider.minCost && provider.minCost > 0) {
            console.log(`[Cost Sync] Skipping ${provider.blueprintId}/${provider.id} - already has cost $${(provider.minCost / 100).toFixed(2)}`);
            synced++;
            continue;
          }
          
          try {
            // Get placement and variants
            const { placement, variantIds } = await printify.getCommonPlacement(provider.blueprintId, provider.id);
            
            // Create placeholder product
            const placeholderProduct = await printify.createPlaceholderProduct(
              provider.blueprintId,
              provider.id,
              variantIds,
              imageId,
              placement
            );
            
            // Extract costs
            const costs = printify.extractCostsFromProduct(placeholderProduct);
            
            // Save to database
            await storage.updatePrintifyProviderCosts(provider.blueprintId, provider.id, {
              minCost: costs.minCost,
              maxCost: costs.maxCost,
            });
            
            // Delete placeholder product
            try {
              await printify.deleteProduct(placeholderProduct.id);
            } catch {}
            
            console.log(`[Cost Sync] ${provider.blueprintId}/${provider.id}: $${(costs.minCost / 100).toFixed(2)} - $${(costs.maxCost / 100).toFixed(2)}`);
            synced++;
            
            // Rate limit: wait 3 seconds between requests
            await new Promise(r => setTimeout(r, 3000));
            
          } catch (err: any) {
            console.error(`[Cost Sync] Failed for ${provider.blueprintId}/${provider.id}:`, err.message);
            failed++;
            // Continue to next provider
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        
        console.log(`[Cost Sync] Complete! Synced: ${synced}, Failed: ${failed}`);
      })();
      
    } catch (error: any) {
      console.error('[Cost Sync] Error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // ========================================
  // END LOCAL CATALOG SYNC ENDPOINTS
  // ========================================

  // Add product from Printify catalog
  app.post("/api/admin/products/from-printify", isAdmin, async (req: any, res) => {
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
      
      // If this is a Kingdom Connects product, also create the partner store product entry
      if (category === "Kingdom Connects" && metadata?.kcPlacements?.length > 0) {
        // Find the Kingdom Connects partner store
        const partnerStores = await storage.getPartnerStores();
        const kcStore = partnerStores.find(p => p.slug === "kingdom-connects");
        
        if (kcStore) {
          await storage.addPartnerStoreProduct({
            partnerStoreId: kcStore.id,
            productId: product.id,
            kcPlacements: metadata.kcPlacements,
            kcBusinessSlug: metadata.kcBusinessSlug || null,
            sortOrder: 0,
            isEnabled: true,
          });
        }
      }
      
      res.json(product);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync product placements and data from Printify
  app.post("/api/admin/products/:id/sync-printify", isAdmin, async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId || !product.printProviderId) {
        return res.status(400).json({ error: "Product missing Printify blueprint or provider IDs" });
      }
      
      // Fetch placements and mockup image from Printify
      const { placements, mockupImageUrl } = await syncProductPlacements(
        product.blueprintId,
        product.printProviderId
      );
      
      // Fetch colors and sizes
      const { colors, sizes, variants } = await syncProductVariants(
        product.blueprintId,
        product.printProviderId
      );
      
      // Save each variant to the database (defaults to isEnabled=true)
      for (const variant of variants) {
        await storage.upsertProductVariant({
          productId: product.id,
          printifyVariantId: variant.id,
          title: variant.title,
          size: variant.options?.size || null,
          color: variant.options?.color || null,
          colorHex: variant.options?.color ? colors.find(c => c.name === variant.options?.color)?.hex || null : null,
          price: String((variant.price || 0) / 100), // Printify prices are in cents
          isEnabled: true, // Default all new variants to enabled
          isInStock: variant.is_available ?? true,
        });
      }
      
      // Update product with synced data
      const updatedProduct = await storage.updateProduct(product.id, {
        availablePlacements: placements.map(p => p.position),
        availableColors: colors,
        availableSizes: sizes,
        imageUrl: mockupImageUrl || product.imageUrl,
        metadata: {
          ...(product.metadata as object || {}),
          placementDetails: placements,
          lastSyncedAt: new Date().toISOString(),
        },
      });
      
      res.json({
        success: true,
        product: updatedProduct,
        syncedData: { placements, colors, sizes, mockupImageUrl, variantsCount: variants.length },
      });
    } catch (error: any) {
      console.error("Product sync error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PUBLIC GALLERY API ============
  
  // Get public gallery designs (opt-in shared designs)
  app.get("/api/gallery", async (req, res) => {
    try {
      const designs = await storage.getPublicGalleryDesigns();
      
      // Enrich with product data
      const enrichedDesigns = await Promise.all(
        designs.map(async (design) => {
          const product = design.productId 
            ? await storage.getProduct(design.productId)
            : null;
          return { ...design, product };
        })
      );
      
      res.json(enrichedDesigns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SITEMAP FOR SEO ============
  
  // Generate XML sitemap
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const products = await storage.getAllProducts();
      const enabledProducts = products.filter(p => p.isEnabled);
      
      type SitemapPage = { loc: string; priority: string; changefreq: string; lastmod?: string };
      
      const staticPages: SitemapPage[] = [
        { loc: '/', priority: '1.0', changefreq: 'daily' },
        { loc: '/store', priority: '0.9', changefreq: 'daily' },
        { loc: '/creator', priority: '0.9', changefreq: 'weekly' },
        { loc: '/gallery', priority: '0.8', changefreq: 'daily' },
        { loc: '/cart', priority: '0.5', changefreq: 'weekly' },
      ];
      
      const productPages: SitemapPage[] = enabledProducts.map(p => ({
        loc: `/store?product=${p.id}`,
        priority: '0.7',
        changefreq: 'weekly',
        lastmod: p.updatedAt?.toISOString().split('T')[0],
      }));
      
      const allPages: SitemapPage[] = [...staticPages, ...productPages];
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <priority>${page.priority}</priority>
    <changefreq>${page.changefreq}</changefreq>
    ${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;
      
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error: any) {
      res.status(500).send('Error generating sitemap');
    }
  });

  // ============ SAVED DESIGNS ENDPOINTS ============
  
  // Get all saved designs for current user
  app.get("/api/designs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const designs = await storage.getQrDesignsByUser(userId);
      res.json(designs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single design by ID
  app.get("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      // Ensure user owns this design
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(design);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new saved design
  app.post("/api/designs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertQrDesignSchema.parse({
        ...req.body,
        userId,
      });
      const design = await storage.createQrDesign(validatedData);
      res.status(201).json(design);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Update a saved design
  app.put("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateQrDesign(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a saved design
  app.delete("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteQrDesign(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRODUCT CATEGORIES ENDPOINTS ============

  // Get all product categories (public)
  // Admin: Get ALL product categories (including inactive)
  app.get("/api/admin/product-categories", isAdmin, async (req: any, res) => {
    try {
      const categories = await storage.getAllProductCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/product-categories", async (req, res) => {
    try {
      const taxonomyType = req.query.taxonomy as string | undefined;
      let categories;
      if (taxonomyType) {
        categories = await storage.getProductCategoriesByTaxonomy(taxonomyType);
      } else {
        categories = await storage.getActiveProductCategories();
      }
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get products by category (public)
  app.get("/api/product-categories/:id/products", async (req, res) => {
    try {
      const products = await storage.getProductsByCategory(req.params.id);
      // Only return enabled products
      const enabledProducts = products.filter(p => p.isEnabled);
      res.json(enabledProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get category assignments for a product
  app.get("/api/products/:id/categories", async (req, res) => {
    try {
      const assignments = await storage.getProductCategoryAssignments(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create a category
  app.post("/api/admin/product-categories", isAdmin, async (req: any, res) => {
    try {
      const { name, slug, description, taxonomyType, icon, parentId, sortOrder, isActive } = req.body;
      const category = await storage.createProductCategory({
        name,
        slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
        description,
        taxonomyType,
        icon,
        parentId,
        sortOrder,
        isActive,
      });
      res.status(201).json(category);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update a category
  app.put("/api/admin/product-categories/:id", isAdmin, async (req: any, res) => {
    try {
      const updated = await storage.updateProductCategory(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete a category
  app.delete("/api/admin/product-categories/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteProductCategory(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Assign categories to a product
  app.post("/api/admin/products/:id/categories", isAdmin, async (req: any, res) => {
    try {
      const { categoryIds } = req.body;
      await storage.syncProductCategories(req.params.id, categoryIds || []);
      const assignments = await storage.getProductCategoryAssignments(req.params.id);
      res.json(assignments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Seed default categories
  app.post("/api/admin/product-categories/seed", isAdmin, async (req: any, res) => {
    try {
      const defaultCategories = [
        // Seasons
        { name: "Spring", slug: "spring", taxonomyType: "season", icon: "Flower2", sortOrder: 1 },
        { name: "Summer", slug: "summer", taxonomyType: "season", icon: "Sun", sortOrder: 2 },
        { name: "Fall", slug: "fall", taxonomyType: "season", icon: "Leaf", sortOrder: 3 },
        { name: "Winter", slug: "winter", taxonomyType: "season", icon: "Snowflake", sortOrder: 4 },
        // Holidays
        { name: "Christmas", slug: "christmas", taxonomyType: "holiday", icon: "Gift", sortOrder: 1 },
        { name: "Easter", slug: "easter", taxonomyType: "holiday", icon: "Egg", sortOrder: 2 },
        { name: "Valentine's Day", slug: "valentines", taxonomyType: "holiday", icon: "Heart", sortOrder: 3 },
        { name: "Halloween", slug: "halloween", taxonomyType: "holiday", icon: "Ghost", sortOrder: 4 },
        { name: "Thanksgiving", slug: "thanksgiving", taxonomyType: "holiday", icon: "Utensils", sortOrder: 5 },
        { name: "Fourth of July", slug: "july-4th", taxonomyType: "holiday", icon: "Flag", sortOrder: 6 },
        { name: "Mother's Day", slug: "mothers-day", taxonomyType: "holiday", icon: "Heart", sortOrder: 7 },
        { name: "Father's Day", slug: "fathers-day", taxonomyType: "holiday", icon: "Trophy", sortOrder: 8 },
        // Occasions
        { name: "Birthday", slug: "birthday", taxonomyType: "occasion", icon: "Cake", sortOrder: 1 },
        { name: "Anniversary", slug: "anniversary", taxonomyType: "occasion", icon: "HeartHandshake", sortOrder: 2 },
        { name: "Graduation", slug: "graduation", taxonomyType: "occasion", icon: "GraduationCap", sortOrder: 3 },
        { name: "Wedding", slug: "wedding", taxonomyType: "occasion", icon: "Gem", sortOrder: 4 },
        { name: "Baby Shower", slug: "baby-shower", taxonomyType: "occasion", icon: "Baby", sortOrder: 5 },
        // Other
        { name: "Religious", slug: "religious", taxonomyType: "other", icon: "Church", sortOrder: 1 },
        { name: "Sports", slug: "sports", taxonomyType: "other", icon: "Trophy", sortOrder: 2 },
        { name: "Business", slug: "business", taxonomyType: "other", icon: "Briefcase", sortOrder: 3 },
        { name: "Patriotic", slug: "patriotic", taxonomyType: "other", icon: "Flag", sortOrder: 4 },
      ];

      const created = [];
      for (const cat of defaultCategories) {
        try {
          const category = await storage.createProductCategory({
            ...cat,
            isActive: true,
          });
          created.push(category);
        } catch (e) {
          // Skip if already exists (unique constraint on slug)
        }
      }
      res.json({ created: created.length, categories: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PARTNER STORE ENDPOINTS ============

  // Admin: Get all partner stores
  app.get("/api/admin/partner-stores", isAdmin, async (req: any, res) => {
    try {
      const stores = await storage.getPartnerStores();
      res.json(stores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get single partner store with products
  app.get("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      const store = await storage.getPartnerStore(req.params.id);
      if (!store) {
        return res.status(404).json({ error: "Partner store not found" });
      }
      const products = await storage.getPartnerStoreProducts(store.id);
      res.json({ ...store, products });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create partner store
  app.post("/api/admin/partner-stores", isAdmin, async (req: any, res) => {
    try {
      const validated = insertPartnerStoreSchema.parse(req.body);
      const store = await storage.createPartnerStore(validated);
      res.json(store);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update partner store
  app.put("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      const store = await storage.updatePartnerStore(req.params.id, req.body);
      if (!store) {
        return res.status(404).json({ error: "Partner store not found" });
      }
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete partner store
  app.delete("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deletePartnerStore(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Get partner store products with product details (sizes/colors)
  app.get("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const storeProducts = await storage.getPartnerStoreProducts(req.params.id);
      
      // Fetch full product details for each store product
      const enrichedProducts = await Promise.all(
        storeProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          return {
            ...sp,
            availableSizes: product?.availableSizes || [],
            availableColors: product?.availableColors || [],
          };
        })
      );
      
      res.json(enrichedProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Sync partner store products
  app.post("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const { productIds } = req.body;
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ error: "productIds must be an array" });
      }
      await storage.syncPartnerStoreProducts(req.params.id, productIds);
      const products = await storage.getPartnerStoreProducts(req.params.id);
      res.json(products);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update partner store product options (sizes, colors, placements)
  app.patch("/api/admin/partner-stores/:storeId/products/:productId", isAdmin, async (req: any, res) => {
    try {
      const { storeId, productId } = req.params;
      const { enabledSizes, enabledColors, kcPlacements, kcBusinessSlug, customPrice, customName, isEnabled } = req.body;
      
      const updated = await storage.updatePartnerStoreProductByIds(storeId, productId, {
        enabledSizes,
        enabledColors,
        kcPlacements,
        kcBusinessSlug,
        customPrice,
        customName,
        isEnabled,
      });
      
      if (!updated) {
        return res.status(404).json({ error: "Partner store product not found" });
      }
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public: Get partner store by slug (for widget embedding)
  app.get("/api/widget/stores/:slug", async (req, res) => {
    try {
      const store = await storage.getPartnerStoreBySlug(req.params.slug);
      if (!store || !store.isActive) {
        return res.status(404).json({ error: "Partner store not found" });
      }
      const storeProducts = await storage.getPartnerStoreProducts(store.id);
      const enabledProducts = storeProducts.filter(sp => sp.isEnabled);
      
      // Fetch actual product details
      const productDetails = await Promise.all(
        enabledProducts.map(async (sp) => {
          const product = await storage.getProduct(sp.productId);
          if (!product || !product.isEnabled) return null;
          return {
            id: product.id,
            name: sp.customName || product.name,
            imageUrl: product.imageUrl,
            customPrice: sp.customPrice,
            sortOrder: sp.sortOrder,
          };
        })
      );
      
      res.json({
        id: store.id,
        name: store.name,
        slug: store.slug,
        logoUrl: store.logoUrl,
        primaryColor: store.primaryColor,
        accentColor: store.accentColor,
        products: productDetails.filter(Boolean).sort((a: any, b: any) => (a?.sortOrder || 0) - (b?.sortOrder || 0)),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ DYNAMIC PAGES ENDPOINTS ============
  
  // Get user's dynamic pages with active image info
  app.get("/api/dynamic-pages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const pages = await storage.getDynamicPagesByUser(userId);
      
      // Enrich pages with active image data
      const enrichedPages = await Promise.all(pages.map(async (page) => {
        let activeImage = null;
        if (page.activeAssetId) {
          const assets = await storage.getDynamicPageAssets(page.id);
          const activeAsset = assets.find(a => a.id === page.activeAssetId);
          if (activeAsset && activeAsset.hostedImageId) {
            const image = await storage.getHostedImage(activeAsset.hostedImageId);
            if (image) {
              activeImage = {
                url: `/api/images/${image.id}`,
                title: activeAsset.title || image.title,
              };
            }
          }
        }
        return { ...page, activeImage };
      }));
      
      res.json(enrichedPages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single dynamic page by ID (auth required)
  app.get("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const assets = await storage.getDynamicPageAssets(page.id);
      res.json({ ...page, assets });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new dynamic page
  app.post("/api/dynamic-pages", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { title, description, hostingTierId } = req.body;
      
      // Generate unique slug
      const slug = crypto.randomUUID();
      
      // Calculate expiration based on hosting tier
      let expiresAt: Date | null = null;
      if (hostingTierId) {
        const tier = await storage.getHostingTier(hostingTierId);
        if (tier && tier.code !== "permanent") {
          expiresAt = new Date();
          expiresAt.setDate(expiresAt.getDate() + tier.durationDays);
        }
      }
      
      const page = await storage.createDynamicPage({
        userId,
        slug,
        title,
        description,
        hostingTierId,
        expiresAt,
        status: "active",
      });
      
      res.status(201).json(page);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update a dynamic page
  app.put("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateDynamicPage(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Delete a dynamic page
  app.delete("/api/dynamic-pages/:id", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteDynamicPage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get assets for a dynamic page
  app.get("/api/dynamic-pages/:id/assets", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const assets = await storage.getDynamicPageAssets(page.id);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Add a new asset to a dynamic page (upload new image)
  app.post("/api/dynamic-pages/:id/assets", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { hostedImageId, title, setAsActive } = req.body;
      
      const asset = await storage.createDynamicPageAsset({
        pageId: page.id,
        hostedImageId,
        title,
        isActive: false,
      });
      
      // Optionally set this as the active asset
      if (setAsActive) {
        await storage.setActiveAsset(page.id, asset.id);
      }
      
      res.status(201).json(asset);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Set active asset for a dynamic page (swap image)
  app.post("/api/dynamic-pages/:id/set-active", isAuthenticated, async (req: any, res) => {
    try {
      const page = await storage.getDynamicPage(req.params.id);
      if (!page) {
        return res.status(404).json({ error: "Dynamic page not found" });
      }
      if (page.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const { assetId } = req.body;
      await storage.setActiveAsset(page.id, assetId);
      
      const updatedPage = await storage.getDynamicPage(page.id);
      res.json(updatedPage);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Public dynamic page viewer
  app.get("/api/dynamic/:slug", async (req, res) => {
    try {
      const page = await storage.getDynamicPageBySlug(req.params.slug);
      if (!page) {
        return res.status(404).json({ error: "Page not found" });
      }
      if (page.status !== "active") {
        return res.status(410).json({ error: "This page is no longer available" });
      }
      if (page.expiresAt && new Date(page.expiresAt) < new Date()) {
        return res.status(410).json({ error: "This page has expired" });
      }
      
      // Increment views
      await storage.incrementDynamicPageViews(page.id);
      
      // Get active asset with hosted image details
      let activeImage = null;
      if (page.activeAssetId) {
        const asset = await storage.getDynamicPageAsset(page.activeAssetId);
        if (asset) {
          activeImage = await storage.getHostedImage(asset.hostedImageId);
        }
      }
      
      res.json({
        title: page.title,
        description: page.description,
        image: activeImage ? {
          url: activeImage.publicUrl,
          title: activeImage.title,
        } : null,
      });
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
  app.post("/api/admin/hosting-tiers/seed", isAdmin, async (req, res) => {
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
  app.get("/api/admin/templates", isAdmin, async (req, res) => {
    try {
      const templates = await storage.getQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Create template
  app.post("/api/admin/templates", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        thumbnailUrl: z.string().url(),
        fullImageUrl: z.string().url(),
        storageUrl: z.string().url(),
        priceUpcharge: z.string().optional().default("0"),
        isActive: z.boolean().optional().default(true),
        isFeatured: z.boolean().optional().default(false),
      });
      
      const validatedData = createSchema.parse(req.body);
      const template = await storage.createQrTemplate(validatedData);
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Update template
  app.put("/api/admin/templates/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        thumbnailUrl: z.string().url().optional(),
        fullImageUrl: z.string().url().optional(),
        storageUrl: z.string().url().optional(),
        priceUpcharge: z.string().optional(),
        isActive: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const template = await storage.updateQrTemplate(id, validatedData);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  // Admin: Delete template
  app.delete("/api/admin/templates/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQrTemplate(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ PRICING QUOTE ENDPOINT ============
  
  // Calculate final price for a product with customizations (supports all 4 product lines)
  app.post("/api/pricing/quote", async (req, res) => {
    try {
      const { 
        productId, 
        productLine = "text", // 'text', 'template', 'custom', 'dynamic'
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
        dynamicUpcharge: 0,
      };

      // Add text upcharges (applicable to text, template, custom lines)
      if (hasTextAbove && productLine !== "dynamic") {
        const upcharge = parseFloat(settings?.textAboveUpcharge || "2");
        price += upcharge;
        breakdown.textAboveUpcharge = upcharge;
      }
      if (hasTextBelow && productLine !== "dynamic") {
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

      // Dynamic QR upcharge (Line 4) - base upcharge for changeable image feature
      if (productLine === "dynamic") {
        const dynamicUpcharge = parseFloat((settings as any)?.dynamicQrUpcharge || "25");
        price += dynamicUpcharge;
        breakdown.dynamicUpcharge = dynamicUpcharge;
      }

      // Hosting tier upcharge (Lines 2, 3, 4 - for image hosting)
      if ((productLine === "template" || productLine === "custom" || productLine === "dynamic") && hostingTierCode !== "1_year") {
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

  // Start cron jobs for hosting expiration checks and order status sync
  startCronJobs();

  const httpServer = createServer(app);
  return httpServer;
}
