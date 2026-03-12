import type { Express } from "express";
import { isAdmin } from "../firebaseAuth";

/**
 * Firestore collection name for mosaic templates (legacy name: dynamicsCollections).
 * Canonical domain term: MosaicTemplate.
 * Firestore collection unchanged to avoid data migration.
 */
const MOSAIC_TEMPLATES_COLLECTION = 'dynamicsCollections';

export function registerDynamicsContentRoutes(app: Express): void {

  app.get("/api/admin/stores/:storeId/channels/:channelId/content", isAdmin, async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;

      if (!storeId || !channelId) {
        return res.status(400).json({ error: "storeId and channelId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const contentSnapshot = await firestoreDb.collection("dynamicsChannelContent")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .get();

      const explicitContent = contentSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));

      const channelIdLower = channelId.toLowerCase();
      let packetsSnapshot = await firestoreDb.collection("productPackets")
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .get();

      if (packetsSnapshot.empty && channelId !== channelIdLower) {
        packetsSnapshot = await firestoreDb.collection("productPackets")
          .where("storeId", "==", storeId)
          .where("channelId", "==", channelIdLower)
          .get();
      }

      const packetContent = packetsSnapshot.docs
        .map(doc => {
          const data = doc.data();
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

  app.post("/api/admin/stores/:storeId/channels/:channelId/content", isAdmin, async (req: any, res) => {
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

  app.delete("/api/admin/stores/:storeId/channels/:channelId/content/:contentId", isAdmin, async (req: any, res) => {
    try {
      const { contentId } = req.params;

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

  app.post("/api/admin/collections/:collectionId/items", isAdmin, async (req: any, res) => {
    try {
      const { collectionId } = req.params;
      const { contentId, contentType, name, url, thumbnailUrl, rotationInterval } = req.body;

      if (!collectionId || !contentId || !contentType || !name || !url) {
        return res.status(400).json({ error: "collectionId, contentId, contentType, name, and url are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

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

  app.get("/api/admin/collections/:collectionId/items", isAdmin, async (req: any, res) => {
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

  app.patch("/api/admin/collections/:collectionId/items/:itemId", isAdmin, async (req: any, res) => {
    try {
      const { itemId } = req.params;
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

  app.delete("/api/admin/collections/:collectionId/items/:itemId", isAdmin, async (req: any, res) => {
    try {
      const { itemId } = req.params;

      if (!itemId) {
        return res.status(400).json({ error: "itemId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      await firestoreDb.collection("dynamicsCollectionItems").doc(itemId).delete();

      console.log(`[CollectionItems] Removed item ${itemId}`);

      res.json({ success: true });
    } catch (error: any) {
      console.error("[CollectionItems] Error removing item:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/collections/:collectionId/items/reorder", isAdmin, async (req: any, res) => {
    try {
      const { collectionId } = req.params;
      const { itemOrders } = req.body;

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

  app.get("/api/admin/stores/:storeId/channels/:channelId/collections", isAdmin, async (req: any, res) => {
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

      linksSnapshot.docs.forEach(doc => {
        const collection = doc.data().collection;
        if (collection) {
          collectionsSet.add(collection);
        }
      });

      const explicitSnapshot = await firestoreDb.collection(MOSAIC_TEMPLATES_COLLECTION)
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

  app.post("/api/admin/stores/:storeId/channels/:channelId/collections", isAdmin, async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { name } = req.body;

      if (!storeId || !channelId || !name) {
        return res.status(400).json({ error: "storeId, channelId, and name are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .where("collection", "==", name)
        .limit(1)
        .get();

      const explicitDoc = await firestoreDb.collection(MOSAIC_TEMPLATES_COLLECTION)
        .where("storeId", "==", storeId)
        .where("channelId", "==", channelId)
        .where("name", "==", name)
        .limit(1)
        .get();

      if (!linksSnapshot.empty || !explicitDoc.empty) {
        return res.status(400).json({ error: "Collection already exists" });
      }

      const docRef = await firestoreDb.collection(MOSAIC_TEMPLATES_COLLECTION).add({
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

  app.get("/api/admin/stores/:storeId/channels/:channelId/collections/:collectionName/items", isAdmin, async (req: any, res) => {
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

  app.post("/api/admin/dynamics/surfaces", isAdmin, async (req: any, res) => {
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

  app.get("/api/admin/dynamics/surfaces", isAdmin, async (req: any, res) => {
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

  app.get("/api/public/dynamics/resolve/:surfaceId", async (req: any, res) => {
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
}
