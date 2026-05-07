/**
 * shared/graphicCodes.ts
 *
 * GRF (Graphic Reference Format) identity system.
 *
 * Format:  [D1][D2][D3][D4][D5]-[NNNNNN]
 *
 *   D1  = Media type      (1=image, 2=video, 3=document)
 *   D2  = Channel         (1=print, 2=store, 3=url)
 *   D3  = Purpose         (1=qr_composite … 7=template)
 *   D4  = Format          (conditional on D1)
 *   D5  = Sub-context     (conditional on D2)
 *   NNNNNN = 6-digit zero-padded global sequence number
 *
 * Example: 12421-000001  (image · store · glamor_shot · jpeg · first shown · #1)
 * Example: 11111-000003  (image · print · qr_composite · png · front · #3)
 *
 * Counter: grf_counters/global  { count: N }  — single global atomic counter.
 * Codes are GLOBAL and FIXED — never renumber once assigned.
 *
 * See docs/GRF.md for the full schema reference.
 */

// ── Digit types ────────────────────────────────────────────────────────────

export type GrfMediaType   = '1' | '2' | '3';
export type GrfChannel     = '1' | '2' | '3';
export type GrfPurpose     = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type GrfImageFormat = '1' | '2' | '3' | '4';
export type GrfVideoFormat = '1' | '2';
export type GrfDocFormat   = '1';
export type GrfFormat      = GrfImageFormat | GrfVideoFormat | GrfDocFormat;
export type GrfSubContext  = '1' | '2' | '3' | '4' | '5';

// ── D1 — Media type ────────────────────────────────────────────────────────

export const GRF_MEDIA_TYPES: Record<GrfMediaType, string> = {
  '1': 'image',
  '2': 'video',
  '3': 'document',
};

// ── D2 — Channel ───────────────────────────────────────────────────────────

export const GRF_CHANNELS: Record<GrfChannel, { label: string; description: string }> = {
  '1': { label: 'print', description: 'Goes to the physical product (sent to print provider)' },
  '2': { label: 'store', description: 'Displayed in the customer-facing storefront' },
  '3': { label: 'url',   description: 'Lives on a landing page / online digital artifact' },
};

// ── D3 — Purpose ───────────────────────────────────────────────────────────

export const GRF_PURPOSES: Record<GrfPurpose, { label: string; description: string }> = {
  '1': { label: 'qr_composite',  description: 'QR code merged with zone/palette graphic or text — goes on the front of the item' },
  '2': { label: 'qr_standalone', description: 'QR code with QRG logo centered on a white box' },
  '3': { label: 'url_graphic',   description: 'Image created for the online landing page / digital artifact' },
  '4': { label: 'glamor_shot',   description: 'Lifestyle/mockup render — shirt with design applied, store-facing' },
  '5': { label: 'source_upload', description: 'Raw asset uploaded by user before any processing' },
  '6': { label: 'background',    description: 'Background image used during composition in the builder' },
  '7': { label: 'template',      description: 'Reusable graphic element applied across multiple products' },
};

// ── D4 — Format (conditional on D1) ───────────────────────────────────────

export const GRF_FORMATS: Record<GrfMediaType, Record<string, { label: string; mime: string }>> = {
  '1': {
    '1': { label: 'png',  mime: 'image/png' },
    '2': { label: 'jpeg', mime: 'image/jpeg' },
    '3': { label: 'webp', mime: 'image/webp' },
    '4': { label: 'svg',  mime: 'image/svg+xml' },
  },
  '2': {
    '1': { label: 'mp4',  mime: 'video/mp4' },
    '2': { label: 'webm', mime: 'video/webm' },
  },
  '3': {
    '1': { label: 'pdf',  mime: 'application/pdf' },
  },
};

// ── D5 — Sub-context (conditional on D2) ──────────────────────────────────

export const GRF_SUBCONTEXTS: Record<GrfChannel, Record<string, string>> = {
  '1': {
    '1': 'front',
    '2': 'back',
    '3': 'sleeve',
  },
  '2': {
    '1': 'first',
    '2': 'second',
    '3': 'third',
    '4': 'fourth',
    '5': 'fifth',
  },
  '3': {
    '1': 'internal',
    '2': 'external',
  },
};

// ── Regex ──────────────────────────────────────────────────────────────────

const GRF_REGEX = /^\d{5}-(\d{6})$/;

// ── Parsed representation ──────────────────────────────────────────────────

export interface ParsedGrfId {
  mediaType:      GrfMediaType;
  channel:        GrfChannel;
  purpose:        GrfPurpose;
  format:         string;
  subContext:     string;
  sequence:       number;
  mediaTypeName:  string;
  channelName:    string;
  purposeName:    string;
  formatName:     string;
  subContextName: string;
  mimeType:       string;
}

// ── Validation ─────────────────────────────────────────────────────────────

/**
 * Returns true when id is a structurally valid GRF ID (5 descriptor digits + 6-digit sequence).
 * Does not check digit compatibility — use parseGrfId for full validation.
 */
export function isValidGrfId(id: string): boolean {
  if (!GRF_REGEX.test(id)) return false;
  const [desc] = id.split('-');
  const [d1, d2, d3, d4, d5] = desc.split('') as [GrfMediaType, GrfChannel, GrfPurpose, string, string];
  if (!GRF_MEDIA_TYPES[d1])                return false;
  if (!GRF_CHANNELS[d2])                   return false;
  if (!GRF_PURPOSES[d3])                   return false;
  if (!GRF_FORMATS[d1]?.[d4])             return false;
  if (!GRF_SUBCONTEXTS[d2]?.[d5])         return false;
  return true;
}

export function assertValidGrfId(id: string): void {
  if (!isValidGrfId(id)) {
    throw new Error(`Invalid GRF ID: "${id}"`);
  }
}

// ── Parser ─────────────────────────────────────────────────────────────────

export function parseGrfId(id: string): ParsedGrfId {
  if (!GRF_REGEX.test(id)) throw new Error(`Invalid GRF ID: "${id}"`);
  const [desc, seqStr] = id.split('-');
  const [d1, d2, d3, d4, d5] = desc.split('') as [GrfMediaType, GrfChannel, GrfPurpose, string, string];

  const mediaEntry   = GRF_MEDIA_TYPES[d1];
  const channelEntry = GRF_CHANNELS[d2];
  const purposeEntry = GRF_PURPOSES[d3 as GrfPurpose];
  const formatEntry  = GRF_FORMATS[d1]?.[d4];
  const subCtxName   = GRF_SUBCONTEXTS[d2]?.[d5];

  if (!mediaEntry)   throw new Error(`Invalid GRF ID "${id}": unknown media type "${d1}"`);
  if (!channelEntry) throw new Error(`Invalid GRF ID "${id}": unknown channel "${d2}"`);
  if (!purposeEntry) throw new Error(`Invalid GRF ID "${id}": unknown purpose "${d3}"`);
  if (!formatEntry)  throw new Error(`Invalid GRF ID "${id}": format "${d4}" invalid for media type "${d1}"`);
  if (!subCtxName)   throw new Error(`Invalid GRF ID "${id}": sub-context "${d5}" invalid for channel "${d2}"`);

  return {
    mediaType:      d1 as GrfMediaType,
    channel:        d2 as GrfChannel,
    purpose:        d3 as GrfPurpose,
    format:         d4,
    subContext:     d5,
    sequence:       parseInt(seqStr, 10),
    mediaTypeName:  mediaEntry,
    channelName:    channelEntry.label,
    purposeName:    purposeEntry.label,
    formatName:     formatEntry.label,
    subContextName: subCtxName,
    mimeType:       formatEntry.mime,
  };
}

// ── Builder ────────────────────────────────────────────────────────────────

export interface GrfIdParams {
  mediaType:  GrfMediaType;
  channel:    GrfChannel;
  purpose:    GrfPurpose;
  format:     string;
  subContext: string;
  sequence:   number;
}

export function buildGrfId(params: GrfIdParams): string {
  const { mediaType, channel, purpose, format, subContext, sequence } = params;

  if (!GRF_MEDIA_TYPES[mediaType])
    throw new Error(`Invalid GRF mediaType: "${mediaType}"`);
  if (!GRF_CHANNELS[channel])
    throw new Error(`Invalid GRF channel: "${channel}"`);
  if (!GRF_PURPOSES[purpose])
    throw new Error(`Invalid GRF purpose: "${purpose}"`);
  if (!GRF_FORMATS[mediaType]?.[format])
    throw new Error(`Format "${format}" is invalid for media type "${mediaType}"`);
  if (!GRF_SUBCONTEXTS[channel]?.[subContext])
    throw new Error(`Sub-context "${subContext}" is invalid for channel "${channel}"`);
  if (sequence < 1 || sequence > 999999)
    throw new Error(`GRF sequence must be 1–999999, got ${sequence}`);

  const seq = String(sequence).padStart(6, '0');
  return `${mediaType}${channel}${purpose}${format}${subContext}-${seq}`;
}

// ── Storage path helper ────────────────────────────────────────────────────

const PURPOSE_FILENAMES: Record<GrfPurpose, string> = {
  '1': 'composite',
  '2': 'qr-standalone',
  '3': 'url-graphic',
  '4': 'glamor',
  '5': 'source',
  '6': 'background',
  '7': 'template',
};

/**
 * Returns the canonical Firebase Storage path for a GRF asset.
 * Example: grfStoragePath('12421-000001') → 'grf/12421-000001/glamor.jpg'
 */
export function grfStoragePath(grfId: string): string {
  const parsed   = parseGrfId(grfId);
  const basename = PURPOSE_FILENAMES[parsed.purpose];
  const ext      = parsed.formatName === 'jpeg' ? 'jpg' : parsed.formatName;
  return `grf/${grfId}/${basename}.${ext}`;
}

// ── MIME lookup ────────────────────────────────────────────────────────────

/**
 * Returns the MIME type for a given GRF ID.
 * Throws if the ID is invalid.
 */
export function grfMimeType(grfId: string): string {
  return parseGrfId(grfId).mimeType;
}

// ── Counter key ────────────────────────────────────────────────────────────

/** Firestore document key for the single global GRF counter. */
export const GRF_COUNTER_KEY = 'global';

// ── Legacy compatibility shims ─────────────────────────────────────────────
// These allow existing call sites to compile during migration to the new API.
// Remove each shim once the consuming file has been updated.

/** @deprecated Use isValidGrfId instead */
export const isValidGraphicId = isValidGrfId;

/** @deprecated Use assertValidGrfId instead */
export const assertValidGraphicId = assertValidGrfId;

/** @deprecated Use parseGrfId instead */
export const parseGraphicId = parseGrfId;

/** @deprecated Use GRF_COUNTER_KEY ('global') instead */
export function grfCounterKey(_typeCode: string, _roleCode: string): string {
  return GRF_COUNTER_KEY;
}

/**
 * @deprecated Use buildGrfId({ mediaType, channel, purpose, format, subContext, sequence }) instead.
 * This shim is intentionally unimplemented — callers must be migrated to buildGrfId.
 */
export function buildGraphicId(_typeCode: string, _roleCode: string, _sequence: number): string {
  throw new Error(
    '[GRF] buildGraphicId() is removed. Migrate caller to buildGrfId({ mediaType, channel, purpose, format, subContext, sequence }).',
  );
}

/** @deprecated Use GrfMediaType | GrfChannel | GrfPurpose instead */
export type GrfTypeCode = string;

/** @deprecated No longer part of the schema */
export type GrfRoleCode = string;

/** @deprecated Use GRF_PURPOSES, GRF_CHANNELS, GRF_MEDIA_TYPES instead */
export const GRF_TYPE_MAP: Record<string, { label: string; description: string; validRoles: string[] }> = {
  '01': { label: 'upload_source',      description: 'Raw uploaded source image',        validRoles: ['1'] },
  '02': { label: 'cropped_derivative', description: 'Cropped/derived from source',      validRoles: ['2'] },
  '03': { label: 'background',         description: 'Background image asset',           validRoles: ['3'] },
  '04': { label: 'qr_graphic',         description: 'QR code graphic',                  validRoles: ['3'] },
  '05': { label: 'canvas_design',      description: 'Full canvas composite design',     validRoles: ['4', '3'] },
  '06': { label: 'url_artifact_asset', description: 'URL/landing page artifact image',  validRoles: ['3'] },
  '07': { label: 'template_graphic',   description: 'Reusable template graphic',        validRoles: ['5'] },
};

/** @deprecated No longer part of the schema */
export const GRF_ROLE_LABELS: Record<string, string> = {
  '1': 'Source',
  '2': 'Derivative',
  '3': 'Renderable',
  '4': 'Final',
  '5': 'Template',
};

/** @deprecated Use GRF_FORMATS instead */
export const GRF_TYPE_ALLOWED_MIMES: Record<string, readonly string[]> = {
  '01': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif'],
  '02': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  '03': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  '04': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  '05': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
  '06': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'video/mp4', 'video/webm', 'application/pdf'],
  '07': ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
};

/** @deprecated Use GRF_MEDIA_TYPES, GRF_CHANNELS, GRF_PURPOSES, GRF_FORMATS, GRF_SUBCONTEXTS */
export const GRF_VALID_PAIRINGS: Array<{ typeCode: string; roleCode: string }> = [
  { typeCode: '01', roleCode: '1' },
  { typeCode: '02', roleCode: '2' },
  { typeCode: '03', roleCode: '3' },
  { typeCode: '04', roleCode: '3' },
  { typeCode: '05', roleCode: '3' },
  { typeCode: '05', roleCode: '4' },
  { typeCode: '06', roleCode: '3' },
  { typeCode: '07', roleCode: '5' },
];
