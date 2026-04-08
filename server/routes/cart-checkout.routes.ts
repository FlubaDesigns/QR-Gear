import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { fsInsert, fsQuery } from "../lib/firestore-crud";
import { isAuthenticated, isAdmin } from "../firebaseAuth";
import { insertCartItemSchema, insertOrderSchema, insertOrderItemSchema } from "@shared/schema";
import { MEMBER_PACKETS_COLLECTION, QR_DYNAMICS_INSTANCES_COLLECTION } from "../lib/constants";
import { uploadToFirebaseStorage } from "../lib/firebase-storage-service";
import { verifyFirebaseToken } from "../lib/firebase-admin";
import { sendOrderConfirmationEmail } from "../lib/email";
import { submitOrderToPrintify, checkPrintifyOrderStatus } from "../lib/printify-orders";
import { z } from "zod";
import { registerUploadsImagesRoutes } from "./uploads-images.routes";

export function registerCartCheckoutRoutes(app: Express): void {
  registerUploadsImagesRoutes(app);

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
      const { getStripePublishableKey } = await import('../stripeClient');
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

      const { getUncachableStripeClient } = await import('../stripeClient');
      const stripe = await getUncachableStripeClient();

      const { DEFAULT_MEMBER_PROFIT_SHARE, formatProfitSharePercent } = await import("@shared/constants");

      let isMember = false;
      let memberDiscount = DEFAULT_MEMBER_PROFIT_SHARE;
      try {
        const { getFirestoreDb } = await import("../lib/firebase-admin");
        const fsDb = getFirestoreDb();
        const memberDoc = await fsDb.collection('member_profiles').doc(userId).get();
        isMember = memberDoc.exists && memberDoc.data()?.isMember === true;

        const pricingDoc = await fsDb.collection('testSettings').doc('pricing').get();
        if (pricingDoc.exists) {
          memberDiscount = pricingDoc.data()?.memberProfitShare ?? DEFAULT_MEMBER_PROFIT_SHARE;
        }
      } catch (e) {
        console.error('[Checkout] Member/pricing check failed, proceeding with defaults:', e);
      }

      const discountLabel = formatProfitSharePercent(memberDiscount);

      const lineItems = cartItems.map((item) => {
        const customization = item.customization as any || {};
        const originalPrice = parseFloat(item.price || '0');
        const finalPrice = isMember ? originalPrice * (1 - memberDiscount) : originalPrice;
        const description = isMember
          ? `${customization.productLine || 'Custom'} QR - ${customization.variantName || 'Standard'} (${discountLabel} Creator Discount applied)`
          : `${customization.productLine || 'Custom'} QR - ${customization.variantName || 'Standard'}`;
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: customization.productName || 'QR Gear Product',
              description,
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: item.quantity || 1,
        };
      });

      if (isMember) {
        console.log(`[Checkout] Creator discount applied for user ${userId} — ${discountLabel} off all items`);
      }

      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/cart`,
        metadata: {
          userId,
          memberDiscount: isMember ? 'true' : 'false',
        },
      });

      res.json({ url: session.url, sessionId: session.id, memberDiscount: isMember });
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

      const { getUncachableStripeClient } = await import('../stripeClient');
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
      const orderItemsList: Array<{ productId: string; quantity: number; price: string; customization?: any }> = [];
      for (const item of cartItems) {
        await storage.createOrderItem({
          orderId: order.id,
          productId: item.productId,
          quantity: item.quantity || 1,
          price: item.price,
          customization: item.customization as Record<string, unknown>,
        });
        orderItemsList.push({
          productId: item.productId,
          quantity: item.quantity || 1,
          price: item.price,
          customization: item.customization,
        });
      }

      // Get user for email and unified order
      const user = await storage.getUser(userId);

      // Create unified order for admin tracking
      // Extract product details from cart items' customization data
      try {
        const unifiedItems = await Promise.all(orderItemsList.map(async (item) => {
          // Get product info for better tracking
          const product = await storage.getProduct(item.productId.toString());
          const customization = item.customization as Record<string, any> || {};
          
          const selectedSize = customization.selectedSize || customization.size || null;
          
          let actualPrintifyCost: number | null = null;
          let memberEarningsActual: number | null = null;
          let adminMarginActual: number | null = null;
          if (customization.packetId && selectedSize) {
            try {
              const { getFirestoreDb: getDb } = await import("../lib/firebase-admin");
              const packetDoc = await getDb().collection(MEMBER_PACKETS_COLLECTION).doc(customization.packetId).get();
              if (packetDoc.exists) {
                const snap = packetDoc.data()?.pricingSnapshot;
                if (snap?.printifyCostVariants?.[selectedSize]) {
                  actualPrintifyCost = snap.printifyCostVariants[selectedSize];
                  const retailPrice = parseFloat(item.price);
                  const actualProfit = retailPrice - actualPrintifyCost!;
                  const memberShare = snap.memberProfitShare ?? 0.25;
                  memberEarningsActual = Math.round(Math.max(0, actualProfit * memberShare) * 100) / 100;
                  adminMarginActual = Math.round(Math.max(0, actualProfit - memberEarningsActual) * 100) / 100;
                }
              }
            } catch (costErr) {
              console.warn('[OrderCost] Failed to look up actual cost (non-fatal):', costErr);
            }
          }
          
          return {
            masterProductId: customization.masterProductId || null,
            variantSku: customization.variantSku || customization.sku || `product-${item.productId}`,
            quantity: item.quantity,
            price: parseFloat(item.price),
            productTitle: product?.name || customization.productName || `Product #${item.productId}`,
            size: selectedSize,
            color: customization.selectedColor || customization.color || null,
            actualPrintifyCost,
            memberEarningsActual,
            adminMarginActual,
          };
        }));

        await storage.createOrderUnified({
          sourceChannel: "direct",
          externalOrderId: order.id,
          customerEmail: user?.email || null,
          customerName: user?.firstName ? `${user.firstName} ${user.lastName || ''}`.trim() : null,
          shippingAddress: null, // Will be collected during fulfillment
          items: unifiedItems,
          subtotal: totalAmount.toFixed(2),
          total: totalAmount.toFixed(2),
          status: "pending", // Pending fulfillment, payment is complete
          statusHistory: [
            { status: "paid", timestamp: new Date().toISOString(), note: "Payment received via Stripe" },
            { status: "pending", timestamp: new Date().toISOString(), note: "Awaiting fulfillment routing" },
          ],
        });
      } catch (unifiedErr) {
        console.error("Failed to create unified order:", unifiedErr);
      }

      // Clear the cart
      for (const item of cartItems) {
        await storage.deleteCartItem(item.id);
      }

      const orderItems = await storage.getOrderItems(order.id);

      // Send order confirmation email
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

      // Create buyer instances for QR Dynamics products
      try {
        const { createBuyerInstance } = await import('../lib/buyerInstanceService');
        const buyerEmail = user?.email || (session.customer_details as any)?.email;
        
        if (buyerEmail) {
          for (const item of orderItems) {
            const customization = item.customization as Record<string, any> || {};
            const packetId = customization.packetId;
            
            if (packetId) {
              await createBuyerInstance({
                buyerEmail,
                buyerUserId: userId,
                orderId: order.id.toString(),
                packetId,
                templateId: customization.templateId || null,
                destinationUrl: customization.destinationUrl || customization.qrUrl || '',
              });
            }
          }
        }
      } catch (instanceErr) {
        console.error('Failed to create buyer instances:', instanceErr);
      }

      res.json({ order, items: orderItems });
    } catch (error: any) {
      console.error('Verify checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ ORDERS ============

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

  // ============ UNIFIED ORDERS ENDPOINTS ============

  // Get all unified orders (admin only)
  app.get("/api/admin/orders-unified", isAdmin, async (req, res) => {
    try {
      const orders = await storage.getOrders();
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get single unified order (admin only)
  app.get("/api/admin/orders-unified/:id", isAdmin, async (req, res) => {
    try {
      const order = await storage.getOrderUnified(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Update unified order status (admin only)
  app.patch("/api/admin/orders-unified/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, trackingNumber, trackingUrl, routedProvider, providerOrderId, productionCost, profit, notes } = req.body;
      
      // Get current order for status history
      const currentOrder = await storage.getOrderUnified(id);
      if (!currentOrder) {
        return res.status(404).json({ error: "Order not found" });
      }

      // Build status history entry
      let statusHistory = (currentOrder.statusHistory as Array<{status: string; timestamp: string; note?: string}>) || [];
      if (status && status !== currentOrder.status) {
        statusHistory = [
          ...statusHistory,
          { status, timestamp: new Date().toISOString(), note: notes || undefined }
        ];
      }

      const updates: Record<string, any> = {};
      if (status) updates.status = status;
      if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
      if (trackingUrl !== undefined) updates.trackingUrl = trackingUrl;
      if (routedProvider !== undefined) updates.routedProvider = routedProvider;
      if (providerOrderId !== undefined) updates.providerOrderId = providerOrderId;
      if (productionCost !== undefined) updates.productionCost = productionCost;
      if (profit !== undefined) updates.profit = profit;
      if (statusHistory.length > 0) updates.statusHistory = statusHistory;

      // Update timestamps for special statuses
      if (status === "shipped" && !currentOrder.shippedAt) {
        updates.shippedAt = new Date();
      }
      if (status === "delivered" && !currentOrder.deliveredAt) {
        updates.deliveredAt = new Date();
      }

      const updated = await storage.updateOrderUnified(id, updates);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Sync order status from Printify (admin only)
  app.post("/api/admin/orders-unified/:id/sync-printify", isAdmin, async (req, res) => {
    try {
      const order = await storage.getOrderUnified(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (!order.providerOrderId || order.routedProvider !== "printify") {
        return res.status(400).json({ error: "Order is not routed to Printify" });
      }

      // Call Printify to get order status
      const printifyStatus = await checkPrintifyOrderStatus(order.providerOrderId);
      
      if (printifyStatus) {
        const updates: Record<string, any> = {};
        
        // Map Printify status to our status
        const statusMap: Record<string, string> = {
          "pending": "pending",
          "on-hold": "pending",
          "payment-not-received": "pending",
          "in-production": "in_production",
          "fulfilled": "shipped",
          "canceled": "cancelled",
        };
        
        if (printifyStatus.status) {
          updates.status = statusMap[printifyStatus.status] || printifyStatus.status;
        }
        if (printifyStatus.trackingNumber) {
          updates.trackingNumber = printifyStatus.trackingNumber;
        }
        if (printifyStatus.trackingUrl) {
          updates.trackingUrl = printifyStatus.trackingUrl;
        }

        const updated = await storage.updateOrderUnified(req.params.id, updates);
        res.json({ synced: true, order: updated });
      } else {
        res.json({ synced: false, message: "Could not fetch status from Printify" });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ EMBEDDED STRIPE CHECKOUT ============

  app.post("/api/checkout/embedded", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cartItems = await storage.getCartItemsByUser(userId);

      if (!cartItems || cartItems.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
      }

      const { getUncachableStripeClient } = await import('../stripeClient');
      const stripe = await getUncachableStripeClient();

      const { DEFAULT_MEMBER_PROFIT_SHARE, formatProfitSharePercent } = await import("@shared/constants");

      let isMember = false;
      let memberDiscount = DEFAULT_MEMBER_PROFIT_SHARE;
      try {
        const { getFirestoreDb } = await import("../lib/firebase-admin");
        const fsDb = getFirestoreDb();
        const memberDoc = await fsDb.collection('member_profiles').doc(userId).get();
        isMember = memberDoc.exists && memberDoc.data()?.isMember === true;

        const pricingDoc = await fsDb.collection('testSettings').doc('pricing').get();
        if (pricingDoc.exists) {
          memberDiscount = pricingDoc.data()?.memberProfitShare ?? DEFAULT_MEMBER_PROFIT_SHARE;
        }
      } catch (e) {
        console.error('[EmbeddedCheckout] Member/pricing check failed, proceeding with defaults:', e);
      }

      const discountLabel = formatProfitSharePercent(memberDiscount);

      const lineItems = cartItems.map((item) => {
        const customization = item.customization as any || {};
        const originalPrice = parseFloat(item.price || '0');
        const finalPrice = isMember ? originalPrice * (1 - memberDiscount) : originalPrice;
        const description = isMember
          ? `${customization.productLine || 'Custom'} QR - ${customization.variantName || 'Standard'} (${discountLabel} Creator Discount applied)`
          : `${customization.productLine || 'Custom'} QR - ${customization.variantName || 'Standard'}`;
        return {
          price_data: {
            currency: 'usd',
            product_data: {
              name: customization.productName || 'QR Gear Product',
              description,
            },
            unit_amount: Math.round(finalPrice * 100),
          },
          quantity: item.quantity || 1,
        };
      });

      if (isMember) {
        console.log(`[EmbeddedCheckout] Creator discount applied for user ${userId} — ${discountLabel} off all items`);
      }

      const returnUrl = req.body.returnUrl || `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        ui_mode: 'embedded',
        return_url: returnUrl,
        metadata: {
          userId,
          memberDiscount: isMember ? 'true' : 'false',
        },
      });

      res.json({ clientSecret: session.client_secret });
    } catch (error: any) {
      console.error('Embedded checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ UPLOAD REQUEST URL ============

  app.post("/api/uploads/request-url", async (req, res) => {
    try {
      const { name, size, contentType } = req.body;

      if (!name || !contentType) {
        return res.status(400).json({ error: "Missing required fields: name, contentType" });
      }

      const path = `uploads/${Date.now()}-${name}`;
      const { getStorageBucket } = await import("../lib/firebase-admin");
      const bucket = getStorageBucket();
      const file = bucket.file(path);

      const [uploadUrl] = await file.getSignedUrl({
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
      });

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${path}`;

      res.json({ uploadUrl, fileUrl: publicUrl, path });
    } catch (error: any) {
      console.error('[UploadRequestUrl] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ CLAIM CODE ENDPOINTS ============

  app.get("/api/claim/validate", async (req, res) => {
    try {
      const code = req.query.code as string;

      if (!code) {
        return res.status(400).json({ valid: false, reason: "Missing claim code" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();

      const snapshot = await fsDb.collection('claim_codes').where('code', '==', code).limit(1).get();

      if (snapshot.empty) {
        return res.json({ valid: false, reason: "Claim code not found" });
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      if (data.status !== 'available') {
        return res.json({ valid: false, reason: "This claim code has already been used" });
      }

      res.json({
        valid: true,
        claimData: {
          claimCode: data.code,
          productName: data.productName || 'QR Gear Product',
          productDescription: data.productDescription || null,
          previewImageUrl: data.previewImageUrl || null,
          packetType: data.packetType || 'qr_basic',
          status: data.status,
        },
      });
    } catch (error: any) {
      console.error('[ClaimValidate] Error:', error);
      res.status(500).json({ valid: false, reason: error.message });
    }
  });

  app.post("/api/claim/:claimCode", isAuthenticated, async (req: any, res) => {
    try {
      const { claimCode } = req.params;
      const userId = req.user.claims.sub;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();

      const snapshot = await fsDb.collection('claim_codes').where('code', '==', claimCode).limit(1).get();

      if (snapshot.empty) {
        return res.status(404).json({ error: "Claim code not found" });
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      if (data.status !== 'available') {
        return res.status(400).json({ error: "This claim code has already been used" });
      }

      await doc.ref.update({
        status: 'claimed',
        claimedBy: userId,
        claimedAt: new Date(),
      });

      let instanceId: string | null = null;

      if (data.packetId) {
        const instanceRef = fsDb.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc();
        instanceId = instanceRef.id;
        await instanceRef.set({
          packetId: data.packetId,
          ownerId: userId,
          claimCode: claimCode,
          status: 'active',
          createdAt: new Date(),
        });
      }

      res.json({ success: true, instanceId });
    } catch (error: any) {
      console.error('[ClaimCode] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ DIAGNOSTIC ENDPOINTS ============

  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getAllProductCategories();
      res.json(categories);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/storage/health", async (req, res) => {
    try {
      const { getStorageBucket } = await import("../lib/firebase-admin");
      const bucket = getStorageBucket();
      res.json({ healthy: true, bucket: bucket.name });
    } catch (error: any) {
      res.json({ healthy: false, error: error.message });
    }
  });
}
