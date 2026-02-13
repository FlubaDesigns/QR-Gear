import type { Express } from "express";
import { storage } from "../storage";

export function registerStoreRoutes(app: Express): void {
  app.get("/api/stores", async (req: any, res) => {
    try {
      const roleType = req.query.roleType as string;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      let query = fsDb.collection('stores');
      if (roleType) query = query.where('roleType', '==', roleType) as any;
      const snapshot = await query.get();
      const stores = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      stores.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      res.json(stores);
    } catch (error: any) {
      console.error('[Stores] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stores/by-id/:storeId", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      let doc = await fsDb.collection('stores').doc(storeId).get();
      if (doc.exists) {
        const data = doc.data();
        return res.json({ id: doc.id, name: data?.name || storeId, type: data?.roleType || 'internal', roleType: data?.roleType || 'internal', isActive: data?.isActive ?? true });
      }
      doc = await fsDb.collection('partnerStores').doc(storeId).get();
      if (doc.exists) {
        const data = doc.data();
        return res.json({ id: doc.id, name: data?.name || storeId, type: data?.isInternal ? 'internal' : 'external', roleType: data?.isInternal ? 'internal' : 'external', isActive: data?.isActive ?? true, isPartnerStore: true });
      }
      return res.status(404).json({ error: 'Store not found' });
    } catch (error: any) {
      console.error('[Stores] GET by-id error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stores", async (req: any, res) => {
    try {
      const { name, roleType } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Store name is required' });
      if (!roleType || !['internal', 'external', 'member'].includes(roleType)) return res.status(400).json({ error: 'Valid roleType is required' });
      const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const storeData = { name: name.trim(), roleType, isActive: true, channelCount: 0, createdAt: new Date().toISOString() };
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('stores').doc(storeId).set(storeData);
      res.json({ id: storeId, ...storeData });
    } catch (error: any) {
      console.error('[Stores] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/stores/:storeId", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const channelsSnapshot = await fsDb.collection('storeChannels').where('storeId', '==', storeId).get();
      const batch = fsDb.batch();
      channelsSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
      batch.delete(fsDb.collection('stores').doc(storeId));
      await batch.commit();
      res.json({ success: true, deletedChannels: channelsSnapshot.size });
    } catch (error: any) {
      console.error('[Stores] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stores/:storeId/channels", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('storeChannels').where('storeId', '==', storeId).get();
      const channels = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      channels.sort((a: any, b: any) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      res.json(channels);
    } catch (error: any) {
      console.error('[Channels] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stores/:storeId/channels", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { name } = req.body;
      if (!name || !name.trim()) return res.status(400).json({ error: 'Channel name is required' });
      const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const channelData = { name: name.trim(), storeId, isActive: true, productCount: 0, createdAt: new Date().toISOString() };
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('storeChannels').doc(channelId).set(channelData);
      res.json({ id: channelId, ...channelData });
    } catch (error: any) {
      console.error('[Channels] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/stores/:storeId/channels/:channelId", async (req: any, res) => {
    try {
      const { channelId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('storeChannels').doc(channelId).delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error('[Channels] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stores/:storeId/allowed-products", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const doc = await fsDb.collection('storeAllowedProducts').doc(storeId).get();
      if (!doc.exists) return res.json({ storeId, products: [] });
      const data = doc.data();
      res.json({ storeId, products: data?.products || [], updatedAt: data?.updatedAt });
    } catch (error: any) {
      console.error('[AllowedProducts] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stores/:storeId/allowed-products", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { products } = req.body;
      if (!Array.isArray(products)) return res.status(400).json({ error: 'products must be an array' });
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const pricingDoc = await fsDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
      const textLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      const { downloadAndStoreFromUrl } = await import("../lib/firebase-storage-service");
      const { syncProductVariants } = await import("../lib/printify");
      const enrichedProducts = await Promise.all(
        products.map(async (p: { blueprintId: number; title: string; addedAt?: string }) => {
          try {
            const blueprint = await storage.getPrintifyBlueprint(p.blueprintId);
            const providers = await storage.getPrintifyPrintProviders(p.blueprintId);
            const usaProviders = providers.filter((prov: any) => prov.isUSA);
            const selectedProvider = usaProviders[0] || providers[0];
            let availableColors: Array<{name: string; hex: string}> = [];
            let availableSizes: string[] = [];
            if (selectedProvider?.availableColors && Array.isArray(selectedProvider.availableColors)) {
              availableColors = selectedProvider.availableColors as Array<{name: string; hex: string}>;
              availableSizes = (selectedProvider.availableSizes as string[]) || [];
            } else if (selectedProvider?.id) {
              try {
                const variantData = await syncProductVariants(p.blueprintId, Number(selectedProvider.id));
                availableColors = variantData.colors;
                availableSizes = variantData.sizes;
              } catch (syncErr) {
                console.error(`[AllowedProducts] Failed to sync variants for ${p.blueprintId}:`, syncErr);
              }
            }
            const baseCostCents = selectedProvider?.minCost || 0;
            const baseCost = baseCostCents / 100;
            const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
            const profit = retailPrice - baseCost;
            const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
            let imageUrl: string | null = null;
            if (blueprint?.primaryImageUrl) {
              imageUrl = await downloadAndStoreFromUrl(blueprint.primaryImageUrl, `product-blueprint-${p.blueprintId}`);
            }
            const mockupsByColor: Record<string, { front: string | null }> = {};
            if (availableColors.length > 0 && imageUrl) {
              mockupsByColor[availableColors[0].name] = { front: imageUrl };
            }
            return {
              blueprintId: p.blueprintId, title: p.title, addedAt: p.addedAt || new Date().toISOString(),
              imageUrl, brand: blueprint?.brand || null, availableColors, availableSizes, mockupsByColor,
              printProviderId: selectedProvider?.id || null, baseCost, retailPrice, profit, memberEarnings,
              hasUSAProvider: usaProviders.length > 0,
              pricingUsed: { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, memberProfitShare },
              packetCreatedAt: new Date().toISOString(),
            };
          } catch (err) {
            console.error(`[AllowedProducts] Error enriching blueprint ${p.blueprintId}:`, err);
            return { ...p, addedAt: p.addedAt || new Date().toISOString(), imageUrl: null, brand: null, baseCost: 0, retailPrice: 0, profit: 0, memberEarnings: 0, hasUSAProvider: false, pricingUsed: null, packetCreatedAt: new Date().toISOString() };
          }
        })
      );
      await fsDb.collection('storeAllowedProducts').doc(storeId).set({ storeId, products: enrichedProducts, updatedAt: new Date().toISOString() });
      res.json({ success: true, storeId, productCount: enrichedProducts.length, message: `Created ${enrichedProducts.length} common packets with pricing` });
    } catch (error: any) {
      console.error('[AllowedProducts] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/partner-stores", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('partnerStores').get();
      const stores = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return { id: doc.id, name: data.name, slug: data.slug, isInternal: data.isInternal ?? true, isActive: data.isActive ?? true, availableSegments: data.availableSegments || [], apiKey: data.apiKey || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null, updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null };
      });
      res.json(stores);
    } catch (error: any) {
      console.error('[PartnerStores] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stores/:storeId/channels/:channelId/products", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { productIds } = req.body;
      const { getFirestoreDb, getFirebaseAdmin } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const admin = getFirebaseAdmin();
      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = fsDb.batch();
      const existingSnapshot = await fsDb.collection('storeChannelProducts').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
      existingSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
      for (const productId of (productIds || [])) {
        const docRef = fsDb.collection('storeChannelProducts').doc();
        batch.set(docRef, { storeId, channelId, productId, createdAt: now });
      }
      await batch.commit();
      res.json({ success: true, synced: (productIds || []).length });
    } catch (error: any) {
      console.error('[ChannelProducts] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stores/:storeId/channels/:channelId/products", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('storeChannelProducts').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
      const products = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(products);
    } catch (error: any) {
      console.error('[ChannelProducts] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stores/:storeId/channels/:channelId/content", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('storeChannelContent').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
      const content = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(content);
    } catch (error: any) {
      console.error('[ChannelContent] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stores/:storeId/channels/:channelId/content", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const contentData = req.body;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const docRef = fsDb.collection('storeChannelContent').doc();
      await docRef.set({ ...contentData, storeId, channelId, createdAt: new Date().toISOString() });
      res.json({ id: docRef.id, ...contentData, storeId, channelId });
    } catch (error: any) {
      console.error('[ChannelContent] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/stores/:storeId/channels/:channelId/content/:contentId", async (req: any, res) => {
    try {
      const { contentId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('storeChannelContent').doc(contentId).delete();
      res.json({ success: true });
    } catch (error: any) {
      console.error('[ChannelContent] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stores/:storeId/channels/:channelId/collections", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('storeChannelCollections').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
      const collections = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
      res.json(collections);
    } catch (error: any) {
      console.error('[ChannelCollections] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stores/:storeId/channels/:channelId/collections", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const collectionData = req.body;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const docRef = fsDb.collection('storeChannelCollections').doc();
      await docRef.set({ ...collectionData, storeId, channelId, createdAt: new Date().toISOString() });
      res.json({ id: docRef.id, ...collectionData, storeId, channelId });
    } catch (error: any) {
      console.error('[ChannelCollections] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stores/:storeId/channels/:channelId/collections/:collectionName/items", async (req: any, res) => {
    try {
      const { storeId, channelId, collectionName } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('storeChannelCollections').where('storeId', '==', storeId).where('channelId', '==', channelId).where('name', '==', collectionName).get();
      if (snapshot.empty) return res.json({ items: [] });
      const collectionDoc = snapshot.docs[0];
      const data = collectionDoc.data();
      res.json({ items: data?.items || [] });
    } catch (error: any) {
      console.error('[CollectionItems] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });
}
