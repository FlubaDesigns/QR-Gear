"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
function register(app) {
    // ============ MARKETPLACE ENDPOINTS ============
    app.get('/admin/marketplace/stores', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snapshot = await core_1.db.collection('stores').where('roleType', '==', 'marketplace').get();
            const stores = snapshot.docs.map((doc) => {
                const data = doc.data();
                const config = data.marketplaceConfig || {};
                config.apiKeyConfigured = !!(config.apiKeyRef);
                return { id: doc.id, ...data, marketplaceConfig: config };
            });
            stores.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            res.json(stores);
        }
        catch (error) {
            console.error('[Marketplace] GET stores error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.put('/admin/marketplace/stores/:storeId/config', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const storeDoc = await core_1.db.collection('stores').doc(storeId).get();
            if (!storeDoc.exists) {
                res.status(404).json({ error: 'Store not found' });
                return;
            }
            const storeData = storeDoc.data();
            if (storeData?.roleType !== 'marketplace') {
                res.status(400).json({ error: 'Store is not a marketplace store' });
                return;
            }
            const { platform, apiKeyRef, shopId, shopName, feePercent, syncEnabled } = req.body;
            const updatedConfig = { ...(storeData?.marketplaceConfig || {}) };
            if (platform !== undefined)
                updatedConfig.platform = platform;
            if (apiKeyRef !== undefined)
                updatedConfig.apiKeyRef = apiKeyRef;
            if (shopId !== undefined)
                updatedConfig.shopId = shopId;
            if (shopName !== undefined)
                updatedConfig.shopName = shopName;
            if (feePercent !== undefined)
                updatedConfig.feePercent = typeof feePercent === 'number' ? feePercent : parseFloat(feePercent) || 0;
            if (syncEnabled !== undefined)
                updatedConfig.syncEnabled = syncEnabled === true;
            updatedConfig.updatedAt = new Date().toISOString();
            await core_1.db.collection('stores').doc(storeId).update({ marketplaceConfig: updatedConfig });
            res.json({ id: storeId, marketplaceConfig: updatedConfig });
        }
        catch (error) {
            console.error('[Marketplace] PUT config error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/marketplace/stores/:storeId/listings', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const storeDoc = await core_1.db.collection('stores').doc(storeId).get();
            if (!storeDoc.exists) {
                res.status(404).json({ error: 'Store not found' });
                return;
            }
            const storeData = storeDoc.data();
            if (storeData?.roleType !== 'marketplace') {
                res.status(400).json({ error: 'Store is not a marketplace store' });
                return;
            }
            const { productId, title, price, sku } = req.body;
            if (!productId) {
                res.status(400).json({ error: 'productId is required' });
                return;
            }
            const platform = storeData?.marketplaceConfig?.platform || 'unknown';
            const listingData = {
                storeId,
                productId,
                platform,
                title: title || '',
                price: typeof price === 'number' ? price : parseFloat(price) || 0,
                sku: sku || '',
                status: 'pending',
                marketplaceListingId: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            const docRef = await core_1.db.collection('marketplaceListings').add(listingData);
            res.json({ id: docRef.id, ...listingData });
        }
        catch (error) {
            console.error('[Marketplace] POST listing error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/marketplace/stores/:storeId/listings', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const storeDoc = await core_1.db.collection('stores').doc(storeId).get();
            if (!storeDoc.exists) {
                res.status(404).json({ error: 'Store not found' });
                return;
            }
            const snapshot = await core_1.db.collection('marketplaceListings').where('storeId', '==', storeId).get();
            const listings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            listings.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            res.json(listings);
        }
        catch (error) {
            console.error('[Marketplace] GET listings error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/marketplace/stores/:storeId/listings/:listingId/push', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId, listingId } = req.params;
            const listingDoc = await core_1.db.collection('marketplaceListings').doc(listingId).get();
            if (!listingDoc.exists) {
                res.status(404).json({ error: 'Listing not found' });
                return;
            }
            const listing = listingDoc.data();
            if (listing?.storeId !== storeId) {
                res.status(400).json({ error: 'Listing does not belong to this store' });
                return;
            }
            const storeDoc = await core_1.db.collection('stores').doc(storeId).get();
            const storeData = storeDoc.data();
            const platform = storeData?.marketplaceConfig?.platform || 'unknown';
            const apiKeyRef = storeData?.marketplaceConfig?.apiKeyRef;
            if (!apiKeyRef) {
                await core_1.db.collection('marketplaceListings').doc(listingId).update({ status: 'error', errorMessage: 'No API key configured for this marketplace', updatedAt: new Date().toISOString() });
                res.status(400).json({ error: 'No API key configured. Set up API credentials in marketplace config first.', message: 'API key not configured' });
                return;
            }
            await core_1.db.collection('marketplaceListings').doc(listingId).update({ status: 'syncing', updatedAt: new Date().toISOString() });
            res.json({ message: `Listing queued for push to ${platform}. API integration will process it.`, status: 'syncing' });
        }
        catch (error) {
            console.error('[Marketplace] POST push listing error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/stores/:storeId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { storeId } = req.params;
            const storeDoc = await core_1.db.collection('stores').doc(storeId).get();
            if (!storeDoc.exists) {
                res.status(404).json({ error: 'Store not found' });
                return;
            }
            const updates = {};
            if (req.body.isActive !== undefined)
                updates.isActive = req.body.isActive;
            if (req.body.name !== undefined)
                updates.name = req.body.name;
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection('stores').doc(storeId).update(updates);
            res.json({ id: storeId, ...storeDoc.data(), ...updates });
        }
        catch (error) {
            console.error('[Stores] PATCH error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=marketplace.js.map