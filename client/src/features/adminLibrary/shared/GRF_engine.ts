/**
 * client/src/features/adminLibrary/shared/grfAssetEngine.ts
 *
 * Library asset naming engine — built on top of shared/graphicCodes.ts.
 *
 * Provides canonical GRF params for every asset type in the internal
 * asset library (D3 = channel 4 "assets"). All library tabs use this
 * file as the single source of truth for which digits to send to save-grf.
 *
 * D1 = 1 (input_build)
 * D2 = 1 (image)
 * D3 = 4 (assets)
 * D4 = purpose within the assets channel (1=original, 2=cropped, 3=background, 4=template)
 * D5 = format, derived from MIME type
 *
 * See GRF.md for the full schema.
 * See shared/graphicCodes.ts for low-level ID format, parsing, and validation.
 */

import type { GrfAssetClass, GrfChannel, GrfFormat, GrfMediaType } from '@shared/graphicCodes';

// ── Fixed digits for all assets-channel library assets ────────────────────────

export const LIBRARY_ASSET_CLASS: GrfAssetClass = '1'; // input_build
export const LIBRARY_MEDIA_TYPE:  GrfMediaType  = '1'; // image
export const LIBRARY_CHANNEL:     GrfChannel    = '4'; // assets

// ── D4 — Purpose within the assets channel ────────────────────────────────────

export const PURPOSE_ORIGINAL:   '1' = '1'; // raw upload, filename preserved
export const PURPOSE_CROPPED:    '2' = '2'; // cropped derivative of an original
export const PURPOSE_BACKGROUND: '3' = '3'; // promoted original used in builder
export const PURPOSE_TEMPLATE:   '4' = '4'; // reusable graphic across products

// ── MIME type → GRF format digit (D5) ────────────────────────────────────────

export function mimeToGrfFormat(mimeType: string): GrfFormat {
  switch (mimeType.toLowerCase()) {
    case 'image/png':     return '1';
    case 'image/jpeg':
    case 'image/jpg':     return '2';
    case 'image/webp':    return '3';
    case 'image/svg+xml': return '4';
    default:              return '2'; // fallback: JPEG
  }
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
// When a source image is cropped, two GRF records are created:
//   1. The crop result        → purpose=2 (cropped)
//   2. The promoted original  → purpose=3 (background)

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

// ── Query filter params — use with GET /api/admin/graphics ────────────────────

export const GRF_FILTER_ORIGINALS   = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_ORIGINAL   };
export const GRF_FILTER_CROPPED     = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_CROPPED     };
export const GRF_FILTER_BACKGROUNDS = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_BACKGROUND  };
export const GRF_FILTER_TEMPLATES   = { channel: LIBRARY_CHANNEL, purpose: PURPOSE_TEMPLATE    };
