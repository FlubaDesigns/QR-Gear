/**
 * Canonical platform constants for Cloud Functions.
 *
 * Firestore collection string values are the actual collection names
 * in Firestore. The constant names reflect the canonical domain
 * vocabulary. If a collection is renamed in Firestore, update the
 * value here — every consumer imports from this single file.
 */

export const MOSAICS_COLLECTION = 'site_programs';
export const MOSAIC_TEMPLATES_COLLECTION = 'dynamicsCollections';

export const CHANNEL_ITEMS_COLLECTION = 'channel_items';
export const CHANNEL_CONTENT_COLLECTION = 'dynamicsChannelContent';
export const COLLECTION_ITEMS_COLLECTION = 'dynamicsCollectionItems';
export const DYNAMICS_SURFACES_COLLECTION = 'qrDynamicsSurfaces';
export const STORE_PRODUCT_LINKS_COLLECTION = 'storeProductLinks';
export const PRODUCT_PACKETS_COLLECTION = 'productPackets';

export const QR_DYNAMICS_INSTANCES_COLLECTION = 'qr_dynamics_instances';
export const MEMBER_PACKETS_COLLECTION = 'memberPackets';

export const PLATFORM_STORE_ID = 'qr-gear';

export const SURFACES_COLLECTION = 'surfaces';
export const SURFACE_VARIANTS_COLLECTION = 'surfaceVariants';
export const MARKETPLACE_ACCOUNTS_COLLECTION = 'marketplaceAccounts';
export const MARKETPLACE_LISTINGS_COLLECTION = 'marketplaceListings';
export const MARKETPLACE_SYNC_JOBS_COLLECTION = 'marketplaceSyncJobs';
export const MARKETPLACE_SYNC_LOGS_COLLECTION = 'marketplaceSyncLogs';

export const BUILDER_HOSTS_COLLECTION = 'builderHosts';
export const BUILDER_PROFILES_COLLECTION = 'builderProfiles';
export const BUILDER_PLACEMENTS_COLLECTION = 'builderPlacements';
export const BUILDER_SESSIONS_COLLECTION = 'builderSessions';
export const BUILDER_DRAFTS_COLLECTION = 'builderDrafts';
export const PRICING_POLICIES_COLLECTION = 'pricingPolicies';
export const REVENUE_SPLITS_COLLECTION = 'revenueSplits';
export const EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION = 'embeddedOrderAttributions';
export const AFFILIATE_PAYOUT_LEDGER_COLLECTION = 'affiliatePayoutLedger';

export type MarketplacePlatform = 'etsy' | 'ebay' | 'amazon';
export type SurfaceStatus = 'draft' | 'ready' | 'published' | 'archived' | 'blocked';
export type ListingStatus = 'pending' | 'draft' | 'active' | 'syncing' | 'error' | 'paused' | 'delisted';
export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SyncJobAction = 'create' | 'update' | 'delete' | 'sync_inventory' | 'full_sync';
export type SyncLogLevel = 'info' | 'warn' | 'error';

export type BuilderHostStatus = 'active' | 'paused' | 'disabled';
export type BuilderProfileStatus = 'active' | 'draft' | 'archived';
export type BuilderPlacementStatus = 'active' | 'paused' | 'disabled';
export type EmbedMode = 'store' | 'product' | 'builder';
export type BuilderSessionStatus = 'active' | 'completed' | 'abandoned' | 'expired';
export type BuilderDraftStatus = 'draft' | 'converted' | 'abandoned';
export type PricingPolicyStatus = 'active' | 'draft' | 'archived';
export type RevenueSplitStatus = 'active' | 'draft' | 'archived';
export type BaseCostMode = 'snapshot' | 'live-cost' | 'variant-cost';
export type MarginType = 'fixed' | 'percent';
export type AffiliateBasis = 'gross_profit';
export type RoundingMode = 'none' | 'round' | 'ceil' | 'floor';
export type PayoutStatus = 'pending' | 'approved' | 'paid' | 'reversed';

export const MARKETPLACE_PLATFORMS: MarketplacePlatform[] = ['etsy', 'ebay', 'amazon'];
export const EMBED_MODES: EmbedMode[] = ['store', 'product', 'builder'];
export const BUILDER_HOST_STATUSES: BuilderHostStatus[] = ['active', 'paused', 'disabled'];
export const BUILDER_PROFILE_STATUSES: BuilderProfileStatus[] = ['active', 'draft', 'archived'];
export const BUILDER_PLACEMENT_STATUSES: BuilderPlacementStatus[] = ['active', 'paused', 'disabled'];
export const PAYOUT_STATUSES: PayoutStatus[] = ['pending', 'approved', 'paid', 'reversed'];

export const MASTER_CATALOG_COLLECTION = 'master_catalog';
export const MASTER_CATALOG_SYNCS_COLLECTION = 'master_catalog_syncs';
export const PRINTIFY_BLUEPRINTS_COLLECTION = 'printify_blueprints';
export const PRINTIFY_PROVIDERS_COLLECTION = 'printify_print_providers';
export const PRINTFUL_PRODUCTS_COLLECTION = 'printful_products';
export const PRINTFUL_VARIANTS_COLLECTION = 'printful_variants';
export const PROVIDER_MAPPING_COLLECTION = 'printify_printful_mapping';

export const QRG_COUNTERS_COLLECTION = 'qrg_counters';

export type QrgSource = 'I' | 'M' | 'E' | 'D';

export const QRG_BLANK_CODES: Record<number, string> = {
  12: '101',
};
