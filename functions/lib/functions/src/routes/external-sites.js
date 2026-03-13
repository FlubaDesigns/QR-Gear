"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const constants_1 = require("../constants");
const surfaces_1 = require("../../../shared/surfaces");
const DEFAULT_BUILDER_PERMISSIONS = {
    allowHeaderText: true,
    allowHeaderImage: false,
    allowFooterText: true,
    allowFooterImage: false,
    allowCenterGraphic: true,
    allowQrModeSwitch: false,
    allowUpload: false,
    allowAssetLibrary: true,
    allowProductChange: false,
    allowVariantChange: true,
    allowSaveDraft: false,
    allowBuyNow: true,
};
function extractRequestDomain(req) {
    const origin = req.headers.origin;
    if (origin) {
        try {
            return new URL(origin).hostname;
        }
        catch { /* ignore */ }
    }
    const referer = req.headers.referer;
    if (referer) {
        try {
            return new URL(referer).hostname;
        }
        catch { /* ignore */ }
    }
    const supplied = req.query.domain || req.body?.domain;
    if (supplied && typeof supplied === 'string')
        return supplied;
    return null;
}
function isDomainAllowed(requestDomain, allowedDomains) {
    if (!allowedDomains || allowedDomains.length === 0)
        return true;
    if (!requestDomain)
        return false;
    const norm = requestDomain.toLowerCase().replace(/^www\./, '');
    return allowedDomains.some(d => {
        const allowed = d.toLowerCase().replace(/^www\./, '');
        if (allowed.startsWith('*.')) {
            const suffix = allowed.slice(2);
            return norm === suffix || norm.endsWith('.' + suffix);
        }
        return norm === allowed;
    });
}
async function validateEmbedContext(placementId, req, opts = {}) {
    const placementDoc = await core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION).doc(placementId).get();
    if (!placementDoc.exists)
        return { valid: false, error: 'Placement not found' };
    const placement = { id: placementDoc.id, ...placementDoc.data() };
    if (placement.status !== 'active')
        return { valid: false, error: 'Placement is not active' };
    const hostDoc = await core_1.db.collection(constants_1.BUILDER_HOSTS_COLLECTION).doc(placement.builderHostId).get();
    if (!hostDoc.exists)
        return { valid: false, error: 'Host not found' };
    const host = { id: hostDoc.id, ...hostDoc.data() };
    if (host.status !== 'active')
        return { valid: false, error: 'Host is not active' };
    const requestDomain = extractRequestDomain(req);
    if (!isDomainAllowed(requestDomain, host.allowedDomains || [])) {
        return { valid: false, error: `Domain '${requestDomain || 'unknown'}' is not allowed for this host` };
    }
    let profile = null;
    const profileId = placement.builderProfileId || host.defaultBuilderProfileId;
    if (profileId) {
        const profileDoc = await core_1.db.collection(constants_1.BUILDER_PROFILES_COLLECTION).doc(profileId).get();
        if (profileDoc.exists) {
            profile = { id: profileDoc.id, ...profileDoc.data() };
            if (profile.status !== 'active')
                return { valid: false, error: 'Profile is not active' };
        }
    }
    let surface = null;
    let variants = [];
    if (placement.surfaceId) {
        const surfaceDoc = await core_1.db.collection(constants_1.SURFACES_COLLECTION).doc(placement.surfaceId).get();
        if (surfaceDoc.exists) {
            surface = { id: surfaceDoc.id, ...surfaceDoc.data() };
            if (surface.status === 'archived' || surface.status === 'blocked') {
                return { valid: false, error: 'Surface is not available' };
            }
        }
    }
    if (opts.requireSurface && !surface)
        return { valid: false, error: 'Placement has no surface configured' };
    if (surface && opts.requireReadiness) {
        const variantsSnap = await core_1.db.collection(constants_1.SURFACE_VARIANTS_COLLECTION)
            .where('surfaceId', '==', surface.id).get();
        variants = variantsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const readiness = (0, surfaces_1.checkSurfaceReadiness)(surface, variants);
        if (!readiness.ready) {
            return { valid: false, error: `Surface not ready: ${readiness.errors.join(', ')}` };
        }
    }
    let pricingPolicy = null;
    const policyId = placement.pricingPolicyId || host.defaultPricingPolicyId;
    if (policyId) {
        const policyDoc = await core_1.db.collection(constants_1.PRICING_POLICIES_COLLECTION).doc(policyId).get();
        if (policyDoc.exists)
            pricingPolicy = { id: policyDoc.id, ...policyDoc.data() };
    }
    let revenueSplit = null;
    const splitId = placement.revenueSplitId || host.defaultRevenueSplitId;
    if (splitId) {
        const splitDoc = await core_1.db.collection(constants_1.REVENUE_SPLITS_COLLECTION).doc(splitId).get();
        if (splitDoc.exists)
            revenueSplit = { id: splitDoc.id, ...splitDoc.data() };
    }
    let affiliateUserId = '';
    if (placement.affiliateUserId) {
        affiliateUserId = placement.affiliateUserId;
    }
    else if (host.ownerUserId) {
        affiliateUserId = host.ownerUserId;
    }
    if (revenueSplit && revenueSplit.affiliatePercent > 0 && !affiliateUserId) {
        if (revenueSplit.requireAffiliate !== false) {
            return { valid: false, error: 'Revenue sharing is enabled but no affiliate user could be resolved' };
        }
    }
    return { valid: true, placement, host, profile, surface, variants, pricingPolicy, revenueSplit, affiliateUserId };
}
function buildPricingFromContext(surface, pricingPolicy, revenueSplit) {
    const salePrice = surface?.retailPrice || 0;
    const productCost = surface?.baseCost || 0;
    const affiliatePercent = revenueSplit?.affiliatePercent ?? 25;
    const platformFeeAmount = pricingPolicy?.platformFeeAmount || 0;
    return (0, surfaces_1.computePricingSnapshot)({
        salePrice, productCost, platformFeeAmount, affiliatePercent,
        currency: pricingPolicy?.currency || 'USD',
    });
}
function getPeriodKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
const VALID_HOST_STATUSES = new Set(constants_1.BUILDER_HOST_STATUSES);
const VALID_PROFILE_STATUSES = new Set(constants_1.BUILDER_PROFILE_STATUSES);
const VALID_PLACEMENT_STATUSES = new Set(constants_1.BUILDER_PLACEMENT_STATUSES);
const VALID_EMBED_MODES = new Set(constants_1.EMBED_MODES);
const VALID_PAYOUT_STATUSES = new Set(constants_1.PAYOUT_STATUSES);
const VALID_BASE_COST_MODES = new Set(['snapshot', 'live-cost', 'variant-cost']);
const VALID_MARGIN_TYPES = new Set(['fixed', 'percent']);
const VALID_ROUNDING_MODES = new Set(['none', 'round', 'ceil', 'floor']);
const VALID_PRICING_STATUSES = new Set(['active', 'draft', 'archived']);
const VALID_SPLIT_STATUSES = new Set(['active', 'draft', 'archived']);
const external_sites_public_1 = require("./external-sites-public");
function register(app) {
    (0, external_sites_public_1.registerExternalSitesPublicRoutes)(app);
    app.get('/admin/external/hosts', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection(constants_1.BUILDER_HOSTS_COLLECTION).get();
            const hosts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            hosts.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            res.json(hosts);
        }
        catch (error) {
            console.error('[ExternalSites] GET hosts error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/external/hosts', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, ownerUserId, storeId, defaultBuilderProfileId, defaultPricingPolicyId, defaultRevenueSplitId, allowedDomains, contactEmail, contactName, notes, status } = req.body;
            if (!name || !name.trim()) {
                res.status(400).json({ error: 'name is required' });
                return;
            }
            const hostStatus = status && VALID_HOST_STATUSES.has(status) ? status : 'active';
            const now = new Date().toISOString();
            const data = {
                name: name.trim(),
                ownerUserId: ownerUserId || '',
                storeId: storeId || '',
                defaultBuilderProfileId: defaultBuilderProfileId || '',
                defaultPricingPolicyId: defaultPricingPolicyId || '',
                defaultRevenueSplitId: defaultRevenueSplitId || '',
                allowedDomains: Array.isArray(allowedDomains) ? allowedDomains : [],
                contactEmail: contactEmail || '',
                contactName: contactName || '',
                notes: notes || '',
                status: hostStatus,
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.BUILDER_HOSTS_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[ExternalSites] POST host error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/external/hosts/:hostId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { hostId } = req.params;
            const doc = await core_1.db.collection(constants_1.BUILDER_HOSTS_COLLECTION).doc(hostId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Host not found' });
                return;
            }
            const updates = {};
            const allowed = ['name', 'ownerUserId', 'storeId', 'defaultBuilderProfileId', 'defaultPricingPolicyId', 'defaultRevenueSplitId', 'allowedDomains', 'contactEmail', 'contactName', 'notes', 'status'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (updates.status && !VALID_HOST_STATUSES.has(updates.status)) {
                res.status(400).json({ error: `Invalid status. Must be one of: ${constants_1.BUILDER_HOST_STATUSES.join(', ')}` });
                return;
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.BUILDER_HOSTS_COLLECTION).doc(hostId).update(updates);
            res.json({ id: hostId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[ExternalSites] PATCH host error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/external/hosts/:hostId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { hostId } = req.params;
            const doc = await core_1.db.collection(constants_1.BUILDER_HOSTS_COLLECTION).doc(hostId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Host not found' });
                return;
            }
            const placementsSnap = await core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION).where('builderHostId', '==', hostId).limit(1).get();
            if (!placementsSnap.empty) {
                res.status(400).json({ error: 'Cannot delete host with active placements. Remove placements first.' });
                return;
            }
            await core_1.db.collection(constants_1.BUILDER_HOSTS_COLLECTION).doc(hostId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[ExternalSites] DELETE host error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BUILDER PROFILES ============
    app.get('/admin/external/profiles', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection(constants_1.BUILDER_PROFILES_COLLECTION).get();
            const profiles = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            profiles.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            res.json(profiles);
        }
        catch (error) {
            console.error('[ExternalSites] GET profiles error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/external/profiles', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, storeId, surfaceId, allowedProductIds, allowedVariantIds, permissions, defaultTheme, maxUploads, status } = req.body;
            if (!name || !name.trim()) {
                res.status(400).json({ error: 'name is required' });
                return;
            }
            const profileStatus = status && VALID_PROFILE_STATUSES.has(status) ? status : 'draft';
            const mergedPermissions = { ...DEFAULT_BUILDER_PERMISSIONS, ...(permissions || {}) };
            const now = new Date().toISOString();
            const data = {
                name: name.trim(),
                storeId: storeId || '',
                surfaceId: surfaceId || '',
                allowedProductIds: Array.isArray(allowedProductIds) ? allowedProductIds : [],
                allowedVariantIds: Array.isArray(allowedVariantIds) ? allowedVariantIds : [],
                permissions: mergedPermissions,
                defaultTheme: defaultTheme || '',
                maxUploads: typeof maxUploads === 'number' ? maxUploads : 5,
                status: profileStatus,
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.BUILDER_PROFILES_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[ExternalSites] POST profile error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/external/profiles/:profileId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { profileId } = req.params;
            const doc = await core_1.db.collection(constants_1.BUILDER_PROFILES_COLLECTION).doc(profileId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Profile not found' });
                return;
            }
            const updates = {};
            const allowed = ['name', 'storeId', 'surfaceId', 'allowedProductIds', 'allowedVariantIds', 'permissions', 'defaultTheme', 'maxUploads', 'status'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (updates.status && !VALID_PROFILE_STATUSES.has(updates.status)) {
                res.status(400).json({ error: `Invalid status. Must be one of: ${constants_1.BUILDER_PROFILE_STATUSES.join(', ')}` });
                return;
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.BUILDER_PROFILES_COLLECTION).doc(profileId).update(updates);
            res.json({ id: profileId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[ExternalSites] PATCH profile error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/external/profiles/:profileId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { profileId } = req.params;
            const doc = await core_1.db.collection(constants_1.BUILDER_PROFILES_COLLECTION).doc(profileId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Profile not found' });
                return;
            }
            const placementsSnap = await core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION).where('builderProfileId', '==', profileId).limit(1).get();
            if (!placementsSnap.empty) {
                res.status(400).json({ error: 'Cannot delete profile with active placements.' });
                return;
            }
            await core_1.db.collection(constants_1.BUILDER_PROFILES_COLLECTION).doc(profileId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[ExternalSites] DELETE profile error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BUILDER PLACEMENTS ============
    app.get('/admin/external/placements', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { builderHostId } = req.query;
            let query = core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION);
            if (builderHostId)
                query = query.where('builderHostId', '==', builderHostId);
            const snapshot = await query.get();
            const placements = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            placements.sort((a, b) => (a.placementName || '').localeCompare(b.placementName || ''));
            res.json(placements);
        }
        catch (error) {
            console.error('[ExternalSites] GET placements error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/external/placements', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { builderHostId, builderProfileId, surfaceId, placementName, slug, domainHint, campaignId, pricingPolicyId, revenueSplitId, embedMode, status } = req.body;
            if (!builderHostId) {
                res.status(400).json({ error: 'builderHostId is required' });
                return;
            }
            if (!placementName || !placementName.trim()) {
                res.status(400).json({ error: 'placementName is required' });
                return;
            }
            const hostDoc = await core_1.db.collection(constants_1.BUILDER_HOSTS_COLLECTION).doc(builderHostId).get();
            if (!hostDoc.exists) {
                res.status(404).json({ error: 'Host not found' });
                return;
            }
            const resolvedEmbedMode = embedMode && VALID_EMBED_MODES.has(embedMode) ? embedMode : 'store';
            const placementStatus = status && VALID_PLACEMENT_STATUSES.has(status) ? status : 'active';
            const resolvedSlug = slug || placementName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            const now = new Date().toISOString();
            const data = {
                builderHostId,
                builderProfileId: builderProfileId || '',
                surfaceId: surfaceId || '',
                placementName: placementName.trim(),
                slug: resolvedSlug,
                domainHint: domainHint || '',
                campaignId: campaignId || '',
                pricingPolicyId: pricingPolicyId || '',
                revenueSplitId: revenueSplitId || '',
                embedMode: resolvedEmbedMode,
                status: placementStatus,
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[ExternalSites] POST placement error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/external/placements/:placementId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { placementId } = req.params;
            const doc = await core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION).doc(placementId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Placement not found' });
                return;
            }
            const updates = {};
            const allowed = ['builderProfileId', 'surfaceId', 'placementName', 'slug', 'domainHint', 'campaignId', 'pricingPolicyId', 'revenueSplitId', 'embedMode', 'status'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (updates.embedMode && !VALID_EMBED_MODES.has(updates.embedMode)) {
                res.status(400).json({ error: `Invalid embedMode. Must be one of: ${constants_1.EMBED_MODES.join(', ')}` });
                return;
            }
            if (updates.status && !VALID_PLACEMENT_STATUSES.has(updates.status)) {
                res.status(400).json({ error: `Invalid status. Must be one of: ${constants_1.BUILDER_PLACEMENT_STATUSES.join(', ')}` });
                return;
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION).doc(placementId).update(updates);
            res.json({ id: placementId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[ExternalSites] PATCH placement error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/external/placements/:placementId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { placementId } = req.params;
            const doc = await core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION).doc(placementId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Placement not found' });
                return;
            }
            await core_1.db.collection(constants_1.BUILDER_PLACEMENTS_COLLECTION).doc(placementId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[ExternalSites] DELETE placement error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PRICING POLICIES ============
    app.get('/admin/external/pricing-policies', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection(constants_1.PRICING_POLICIES_COLLECTION).get();
            const policies = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            policies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            res.json(policies);
        }
        catch (error) {
            console.error('[ExternalSites] GET pricing-policies error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/external/pricing-policies', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, storeId, surfaceId, currency, baseCostMode, baseRetailPrice, platformMarginType, platformMarginValue, affiliateBasis, affiliatePercent, campaignMarkupType, campaignMarkupValue, minPrice, maxPrice, roundingMode, status } = req.body;
            if (!name || !name.trim()) {
                res.status(400).json({ error: 'name is required' });
                return;
            }
            const now = new Date().toISOString();
            const data = {
                name: name.trim(),
                storeId: storeId || '',
                surfaceId: surfaceId || '',
                currency: currency || 'USD',
                baseCostMode: baseCostMode && VALID_BASE_COST_MODES.has(baseCostMode) ? baseCostMode : 'snapshot',
                baseRetailPrice: typeof baseRetailPrice === 'number' ? baseRetailPrice : 0,
                platformMarginType: platformMarginType && VALID_MARGIN_TYPES.has(platformMarginType) ? platformMarginType : 'percent',
                platformMarginValue: typeof platformMarginValue === 'number' ? platformMarginValue : 0,
                affiliateBasis: 'gross_profit',
                affiliatePercent: typeof affiliatePercent === 'number' ? affiliatePercent : 25,
                roundingMode: roundingMode && VALID_ROUNDING_MODES.has(roundingMode) ? roundingMode : 'round',
                status: status && VALID_PRICING_STATUSES.has(status) ? status : 'draft',
                createdAt: now,
                updatedAt: now,
            };
            if (campaignMarkupType && VALID_MARGIN_TYPES.has(campaignMarkupType)) {
                data.campaignMarkupType = campaignMarkupType;
                data.campaignMarkupValue = typeof campaignMarkupValue === 'number' ? campaignMarkupValue : 0;
            }
            if (typeof minPrice === 'number')
                data.minPrice = minPrice;
            if (typeof maxPrice === 'number')
                data.maxPrice = maxPrice;
            const docRef = await core_1.db.collection(constants_1.PRICING_POLICIES_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[ExternalSites] POST pricing-policy error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/external/pricing-policies/:policyId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { policyId } = req.params;
            const doc = await core_1.db.collection(constants_1.PRICING_POLICIES_COLLECTION).doc(policyId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Pricing policy not found' });
                return;
            }
            const updates = {};
            const allowed = ['name', 'storeId', 'surfaceId', 'currency', 'baseCostMode', 'baseRetailPrice', 'platformMarginType', 'platformMarginValue', 'affiliatePercent', 'campaignMarkupType', 'campaignMarkupValue', 'minPrice', 'maxPrice', 'roundingMode', 'status'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (updates.status && !VALID_PRICING_STATUSES.has(updates.status)) {
                res.status(400).json({ error: 'Invalid status' });
                return;
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.PRICING_POLICIES_COLLECTION).doc(policyId).update(updates);
            res.json({ id: policyId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[ExternalSites] PATCH pricing-policy error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/external/pricing-policies/:policyId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { policyId } = req.params;
            const doc = await core_1.db.collection(constants_1.PRICING_POLICIES_COLLECTION).doc(policyId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Pricing policy not found' });
                return;
            }
            await core_1.db.collection(constants_1.PRICING_POLICIES_COLLECTION).doc(policyId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[ExternalSites] DELETE pricing-policy error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ REVENUE SPLITS ============
    app.get('/admin/external/revenue-splits', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection(constants_1.REVENUE_SPLITS_COLLECTION).get();
            const splits = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            splits.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            res.json(splits);
        }
        catch (error) {
            console.error('[ExternalSites] GET revenue-splits error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/external/revenue-splits', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { name, storeId, affiliateSharePercent, platformSharePercent, notes, status } = req.body;
            if (!name || !name.trim()) {
                res.status(400).json({ error: 'name is required' });
                return;
            }
            const now = new Date().toISOString();
            const affShare = typeof affiliateSharePercent === 'number' ? affiliateSharePercent : 25;
            const platShare = typeof platformSharePercent === 'number' ? platformSharePercent : 75;
            const data = {
                name: name.trim(),
                storeId: storeId || '',
                affiliateSharePercent: affShare,
                platformSharePercent: platShare,
                notes: notes || '',
                status: status && VALID_SPLIT_STATUSES.has(status) ? status : 'draft',
                createdAt: now,
                updatedAt: now,
            };
            const docRef = await core_1.db.collection(constants_1.REVENUE_SPLITS_COLLECTION).add(data);
            res.json({ id: docRef.id, ...data });
        }
        catch (error) {
            console.error('[ExternalSites] POST revenue-split error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/external/revenue-splits/:splitId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { splitId } = req.params;
            const doc = await core_1.db.collection(constants_1.REVENUE_SPLITS_COLLECTION).doc(splitId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Revenue split not found' });
                return;
            }
            const updates = {};
            const allowed = ['name', 'storeId', 'affiliateSharePercent', 'platformSharePercent', 'notes', 'status'];
            for (const key of allowed) {
                if (req.body[key] !== undefined)
                    updates[key] = req.body[key];
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            updates.updatedAt = new Date().toISOString();
            await core_1.db.collection(constants_1.REVENUE_SPLITS_COLLECTION).doc(splitId).update(updates);
            res.json({ id: splitId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[ExternalSites] PATCH revenue-split error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/external/revenue-splits/:splitId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { splitId } = req.params;
            const doc = await core_1.db.collection(constants_1.REVENUE_SPLITS_COLLECTION).doc(splitId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Revenue split not found' });
                return;
            }
            await core_1.db.collection(constants_1.REVENUE_SPLITS_COLLECTION).doc(splitId).delete();
            res.json({ success: true });
        }
        catch (error) {
            console.error('[ExternalSites] DELETE revenue-split error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BUILDER SESSIONS (admin read-only) ============
    app.get('/admin/external/sessions', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { builderHostId, builderPlacementId, status } = req.query;
            let query = core_1.db.collection(constants_1.BUILDER_SESSIONS_COLLECTION);
            if (builderHostId)
                query = query.where('builderHostId', '==', builderHostId);
            if (builderPlacementId)
                query = query.where('builderPlacementId', '==', builderPlacementId);
            if (status)
                query = query.where('status', '==', status);
            const snapshot = await query.get();
            const sessions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            sessions.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
            res.json(sessions);
        }
        catch (error) {
            console.error('[ExternalSites] GET sessions error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BUILDER DRAFTS (admin read-only) ============
    app.get('/admin/external/drafts', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { builderHostId, builderPlacementId, status } = req.query;
            let query = core_1.db.collection(constants_1.BUILDER_DRAFTS_COLLECTION);
            if (builderHostId)
                query = query.where('builderHostId', '==', builderHostId);
            if (builderPlacementId)
                query = query.where('builderPlacementId', '==', builderPlacementId);
            if (status)
                query = query.where('status', '==', status);
            const snapshot = await query.get();
            const drafts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            drafts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            res.json(drafts);
        }
        catch (error) {
            console.error('[ExternalSites] GET drafts error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ EMBEDDED ORDER ATTRIBUTIONS (admin read-only) ============
    app.get('/admin/external/attributions', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { orderId, affiliateUserId, builderHostId } = req.query;
            let query = core_1.db.collection(constants_1.EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION);
            if (orderId)
                query = query.where('orderId', '==', orderId);
            if (affiliateUserId)
                query = query.where('affiliateUserId', '==', affiliateUserId);
            if (builderHostId)
                query = query.where('builderHostId', '==', builderHostId);
            const snapshot = await query.get();
            const attributions = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            attributions.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            res.json(attributions);
        }
        catch (error) {
            console.error('[ExternalSites] GET attributions error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ AFFILIATE PAYOUT LEDGER ============
    app.get('/admin/external/payouts', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { affiliateUserId, status, builderHostId } = req.query;
            let query = core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION);
            if (affiliateUserId)
                query = query.where('affiliateUserId', '==', affiliateUserId);
            if (status)
                query = query.where('status', '==', status);
            if (builderHostId)
                query = query.where('builderHostId', '==', builderHostId);
            const snapshot = await query.get();
            const entries = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
            entries.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            res.json(entries);
        }
        catch (error) {
            console.error('[ExternalSites] GET payouts error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    app.patch('/admin/external/payouts/:payoutId', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { payoutId } = req.params;
            const doc = await core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION).doc(payoutId).get();
            if (!doc.exists) {
                res.status(404).json({ error: 'Payout entry not found' });
                return;
            }
            const updates = {};
            if (req.body.status !== undefined) {
                if (!VALID_PAYOUT_STATUSES.has(req.body.status)) {
                    res.status(400).json({ error: `Invalid status. Must be one of: ${constants_1.PAYOUT_STATUSES.join(', ')}` });
                    return;
                }
                updates.status = req.body.status;
                if (req.body.status === 'paid')
                    updates.paidAt = new Date().toISOString();
            }
            if (Object.keys(updates).length === 0) {
                res.status(400).json({ error: 'No valid fields to update' });
                return;
            }
            await core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION).doc(payoutId).update(updates);
            res.json({ id: payoutId, ...doc.data(), ...updates });
        }
        catch (error) {
            console.error('[ExternalSites] PATCH payout error:', error);
            res.status(500).json({ error: error.message });
        }
    });
    // ============ PUBLIC EMBED ENDPOINTS ============
}
//# sourceMappingURL=external-sites.js.map