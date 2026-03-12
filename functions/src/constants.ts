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

export const MOSAICS_COLLECTION = 'site_programs';
export const MOSAIC_TEMPLATES_COLLECTION = 'dynamicsCollections';

export const PLATFORM_STORE_ID = 'qr-gear';
export const LEGACY_STORE_ID = 'kingdom_connects';

export const SURFACES_COLLECTION = 'surfaces';
export const SURFACE_VARIANTS_COLLECTION = 'surfaceVariants';
export const MARKETPLACE_ACCOUNTS_COLLECTION = 'marketplaceAccounts';
export const MARKETPLACE_LISTINGS_COLLECTION = 'marketplaceListings';
export const MARKETPLACE_SYNC_JOBS_COLLECTION = 'marketplaceSyncJobs';
export const MARKETPLACE_SYNC_LOGS_COLLECTION = 'marketplaceSyncLogs';

export type MarketplacePlatform = 'etsy' | 'ebay' | 'amazon';
export type SurfaceStatus = 'draft' | 'ready' | 'published' | 'archived';
export type ListingStatus = 'pending' | 'draft' | 'active' | 'syncing' | 'error' | 'paused' | 'delisted';
export type SyncJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type SyncJobAction = 'create' | 'update' | 'delete' | 'sync_inventory' | 'full_sync';
export type SyncLogLevel = 'info' | 'warn' | 'error';

export const MARKETPLACE_PLATFORMS: MarketplacePlatform[] = ['etsy', 'ebay', 'amazon'];
