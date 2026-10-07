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

import {
  GRF_ASSET_CLASSES,
  GRF_MEDIA_TYPES,
  GRF_CHANNELS,
  GRF_PURPOSES_BY_CHANNEL,
  GRF_FORMATS,
  isValidGrfId,
  parseGrfId,
} from './graphicCodes';

import type {
  GrfAssetClass,
  GrfChannel,
  GrfFormat,
  GrfMediaType,
} from './graphicCodes';

// ── Fixed digits — verified against the GRF scheme at module load ─────────────

export const LIBRARY_ASSET_CLASS: GrfAssetClass = '1'; // input_build
export const LIBRARY_MEDIA_TYPE:  GrfMediaType  = '1'; // image
export const LIBRARY_CHANNEL:     GrfChannel    = '4'; // assets

if (!GRF_ASSET_CLASSES[LIBRARY_ASSET_CLASS]) throw new Error(`GRF_engine: unknown asset class "${LIBRARY_ASSET_CLASS}"`);
if (!GRF_MEDIA_TYPES[LIBRARY_MEDIA_TYPE])    throw new Error(`GRF_engine: unknown media type "${LIBRARY_MEDIA_TYPE}"`);
if (!GRF_CHANNELS[LIBRARY_CHANNEL])          throw new Error(`GRF_engine: unknown channel "${LIBRARY_CHANNEL}"`);

// ── D4 — Purpose digits ───────────────────────────────────────────────────────

const _assetPurposes = GRF_PURPOSES_BY_CHANNEL[LIBRARY_CHANNEL];

function _requirePurpose(digit: string): string {
  if (!_assetPurposes[digit]) throw new Error(`GRF_engine: no assets-channel purpose for digit "${digit}"`);
  return digit;
}

export const PURPOSE_ORIGINAL:   string = _requirePurpose('1'); // raw upload, filename preserved
export const PURPOSE_CROPPED:    string = _requirePurpose('2'); // cropped derivative
export const PURPOSE_BACKGROUND: string = _requirePurpose('3'); // promoted original used in builder
export const PURPOSE_TEMPLATE:   string = _requirePurpose('4'); // reusable graphic

// ── MIME type → D5 format digit ───────────────────────────────────────────────

const _imageFormats = GRF_FORMATS[LIBRARY_MEDIA_TYPE];

const _mimeToFormat: Record<string, GrfFormat> = {};
for (const [digit, entry] of Object.entries(_imageFormats)) {
  _mimeToFormat[entry.mime] = digit as GrfFormat;
}

export function mimeToGrfFormat(mimeType: string): GrfFormat {
  const normalized = mimeType.toLowerCase();
  const lookup = normalized === 'image/jpg' ? 'image/jpeg' : normalized;
  const digit = _mimeToFormat[lookup];
  if (!digit) {
    console.error(`GRF_engine: unrecognized MIME type "${mimeType}" — this must be fixed, not silently defaulted`);
    throw new Error(`GRF_engine: unrecognized MIME type "${mimeType}"`);
  }
  return digit;
}

// ── MIME normalization — browser → GRF-compatible MIME ───────────────────────
// Validate against GRF_FORMATS. Only true MIME aliases are normalized; unsupported
// image encodings must be converted by an image processor before upload.

// Source uploads preserve bytes; MIME aliases must not pretend to convert files.
export const GRF_IMAGE_ACCEPT_TYPES = Object.values(GRF_FORMATS['1']).map(f => f.mime).join(',');
export const GRF_IMAGE_MAX_MB = 20;
export const GRF_IMAGE_MAX_BYTES = GRF_IMAGE_MAX_MB * 1024 * 1024;
export const GRF_CROP_MIME_TYPE = 'image/png';

export function normalizeMimeType(raw: string): string {
  const lower = (raw || '').toLowerCase();
  const normalized = lower === 'image/jpg' ? 'image/jpeg' : lower;
  if (!Object.values(GRF_FORMATS['1']).some(f => f.mime === normalized)) {
    throw new Error('Unsupported image format. Use PNG, JPEG, WebP, or SVG.');
  }
  return normalized;
}

// ── GRF param shape ───────────────────────────────────────────────────────────

export interface LibraryGrfParams {
  assetClass: GrfAssetClass;
  mediaType:  GrfMediaType;
  channel:    GrfChannel;
  purpose:    string;
  format:     string;
}

// Video upload policy is shared by the browser and the permanent-file registrar.
export const GRF_VIDEO_MEDIA_TYPE: GrfMediaType = '2';
export const GRF_VIDEO_ACCEPT_TYPES = Object.values(GRF_FORMATS[GRF_VIDEO_MEDIA_TYPE]).map(f => f.mime).join(',');
export const GRF_VIDEO_FORMAT_LABELS = Object.values(GRF_FORMATS[GRF_VIDEO_MEDIA_TYPE]).map(f => f.label.toUpperCase()).join(', ');
// Base64 plus JSON must fit the deployed HTTP request limit.
export const GRF_VIDEO_MAX_MB = 20;
export const GRF_VIDEO_MAX_BYTES = GRF_VIDEO_MAX_MB * 1024 * 1024;
export function videoGrfParams(mimeType: string): LibraryGrfParams {
  const format = Object.entries(GRF_FORMATS[GRF_VIDEO_MEDIA_TYPE]).find(([, value]) => value.mime === mimeType.toLowerCase());
  if (!format) throw new Error(`Unsupported video format. Use ${GRF_VIDEO_FORMAT_LABELS}.`);
  return { assetClass: LIBRARY_ASSET_CLASS, mediaType: GRF_VIDEO_MEDIA_TYPE, channel: '3', purpose: '2', format: format[0] };
}
export function validateVideoUpload(mimeType: string, size: number): LibraryGrfParams {
  const params = videoGrfParams(mimeType);
  if (!Number.isFinite(size) || size <= 0) throw new Error('The video file is empty');
  if (size > GRF_VIDEO_MAX_BYTES) throw new Error(`Videos must be ${GRF_VIDEO_MAX_MB} MB or smaller`);
  return params;
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

// ── Purpose label lookup ──────────────────────────────────────────────────────

export function purposeLabel(purpose: string): string {
  return _assetPurposes[purpose]?.label ?? purpose;
}

// ── Query filter params ───────────────────────────────────────────────────────

export const GRF_FILTER_ORIGINALS   = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_ORIGINAL   };
export const GRF_FILTER_CROPPED     = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_CROPPED     };
export const GRF_FILTER_BACKGROUNDS = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_BACKGROUND  };
export const GRF_FILTER_TEMPLATES   = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_TEMPLATE    };

// ── Re-exports — graphicCodes is an implementation detail; import from here ──

export * from './graphicCodes';

/** Check record metadata against the identity encoded by the canonical GRF schema. */
export function inspectGrfAsset(asset: Record<string, any>): string[] {
  if (!isValidGrfId(asset.grfId)) return ['Invalid GRF identity.'];
  const parsed = parseGrfId(asset.grfId);
  const issues: string[] = [];
  for (const key of ['assetClass', 'mediaType', 'channel', 'purpose', 'format'] as const) {
    if (asset[key] !== parsed[key]) issues.push(`${key} does not match the GRF ID.`);
  }
  const mime = String(asset.mimeType || '').toLowerCase().replace(/^image\/jpg$/, 'image/jpeg');
  if (mime !== parsed.mimeType) issues.push('MIME type does not match the GRF format.');
  return issues;
}
