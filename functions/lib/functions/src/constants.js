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
exports.LEGACY_STORE_ID = exports.PLATFORM_STORE_ID = exports.MOSAIC_TEMPLATES_COLLECTION = exports.MOSAICS_COLLECTION = void 0;
exports.MOSAICS_COLLECTION = 'site_programs';
exports.MOSAIC_TEMPLATES_COLLECTION = 'dynamicsCollections';
exports.PLATFORM_STORE_ID = 'qr-gear';
exports.LEGACY_STORE_ID = 'kingdom_connects';
//# sourceMappingURL=constants.js.map