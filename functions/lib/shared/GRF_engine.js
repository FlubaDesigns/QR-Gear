"use strict";
/**
 * shared/GRF_engine.ts
 *
 * Single source of truth for GRF library asset naming.
 * Built on top of graphicCodes.ts. Nothing is re-invented here.
 *
 * D1 = '1' (input_build)   — from GRF_ASSET_CLASSES
 * D2 = '1' (image)         — from GRF_MEDIA_TYPES
 * D3 = '4' (assets)        — from GRF_CHANNELS
 * D4 = purpose             — from GRF_PURPOSES_BY_CHANNEL['4']
 * D5 = format              — from GRF_FORMATS['1'] keyed by MIME type
 *
 * Import from here on the frontend, dev server, and Cloud Functions.
 * Never redefine these constants in component or route files.
 *
 * See docs/GRF.md for the full schema.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GRF_FILTER_TEMPLATES = exports.GRF_FILTER_BACKGROUNDS = exports.GRF_FILTER_CROPPED = exports.GRF_FILTER_ORIGINALS = exports.PURPOSE_TEMPLATE = exports.PURPOSE_BACKGROUND = exports.PURPOSE_CROPPED = exports.PURPOSE_ORIGINAL = exports.LIBRARY_CHANNEL = exports.LIBRARY_MEDIA_TYPE = exports.LIBRARY_ASSET_CLASS = void 0;
exports.mimeToGrfFormat = mimeToGrfFormat;
exports.originalGrfParams = originalGrfParams;
exports.croppedGrfParams = croppedGrfParams;
exports.backgroundGrfParams = backgroundGrfParams;
exports.templateGrfParams = templateGrfParams;
exports.buildCropTransition = buildCropTransition;
exports.purposeLabel = purposeLabel;
const graphicCodes_1 = require("./graphicCodes");
// ── Fixed digits — verified against the GRF scheme at module load ─────────────
exports.LIBRARY_ASSET_CLASS = '1'; // input_build
exports.LIBRARY_MEDIA_TYPE = '1'; // image
exports.LIBRARY_CHANNEL = '4'; // assets
if (!graphicCodes_1.GRF_ASSET_CLASSES[exports.LIBRARY_ASSET_CLASS])
    throw new Error(`GRF_engine: unknown asset class "${exports.LIBRARY_ASSET_CLASS}"`);
if (!graphicCodes_1.GRF_MEDIA_TYPES[exports.LIBRARY_MEDIA_TYPE])
    throw new Error(`GRF_engine: unknown media type "${exports.LIBRARY_MEDIA_TYPE}"`);
if (!graphicCodes_1.GRF_CHANNELS[exports.LIBRARY_CHANNEL])
    throw new Error(`GRF_engine: unknown channel "${exports.LIBRARY_CHANNEL}"`);
// ── D4 — Purpose digits ───────────────────────────────────────────────────────
const _assetPurposes = graphicCodes_1.GRF_PURPOSES_BY_CHANNEL[exports.LIBRARY_CHANNEL];
function _requirePurpose(digit) {
    if (!_assetPurposes[digit])
        throw new Error(`GRF_engine: no assets-channel purpose for digit "${digit}"`);
    return digit;
}
exports.PURPOSE_ORIGINAL = _requirePurpose('1'); // raw upload, filename preserved
exports.PURPOSE_CROPPED = _requirePurpose('2'); // cropped derivative
exports.PURPOSE_BACKGROUND = _requirePurpose('3'); // promoted original used in builder
exports.PURPOSE_TEMPLATE = _requirePurpose('4'); // reusable graphic
// ── MIME type → D5 format digit ───────────────────────────────────────────────
const _imageFormats = graphicCodes_1.GRF_FORMATS[exports.LIBRARY_MEDIA_TYPE];
const _mimeToFormat = {};
for (const [digit, entry] of Object.entries(_imageFormats)) {
    _mimeToFormat[entry.mime] = digit;
}
function mimeToGrfFormat(mimeType) {
    const normalized = mimeType.toLowerCase();
    const lookup = normalized === 'image/jpg' ? 'image/jpeg' : normalized;
    const digit = _mimeToFormat[lookup];
    if (!digit) {
        console.error(`GRF_engine: unrecognized MIME type "${mimeType}" — this must be fixed, not silently defaulted`);
        throw new Error(`GRF_engine: unrecognized MIME type "${mimeType}"`);
    }
    return digit;
}
// ── Param builders — one per asset purpose ────────────────────────────────────
function originalGrfParams(mimeType) {
    return {
        assetClass: exports.LIBRARY_ASSET_CLASS,
        mediaType: exports.LIBRARY_MEDIA_TYPE,
        channel: exports.LIBRARY_CHANNEL,
        purpose: exports.PURPOSE_ORIGINAL,
        format: mimeToGrfFormat(mimeType),
    };
}
function croppedGrfParams(mimeType = 'image/jpeg') {
    return {
        assetClass: exports.LIBRARY_ASSET_CLASS,
        mediaType: exports.LIBRARY_MEDIA_TYPE,
        channel: exports.LIBRARY_CHANNEL,
        purpose: exports.PURPOSE_CROPPED,
        format: mimeToGrfFormat(mimeType),
    };
}
function backgroundGrfParams(mimeType) {
    return {
        assetClass: exports.LIBRARY_ASSET_CLASS,
        mediaType: exports.LIBRARY_MEDIA_TYPE,
        channel: exports.LIBRARY_CHANNEL,
        purpose: exports.PURPOSE_BACKGROUND,
        format: mimeToGrfFormat(mimeType),
    };
}
function templateGrfParams(mimeType) {
    return {
        assetClass: exports.LIBRARY_ASSET_CLASS,
        mediaType: exports.LIBRARY_MEDIA_TYPE,
        channel: exports.LIBRARY_CHANNEL,
        purpose: exports.PURPOSE_TEMPLATE,
        format: mimeToGrfFormat(mimeType),
    };
}
function buildCropTransition(originalMimeType, croppedMimeType = 'image/jpeg') {
    return {
        cropped: croppedGrfParams(croppedMimeType),
        background: backgroundGrfParams(originalMimeType),
    };
}
// ── Purpose label lookup ──────────────────────────────────────────────────────
function purposeLabel(purpose) {
    return _assetPurposes[purpose]?.label ?? purpose;
}
// ── Query filter params ───────────────────────────────────────────────────────
exports.GRF_FILTER_ORIGINALS = { channel: exports.LIBRARY_CHANNEL, purpose: exports.PURPOSE_ORIGINAL };
exports.GRF_FILTER_CROPPED = { channel: exports.LIBRARY_CHANNEL, purpose: exports.PURPOSE_CROPPED };
exports.GRF_FILTER_BACKGROUNDS = { channel: exports.LIBRARY_CHANNEL, purpose: exports.PURPOSE_BACKGROUND };
exports.GRF_FILTER_TEMPLATES = { channel: exports.LIBRARY_CHANNEL, purpose: exports.PURPOSE_TEMPLATE };
// ── Re-exports — graphicCodes is an implementation detail; import from here ──
__exportStar(require("./graphicCodes"), exports);
//# sourceMappingURL=GRF_engine.js.map