"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseGraphicId = exports.assertValidGraphicId = exports.isValidGraphicId = exports.GRF_PACKET_SLOTS = exports.GRF_COUNTER_KEY = exports.GRF_FORMATS = exports.GRF_PURPOSES_BY_CHANNEL = exports.GRF_CHANNELS = exports.GRF_MEDIA_TYPES = exports.GRF_ASSET_CLASSES = void 0;
exports.isValidGrfId = isValidGrfId;
exports.assertValidGrfId = assertValidGrfId;
exports.parseGrfId = parseGrfId;
exports.buildGrfId = buildGrfId;
exports.grfStoragePath = grfStoragePath;
exports.grfMimeType = grfMimeType;
// ── D1 — Asset class ─────────────────────────────────────────────────────────
exports.GRF_ASSET_CLASSES = {
    '1': { label: 'input_build', description: 'Input to the build process — source uploads, backgrounds, templates, crops' },
    '2': { label: 'output_artifact', description: 'Output of the build — QR composites, glamor shots, URL graphics' },
};
// ── D2 — Media type ──────────────────────────────────────────────────────────
exports.GRF_MEDIA_TYPES = {
    '1': 'image',
    '2': 'video',
    '3': 'document',
};
// ── D3 — Channel ─────────────────────────────────────────────────────────────
exports.GRF_CHANNELS = {
    '1': { label: 'print', description: 'Goes to the physical product (sent to print provider)' },
    '2': { label: 'store', description: 'Displayed in the customer-facing storefront' },
    '3': { label: 'url', description: 'Lives on a landing page / online digital artifact' },
    '4': { label: 'assets', description: 'Internal asset library — source uploads, backgrounds, templates' },
};
exports.GRF_PURPOSES_BY_CHANNEL = {
    '1': {
        '1': { label: 'qr_composite', description: 'QR code merged with zone/palette graphic — goes on the product' },
        '2': { label: 'qr_standalone', description: 'QR code with QRG logo centered on a white box' },
    },
    '2': {
        '1': { label: 'glamor_shot', description: 'Hero image — first shown in storefront, lifestyle/glamor render' },
        '2': { label: 'front', description: 'Front-facing product render' },
        '3': { label: 'back', description: 'Back-facing product render' },
    },
    '3': {
        '1': { label: 'snapshot', description: 'Rendered capture of the landing page' },
        '2': { label: 'graphic', description: 'Designed image placed on the landing page' },
    },
    '4': {
        '1': { label: 'original', description: 'Raw asset as uploaded — filename preserved' },
        '2': { label: 'cropped', description: 'Cropped derivative of the original' },
        '3': { label: 'background', description: 'Background image used during builder composition' },
        '4': { label: 'template', description: 'Reusable graphic applied across multiple products' },
    },
};
// ── D5 — Format (conditional on D2) ─────────────────────────────────────────
exports.GRF_FORMATS = {
    '1': {
        '1': { label: 'png', mime: 'image/png' },
        '2': { label: 'jpeg', mime: 'image/jpeg' },
        '3': { label: 'webp', mime: 'image/webp' },
        '4': { label: 'svg', mime: 'image/svg+xml' },
    },
    '2': {
        '1': { label: 'mp4', mime: 'video/mp4' },
        '2': { label: 'webm', mime: 'video/webm' },
    },
    '3': {
        '1': { label: 'pdf', mime: 'application/pdf' },
    },
};
// ── Regex ─────────────────────────────────────────────────────────────────────
const GRF_REGEX = /^GRF-(\d{5})-(\d{6})$/;
// ── Validation ────────────────────────────────────────────────────────────────
function isValidGrfId(id) {
    if (typeof id !== 'string' || !GRF_REGEX.test(id))
        return false;
    const digits = id.split('-')[1];
    const [d1, d2, d3, d4, d5] = digits.split('');
    if (!exports.GRF_ASSET_CLASSES[d1])
        return false;
    if (!exports.GRF_MEDIA_TYPES[d2])
        return false;
    if (!exports.GRF_CHANNELS[d3])
        return false;
    if (!exports.GRF_PURPOSES_BY_CHANNEL[d3]?.[d4])
        return false;
    if (!exports.GRF_FORMATS[d2]?.[d5])
        return false;
    return true;
}
function assertValidGrfId(id) {
    if (!isValidGrfId(id))
        throw new Error(`Invalid GRF ID: "${id}"`);
}
// ── Parser ────────────────────────────────────────────────────────────────────
function parseGrfId(id) {
    if (!GRF_REGEX.test(id))
        throw new Error(`Invalid GRF ID: "${id}"`);
    const digits = id.split('-')[1];
    const [d1, d2, d3, d4, d5] = digits.split('');
    const classEntry = exports.GRF_ASSET_CLASSES[d1];
    const mediaEntry = exports.GRF_MEDIA_TYPES[d2];
    const chanEntry = exports.GRF_CHANNELS[d3];
    const purposeEntry = exports.GRF_PURPOSES_BY_CHANNEL[d3]?.[d4];
    const formatEntry = exports.GRF_FORMATS[d2]?.[d5];
    if (!classEntry)
        throw new Error(`Invalid GRF ID "${id}": unknown asset class "${d1}"`);
    if (!mediaEntry)
        throw new Error(`Invalid GRF ID "${id}": unknown media type "${d2}"`);
    if (!chanEntry)
        throw new Error(`Invalid GRF ID "${id}": unknown channel "${d3}"`);
    if (!purposeEntry)
        throw new Error(`Invalid GRF ID "${id}": unknown purpose "${d4}" for channel "${d3}"`);
    if (!formatEntry)
        throw new Error(`Invalid GRF ID "${id}": format "${d5}" invalid for media type "${d2}"`);
    return {
        assetClass: d1,
        mediaType: d2,
        channel: d3,
        purpose: d4,
        format: d5,
        sequence: parseInt(id.split('-')[2], 10),
        assetClassName: classEntry.label,
        mediaTypeName: mediaEntry,
        channelName: chanEntry.label,
        purposeName: purposeEntry.label,
        formatName: formatEntry.label,
        mimeType: formatEntry.mime,
    };
}
function buildGrfId(params) {
    const { assetClass, mediaType, channel, purpose, format, sequence } = params;
    if (!exports.GRF_ASSET_CLASSES[assetClass])
        throw new Error(`Invalid GRF assetClass: "${assetClass}"`);
    if (!exports.GRF_MEDIA_TYPES[mediaType])
        throw new Error(`Invalid GRF mediaType: "${mediaType}"`);
    if (!exports.GRF_CHANNELS[channel])
        throw new Error(`Invalid GRF channel: "${channel}"`);
    if (!exports.GRF_PURPOSES_BY_CHANNEL[channel]?.[purpose])
        throw new Error(`Invalid GRF purpose "${purpose}" for channel "${channel}"`);
    if (!exports.GRF_FORMATS[mediaType]?.[format])
        throw new Error(`Format "${format}" is invalid for media type "${mediaType}"`);
    if (sequence < 1 || sequence > 999999)
        throw new Error(`GRF sequence must be 1–999999, got ${sequence}`);
    const seq = String(sequence).padStart(6, '0');
    return `GRF-${assetClass}${mediaType}${channel}${purpose}${format}-${seq}`;
}
// ── Storage path helper ───────────────────────────────────────────────────────
const CHANNEL_PURPOSE_FILENAMES = {
    '1': { '1': 'composite', '2': 'qr-standalone' },
    '2': { '1': 'glamor', '2': 'front', '3': 'back' },
    '3': { '1': 'snapshot', '2': 'graphic' },
    '4': { '1': 'original', '2': 'cropped', '3': 'background', '4': 'template' },
};
/**
 * Returns the canonical Firebase Storage path for a GRF asset.
 *
 * For assets-channel originals (D3=4, D4=1), pass `originalFilename` to
 * preserve the uploaded filename. Without it, falls back to "original.{ext}".
 *
 * Example: grfStoragePath('GRF-21211-000001') → 'grf/GRF-21211-000001/glamor.png'
 */
function grfStoragePath(grfId, originalFilename) {
    const parsed = parseGrfId(grfId);
    const ext = parsed.formatName === 'jpeg' ? 'jpg' : parsed.formatName;
    let base = CHANNEL_PURPOSE_FILENAMES[parsed.channel]?.[parsed.purpose] ?? 'asset';
    if (parsed.channel === '4' && parsed.purpose === '1' && originalFilename) {
        base = originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_');
    }
    return `grf/${grfId}/${base}.${ext}`;
}
// ── MIME lookup ───────────────────────────────────────────────────────────────
function grfMimeType(grfId) {
    return parseGrfId(grfId).mimeType;
}
// ── Counter key ───────────────────────────────────────────────────────────────
exports.GRF_COUNTER_KEY = 'global';
exports.GRF_PACKET_SLOTS = {
    /** Background image used in the builder — input_build · image · assets · background · png */
    background: {
        assetClass: '1', mediaType: '1',
        channel: '4', purpose: '3', format: '1',
    },
    /** QR code standalone — output_artifact · image · print · qr_standalone · png */
    qrStandalone: {
        assetClass: '2', mediaType: '1',
        channel: '1', purpose: '2', format: '1',
    },
    /** QR composite (canvas design) — output_artifact · image · print · qr_composite · png */
    qrComposite: {
        assetClass: '2', mediaType: '1',
        channel: '1', purpose: '1', format: '1',
    },
    /** Landing page snapshot — output_artifact · image · url · snapshot · png */
    urlSnapshot: {
        assetClass: '2', mediaType: '1',
        channel: '3', purpose: '1', format: '1',
    },
};
// ── Direct aliases ────────────────────────────────────────────────────────────
exports.isValidGraphicId = isValidGrfId;
exports.assertValidGraphicId = assertValidGrfId;
exports.parseGraphicId = parseGrfId;
//# sourceMappingURL=graphicCodes.js.map