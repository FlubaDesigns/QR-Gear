"use strict";
/**
 * Canonical platform constants for Cloud Functions.
 *
 * Firestore collection string values are the actual collection names
 * in Firestore. The constant names reflect the canonical domain
 * vocabulary. If a collection is renamed in Firestore, update the
 * value here — every consumer imports from this single file.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_SETTINGS_COLLECTION = exports.ADMIN_BUILD_SHELF_COLLECTION = exports.ADMIN_BUILD_SESSIONS_COLLECTION = exports.CATALOGS_COLLECTION = exports.ASM_COUNTERS_COLLECTION = exports.ASSEMBLIES_COLLECTION = exports.GRF_COUNTERS_COLLECTION = exports.GRF_ASSETS_COLLECTION = exports.BLD_COUNTERS_COLLECTION = exports.BLD_DEFINITIONS_COLLECTION = exports.QRG_COUNTERS_COLLECTION = exports.PROVIDER_MAPPING_COLLECTION = exports.PRINTFUL_VARIANTS_COLLECTION = exports.PRINTFUL_PRODUCTS_COLLECTION = exports.PRINTIFY_PROVIDERS_COLLECTION = exports.PRINTIFY_BLUEPRINTS_COLLECTION = exports.MASTER_CATALOG_SYNCS_COLLECTION = exports.MASTER_CATALOG_COLLECTION = exports.PAYOUT_STATUSES = exports.BUILDER_PLACEMENT_STATUSES = exports.BUILDER_PROFILE_STATUSES = exports.BUILDER_HOST_STATUSES = exports.EMBED_MODES = exports.MARKETPLACE_PLATFORMS = exports.AFFILIATE_PAYOUT_LEDGER_COLLECTION = exports.EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION = exports.REVENUE_SPLITS_COLLECTION = exports.PRICING_POLICIES_COLLECTION = exports.BUILDER_DRAFTS_COLLECTION = exports.BUILDER_SESSIONS_COLLECTION = exports.BUILDER_PLACEMENTS_COLLECTION = exports.BUILDER_PROFILES_COLLECTION = exports.BUILDER_HOSTS_COLLECTION = exports.MARKETPLACE_SYNC_LOGS_COLLECTION = exports.MARKETPLACE_SYNC_JOBS_COLLECTION = exports.MARKETPLACE_LISTINGS_COLLECTION = exports.MARKETPLACE_ACCOUNTS_COLLECTION = exports.SURFACE_VARIANTS_COLLECTION = exports.SURFACES_COLLECTION = exports.PLATFORM_STORE_ID = exports.MEMBER_PACKETS_COLLECTION = exports.QR_DYNAMICS_INSTANCES_COLLECTION = exports.PRODUCT_PACKETS_COLLECTION = exports.STORE_PRODUCT_LINKS_COLLECTION = exports.DYNAMICS_SURFACES_COLLECTION = exports.COLLECTION_ITEMS_COLLECTION = exports.CHANNEL_CONTENT_COLLECTION = exports.CHANNEL_ITEMS_COLLECTION = exports.MOSAIC_TEMPLATES_COLLECTION = exports.MOSAICS_COLLECTION = void 0;
exports.QRG_BLANK_CODES = exports.PRICING_SETTINGS_DOC = exports.PRICING_SETTINGS_COLLECTION = void 0;
exports.MOSAICS_COLLECTION = 'site_programs';
exports.MOSAIC_TEMPLATES_COLLECTION = 'dynamicsCollections';
exports.CHANNEL_ITEMS_COLLECTION = 'channel_items';
exports.CHANNEL_CONTENT_COLLECTION = 'dynamicsChannelContent';
exports.COLLECTION_ITEMS_COLLECTION = 'dynamicsCollectionItems';
exports.DYNAMICS_SURFACES_COLLECTION = 'qrDynamicsSurfaces';
exports.STORE_PRODUCT_LINKS_COLLECTION = 'storeProductLinks';
exports.PRODUCT_PACKETS_COLLECTION = 'productPackets';
exports.QR_DYNAMICS_INSTANCES_COLLECTION = 'qr_dynamics_instances';
exports.MEMBER_PACKETS_COLLECTION = 'memberPackets';
exports.PLATFORM_STORE_ID = 'qr-gear';
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
exports.MASTER_CATALOG_COLLECTION = 'master_catalog';
exports.MASTER_CATALOG_SYNCS_COLLECTION = 'master_catalog_syncs';
exports.PRINTIFY_BLUEPRINTS_COLLECTION = 'printify_blueprints';
exports.PRINTIFY_PROVIDERS_COLLECTION = 'printify_print_providers';
exports.PRINTFUL_PRODUCTS_COLLECTION = 'printful_products';
exports.PRINTFUL_VARIANTS_COLLECTION = 'printful_variants';
exports.PROVIDER_MAPPING_COLLECTION = 'printify_printful_mapping';
exports.QRG_COUNTERS_COLLECTION = 'qrg_counters';
// ── Canonical core operational collections ────────────────────────────────────
// These collections are accessed exclusively via Cloud Functions middleware
// (requireAdmin). Direct client SDK access is blocked by Firestore wildcard deny.
exports.BLD_DEFINITIONS_COLLECTION = 'bld_definitions';
exports.BLD_COUNTERS_COLLECTION = 'bld_counters';
exports.GRF_ASSETS_COLLECTION = 'grf_assets';
exports.GRF_COUNTERS_COLLECTION = 'grf_counters';
exports.ASSEMBLIES_COLLECTION = 'assemblies';
exports.ASM_COUNTERS_COLLECTION = 'asm_counters';
exports.CATALOGS_COLLECTION = 'catalogs';
exports.ADMIN_BUILD_SESSIONS_COLLECTION = 'admin_build_sessions';
exports.ADMIN_BUILD_SHELF_COLLECTION = 'admin_build_shelf';
// ── System settings collections ───────────────────────────────────────────────
// systemSettings — catalog section assignments + catalog defaults (admin-only)
exports.SYSTEM_SETTINGS_COLLECTION = 'systemSettings';
// IMPORTANT: Despite the name, testSettings/pricing IS the live production
// pricing store (markup %, member profit share, fixed markup). It is read by
// 14+ routes in both server/ and functions/. Do NOT wipe this in testing.
exports.PRICING_SETTINGS_COLLECTION = 'testSettings';
exports.PRICING_SETTINGS_DOC = 'pricing';
exports.QRG_BLANK_CODES = {
    12: '101',
};
//# sourceMappingURL=constants.js.map