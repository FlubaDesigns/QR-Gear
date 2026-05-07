/**
 * shared/graphicCodes.ts
 *
 * GRF (Graphic Reference Format) identity system.
 *
 * Format:  [D1][D2][D3][D4][D5][D6]-[NNNNNN]
 *
 *   D1  = Asset class     (1=input build, 2=output artifact)
 *   D2  = Media type      (1=image, 2=video, 3=document)
 *   D3  = Channel         (1=print, 2=store, 3=url)
 *   D4  = Purpose         (1=qr_composite … 7=template)
 *   D5  = Format          (conditional on D2)
 *   D6  = Sub-context     (conditional on D3)
 *   NNNNNN = 6-digit zero-padded global sequence number
 *
 * Example: 212421-000001  (output artifact · image · store · glamor_shot · jpeg · first shown)
 * Example: 211111-000003  (output artifact · image · print · qr_composite · png · front · #3)
 * Example: 111611-000001  (input build · image · print · background · png · front)
 *
 * Counter: grf_counters/global  { count: N }  — single global atomic counter.
 * Codes are GLOBAL and FIXED — never renumber once assigned.
 *
 * See GRF.md for the full schema reference.
 */

// ── Digit types ────────────────────────────────────────────────────────────

export type GrfAssetClass  = '1' | '2';
export type GrfMediaType   = '1' | '2' | '3';
export type GrfChannel     = '1' | '2' | '3';
export type GrfPurpose     = '1' | '2' | '3' | '4' | '5' | '6' | '7';
export type GrfFormat      = '1' | '2' | '3' | '4';
export type GrfSubContext  = '1' | '2' | '3' | '4' | '5';

// ── D1 — Asset class ───────────────────────────────────────────────────────

export const GRF_ASSET_CLASSES: Record<GrfAssetClass, { label: string; description: string }> = {
  '1': { label: 'input_build',      description: 'Input to the build process — source uploads, backgrounds, templates, crops' },
  '2': { label: 'output_artifact',  description: 'Output of the build — QR composites, glamor shots, URL graphics' },
};

// ── D2 — Media type ────────────────────────────────────────────────────────

export const GRF_MEDIA_TYPES: Record<GrfMediaType, string> = {
  '1': 'image',
  '2': 'video',
  '3': 'document',
};

// ── D3 — Channel ───────────────────────────────────────────────────────────

export const GRF_CHANNELS: Record<GrfChannel, { label: string; description: string }> = {
  '1': { label: 'print', description: 'Goes to the physical product (sent to print provider)' },
  '2': { label: 'store', description: 'Displayed in the customer-facing storefront' },
  '3': { label: 'url',   description: 'Lives on a landing page / online digital artifact' },
};

// ── D4 — Purpose ───────────────────────────────────────────────────────────

export const GRF_PURPOSES: Record<GrfPurpose, { label: string; description: string }> = {
  '1': { label: 'qr_composite',  description: 'QR code merged with zone/palette graphic or text — goes on the front of the item' },
  '2': { label: 'qr_standalone', description: 'QR code with QRG logo centered on a white box' },
  '3': { label: 'url_graphic',   description: 'Image created for the online landing page / digital artifact' },
  '4': { label: 'glamor_shot',   description: 'Lifestyle/mockup render — shirt with design applied, store-facing' },
  '5': { label: 'source_upload', description: 'Raw asset uploaded by user before any processing' },
  '6': { label: 'background',    description: 'Background image used during composition in the builder' },
  '7': { label: 'template',      description: 'Reusable graphic element applied across multiple products' },
};

// ── D5 — Format (conditional on D2) ───────────────────────────────────────

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

// ── D6 — Sub-context (conditional on D3) ──────────────────────────────────

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

const GRF_REGEX = /^\d{6}-(\d{6})$/;

// ── Parsed representation ──────────────────────────────────────────────────

export interface ParsedGrfId {
  assetClass:      GrfAssetClass;
  mediaType:       GrfMediaType;
  channel:         GrfChannel;
  purpose:         GrfPurpose;
  format:          string;
  subContext:      string;
  sequence:        number;
  assetClassName:  string;
  mediaTypeName:   string;
  channelName:     string;
  purposeName:     string;
  formatName:      string;
  subContextName:  string;
  mimeType:        string;
}

// ── Validation ─────────────────────────────────────────────────────────────

export function isValidGrfId(id: string): boolean {
  if (!GRF_REGEX.test(id)) return false;
  const [desc] = id.split('-');
  const [d1, d2, d3, d4, d5, d6] = desc.split('') as [GrfAssetClass, GrfMediaType, GrfChannel, GrfPurpose, string, string];
  if (!GRF_ASSET_CLASSES[d1])        return false;
  if (!GRF_MEDIA_TYPES[d2])          return false;
  if (!GRF_CHANNELS[d3])             return false;
  if (!GRF_PURPOSES[d4])             return false;
  if (!GRF_FORMATS[d2]?.[d5])       return false;
  if (!GRF_SUBCONTEXTS[d3]?.[d6])   return false;
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
  const [d1, d2, d3, d4, d5, d6] = desc.split('') as [GrfAssetClass, GrfMediaType, GrfChannel, GrfPurpose, string, string];

  const classEntry  = GRF_ASSET_CLASSES[d1];
  const mediaEntry  = GRF_MEDIA_TYPES[d2];
  const chanEntry   = GRF_CHANNELS[d3];
  const purposeEntry = GRF_PURPOSES[d4 as GrfPurpose];
  const formatEntry = GRF_FORMATS[d2]?.[d5];
  const subCtxName  = GRF_SUBCONTEXTS[d3]?.[d6];

  if (!classEntry)   throw new Error(`Invalid GRF ID "${id}": unknown asset class "${d1}"`);
  if (!mediaEntry)   throw new Error(`Invalid GRF ID "${id}": unknown media type "${d2}"`);
  if (!chanEntry)    throw new Error(`Invalid GRF ID "${id}": unknown channel "${d3}"`);
  if (!purposeEntry) throw new Error(`Invalid GRF ID "${id}": unknown purpose "${d4}"`);
  if (!formatEntry)  throw new Error(`Invalid GRF ID "${id}": format "${d5}" invalid for media type "${d2}"`);
  if (!subCtxName)   throw new Error(`Invalid GRF ID "${id}": sub-context "${d6}" invalid for channel "${d3}"`);

  return {
    assetClass:     d1,
    mediaType:      d2,
    channel:        d3,
    purpose:        d4 as GrfPurpose,
    format:         d5,
    subContext:     d6,
    sequence:       parseInt(seqStr, 10),
    assetClassName: classEntry.label,
    mediaTypeName:  mediaEntry,
    channelName:    chanEntry.label,
    purposeName:    purposeEntry.label,
    formatName:     formatEntry.label,
    subContextName: subCtxName,
    mimeType:       formatEntry.mime,
  };
}

// ── Builder ────────────────────────────────────────────────────────────────

export interface GrfIdParams {
  assetClass: GrfAssetClass;
  mediaType:  GrfMediaType;
  channel:    GrfChannel;
  purpose:    GrfPurpose;
  format:     string;
  subContext: string;
  sequence:   number;
}

export function buildGrfId(params: GrfIdParams): string {
  const { assetClass, mediaType, channel, purpose, format, subContext, sequence } = params;

  if (!GRF_ASSET_CLASSES[assetClass])
    throw new Error(`Invalid GRF assetClass: "${assetClass}"`);
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
  return `${assetClass}${mediaType}${channel}${purpose}${format}${subContext}-${seq}`;
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
 * Example: grfStoragePath('212421-000001') → 'grf/212421-000001/glamor.jpg'
 */
export function grfStoragePath(grfId: string): string {
  const parsed   = parseGrfId(grfId);
  const basename = PURPOSE_FILENAMES[parsed.purpose];
  const ext      = parsed.formatName === 'jpeg' ? 'jpg' : parsed.formatName;
  return `grf/${grfId}/${basename}.${ext}`;
}

// ── MIME lookup ────────────────────────────────────────────────────────────

export function grfMimeType(grfId: string): string {
  return parseGrfId(grfId).mimeType;
}

// ── Counter key ────────────────────────────────────────────────────────────

export const GRF_COUNTER_KEY = 'global';

// ── Legacy compatibility shims ─────────────────────────────────────────────
// Allow old call sites to compile during migration. Remove once fully migrated.

/** @deprecated Use isValidGrfId instead */
export const isValidGraphicId = isValidGrfId;

/** @deprecated Use assertValidGrfId instead */
export const assertValidGraphicId = assertValidGrfId;

/** @deprecated Use parseGrfId instead */
export const parseGraphicId = parseGrfId;

/** @deprecated Use GRF_COUNTER_KEY instead */
export function grfCounterKey(_typeCode: string, _roleCode: string): string {
  return GRF_COUNTER_KEY;
}

/** @deprecated Migrate caller to buildGrfId({ assetClass, mediaType, channel, purpose, format, subContext, sequence }) */
export function buildGraphicId(_typeCode: string, _roleCode: string, _sequence: number): string {
  throw new Error('[GRF] buildGraphicId() removed — migrate to buildGrfId(params)');
}

/** @deprecated Use GrfAssetClass | GrfMediaType | GrfChannel | GrfPurpose */
export type GrfTypeCode = string;

/** @deprecated No longer part of the schema */
export type GrfRoleCode = string;

/** @deprecated Use GRF_ASSET_CLASSES, GRF_MEDIA_TYPES, GRF_CHANNELS, GRF_PURPOSES */
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
  '1': 'Source', '2': 'Derivative', '3': 'Renderable', '4': 'Final', '5': 'Template',
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

/** @deprecated */
export const GRF_VALID_PAIRINGS: Array<{ typeCode: string; roleCode: string }> = [
  { typeCode: '01', roleCode: '1' }, { typeCode: '02', roleCode: '2' },
  { typeCode: '03', roleCode: '3' }, { typeCode: '04', roleCode: '3' },
  { typeCode: '05', roleCode: '3' }, { typeCode: '05', roleCode: '4' },
  { typeCode: '06', roleCode: '3' }, { typeCode: '07', roleCode: '5' },
];
