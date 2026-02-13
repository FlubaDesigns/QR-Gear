import type { Express } from "express";
import { storage } from "../storage";
import { isAuthenticated, isAdmin } from "../firebaseAuth";

export function registerQRDynamicsRoutes(app: Express): void {

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

  // Create dynamic page from builder (with content config)
  app.post("/api/dynamic-pages/create", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        title, 
        description, 
        backgroundUrl, 
        backgroundType, 
        overlayPosition, 
        overlayColor, 
        overlayFontFamily,
        productId,
        qrState 
      } = req.body;
      
      // Generate unique slug
      const slug = crypto.randomUUID();
      
      // Store content config in description as JSON for now
      const contentConfig = JSON.stringify({
        backgroundUrl,
        backgroundType: backgroundType || "image",
        overlayPosition: overlayPosition || "bottom",
        overlayColor: overlayColor || "#ffffff",
        overlayFontFamily: overlayFontFamily || "Arial",
        productId,
        qrState,
      });
      
      const page = await storage.createDynamicPage({
        userId,
        slug,
        title: title || "Untitled",
        description: contentConfig,
        status: "active",
      });
      
      // Build the public URL
      const baseUrl = process.env.NODE_ENV === "production" 
        ? "https://qrgear-c1ffd.web.app"
        : `http://localhost:${process.env.PORT || 5000}`;
      
      res.status(201).json({
        id: page.id,
        slug: page.slug,
        url: `${baseUrl}/p/${page.slug}`,
        createdAt: page.createdAt,
      });
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

  // ============== BUYER INSTANCES API ==============

  // Get buyer instances for authenticated user
  app.get("/api/buyer/instances", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { getBuyerInstancesByUserId } = await import('../lib/buyerInstanceService');
      const instances = await getBuyerInstancesByUserId(userId);
      res.json({ instances });
    } catch (error: any) {
      console.error('[BuyerInstances] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get a single buyer instance
  app.get("/api/buyer/instances/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance, isInstanceActive } = await import('../lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }
      
      res.json({ 
        instance,
        isActive: isInstanceActive(instance)
      });
    } catch (error: any) {
      console.error('[BuyerInstances] GET single error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update instance destination URL
  app.patch("/api/buyer/instances/:instanceId", isAuthenticated, async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { destinationUrl } = req.body;
      const userId = req.user.claims.sub;
      
      const { getBuyerInstance, updateInstanceDestination } = await import('../lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }
      
      if (instance.buyerUserId !== userId) {
        return res.status(403).json({ error: "Not authorized to update this instance" });
      }
      
      await updateInstanceDestination(instanceId, destinationUrl);
      res.json({ success: true });
    } catch (error: any) {
      console.error('[BuyerInstances] PATCH error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create renewal checkout session
  app.post("/api/buyer/instances/:instanceId/renew", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance } = await import('../lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const { getUncachableStripeClient } = await import('../stripeClient');
      const stripe = await getUncachableStripeClient();
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'QR Hosting Renewal - 3 Years',
              description: 'Extend your QR hosting for another 3 years',
            },
            unit_amount: 499, // $4.99 in cents
          },
          quantity: 1,
        }],
        mode: 'payment',
        success_url: `${baseUrl}/renew/${instanceId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/renew/${instanceId}`,
        metadata: {
          instanceId,
          type: 'hosting_renewal',
        },
        customer_email: instance.buyerEmail,
      });

      res.json({ url: session.url, sessionId: session.id });
    } catch (error: any) {
      console.error('[BuyerInstances] Renew checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Verify renewal payment and extend hosting
  app.post("/api/buyer/instances/:instanceId/verify-renewal", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { sessionId } = req.body;

      const { getUncachableStripeClient } = await import('../stripeClient');
      const stripe = await getUncachableStripeClient();
      
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      
      if (session.payment_status !== 'paid') {
        return res.status(400).json({ error: "Payment not completed" });
      }
      
      if (session.metadata?.instanceId !== instanceId) {
        return res.status(400).json({ error: "Session does not match instance" });
      }

      const { extendInstanceHosting } = await import('../lib/buyerInstanceService');
      const updatedInstance = await extendInstanceHosting(instanceId, 3);
      
      if (!updatedInstance) {
        return res.status(404).json({ error: "Instance not found" });
      }

      res.json({ 
        success: true, 
        instance: updatedInstance,
        newExpirationDate: updatedInstance.hostingExpiresAt 
      });
    } catch (error: any) {
      console.error('[BuyerInstances] Verify renewal error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resolve instance for QR scan - returns content or renewal page redirect
  app.get("/api/resolve/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { getBuyerInstance, isInstanceActive } = await import('../lib/buyerInstanceService');
      const instance = await getBuyerInstance(instanceId);
      
      if (!instance) {
        return res.status(404).json({ error: "Instance not found", redirect: "/not-found" });
      }
      
      if (!isInstanceActive(instance)) {
        // Instance expired - redirect to renewal page
        return res.json({ 
          expired: true,
          redirect: `/renew/${instanceId}`,
          message: "Your QR hosting has expired. Please renew to continue."
        });
      }
      
      // Active instance - return content info
      res.json({
        expired: false,
        destinationUrl: instance.destinationUrl,
        packetId: instance.packetId,
        instanceId: instance.instanceId
      });
    } catch (error: any) {
      console.error('[Resolve] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== QR DYNAMICS - Channel Content API ==============

  // Get all content (images, videos, documents) for a channel
  app.get("/api/test/stores/:storeId/channels/:channelId/content", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;

      if (!storeId || !channelId) {
        return res.status(400).json({ error: "storeId and channelId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Query dynamicsChannelContent for this channel's explicit content
      const contentSnapshot = await firestoreDb.collection("dynamicsChannelContent")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .get();

      const explicitContent = contentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Also fetch packets for this store/channel as landing page content
      // Try both exact match and lowercase match for channel ID
      const channelIdLower = channelId.toLowerCase();
      let packetsSnapshot = await firestoreDb.collection("productPackets")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .get();
      
      // If no results, try lowercase version
      if (packetsSnapshot.empty && channelId !== channelIdLower) {
        packetsSnapshot = await firestoreDb.collection("productPackets")
          .where("storeId", "==", storeId)
          .where("channelId", "==", channelIdLower)
          .get();
      }

      const packetContent = packetsSnapshot.docs
        .map(doc => {
          const data = doc.data();
          // Only include packets that have a landing page snapshot
          if (data.landingPageSnapshotUrl) {
            return {
              id: `packet-${doc.id}`,
              storeId,
              channelId,
              name: data.productName || data.landingPageTitle || 'Landing Page',
              contentType: 'image' as const,
              url: data.landingPageSnapshotUrl,
              thumbnailUrl: data.landingPageSnapshotUrl,
              sourceType: 'packet',
              packetId: doc.id,
              landingPageSlug: data.landingPageSlug,
            };
          }
          return null;
        })
        .filter(Boolean);

      const content = [...explicitContent, ...packetContent];

      console.log(`[ChannelContent] Found ${explicitContent.length} explicit + ${packetContent.length} packets = ${content.length} total for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        content,
        count: content.length 
      });
    } catch (error: any) {
      console.error("[ChannelContent] Error getting content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add content to a channel
  app.post("/api/test/stores/:storeId/channels/:channelId/content", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { name, contentType, url, thumbnailUrl, metadata } = req.body;

      if (!storeId || !channelId || !name || !contentType || !url) {
        return res.status(400).json({ error: "storeId, channelId, name, contentType, and url are required" });
      }

      if (!['image', 'video', 'document'].includes(contentType)) {
        return res.status(400).json({ error: "contentType must be 'image', 'video', or 'document'" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = await firestoreDb.collection("dynamicsChannelContent").add({
        storeId,
        channelId,
        name,
        contentType,
        url,
        thumbnailUrl: thumbnailUrl || url,
        metadata: metadata || {},
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[ChannelContent] Created content "${name}" for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        contentId: docRef.id,
        name,
      });
    } catch (error: any) {
      console.error("[ChannelContent] Error creating content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete content from a channel
  app.delete("/api/test/stores/:storeId/channels/:channelId/content/:contentId", async (req: any, res) => {
    try {
      const { storeId, channelId, contentId } = req.params;

      if (!contentId) {
        return res.status(400).json({ error: "contentId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      await firestoreDb.collection("dynamicsChannelContent").doc(contentId).delete();

      console.log(`[ChannelContent] Deleted content ${contentId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[ChannelContent] Error deleting content:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== QR DYNAMICS - Collection Items API ==============

  // Add item to collection
  app.post("/api/test/collections/:collectionId/items", async (req: any, res) => {
    try {
      const { collectionId } = req.params;
      const { contentId, contentType, name, url, thumbnailUrl, rotationInterval } = req.body;

      if (!collectionId || !contentId || !contentType || !name || !url) {
        return res.status(400).json({ error: "collectionId, contentId, contentType, name, and url are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Get current max order
      const existingItems = await firestoreDb.collection("dynamicsCollectionItems")
        .where("collectionId", "==", collectionId)
        .orderBy("order", "desc")
        .limit(1)
        .get();

      const maxOrder = existingItems.empty ? 0 : (existingItems.docs[0].data().order || 0);

      const docRef = await firestoreDb.collection("dynamicsCollectionItems").add({
        collectionId,
        contentId,
        contentType,
        name,
        url,
        thumbnailUrl: thumbnailUrl || url,
        order: maxOrder + 1,
        rotationInterval: rotationInterval || 'daily',
        addedAt: new Date(),
      });

      console.log(`[CollectionItems] Added item to collection ${collectionId}`);

      res.json({ 
        success: true, 
        itemId: docRef.id,
        order: maxOrder + 1,
      });
    } catch (error: any) {
      console.error("[CollectionItems] Error adding item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get items in a collection (by collection ID)
  app.get("/api/test/collections/:collectionId/items", async (req: any, res) => {
    try {
      const { collectionId } = req.params;

      if (!collectionId) {
        return res.status(400).json({ error: "collectionId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const itemsSnapshot = await firestoreDb.collection("dynamicsCollectionItems")
        .where("collectionId", "==", collectionId)
        .orderBy("order", "asc")
        .get();

      const items = itemsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      res.json({ 
        success: true, 
        items,
        count: items.length 
      });
    } catch (error: any) {
      console.error("[CollectionItems] Error getting items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update collection item (order or interval)
  app.patch("/api/test/collections/:collectionId/items/:itemId", async (req: any, res) => {
    try {
      const { collectionId, itemId } = req.params;
      const { order, rotationInterval } = req.body;

      if (!itemId) {
        return res.status(400).json({ error: "itemId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const updateData: any = { updatedAt: new Date() };
      if (order !== undefined) updateData.order = order;
      if (rotationInterval) updateData.rotationInterval = rotationInterval;

      await firestoreDb.collection("dynamicsCollectionItems").doc(itemId).update(updateData);

      console.log(`[CollectionItems] Updated item ${itemId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CollectionItems] Error updating item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove item from collection
  app.delete("/api/test/collections/:collectionId/items/:itemId", async (req: any, res) => {
    try {
      const { collectionId, itemId } = req.params;

      if (!itemId) {
        return res.status(400).json({ error: "itemId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      await firestoreDb.collection("dynamicsCollectionItems").doc(itemId).delete();

      console.log(`[CollectionItems] Removed item ${itemId} from collection ${collectionId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CollectionItems] Error removing item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Reorder items in collection
  app.put("/api/test/collections/:collectionId/items/reorder", async (req: any, res) => {
    try {
      const { collectionId } = req.params;
      const { itemOrders } = req.body; // Array of { itemId, order }

      if (!collectionId || !itemOrders || !Array.isArray(itemOrders)) {
        return res.status(400).json({ error: "collectionId and itemOrders array are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const batch = firestoreDb.batch();
      
      for (const { itemId, order } of itemOrders) {
        const docRef = firestoreDb.collection("dynamicsCollectionItems").doc(itemId);
        batch.update(docRef, { order, updatedAt: new Date() });
      }

      await batch.commit();

      console.log(`[CollectionItems] Reordered ${itemOrders.length} items in collection ${collectionId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CollectionItems] Error reordering items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== QR DYNAMICS - Collections API ==============

  // Get all unique collections for a store/channel
  app.get("/api/test/stores/:storeId/channels/:channelId/collections", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;

      if (!storeId || !channelId) {
        return res.status(400).json({ error: "storeId and channelId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .get();

      const collectionsSet = new Set<string>();
      
      // Get collections from product links
      linksSnapshot.docs.forEach(doc => {
        const collection = doc.data().collection;
        if (collection) {
          collectionsSet.add(collection);
        }
      });

      // Also get explicit collections from dynamicsCollections
      const explicitSnapshot = await firestoreDb.collection("dynamicsCollections")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .get();

      explicitSnapshot.docs.forEach(doc => {
        const name = doc.data().name;
        if (name) {
          collectionsSet.add(name);
        }
      });

      const collections = Array.from(collectionsSet).sort();

      console.log(`[Collections] Found ${collections.length} collections for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        collections,
        count: collections.length 
      });
    } catch (error: any) {
      console.error("[Collections] Error getting collections:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new collection
  app.post("/api/test/stores/:storeId/channels/:channelId/collections", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { name } = req.body;

      if (!storeId || !channelId || !name) {
        return res.status(400).json({ error: "storeId, channelId, and name are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      // Check if collection already exists (either as explicit or from links)
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .where("collection", "==", name)
        .limit(1)
        .get();

      const explicitDoc = await firestoreDb.collection("dynamicsCollections")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .where("name", "==", name)
        .limit(1)
        .get();

      if (!linksSnapshot.empty || !explicitDoc.empty) {
        return res.status(400).json({ error: "Collection already exists" });
      }

      // Create explicit collection record
      const docRef = await firestoreDb.collection("dynamicsCollections").add({
        storeId,
        channelId,
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(`[Collections] Created collection "${name}" for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        collectionId: docRef.id,
        name,
      });
    } catch (error: any) {
      console.error("[Collections] Error creating collection:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get items in a specific collection
  app.get("/api/test/stores/:storeId/channels/:channelId/collections/:collectionName/items", async (req: any, res) => {
    try {
      const { storeId, channelId, collectionName } = req.params;

      if (!storeId || !channelId || !collectionName) {
        return res.status(400).json({ error: "storeId, channelId, and collectionName are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .where("collection", "==", collectionName)
        .get();

      const items = linksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          linkId: doc.id,
          packetId: data.packetId || null,
          name: data.productName || "Untitled Product",
          imageUrl: data.compositeUrl || data.qrOnlyUrl || null,
          mockupUrl: data.mockupUrl || null,
          qrProductState: data.qrProductState || null,
          landingPageUrl: data.landingPageUrl || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      });

      console.log(`[Collections] Found ${items.length} items in collection ${collectionName} for ${storeId}/${channelId}`);

      res.json({ 
        success: true, 
        items,
        collection: collectionName,
        count: items.length 
      });
    } catch (error: any) {
      console.error("[Collections] Error getting collection items:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============== QR DYNAMICS - Surfaces & Resolver API ==============

  // Create or update a Dynamics surface
  app.post("/api/test/dynamics/surfaces", async (req: any, res) => {
    try {
      const { 
        name, storeId, channelId, collectionName, 
        rotationInterval, timezone, isEnabled 
      } = req.body;

      if (!storeId || !channelId || !collectionName) {
        return res.status(400).json({ error: "storeId, channelId, and collectionName are required" });
      }

      const { getFirestoreDb, FieldValue } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const surfaceData = {
        name: name || `Dynamics - ${collectionName}`,
        storeId,
        channelId,
        collectionName,
        rotationInterval: rotationInterval || "daily",
        timezone: timezone || "America/New_York",
        isEnabled: isEnabled !== false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      const surfaceRef = await firestoreDb.collection("qrDynamicsSurfaces").add(surfaceData);

      console.log(`[Dynamics] Created surface: ${surfaceRef.id} for collection ${collectionName}`);

      res.json({
        success: true,
        surfaceId: surfaceRef.id,
        message: `Dynamics surface created for ${collectionName}`,
      });
    } catch (error: any) {
      console.error("[Dynamics] Error creating surface:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all surfaces
  app.get("/api/test/dynamics/surfaces", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("qrDynamicsSurfaces")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const surfaces = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      res.json({ success: true, surfaces, count: surfaces.length });
    } catch (error: any) {
      console.error("[Dynamics] Error listing surfaces:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Resolver: Get what should show NOW for a surface
  app.get("/api/test/dynamics/resolve/:surfaceId", async (req: any, res) => {
    try {
      const { surfaceId } = req.params;

      if (!surfaceId) {
        return res.status(400).json({ error: "surfaceId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const surfaceDoc = await firestoreDb.collection("qrDynamicsSurfaces").doc(surfaceId).get();
      
      if (!surfaceDoc.exists) {
        return res.status(404).json({ error: "Surface not found" });
      }

      const surface = surfaceDoc.data() as any;
      
      if (!surface.isEnabled) {
        return res.json({
          success: true,
          surfaceId,
          isEnabled: false,
          activeItem: null,
          message: "Surface is disabled",
        });
      }

      const { storeId, channelId, collectionName, rotationInterval, timezone } = surface;

      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .where("collection", "==", collectionName)
        .orderBy("createdAt", "asc")
        .get();

      if (linksSnapshot.empty) {
        return res.json({
          success: true,
          surfaceId,
          isEnabled: true,
          activeItem: null,
          message: "No items in collection",
        });
      }

      const items = linksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      const now = new Date();
      const tz = timezone || "America/New_York";
      
      const fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        weekday: "short",
        hour12: false
      });
      const parts = fmt.formatToParts(now);
      const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
      
      const year = Number(get("year"));
      const month = Number(get("month"));
      const day = Number(get("day"));
      const weekdayStr = get("weekday");

      let indexKey: number;
      
      if (rotationInterval === "daily") {
        indexKey = year * 10000 + month * 100 + day;
      } else if (rotationInterval === "weekly") {
        const startOfYear = new Date(year, 0, 1);
        const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
        indexKey = year * 100 + Math.floor(dayOfYear / 7);
      } else {
        indexKey = year * 100 + month;
      }

      const activeIndex = indexKey % items.length;
      const activeItem = items[activeIndex];

      const nextSwitchInfo = rotationInterval === "daily" 
        ? "Midnight (local time)" 
        : rotationInterval === "weekly" 
          ? "Sunday midnight" 
          : "1st of next month";

      console.log(`[Dynamics Resolver] Surface ${surfaceId}: showing item ${activeIndex + 1}/${items.length} (${rotationInterval})`);

      res.json({
        success: true,
        serverNowIso: now.toISOString(),
        surfaceId,
        isEnabled: true,
        rotationInterval,
        timezone: tz,
        totalItems: items.length,
        activeIndex,
        activeItem: {
          id: activeItem.id,
          packetId: (activeItem as any).packetId,
          name: (activeItem as any).productName || "Untitled",
          imageUrl: (activeItem as any).compositeUrl || (activeItem as any).qrOnlyUrl,
          mockupUrl: (activeItem as any).mockupUrl,
          landingPageUrl: (activeItem as any).landingPageUrl,
          qrProductState: (activeItem as any).qrProductState,
        },
        nextSwitch: nextSwitchInfo,
      });
    } catch (error: any) {
      console.error("[Dynamics Resolver] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // QR DYNAMICS V2 - TIME-BASED URL STITCHER
  // ============================================================

  // Get packets filtered to qr-canvas/qr-play only (for QR Dynamics admin UI)
  app.get("/api/dynamics/packets", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.query;

      if (!storeId) {
        return res.status(400).json({ error: "storeId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      // Query productPackets for this store (optionally filtered by channel)
      // Try both exact match and lowercase for channelId
      const channelIdLower = channelId ? (channelId as string).toLowerCase() : null;
      
      let packetsSnapshot = await firestoreDb.collection("productPackets")
        .where("storeId", "==", storeId)
        .get();

      // Filter by channel if provided
      let docs = packetsSnapshot.docs;
      if (channelId) {
        docs = docs.filter(doc => {
          const data = doc.data();
          return data.channelId === channelId || data.channelId === channelIdLower;
        });
      }

      // Filter to packets with landing page snapshots and derive type from URL
      const packets = docs
        .map(doc => {
          const data = doc.data();
          
          // Only include packets that have a landing page snapshot URL
          if (!data.landingPageSnapshotUrl) return null;
          
          // Derive type from URL path: /canvas/ = qr-canvas, /play/ = qr-play
          const url = data.landingPageSnapshotUrl || '';
          let qrType: 'qr-canvas' | 'qr-play' = 'qr-canvas';
          if (url.includes('/play/')) {
            qrType = 'qr-play';
          } else if (url.includes('/canvas/')) {
            qrType = 'qr-canvas';
          }
          
          return {
            id: doc.id,
            packetId: doc.id,
            name: data.productName || data.landingPageTitle || 'Untitled',
            qrProductType: qrType,
            thumbnailUrl: data.landingPageSnapshotUrl,
            landingPageSlug: data.landingPageSlug,
            landingPageUrl: data.landingPageSlug ? `/p/${data.landingPageSlug}` : null,
            storeId: data.storeId,
            channelId: data.channelId,
          };
        })
        .filter(Boolean);

      console.log(`[Dynamics Packets] Found ${packets.length} eligible packets for ${storeId}/${channelId || 'all'}`);

      res.json({
        success: true,
        packets,
        count: packets.length,
      });
    } catch (error: any) {
      console.error("[Dynamics Packets] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Create QR Dynamics instance (typically at sale/checkout)
  app.post("/api/dynamics/instances", async (req: any, res) => {
    try {
      const { orderId, collectionId, slots, fallbackUrl } = req.body;

      if (!slots || !Array.isArray(slots) || slots.length === 0) {
        return res.status(400).json({ error: "slots array is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const nowEpoch = Math.floor(Date.now() / 1000);
      
      const instanceData = {
        orderId: orderId || null,
        collectionId: collectionId || null,
        createdAt: nowEpoch,
        startTimestamp: nowEpoch,
        mode: 'loop',
        fallbackUrl: fallbackUrl || null,
        slots: slots.map((slot: any, index: number) => ({
          slotId: slot.slotId || `slot-${Date.now()}-${index}`,
          packetId: slot.packetId,
          durationSeconds: slot.durationSeconds || 86400,
          order: slot.order ?? index + 1,
        })),
      };

      const docRef = await firestoreDb.collection("qr_dynamics_instances").add(instanceData);

      console.log(`[Dynamics Instance] Created instance ${docRef.id} with ${slots.length} slots`);

      res.json({
        success: true,
        instanceId: docRef.id,
        resolverUrl: `/qr/d/${docRef.id}`,
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error creating:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get instance details
  app.get("/api/dynamics/instances/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Instance not found" });
      }

      res.json({
        success: true,
        instance: {
          id: doc.id,
          ...doc.data(),
        },
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error fetching:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Preview current active slot using math
  app.get("/api/dynamics/instances/:instanceId/preview", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).json({ error: "Instance not found" });
      }

      const instance = doc.data() as any;
      const slots = instance.slots || [];

      if (slots.length === 0) {
        return res.json({
          success: true,
          activeSlot: null,
          message: "No slots configured",
        });
      }

      // Sort by order
      const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);

      // Time math
      const nowEpoch = Math.floor(Date.now() / 1000);
      const elapsed = nowEpoch - instance.startTimestamp;

      let cycleLength = 0;
      for (const slot of sortedSlots) {
        cycleLength += slot.durationSeconds;
      }

      if (cycleLength <= 0) {
        return res.status(500).json({ error: "Invalid cycle length" });
      }

      const position = elapsed % cycleLength;

      // Resolve active slot
      let running = 0;
      let activeSlot = null;
      let activeIndex = 0;

      for (let i = 0; i < sortedSlots.length; i++) {
        running += sortedSlots[i].durationSeconds;
        if (position < running) {
          activeSlot = sortedSlots[i];
          activeIndex = i;
          break;
        }
      }

      // Fetch packet details for thumbnail
      let packetDetails = null;
      if (activeSlot) {
        const packetDoc = await firestoreDb.collection("productPackets").doc(activeSlot.packetId).get();
        if (packetDoc.exists) {
          const packetData = packetDoc.data() as any;
          packetDetails = {
            name: packetData.productName || packetData.landingPageTitle || 'Untitled',
            thumbnailUrl: packetData.landingPageSnapshotUrl,
            landingPageSlug: packetData.landingPageSlug,
            qrProductType: packetData.qrProductType,
          };
        }
      }

      // Calculate time remaining in current slot
      let timeRemainingSeconds = 0;
      if (activeSlot) {
        const slotStart = running - activeSlot.durationSeconds;
        timeRemainingSeconds = activeSlot.durationSeconds - (position - slotStart);
      }

      res.json({
        success: true,
        nowEpoch,
        elapsed,
        cycleLength,
        position,
        activeIndex,
        totalSlots: sortedSlots.length,
        activeSlot: activeSlot ? {
          ...activeSlot,
          packet: packetDetails,
        } : null,
        timeRemainingSeconds,
        nextSlotIndex: (activeIndex + 1) % sortedSlots.length,
      });
    } catch (error: any) {
      console.error("[Dynamics Preview] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update instance slots (resets startTimestamp)
  app.put("/api/dynamics/instances/:instanceId/slots", async (req: any, res) => {
    try {
      const { instanceId } = req.params;
      const { slots } = req.body;

      if (!slots || !Array.isArray(slots)) {
        return res.status(400).json({ error: "slots array is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const nowEpoch = Math.floor(Date.now() / 1000);

      await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).update({
        slots: slots.map((slot: any, index: number) => ({
          slotId: slot.slotId || `slot-${Date.now()}-${index}`,
          packetId: slot.packetId,
          durationSeconds: slot.durationSeconds || 86400,
          order: slot.order ?? index + 1,
        })),
        startTimestamp: nowEpoch, // Reset anchor on edit
      });

      console.log(`[Dynamics Instance] Updated slots for ${instanceId}, reset startTimestamp`);

      res.json({
        success: true,
        instanceId,
        newStartTimestamp: nowEpoch,
      });
    } catch (error: any) {
      console.error("[Dynamics Instance] Error updating slots:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // QR RESOLVER: The actual redirect endpoint
  app.get("/qr/d/:instanceId", async (req: any, res) => {
    try {
      const { instanceId } = req.params;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const doc = await firestoreDb.collection("qr_dynamics_instances").doc(instanceId).get();

      if (!doc.exists) {
        return res.status(404).send("QR Dynamics instance not found");
      }

      const instance = doc.data() as any;
      const slots = instance.slots || [];

      if (slots.length === 0) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("No content configured");
      }

      // Sort by order
      const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);

      // SCAN-TO-REVEAL MODE: Serve a lightweight HTML page that tracks per-device progress via localStorage
      if (instance.composeMode === 'scan-to-reveal') {
        const slotPacketIds = sortedSlots.map((s: any) => s.packetId);
        const packetSlugs: string[] = [];
        
        for (const pid of slotPacketIds) {
          let pDoc = await firestoreDb.collection("productPackets").doc(pid).get();
          if (!pDoc.exists) {
            pDoc = await firestoreDb.collection("memberPackets").doc(pid).get();
          }
          const pData = pDoc.exists ? (pDoc.data() as any) : null;
          packetSlugs.push(pData?.landingPageSlug || '');
        }

        const validSlugs = packetSlugs.filter(s => s !== '');
        if (validSlugs.length === 0) {
          if (instance.fallbackUrl) {
            return res.redirect(302, instance.fallbackUrl);
          }
          return res.status(404).send("No content configured");
        }

        console.log(`[QR Dynamics] Scan-to-Reveal instance ${instanceId} with ${validSlugs.length} items`);

        const slugsJson = JSON.stringify(validSlugs);
        const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading...</title></head><body><script>
(function(){
  var k='qr_str_'+${JSON.stringify(instanceId)};
  var slugs=${slugsJson};
  var idx=parseInt(localStorage.getItem(k)||'0',10);
  if(isNaN(idx)||idx<0)idx=0;
  var current=idx%slugs.length;
  localStorage.setItem(k,String(idx+1));
  window.location.replace('/p/'+slugs[current]);
})();
</script><noscript><p>JavaScript is required.</p></noscript></body></html>`;

        return res.status(200).type('html').send(html);
      }

      // AUTO-ROTATE MODE: Time-based rotation (existing behavior)
      const nowEpoch = Math.floor(Date.now() / 1000);
      const elapsed = nowEpoch - instance.startTimestamp;

      let cycleLength = 0;
      for (const slot of sortedSlots) {
        cycleLength += slot.durationSeconds;
      }

      if (cycleLength <= 0) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(500).send("Invalid QR Dynamics configuration");
      }

      const position = elapsed % cycleLength;

      // Resolve active slot
      let running = 0;
      let activeSlot = null;

      for (const slot of sortedSlots) {
        running += slot.durationSeconds;
        if (position < running) {
          activeSlot = slot;
          break;
        }
      }

      if (!activeSlot) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(500).send("Unable to resolve slot");
      }

      // Fetch packet for redirect URL (check both productPackets and memberPackets)
      let packetDoc = await firestoreDb.collection("productPackets").doc(activeSlot.packetId).get();
      if (!packetDoc.exists) {
        packetDoc = await firestoreDb.collection("memberPackets").doc(activeSlot.packetId).get();
      }

      if (!packetDoc.exists) {
        // Slot's packet missing - skip to next slot
        console.log(`[QR Dynamics] Packet ${activeSlot.packetId} not found, trying next slot`);
        
        const nextSlotIndex = (sortedSlots.indexOf(activeSlot) + 1) % sortedSlots.length;
        const nextSlot = sortedSlots[nextSlotIndex];
        
        if (nextSlot && nextSlot.packetId !== activeSlot.packetId) {
          const nextPacketDoc = await firestoreDb.collection("productPackets").doc(nextSlot.packetId).get();
          if (nextPacketDoc.exists) {
            const nextPacketData = nextPacketDoc.data() as any;
            if (nextPacketData.landingPageSlug) {
              return res.redirect(302, `/p/${nextPacketData.landingPageSlug}`);
            }
          }
        }

        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("Content not available");
      }

      const packetData = packetDoc.data() as any;

      if (!packetData.landingPageSlug) {
        if (instance.fallbackUrl) {
          return res.redirect(302, instance.fallbackUrl);
        }
        return res.status(404).send("Landing page not configured");
      }

      console.log(`[QR Dynamics] Instance ${instanceId} → Slot ${activeSlot.order} → /p/${packetData.landingPageSlug}`);

      res.redirect(302, `/p/${packetData.landingPageSlug}`);
    } catch (error: any) {
      console.error("[QR Dynamics Resolver] Error:", error);
      res.status(500).send("QR Dynamics error");
    }
  });

  // ============================================================
  // END QR DYNAMICS V2
  // ============================================================
}
