/**
 * Canonical platform constants for the server build layer.
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
