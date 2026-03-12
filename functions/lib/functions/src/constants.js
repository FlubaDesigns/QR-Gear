"use strict";
/**
 * Canonical platform constants for Cloud Functions.
 *
 * Firestore collection names use legacy values because the underlying
 * collections have not been renamed yet. The constant names reflect
 * the canonical domain vocabulary.
 *
 * When Firestore collections are eventually renamed, update the values
 * here — every consumer imports from this single file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYOUT_STATUSES = exports.BUILDER_PLACEMENT_STATUSES = exports.BUILDER_PROFILE_STATUSES = exports.BUILDER_HOST_STATUSES = exports.EMBED_MODES = exports.MARKETPLACE_PLATFORMS = exports.AFFILIATE_PAYOUT_LEDGER_COLLECTION = exports.EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION = exports.REVENUE_SPLITS_COLLECTION = exports.PRICING_POLICIES_COLLECTION = exports.BUILDER_DRAFTS_COLLECTION = exports.BUILDER_SESSIONS_COLLECTION = exports.BUILDER_PLACEMENTS_COLLECTION = exports.BUILDER_PROFILES_COLLECTION = exports.BUILDER_HOSTS_COLLECTION = exports.MARKETPLACE_SYNC_LOGS_COLLECTION = exports.MARKETPLACE_SYNC_JOBS_COLLECTION = exports.MARKETPLACE_LISTINGS_COLLECTION = exports.MARKETPLACE_ACCOUNTS_COLLECTION = exports.SURFACE_VARIANTS_COLLECTION = exports.SURFACES_COLLECTION = exports.LEGACY_STORE_ID = exports.PLATFORM_STORE_ID = exports.MOSAIC_TEMPLATES_COLLECTION = exports.MOSAICS_COLLECTION = void 0;
exports.MOSAICS_COLLECTION = 'site_programs';
exports.MOSAIC_TEMPLATES_COLLECTION = 'dynamicsCollections';
exports.PLATFORM_STORE_ID = 'qr-gear';
exports.LEGACY_STORE_ID = 'kingdom_connects';
exports.SURFACES_COLLECTION = 'surfaces';
exports.SURFACE_VARIANTS_COLLECTION = 'surfaceVariants';
exports.MARKETPLACE_ACCOUNTS_COLLECTION = 'marketplaceAccounts';
exports.MARKETPLACE_LISTINGS_COLLECTION = 'marketplaceListings';
exports.MARKETPLACE_SYNC_JOBS_COLLECTION = 'marketplaceSyncJobs';
exports.MARKETPLACE_SYNC_LOGS_COLLECTION = 'marketplaceSyncLogs';
exports.BUILDER_HOSTS_COLLECTION = 'builderHosts';
exports.BUILDER_PROFILES_COLLECTION = 'builderProfiles';
exports.BUILDER_PLACEMENTS_COLLECTION = 'builderPlacements';
exports.BUILDER_SESSIONS_COLLECTION = 'builderSessions';
exports.BUILDER_DRAFTS_COLLECTION = 'builderDrafts';
exports.PRICING_POLICIES_COLLECTION = 'pricingPolicies';
exports.REVENUE_SPLITS_COLLECTION = 'revenueSplits';
exports.EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION = 'embeddedOrderAttributions';
exports.AFFILIATE_PAYOUT_LEDGER_COLLECTION = 'affiliatePayoutLedger';
exports.MARKETPLACE_PLATFORMS = ['etsy', 'ebay', 'amazon'];
exports.EMBED_MODES = ['store', 'product', 'builder'];
exports.BUILDER_HOST_STATUSES = ['active', 'paused', 'disabled'];
exports.BUILDER_PROFILE_STATUSES = ['active', 'draft', 'archived'];
exports.BUILDER_PLACEMENT_STATUSES = ['active', 'paused', 'disabled'];
exports.PAYOUT_STATUSES = ['pending', 'approved', 'paid', 'reversed'];
//# sourceMappingURL=constants.js.map