"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BUILDER_PERMISSIONS = void 0;
exports.extractRequestDomain = extractRequestDomain;
exports.isDomainAllowed = isDomainAllowed;
exports.validateEmbedContext = validateEmbedContext;
exports.buildPricingFromContext = buildPricingFromContext;
const core_1 = require("../core");
const constants_1 = require("../constants");
const surfaces_1 = require("../../../shared/surfaces");
exports.DEFAULT_BUILDER_PERMISSIONS = {
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
            return new URL(typeof origin === 'string' ? origin : origin[0]).hostname;
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
    if (!requestDomain) {
        return { valid: false, error: 'Domain could not be determined from request (missing Origin and Referer headers)' };
    }
    const hostHasDomainRestrictions = host.allowedDomains && host.allowedDomains.length > 0;
    if (hostHasDomainRestrictions && !isDomainAllowed(requestDomain, host.allowedDomains)) {
        return { valid: false, error: `Domain '${requestDomain}' is not allowed for this host` };
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
    let affiliateSource = 'none';
    if (placement.affiliateUserId) {
        affiliateUserId = placement.affiliateUserId;
        affiliateSource = 'placement';
    }
    else if (host.ownerUserId) {
        affiliateUserId = host.ownerUserId;
        affiliateSource = 'host_owner';
    }
    else if (profile?.affiliateUserId) {
        affiliateUserId = profile.affiliateUserId;
        affiliateSource = 'profile';
    }
    const resolvedAffiliatePercent = revenueSplit?.affiliatePercent ?? revenueSplit?.affiliateSharePercent ?? 0;
    if (revenueSplit) {
        revenueSplit.affiliatePercent = resolvedAffiliatePercent;
    }
    if (revenueSplit && resolvedAffiliatePercent > 0 && !affiliateUserId) {
        if (revenueSplit.requireAffiliate !== false) {
            return { valid: false, error: 'Revenue sharing is enabled but no affiliate user could be resolved (checked placement.affiliateUserId, host.ownerUserId, and profile.affiliateUserId)' };
        }
    }
    return { valid: true, placement, host, profile, surface, variants, pricingPolicy, revenueSplit, affiliateUserId, affiliateSource };
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
//# sourceMappingURL=embed-validation.js.map