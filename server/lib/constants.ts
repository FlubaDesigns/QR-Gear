/**
 * Canonical platform constants for the server build layer.
 *
 * Firestore collection string values are the actual collection names
 * in Firestore. The constant names reflect the canonical domain
 * vocabulary. If a collection is renamed in Firestore, update the
 * value here — every consumer imports from this single file.
 */

export const MOSAICS_COLLECTION = 'site_programs';
export const MOSAIC_TEMPLATES_COLLECTION = 'dynamicsCollections';
