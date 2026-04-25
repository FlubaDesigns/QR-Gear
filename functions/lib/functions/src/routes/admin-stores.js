"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const constants_1 = require("../constants");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ ADMIN STORES (stores + storeChannels collections) ============
    app.get('/admin/stores', middleware_1.requireAdmin, async (req, res) => {
        try {
            const roleType = req.query.roleType;
            let query = core_1.db.collection('stores');
            if (roleType)
                query = query.where('roleType', '==', roleType);
            const snapshot = await query.get();
            const stores = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            stores.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            res.json(stores);
        }
        catch (error) {
            console.error('[Stores] GET error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/stores', middleware_1.requireAdmin, async (req, res) => {
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
            console.error('[Stores] POST error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/stores/:storeId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const channelsSnapshot = await core_1.db.collection('storeChannels').where('storeId', '==', storeId).get();
            const batch = core_1.db.batch();
            channelsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));
            batch.delete(core_1.db.collection('stores').doc(storeId));
            await batch.commit();
            res.json({ success: true, deletedChannels: channelsSnapshot.size });
        }
        catch (error) {
            console.error('[Stores] DELETE error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/stores/by-id/:storeId', middleware_1.requireAdmin, async (req, res) => {
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
            console.error('[Stores] GET by-id error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // List ALL channels across all stores (with store name, including orphaned)
    app.get('/admin/channels', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('storeChannels').get();
            const storeIds = [...new Set(snapshot.docs.map((d) => d.data().storeId).filter(Boolean))];
            const storeMap = {};
            for (const id of storeIds) {
                const doc = await core_1.db.collection('stores').doc(id).get();
                storeMap[id] = doc.exists ? (doc.data()?.name || id) : `(orphaned)`;
            }
            const channels = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
                storeName: storeMap[doc.data().storeId] || `(orphaned)`,
                storeExists: !!storeMap[doc.data().storeId] && !storeMap[doc.data().storeId].includes('orphaned'),
            }));
            channels.sort((a, b) => (a.storeName || '').localeCompare(b.storeName || '') || (a.name || '').localeCompare(b.name || ''));
            res.json(channels);
        }
        catch (error) {
            console.error('[AllChannels] GET error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Delete any channel directly by ID (no storeId required)
    app.delete('/admin/channels/:channelId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { channelId } = req.params;
            await core_1.db.collection('storeChannels').doc(channelId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[AllChannels] DELETE error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/stores/:storeId/channels', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const snapshot = await core_1.db.collection('storeChannels').where('storeId', '==', storeId).get();
            const channels = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            channels.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            res.json(channels);
        }
        catch (error) {
            console.error('[Channels] GET error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/stores/:storeId/channels', middleware_1.requireAdmin, async (req, res) => {
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
            console.error('[Channels] POST error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/stores/:storeId/channels/:channelId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            // Soft-delete every catalog instance in this channel so the public store
            // stops showing them immediately without permanently destroying data.
            const instancesSnap = await core_1.db.collection('admin_catalog_instances')
                .where('storeId', '==', storeId)
                .where('channelId', '==', channelId)
                .get();
            const batch = core_1.db.batch();
            instancesSnap.docs.forEach(doc => {
                batch.update(doc.ref, { isVisible: false, status: 'deleted', deletedAt: now });
            });
            batch.delete(core_1.db.collection('storeChannels').doc(channelId));
            await batch.commit();
            res.json({ success: true, archivedInstances: instancesSnap.size });
        }
        catch (error) {
            console.error('[Channels] DELETE error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Admin: Delete a collection (soft-deletes all catalog instances in it)
    app.delete('/admin/stores/:storeId/channels/:channelId/collections/:collectionName', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId, collectionName } = req.params;
            const now = core_1.admin.firestore.FieldValue.serverTimestamp();
            const snap = await core_1.db.collection('admin_catalog_instances')
                .where('storeId', '==', storeId)
                .where('channelId', '==', channelId)
                .where('collectionName', '==', collectionName)
                .get();
            const batch = core_1.db.batch();
            snap.docs.forEach(doc => {
                batch.update(doc.ref, { isVisible: false, status: 'deleted', deletedAt: now });
            });
            await batch.commit();
            res.json({ success: true, deleted: snap.size });
        }
        catch (error) {
            console.error('[Collections] DELETE error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // Admin: Get collections for a store channel
    app.get('/admin/stores/:storeId/channels/:channelId/collections', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelId } = req.params;
            if (!storeId || !channelId) {
                res.status(400).json({ error: 'storeId and channelId are required' });
                return;
            }
            const collectionsSet = new Set();
            // 1. From admin_catalog_instances (primary source for Catalog tab)
            // Exclude soft-deleted instances so their collections don't appear in the sidebar.
            const instancesSnapshot = await core_1.db.collection('admin_catalog_instances')
                .where('storeId', '==', storeId)
                .where('channelId', '==', channelId)
                .get();
            instancesSnapshot.docs.forEach(doc => {
                const d = doc.data();
                if (d.isVisible === false || d.status === 'deleted')
                    return;
                const col = d.collectionName;
                if (col)
                    collectionsSet.add(col);
            });
            // 2. From storeProductLinks (legacy / store-facing products)
            const linksSnapshot = await core_1.db.collection('storeProductLinks')
                .where('storeId', '==', storeId)
                .where('channel', '==', channelId)
                .get();
            linksSnapshot.docs.forEach(doc => {
                const collection = doc.data().collection;
                if (collection)
                    collectionsSet.add(collection);
            });
            // 3. From mosaic templates
            const explicitSnapshot = await core_1.db.collection(constants_1.MOSAIC_TEMPLATES_COLLECTION)
                .where('storeId', '==', storeId)
                .where('channelId', '==', channelId)
                .get();
            explicitSnapshot.docs.forEach(doc => {
                const name = doc.data().name;
                if (name)
                    collectionsSet.add(name);
            });
            const collections = Array.from(collectionsSet).sort();
            res.json({ success: true, collections, count: collections.length });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ ADMIN PARTNER STORES ============
    app.get('/admin/partner-stores', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('partnerStores').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/partner-stores', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('partnerStores').add({
                ...req.body,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/partner-stores/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('partnerStores').doc(req.params.id).update(req.body);
            const doc = await core_1.db.collection('partnerStores').doc(req.params.id).get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/partner-stores/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('partnerStores').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/partner-stores/:id/products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('partnerStoreProducts')
                .where('storeId', '==', req.params.id)
                .get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/partner-stores/:id/products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('partnerStoreProducts').add({
                ...req.body,
                storeId: req.params.id,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Store Library: products assigned to a channel (reads storeProductLinks by channel name)
    app.get('/admin/stores/:storeId/channels/:channelName/products', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, channelName } = req.params;
            const snapshot = await core_1.db.collection('storeProductLinks')
                .where('storeId', '==', storeId)
                .where('channel', '==', channelName)
                .get();
            const products = snapshot.docs.map((doc) => {
                const d = doc.data();
                return {
                    id: doc.id,
                    linkId: doc.id,
                    packetId: d.packetId || null,
                    templateId: d.templateId || null,
                    name: d.productName || d.name || 'Untitled',
                    imageUrl: d.mockupUrl || d.compositeUrl || d.qrOnlyUrl || '',
                    baseProductId: d.baseProductId || null,
                    enabledColors: d.enabledColors || [],
                    enabledSizes: d.enabledSizes || [],
                    selectedGraphicSize: d.selectedGraphicSize || null,
                    defaultColor: d.defaultColor || null,
                    qrContent: d.qrContent || null,
                    pricing: d.pricing || null,
                };
            });
            res.json(products);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=admin-stores.js.map