/**
 * client/src/features/adminLibrary/shared/GRF_engine.ts
 *
 * Library asset naming engine — built on top of shared/graphicCodes.ts.
 *
 * All digit values, labels, and MIME mappings are derived directly from
 * the GRF scheme in graphicCodes.ts. Nothing is re-invented here.
 *
 * D1 = '1' (input_build)   — from GRF_ASSET_CLASSES
 * D2 = '1' (image)         — from GRF_MEDIA_TYPES
 * D3 = '4' (assets)        — from GRF_CHANNELS
 * D4 = purpose             — from GRF_PURPOSES_BY_CHANNEL['4']
 * D5 = format              — from GRF_FORMATS['1'] keyed by MIME type
 *
 * See GRF.md for the full schema.
 */

import {
  GRF_ASSET_CLASSES,
  GRF_MEDIA_TYPES,
  GRF_CHANNELS,
  GRF_PURPOSES_BY_CHANNEL,
  GRF_FORMATS,
  isValidGrfId,
  parseGrfId,
} from '@shared/graphicCodes';

import type {
  GrfAssetClass,
  GrfChannel,
  GrfFormat,
  GrfMediaType,
} from '@shared/graphicCodes';

// ── Fixed digits — verified against the GRF scheme ───────────────────────────

export const LIBRARY_ASSET_CLASS: GrfAssetClass = '1'; // input_build
export const LIBRARY_MEDIA_TYPE:  GrfMediaType  = '1'; // image
export const LIBRARY_CHANNEL:     GrfChannel    = '4'; // assets

// Confirm these exist in the scheme at module load — hard-fail if not
if (!GRF_ASSET_CLASSES[LIBRARY_ASSET_CLASS]) throw new Error(`GRF_engine: unknown asset class "${LIBRARY_ASSET_CLASS}"`);
if (!GRF_MEDIA_TYPES[LIBRARY_MEDIA_TYPE])    throw new Error(`GRF_engine: unknown media type "${LIBRARY_MEDIA_TYPE}"`);
if (!GRF_CHANNELS[LIBRARY_CHANNEL])          throw new Error(`GRF_engine: unknown channel "${LIBRARY_CHANNEL}"`);

// ── D4 — Purpose digits, taken from GRF_PURPOSES_BY_CHANNEL['4'] ─────────────

const _assetPurposes = GRF_PURPOSES_BY_CHANNEL[LIBRARY_CHANNEL];

function _requirePurpose(digit: string): string {
  if (!_assetPurposes[digit]) throw new Error(`GRF_engine: no assets-channel purpose for digit "${digit}"`);
  return digit;
}

export const PURPOSE_ORIGINAL:   string = _requirePurpose('1'); // raw upload, filename preserved
export const PURPOSE_CROPPED:    string = _requirePurpose('2'); // cropped derivative
export const PURPOSE_BACKGROUND: string = _requirePurpose('3'); // promoted original used in builder
export const PURPOSE_TEMPLATE:   string = _requirePurpose('4'); // reusable graphic

// ── MIME type → D5 format digit, derived from GRF_FORMATS ────────────────────

const _imageFormats = GRF_FORMATS[LIBRARY_MEDIA_TYPE]; // all image format entries

const _mimeToFormat: Record<string, GrfFormat> = {};
for (const [digit, entry] of Object.entries(_imageFormats)) {
  _mimeToFormat[entry.mime] = digit as GrfFormat;
}

export function mimeToGrfFormat(mimeType: string): GrfFormat {
  const normalized = mimeType.toLowerCase();
  // image/jpg is not in the scheme — normalize to image/jpeg
  const lookup = normalized === 'image/jpg' ? 'image/jpeg' : normalized;
  const digit = _mimeToFormat[lookup];
  if (!digit) {
    console.warn(`GRF_engine: unrecognized MIME type "${mimeType}", defaulting to JPEG`);
    return _mimeToFormat['image/jpeg'];
  }
  return digit;
}

// ── GRF param shape sent to save-grf ─────────────────────────────────────────

export interface LibraryGrfParams {
  assetClass: GrfAssetClass;
  mediaType:  GrfMediaType;
  channel:    GrfChannel;
  purpose:    string;
  format:     string;
}

// ── Param builders — one per asset purpose ────────────────────────────────────

export function originalGrfParams(mimeType: string): LibraryGrfParams {
  return {
    assetClass: LIBRARY_ASSET_CLASS,
    mediaType:  LIBRARY_MEDIA_TYPE,
    channel:    LIBRARY_CHANNEL,
    purpose:    PURPOSE_ORIGINAL,
    format:     mimeToGrfFormat(mimeType),
  };
}

export function croppedGrfParams(mimeType = 'image/jpeg'): LibraryGrfParams {
  return {
    assetClass: LIBRARY_ASSET_CLASS,
    mediaType:  LIBRARY_MEDIA_TYPE,
    channel:    LIBRARY_CHANNEL,
    purpose:    PURPOSE_CROPPED,
    format:     mimeToGrfFormat(mimeType),
  };
}

export function backgroundGrfParams(mimeType: string): LibraryGrfParams {
  return {
    assetClass: LIBRARY_ASSET_CLASS,
    mediaType:  LIBRARY_MEDIA_TYPE,
    channel:    LIBRARY_CHANNEL,
    purpose:    PURPOSE_BACKGROUND,
    format:     mimeToGrfFormat(mimeType),
  };
}

export function templateGrfParams(mimeType: string): LibraryGrfParams {
  return {
    assetClass: LIBRARY_ASSET_CLASS,
    mediaType:  LIBRARY_MEDIA_TYPE,
    channel:    LIBRARY_CHANNEL,
    purpose:    PURPOSE_TEMPLATE,
    format:     mimeToGrfFormat(mimeType),
  };
}

// ── Crop transition ───────────────────────────────────────────────────────────
// When a source image is cropped, two GRF records are produced:
//   1. The crop result       → purpose=2 (cropped)
//   2. The promoted original → purpose=3 (background)

export interface CropTransition {
  cropped:    LibraryGrfParams;
  background: LibraryGrfParams;
}

export function buildCropTransition(
  originalMimeType: string,
  croppedMimeType = 'image/jpeg',
): CropTransition {
  return {
    cropped:    croppedGrfParams(croppedMimeType),
    background: backgroundGrfParams(originalMimeType),
  };
}

// ── Purpose label lookup — from the scheme, not hardcoded ─────────────────────

export function purposeLabel(purpose: string): string {
  return _assetPurposes[purpose]?.label ?? purpose;
}

// ── Query filter params — use with GET /api/admin/graphics ────────────────────

export const GRF_FILTER_ORIGINALS   = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_ORIGINAL   };
export const GRF_FILTER_CROPPED     = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_CROPPED     };
export const GRF_FILTER_BACKGROUNDS = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_BACKGROUND  };
export const GRF_FILTER_TEMPLATES   = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_TEMPLATE    };

// ── Re-export what callers need from graphicCodes ────────────────────────────
// So tabs only need to import from GRF_engine, not graphicCodes directly.

export { isValidGrfId, parseGrfId };
