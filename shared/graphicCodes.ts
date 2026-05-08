/**
 * shared/graphicCodes.ts
 *
 * GRF (Graphic Reference Format) identity system.
 *
 * Format:  GRF-[D1][D2][D3][D4][D5]-[NNNNNN]
 *
 *   D1  = Asset class  (1=input_build, 2=output_artifact)
 *   D2  = Media type   (1=image, 2=video, 3=document)
 *   D3  = Channel      (1=print, 2=store, 3=url, 4=assets)
 *   D4  = Purpose      — relative to D3 (same digit means different things per channel)
 *   D5  = Format       — conditional on D2
 *   NNNNNN = 6-digit zero-padded global sequence number
 *
 * Example: GRF-21111-000001  (output artifact · image · print · qr_composite · PNG)
 * Example: GRF-11421-000001  (input build · image · assets · cropped · PNG)
 *
 * Counter: grf_counters/global  { count: N }  — single global atomic counter.
 * IDs are GLOBAL and FIXED — never renumber once assigned.
 *
 * See GRF.md for the full schema reference.
 */

// ── Digit types ──────────────────────────────────────────────────────────────

export type GrfAssetClass = '1' | '2';
export type GrfMediaType  = '1' | '2' | '3';
export type GrfChannel    = '1' | '2' | '3' | '4';
export type GrfPurpose    = '1' | '2' | '3' | '4';
export type GrfFormat     = '1' | '2' | '3' | '4';

// ── D1 — Asset class ─────────────────────────────────────────────────────────

export const GRF_ASSET_CLASSES: Record<GrfAssetClass, { label: string; description: string }> = {
  '1': { label: 'input_build',     description: 'Input to the build process — source uploads, backgrounds, templates, crops' },
  '2': { label: 'output_artifact', description: 'Output of the build — QR composites, glamor shots, URL graphics' },
};

// ── D2 — Media type ──────────────────────────────────────────────────────────

export const GRF_MEDIA_TYPES: Record<GrfMediaType, string> = {
  '1': 'image',
  '2': 'video',
  '3': 'document',
};

// ── D3 — Channel ─────────────────────────────────────────────────────────────

export const GRF_CHANNELS: Record<GrfChannel, { label: string; description: string }> = {
  '1': { label: 'print',  description: 'Goes to the physical product (sent to print provider)' },
  '2': { label: 'store',  description: 'Displayed in the customer-facing storefront' },
  '3': { label: 'url',    description: 'Lives on a landing page / online digital artifact' },
  '4': { label: 'assets', description: 'Internal asset library — source uploads, backgrounds, templates' },
};

// ── D4 — Purpose (relative to D3) ───────────────────────────────────────────

export interface GrfPurposeEntry {
  label:       string;
  description: string;
}

export const GRF_PURPOSES_BY_CHANNEL: Record<GrfChannel, Record<string, GrfPurposeEntry>> = {
  '1': {
    '1': { label: 'qr_composite',  description: 'QR code merged with zone/palette graphic — goes on the product' },
    '2': { label: 'qr_standalone', description: 'QR code with QRG logo centered on a white box' },
  },
  '2': {
    '1': { label: 'glamor_shot',   description: 'Hero image — first shown in storefront, lifestyle/glamor render' },
    '2': { label: 'front',         description: 'Front-facing product render' },
    '3': { label: 'back',          description: 'Back-facing product render' },
  },
  '3': {
    '1': { label: 'snapshot',      description: 'Rendered capture of the landing page' },
    '2': { label: 'graphic',       description: 'Designed image placed on the landing page' },
  },
  '4': {
    '1': { label: 'original',      description: 'Raw asset as uploaded — filename preserved' },
    '2': { label: 'cropped',       description: 'Cropped derivative of the original' },
    '3': { label: 'background',    description: 'Background image used during builder composition' },
    '4': { label: 'template',      description: 'Reusable graphic applied across multiple products' },
  },
};

// ── D5 — Format (conditional on D2) ─────────────────────────────────────────

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

// ── Regex ─────────────────────────────────────────────────────────────────────

const GRF_REGEX = /^GRF-(\d{5})-(\d{6})$/;

// ── Parsed representation ─────────────────────────────────────────────────────

export interface ParsedGrfId {
  assetClass:     GrfAssetClass;
  mediaType:      GrfMediaType;
  channel:        GrfChannel;
  purpose:        string;
  format:         string;
  sequence:       number;
  assetClassName: string;
  mediaTypeName:  string;
  channelName:    string;
  purposeName:    string;
  formatName:     string;
  mimeType:       string;
}

// ── Validation ────────────────────────────────────────────────────────────────

export function isValidGrfId(id: string): boolean {
  if (typeof id !== 'string' || !GRF_REGEX.test(id)) return false;
  const digits = id.split('-')[1];
  const [d1, d2, d3, d4, d5] = digits.split('') as [GrfAssetClass, GrfMediaType, GrfChannel, string, string];
  if (!GRF_ASSET_CLASSES[d1])                            return false;
  if (!GRF_MEDIA_TYPES[d2 as GrfMediaType])              return false;
  if (!GRF_CHANNELS[d3 as GrfChannel])                   return false;
  if (!GRF_PURPOSES_BY_CHANNEL[d3 as GrfChannel]?.[d4])  return false;
  if (!GRF_FORMATS[d2 as GrfMediaType]?.[d5])            return false;
  return true;
}

export function assertValidGrfId(id: string): void {
  if (!isValidGrfId(id)) throw new Error(`Invalid GRF ID: "${id}"`);
}

// ── Parser ────────────────────────────────────────────────────────────────────

export function parseGrfId(id: string): ParsedGrfId {
  if (!GRF_REGEX.test(id)) throw new Error(`Invalid GRF ID: "${id}"`);
  const digits = id.split('-')[1];
  const [d1, d2, d3, d4, d5] = digits.split('') as [GrfAssetClass, GrfMediaType, GrfChannel, string, string];

  const classEntry   = GRF_ASSET_CLASSES[d1];
  const mediaEntry   = GRF_MEDIA_TYPES[d2 as GrfMediaType];
  const chanEntry    = GRF_CHANNELS[d3 as GrfChannel];
  const purposeEntry = GRF_PURPOSES_BY_CHANNEL[d3 as GrfChannel]?.[d4];
  const formatEntry  = GRF_FORMATS[d2 as GrfMediaType]?.[d5];

  if (!classEntry)   throw new Error(`Invalid GRF ID "${id}": unknown asset class "${d1}"`);
  if (!mediaEntry)   throw new Error(`Invalid GRF ID "${id}": unknown media type "${d2}"`);
  if (!chanEntry)    throw new Error(`Invalid GRF ID "${id}": unknown channel "${d3}"`);
  if (!purposeEntry) throw new Error(`Invalid GRF ID "${id}": unknown purpose "${d4}" for channel "${d3}"`);
  if (!formatEntry)  throw new Error(`Invalid GRF ID "${id}": format "${d5}" invalid for media type "${d2}"`);

  return {
    assetClass:     d1,
    mediaType:      d2 as GrfMediaType,
    channel:        d3 as GrfChannel,
    purpose:        d4,
    format:         d5,
    sequence:       parseInt(id.split('-')[2], 10),
    assetClassName: classEntry.label,
    mediaTypeName:  mediaEntry,
    channelName:    chanEntry.label,
    purposeName:    purposeEntry.label,
    formatName:     formatEntry.label,
    mimeType:       formatEntry.mime,
  };
}

// ── Builder ───────────────────────────────────────────────────────────────────

export interface GrfIdParams {
  assetClass: GrfAssetClass;
  mediaType:  GrfMediaType;
  channel:    GrfChannel;
  purpose:    string;
  format:     string;
  sequence:   number;
}

export function buildGrfId(params: GrfIdParams): string {
  const { assetClass, mediaType, channel, purpose, format, sequence } = params;

  if (!GRF_ASSET_CLASSES[assetClass])
    throw new Error(`Invalid GRF assetClass: "${assetClass}"`);
  if (!GRF_MEDIA_TYPES[mediaType])
    throw new Error(`Invalid GRF mediaType: "${mediaType}"`);
  if (!GRF_CHANNELS[channel])
    throw new Error(`Invalid GRF channel: "${channel}"`);
  if (!GRF_PURPOSES_BY_CHANNEL[channel]?.[purpose])
    throw new Error(`Invalid GRF purpose "${purpose}" for channel "${channel}"`);
  if (!GRF_FORMATS[mediaType]?.[format])
    throw new Error(`Format "${format}" is invalid for media type "${mediaType}"`);
  if (sequence < 1 || sequence > 999999)
    throw new Error(`GRF sequence must be 1–999999, got ${sequence}`);

  const seq = String(sequence).padStart(6, '0');
  return `GRF-${assetClass}${mediaType}${channel}${purpose}${format}-${seq}`;
}

// ── Storage path helper ───────────────────────────────────────────────────────

const CHANNEL_PURPOSE_FILENAMES: Record<GrfChannel, Record<string, string>> = {
  '1': { '1': 'composite',  '2': 'qr-standalone' },
  '2': { '1': 'glamor',     '2': 'front',      '3': 'back' },
  '3': { '1': 'snapshot',   '2': 'graphic' },
  '4': { '1': 'original',   '2': 'cropped',    '3': 'background', '4': 'template' },
};

/**
 * Returns the canonical Firebase Storage path for a GRF asset.
 *
 * For assets-channel originals (D3=4, D4=1), pass `originalFilename` to
 * preserve the uploaded filename. Without it, falls back to "original.{ext}".
 *
 * Example: grfStoragePath('GRF-21211-000001') → 'grf/GRF-21211-000001/glamor.png'
 */
export function grfStoragePath(grfId: string, originalFilename?: string): string {
  const parsed = parseGrfId(grfId);
  const ext    = parsed.formatName === 'jpeg' ? 'jpg' : parsed.formatName;
  let   base   = CHANNEL_PURPOSE_FILENAMES[parsed.channel]?.[parsed.purpose] ?? 'asset';
  if (parsed.channel === '4' && parsed.purpose === '1' && originalFilename) {
    const nameWithoutExt = originalFilename.replace(/\.[^/.]+$/, '');
    base = nameWithoutExt.replace(/[^a-zA-Z0-9._-]/g, '_') || 'original';
  }
  return `grf/${grfId}/${base}.${ext}`;
}

// ── MIME lookup ───────────────────────────────────────────────────────────────

export function grfMimeType(grfId: string): string {
  return parseGrfId(grfId).mimeType;
}

// ── Counter key ───────────────────────────────────────────────────────────────

export const GRF_COUNTER_KEY = 'global';

// ── Canonical packet slot definitions ─────────────────────────────────────────
// Single source of truth for which GRF params map to each auto-registered
// packet asset slot. Import everywhere — never hardcode slot params elsewhere.

export interface GrfSlotParams {
  assetClass: GrfAssetClass;
  mediaType:  GrfMediaType;
  channel:    GrfChannel;
  purpose:    string;
  format:     string;
}

export const GRF_PACKET_SLOTS = {
  /** Background image used in the builder — input_build · image · assets · background · png */
  background: {
    assetClass: '1' as GrfAssetClass, mediaType: '1' as GrfMediaType,
    channel: '4' as GrfChannel, purpose: '3', format: '1',
  },
  /** QR code standalone — output_artifact · image · print · qr_standalone · png */
  qrStandalone: {
    assetClass: '2' as GrfAssetClass, mediaType: '1' as GrfMediaType,
    channel: '1' as GrfChannel, purpose: '2', format: '1',
  },
  /** QR composite (canvas design) — output_artifact · image · print · qr_composite · png */
  qrComposite: {
    assetClass: '2' as GrfAssetClass, mediaType: '1' as GrfMediaType,
    channel: '1' as GrfChannel, purpose: '1', format: '1',
  },
  /** Landing page snapshot — output_artifact · image · url · snapshot · png */
  urlSnapshot: {
    assetClass: '2' as GrfAssetClass, mediaType: '1' as GrfMediaType,
    channel: '3' as GrfChannel, purpose: '1', format: '1',
  },
} satisfies Record<string, GrfSlotParams>;

// ── Direct aliases ────────────────────────────────────────────────────────────

export const isValidGraphicId    = isValidGrfId;
export const assertValidGraphicId = assertValidGrfId;
export const parseGraphicId       = parseGrfId;
