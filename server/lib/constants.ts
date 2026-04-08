/**
 * Canonical platform constants for the server build layer.
 *
 * Firestore collection string values are the actual collection names
 * in Firestore. The constant names reflect the canonical domain
 * vocabulary. If a collection is renamed in Firestore, update the
 * value here — every consumer imports from this single file.
 *
 * BACKWARD-COMPAT NOTE:
 * Several Firestore collection names still carry legacy prefixes
 * (e.g. "site_programs", "dynamicsCollections"). Renaming the
 * actual Firestore collections is out of scope — instead, every
 * consumer references the constant so the legacy string is
 * confined to this single file.
 */

export const MOSAICS_COLLECTION = 'site_programs';
export const MOSAIC_TEMPLATES_COLLECTION = 'dynamicsCollections';

export const CHANNEL_ITEMS_COLLECTION = 'channel_items';
export const CHANNEL_CONTENT_COLLECTION = 'dynamicsChannelContent';
export const COLLECTION_ITEMS_COLLECTION = 'dynamicsCollectionItems';
export const DYNAMICS_SURFACES_COLLECTION = 'qrDynamicsSurfaces';
export const STORE_PRODUCT_LINKS_COLLECTION = 'storeProductLinks';
export const PRODUCT_PACKETS_COLLECTION = 'productPackets';

export const PLATFORM_STORE_ID = 'qr-gear';
