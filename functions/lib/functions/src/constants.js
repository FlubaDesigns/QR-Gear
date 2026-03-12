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
exports.MARKETPLACE_PLATFORMS = exports.MARKETPLACE_SYNC_LOGS_COLLECTION = exports.MARKETPLACE_SYNC_JOBS_COLLECTION = exports.MARKETPLACE_LISTINGS_COLLECTION = exports.MARKETPLACE_ACCOUNTS_COLLECTION = exports.SURFACE_VARIANTS_COLLECTION = exports.SURFACES_COLLECTION = exports.LEGACY_STORE_ID = exports.PLATFORM_STORE_ID = exports.MOSAIC_TEMPLATES_COLLECTION = exports.MOSAICS_COLLECTION = void 0;
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
exports.MARKETPLACE_PLATFORMS = ['etsy', 'ebay', 'amazon'];
//# sourceMappingURL=constants.js.map