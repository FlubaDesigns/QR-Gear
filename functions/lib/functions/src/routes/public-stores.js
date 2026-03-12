"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ PUBLIC STORE ROUTES (Batch 3) ============
    app.get('/stores/by-id/:storeId', async (req, res) => {
        try {
            const { storeId } = req.params;
            let doc = await core_1.db.collection('stores').doc(storeId).get();
            if (doc.exists) {
                const data = doc.data();
                res.json({ id: doc.id, name: data?.name || storeId, type: data?.roleType || 'internal', roleType: data?.roleType || 'internal', isActive: data?.isActive ?? true });
                return;
            }
            doc = await core_1.db.collection('partnerStores').doc(storeId).get();
            if (doc.exists) {
                const data = doc.data();
                res.json({ id: doc.id, name: data?.name || storeId, type: data?.isInternal ? 'internal' : 'external', roleType: data?.isInternal ? 'internal' : 'external', isActive: data?.isActive ?? true, isPartnerStore: true });
                return;
            }
            res.status(404).json({ error: 'Store not found' });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/stores', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, roleType } = req.body;
            if (!name || !name.trim()) {
                res.status(400).json({ error: 'Store name is required' });
                return;
            }
            if (!roleType || !['internal', 'external', 'member', 'marketplace'].includes(roleType)) {
                res.status(400).json({ error: 'Valid roleType is required' });
                return;
            }
            const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const storeData = { name: name.trim(), roleType, isActive: true, channelCount: 0, createdAt: new Date().toISOString() };
            if (roleType === 'marketplace') {
                const { platform, apiKeyRef, shopId, shopName, feePercent, syncEnabled } = req.body;
                storeData.marketplaceConfig = {
                    platform: platform || '',
                    apiKeyRef: apiKeyRef || '',
                    shopId: shopId || '',
                    shopName: shopName || '',
                    feePercent: typeof feePercent === 'number' ? feePercent : 0,
                    syncEnabled: syncEnabled === true,
                    apiKeyConfigured: false,
                };
            }
            await core_1.db.collection('stores').doc(storeId).set(storeData);
            res.json({ id: storeId, ...storeData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/stores/:storeId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const channelsSnapshot = await core_1.db.collection('storeChannels').where('storeId', '==', storeId).get();
            const batch = core_1.db.batch();
            channelsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            batch.delete(core_1.db.collection('stores').doc(storeId));
            await batch.commit();
            res.json({ success: true, deletedChannels: channelsSnapshot.size });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/stores/:storeId/channels', async (req, res) => {
        try {
            const { storeId } = req.params;
            const snapshot = await core_1.db.collection('storeChannels').where('storeId', '==', storeId).get();
            const channels = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            channels.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            res.json(channels);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/stores/:storeId/channels', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const { name } = req.body;
            if (!name || !name.trim()) {
                res.status(400).json({ error: 'Channel name is required' });
                return;
            }
            const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
            const channelData = { name: name.trim(), storeId, isActive: true, productCount: 0, createdAt: new Date().toISOString() };
            await core_1.db.collection('storeChannels').doc(channelId).set(channelData);
            res.json({ id: channelId, ...channelData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/stores/:storeId/channels/:channelId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { channelId } = req.params;
            await core_1.db.collection('storeChannels').doc(channelId).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/stores/:storeId/allowed-products', async (req, res) => {
        try {
            const { storeId } = req.params;
            const doc = await core_1.db.collection('storeAllowedProducts').doc(storeId).get();
            if (!doc.exists) {
                res.json({ storeId, products: [] });
                return;
            }
            const data = doc.data();
            res.json({ storeId, products: data?.products || [], updatedAt: data?.updatedAt });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/stores/:storeId/allowed-products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const { products } = req.body;
            if (!Array.isArray(products)) {
                res.status(400).json({ error: 'products must be an array' });
                return;
            }
            const pricingDoc = await core_1.db.collection("testSettings").doc("pricing").get();
            const ps = pricingDoc.exists ? pricingDoc.data() : null;
            const markupPercent = ps?.markupPercent ?? 25;
            const markupFixed = ps?.markupFixed ?? 0;
            const memberProfitShare = ps?.memberProfitShare ?? 0.25;
            const enrichedProducts = await Promise.all(products.map(async (p) => {
                try {
                    let baseCost = 0;
                    if (p.blueprintId) {
                        const provSnap = await core_1.db.collection('printifyPrintProviders').where('blueprintId', '==', p.blueprintId).limit(5).get();
                        const usaProv = provSnap.docs.filter(d => d.data().isUSA);
                        const selectedProv = usaProv[0] || provSnap.docs[0];
                        if (selectedProv)
                            baseCost = (selectedProv.data().minCost || 0) / 100;
                    }
                    const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
                    const profit = retailPrice - baseCost;
                    const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
                    return { blueprintId: p.blueprintId, title: p.title, addedAt: p.addedAt || new Date().toISOString(), imageUrl: p.imageUrl || null, baseCost, retailPrice, profit, memberEarnings, pricingUsed: { markupPercent, markupFixed, memberProfitShare }, packetCreatedAt: new Date().toISOString() };
                }
                catch {
                    return { ...p, addedAt: p.addedAt || new Date().toISOString(), baseCost: 0, retailPrice: 0, profit: 0, memberEarnings: 0 };
                }
            }));
            await core_1.db.collection('storeAllowedProducts').doc(storeId).set({ storeId, products: enrichedProducts, updatedAt: new Date().toISOString() });
            res.json({ success: true, storeId, productCount: enrichedProducts.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/partner-stores', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('partnerStores').get();
            const stores = snapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, name: data.name, slug: data.slug, isInternal: data.isInternal ?? true, isActive: data.isActive ?? true, availableSegments: data.availableSegments || [], apiKey: data.apiKey || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null }; });
            res.json(stores);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/stores/:storeId/channels/:channelId/products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const { productIds } = req.body;
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const batch = core_1.db.batch();
            const existingSnapshot = await core_1.db.collection('storeChannelProducts').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
            existingSnapshot.docs.forEach(doc => batch.delete(doc.ref));
            for (const productId of (productIds || [])) {
                const docRef = core_1.db.collection('storeChannelProducts').doc();
                batch.set(docRef, { storeId, channelId, productId, createdAt: now });
            }
            await batch.commit();
            res.json({ success: true, synced: (productIds || []).length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/stores/:storeId/channels/:channelId/products', async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const snapshot = await core_1.db.collection('storeChannelProducts').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
            const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(products);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/stores/:storeId/channels/:channelId/content', async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const snapshot = await core_1.db.collection('storeChannelContent').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
            const content = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(content);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/stores/:storeId/channels/:channelId/content', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const contentData = req.body;
            const docRef = core_1.db.collection('storeChannelContent').doc();
            await docRef.set({ ...contentData, storeId, channelId, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, ...contentData, storeId, channelId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/stores/:storeId/channels/:channelId/content/:contentId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { contentId } = req.params;
            await core_1.db.collection('storeChannelContent').doc(contentId).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/stores/:storeId/channels/:channelId/collections', async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const snapshot = await core_1.db.collection('storeChannelCollections').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
            const collections = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            res.json(collections);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/stores/:storeId/channels/:channelId/collections', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const collectionData = req.body;
            const docRef = core_1.db.collection('storeChannelCollections').doc();
            await docRef.set({ ...collectionData, storeId, channelId, createdAt: new Date().toISOString() });
            res.json({ id: docRef.id, ...collectionData, storeId, channelId });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/stores/:storeId/channels/:channelId/collections/:collectionName/items', async (req, res) => {
        try {
            const { storeId, channelId, collectionName } = req.params;
            const snapshot = await core_1.db.collection('storeChannelCollections').where('storeId', '==', storeId).where('channelId', '==', channelId).where('name', '==', collectionName).get();
            if (snapshot.empty) {
                res.json({ items: [] });
                return;
            }
            const data = snapshot.docs[0].data();
            res.json({ items: data?.items || [] });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=public-stores.js.map