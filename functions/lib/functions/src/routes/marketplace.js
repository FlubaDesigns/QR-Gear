"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const constants_1 = require("../constants");
const VALID_PLATFORMS = new Set(constants_1.MARKETPLACE_PLATFORMS);
const VALID_SURFACE_STATUSES = new Set(['draft', 'ready', 'published', 'archived']);
const VALID_LISTING_STATUSES = new Set(['pending', 'draft', 'active', 'syncing', 'error', 'paused', 'delisted']);
const VALID_JOB_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'cancelled']);
const VALID_JOB_ACTIONS = new Set(['create', 'update', 'delete', 'sync_inventory', 'full_sync']);
const VALID_LOG_LEVELS = new Set(['info', 'warn', 'error']);
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
    // ============ CANONICAL SURFACES SYSTEM ============
    // --- Marketplace Accounts ---
    app.get('/admin/surfaces/accounts', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snapshot = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).get();
            const accounts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            accounts.sort((a, b) => (a.accountName || '').localeCompare(b.accountName || ''));
            res.json(accounts);
        }
        catch (error) {
            console.error('[Surfaces] GET accounts error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/surfaces/accounts', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { platform, accountName, shopId, shopName, feePercent } = req.body;
            if (!platform || !accountName) {
                res.status(400).json({ error: 'platform and accountName are required' });
                return;
            }
            if (!VALID_PLATFORMS.has(platform)) {
                res.status(400).json({ error: `Invalid platform. Must be one of: ${constants_1.MARKETPLACE_PLATFORMS.join(', ')}` });
                return;
            }
            const now = new Date().toISOString();
            const data = {
                platform,
                accountName: accountName.trim(),
                shopId: shopId || '',
                shopName: shopName || '',
                isActive: true,
                feePercent: typeof feePercent === 'number' ? feePercent : parseFloat(feePercent) || 0,
                apiKeyConfigured: false,
                healthStatus: 'unknown',
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[Surfaces] POST account error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/surfaces/accounts/:accountId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { accountId } = req.params;
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            const updates = {};
            const allowed = ['accountName', 'shopId', 'shopName', 'isActive', 'feePercent', 'platform'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (updates.feePercent !== undefined) {
                updates.feePercent = typeof updates.feePercent === 'number' ? updates.feePercent : parseFloat(updates.feePercent) || 0;
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).update(updates);
            res.json({ id: accountId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[Surfaces] PATCH account error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/surfaces/accounts/:accountId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { accountId } = req.params;
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            const listingsSnap = await core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION).where('accountId', '==', accountId).limit(1).get();
            if (!listingsSnap.empty) {
                res.status(400).json({ error: 'Cannot delete account with active listings. Remove listings first.' });
                return;
            }
            await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[Surfaces] DELETE account error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // --- Surfaces ---
    app.get('/admin/surfaces', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snapshot = await core_1.db.collection(constants_1.SURFACES_COLLECTION).get();
            const surfaces = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            surfaces.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            res.json(surfaces);
        }
        catch (error) {
            console.error('[Surfaces] GET surfaces error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/admin/surfaces/:surfaceId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { surfaceId } = req.params;
            const doc = await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Surface not found' });
                return;
            }
            const variantsSnap = await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
            const variants = variantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            res.json({ ...doc.data(), id: doc.id, variants });
        }
        catch (error) {
            console.error('[Surfaces] GET surface error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/surfaces', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { masterProductId, title, subtitle, description, bulletPoints, tags, keywords, images, mockupImages, retailPrice, compareAtPrice, currency, sku, defaultSkuPrefix, enabledPlatforms, storeId, channelId, collectionId, productId, artifactId, mosaicId, supportsEmbedStore, supportsEmbedProduct, supportsEmbedBuilder, supportsEtsy, supportsEbay, supportsAmazon } = req.body;
            if (!masterProductId) {
                res.status(400).json({ error: 'masterProductId is required' });
                return;
            }
            const now = new Date().toISOString();
            const data = {
                masterProductId,
                title: title || '',
                subtitle: subtitle || '',
                description: description || '',
                bulletPoints: Array.isArray(bulletPoints) ? bulletPoints : [],
                tags: Array.isArray(tags) ? tags : [],
                keywords: Array.isArray(keywords) ? keywords : [],
                images: Array.isArray(images) ? images : [],
                mockupImages: Array.isArray(mockupImages) ? mockupImages : [],
                retailPrice: typeof retailPrice === 'number' ? retailPrice : parseFloat(retailPrice) || 0,
                compareAtPrice: compareAtPrice != null ? (typeof compareAtPrice === 'number' ? compareAtPrice : parseFloat(compareAtPrice) || undefined) : undefined,
                currency: currency || 'USD',
                sku: sku || '',
                defaultSkuPrefix: defaultSkuPrefix || '',
                enabledPlatforms: Array.isArray(enabledPlatforms) ? enabledPlatforms : [],
                storeId: storeId || '',
                channelId: channelId || '',
                collectionId: collectionId || '',
                productId: productId || '',
                artifactId: artifactId || '',
                mosaicId: mosaicId || '',
                supportsEmbedStore: supportsEmbedStore === true,
                supportsEmbedProduct: supportsEmbedProduct === true,
                supportsEmbedBuilder: supportsEmbedBuilder === true,
                supportsEtsy: supportsEtsy === true,
                supportsEbay: supportsEbay === true,
                supportsAmazon: supportsAmazon === true,
                status: 'draft',
                readinessErrors: [],
                isActive: true,
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.SURFACES_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[Surfaces] POST surface error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/surfaces/:surfaceId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { surfaceId } = req.params;
            const doc = await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Surface not found' });
                return;
            }
            const updates = {};
            const allowed = ['title', 'subtitle', 'description', 'bulletPoints', 'tags', 'keywords', 'images', 'mockupImages', 'retailPrice', 'compareAtPrice', 'currency', 'sku', 'defaultSkuPrefix', 'enabledPlatforms', 'status', 'storeId', 'channelId', 'collectionId', 'productId', 'artifactId', 'mosaicId', 'supportsEmbedStore', 'supportsEmbedProduct', 'supportsEmbedBuilder', 'supportsEtsy', 'supportsEbay', 'supportsAmazon', 'isActive'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (updates.retailPrice !== undefined) {
                updates.retailPrice = typeof updates.retailPrice === 'number' ? updates.retailPrice : parseFloat(updates.retailPrice) || 0;
            }
            if (updates.status !== undefined && !VALID_SURFACE_STATUSES.has(updates.status)) {
                res.status(400).json({ error: `Invalid status. Must be one of: ${[...VALID_SURFACE_STATUSES].join(', ')}` });
                return;
            }
            if (updates.enabledPlatforms !== undefined) {
                if (!Array.isArray(updates.enabledPlatforms) || updates.enabledPlatforms.some((p) => !VALID_PLATFORMS.has(p))) {
                    res.status(400).json({ error: `Invalid enabledPlatforms. Each must be one of: ${constants_1.MARKETPLACE_PLATFORMS.join(', ')}` });
                    return;
                }
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId).update(updates);
            res.json({ id: surfaceId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[Surfaces] PATCH surface error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/surfaces/:surfaceId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { surfaceId } = req.params;
            const doc = await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Surface not found' });
                return;
            }
            const listingsSnap = await core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION).where('surfaceId', '==', surfaceId).limit(1).get();
            if (!listingsSnap.empty) {
                res.status(400).json({ error: 'Cannot delete surface with active listings. Remove listings first.' });
                return;
            }
            const variantsSnap = await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
            const batch = core_1.db.batch();
            variantsSnap.docs.forEach((d) => batch.delete(d.ref));
            batch.delete(core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId));
            await batch.commit();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[Surfaces] DELETE surface error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/surfaces/:surfaceId/check-readiness', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { surfaceId } = req.params;
            const doc = await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Surface not found' });
                return;
            }
            const surface = doc.data();
            const variantsSnap = await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
            const variants = variantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
            const errors = [];
            if (!surface.title || surface.title.trim().length === 0)
                errors.push('Title is required');
            if (!surface.description || surface.description.trim().length === 0)
                errors.push('Description is required');
            if (!surface.images || surface.images.length === 0)
                errors.push('At least one image is required');
            if (surface.retailPrice == null || surface.retailPrice <= 0)
                errors.push('Retail price must be greater than zero');
            if (!surface.sku || surface.sku.trim().length === 0)
                errors.push('SKU is required');
            const enabledVariants = variants.filter((v) => v.enabled);
            if (enabledVariants.length === 0)
                errors.push('At least one enabled variant is required');
            const variantSkus = [];
            for (const v of enabledVariants) {
                if (!v.sku || v.sku.trim().length === 0) {
                    errors.push(`Variant ${v.size}/${v.color} is missing a SKU`);
                }
                else {
                    variantSkus.push(v.sku);
                }
            }
            const uniqueSkus = new Set(variantSkus);
            if (variantSkus.length !== uniqueSkus.size)
                errors.push('All variant SKUs must be unique');
            const hasAnyChannel = (surface.enabledPlatforms && surface.enabledPlatforms.length > 0)
                || surface.supportsEmbedStore || surface.supportsEmbedProduct || surface.supportsEmbedBuilder
                || surface.supportsEtsy || surface.supportsEbay || surface.supportsAmazon;
            if (!hasAnyChannel)
                errors.push('At least one selling channel must be enabled (marketplace or embed)');
            const newStatus = errors.length === 0 ? 'ready' : 'draft';
            await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId).update({ readinessErrors: errors, status: newStatus, updatedAt: new Date().toISOString() });
            res.json({ ready: errors.length === 0, errors, status: newStatus });
        }
        catch (error) {
            console.error('[Surfaces] POST check-readiness error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // --- Surface Variants ---
    app.get('/admin/surfaces/:surfaceId/variants', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { surfaceId } = req.params;
            const snapshot = await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).where('surfaceId', '==', surfaceId).get();
            const variants = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            res.json(variants);
        }
        catch (error) {
            console.error('[Surfaces] GET variants error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/surfaces/:surfaceId/variants', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { surfaceId } = req.params;
            const surfaceDoc = await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId).get();
            if (!surfaceDoc.exists) {
                res.status(404).json({ error: 'Surface not found' });
                return;
            }
            const { size, color, colorHex, sku, priceOverride, enabled, inventoryQuantity, productVariantId, titleSuffix, option1Name, option1Value, option2Name, option2Value, option3Name, option3Value, availability, marketplaceOverrides } = req.body;
            if (!size || !color) {
                res.status(400).json({ error: 'size and color are required' });
                return;
            }
            const now = new Date().toISOString();
            const data = {
                surfaceId,
                size,
                color,
                colorHex: colorHex || undefined,
                sku: sku || '',
                priceOverride: priceOverride != null ? (typeof priceOverride === 'number' ? priceOverride : parseFloat(priceOverride) || undefined) : undefined,
                enabled: enabled !== false,
                inventoryQuantity: typeof inventoryQuantity === 'number' ? inventoryQuantity : 999,
                productVariantId: productVariantId || '',
                titleSuffix: titleSuffix || '',
                option1Name: option1Name || '',
                option1Value: option1Value || '',
                option2Name: option2Name || '',
                option2Value: option2Value || '',
                option3Name: option3Name || '',
                option3Value: option3Value || '',
                availability: availability || 'in_stock',
                marketplaceOverrides: marketplaceOverrides || {},
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[Surfaces] POST variant error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/surfaces/variants/:variantId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { variantId } = req.params;
            const doc = await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).doc(variantId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Variant not found' });
                return;
            }
            const updates = {};
            const allowed = ['size', 'color', 'colorHex', 'sku', 'priceOverride', 'enabled', 'inventoryQuantity', 'productVariantId', 'titleSuffix', 'option1Name', 'option1Value', 'option2Name', 'option2Value', 'option3Name', 'option3Value', 'availability', 'marketplaceOverrides'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).doc(variantId).update(updates);
            res.json({ id: variantId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[Surfaces] PATCH variant error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/surfaces/variants/:variantId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { variantId } = req.params;
            const doc = await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).doc(variantId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Variant not found' });
                return;
            }
            await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION).doc(variantId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[Surfaces] DELETE variant error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // --- Marketplace Listings (canonical) ---
    app.get('/admin/surfaces/listings', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { surfaceId, accountId, status } = req.query;
            let query = core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION);
            if (surfaceId)
                query = query.where('surfaceId', '==', surfaceId);
            if (accountId)
                query = query.where('accountId', '==', accountId);
            if (status)
                query = query.where('status', '==', status);
            const snapshot = await query.get();
            const listings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            listings.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
            res.json(listings);
        }
        catch (error) {
            console.error('[Surfaces] GET listings error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/surfaces/listings', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { surfaceId, accountId } = req.body;
            if (!surfaceId || !accountId) {
                res.status(400).json({ error: 'surfaceId and accountId are required' });
                return;
            }
            const surfaceDoc = await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(surfaceId).get();
            if (!surfaceDoc.exists) {
                res.status(404).json({ error: 'Surface not found' });
                return;
            }
            const accountDoc = await core_1.db.collection(constants_1.MARKETPLACE_ACCOUNTS_COLLECTION).doc(accountId).get();
            if (!accountDoc.exists) {
                res.status(404).json({ error: 'Account not found' });
                return;
            }
            const surface = surfaceDoc.data();
            const account = accountDoc.data();
            const existingSnap = await core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION)
                .where('surfaceId', '==', surfaceId)
                .where('accountId', '==', accountId)
                .limit(1).get();
            if (!existingSnap.empty) {
                res.status(400).json({ error: 'A listing already exists for this surface on this account' });
                return;
            }
            const now = new Date().toISOString();
            const data = {
                surfaceId,
                accountId,
                platform: account.platform,
                status: 'pending',
                title: surface.title || '',
                price: surface.retailPrice || 0,
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[Surfaces] POST listing error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/surfaces/listings/:listingId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { listingId } = req.params;
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Listing not found' });
                return;
            }
            await core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[Surfaces] DELETE listing error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // --- Sync Jobs ---
    app.get('/admin/surfaces/jobs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { status, listingId } = req.query;
            let query = core_1.db.collection(constants_1.MARKETPLACE_SYNC_JOBS_COLLECTION);
            if (status)
                query = query.where('status', '==', status);
            if (listingId)
                query = query.where('listingId', '==', listingId);
            const snapshot = await query.get();
            const jobs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            jobs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            res.json(jobs);
        }
        catch (error) {
            console.error('[Surfaces] GET jobs error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/surfaces/jobs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { listingId, action } = req.body;
            if (!listingId || !action) {
                res.status(400).json({ error: 'listingId and action are required' });
                return;
            }
            if (!VALID_JOB_ACTIONS.has(action)) {
                res.status(400).json({ error: `Invalid action. Must be one of: ${[...VALID_JOB_ACTIONS].join(', ')}` });
                return;
            }
            const listingDoc = await core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).get();
            if (!listingDoc.exists) {
                res.status(404).json({ error: 'Listing not found' });
                return;
            }
            const listing = listingDoc.data();
            const now = new Date().toISOString();
            const data = {
                listingId,
                surfaceId: listing.surfaceId,
                accountId: listing.accountId,
                platform: listing.platform,
                action,
                status: 'queued',
                attempts: 0,
                maxAttempts: 3,
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.MARKETPLACE_SYNC_JOBS_COLLECTION).add(data);
            await core_1.db.collection(constants_1.MARKETPLACE_LISTINGS_COLLECTION).doc(listingId).update({ status: 'syncing', lastSyncJobId: docRef.id, updatedAt: now });
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[Surfaces] POST job error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/surfaces/jobs/:jobId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { jobId } = req.params;
            const doc = await core_1.db.collection(constants_1.MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Job not found' });
                return;
            }
            const updates = {};
            const allowed = ['status', 'attempts', 'lastAttemptAt', 'completedAt', 'errorMessage', 'result'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.MARKETPLACE_SYNC_JOBS_COLLECTION).doc(jobId).update(updates);
            res.json({ id: jobId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[Surfaces] PATCH job error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // --- Sync Logs ---
    app.get('/admin/surfaces/logs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { jobId, listingId, level } = req.query;
            let query = core_1.db.collection(constants_1.MARKETPLACE_SYNC_LOGS_COLLECTION);
            if (jobId)
                query = query.where('jobId', '==', jobId);
            if (listingId)
                query = query.where('listingId', '==', listingId);
            if (level)
                query = query.where('level', '==', level);
            const snapshot = await query.get();
            const logs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            logs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            res.json(logs);
        }
        catch (error) {
            console.error('[Surfaces] GET logs error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/surfaces/logs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { jobId, listingId, accountId, platform, level, message, details } = req.body;
            if (!jobId || !message) {
                res.status(400).json({ error: 'jobId and message are required' });
                return;
            }
            const resolvedLevel = level && VALID_LOG_LEVELS.has(level) ? level : 'info';
            const now = new Date().toISOString();
            const data = {
                jobId,
                listingId: listingId || '',
                accountId: accountId || '',
                platform: platform && VALID_PLATFORMS.has(platform) ? platform : undefined,
                level: resolvedLevel,
                message,
                details: details || undefined,
                createdAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.MARKETPLACE_SYNC_LOGS_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[Surfaces] POST log error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=marketplace.js.map