"use strict";
/**
 * shared/qrgVariantMappings.ts
 *
 * Canonical provider → QRG size/color mapping for client-side use.
 *
 * KEY RULE: getQrgSizeCode and getQrgColorCode return null if a value cannot
 * be mapped. The caller MUST track these as unmapped — never silently ignore.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLOR_LABELS = exports.SIZE_LABELS = exports.COLOR_CODE_MAP = exports.SIZE_CODE_MAP = void 0;
exports.normalizeProviderSize = normalizeProviderSize;
exports.normalizeProviderColor = normalizeProviderColor;
exports.getQrgSizeCode = getQrgSizeCode;
exports.getQrgColorCode = getQrgColorCode;
exports.buildVariantCode = buildVariantCode;
exports.parseVariantCode = parseVariantCode;
var qrgCodes_1 = require("./qrgCodes");
Object.defineProperty(exports, "SIZE_CODE_MAP", { enumerable: true, get: function () { return qrgCodes_1.SIZE_CODE_MAP; } });
Object.defineProperty(exports, "COLOR_CODE_MAP", { enumerable: true, get: function () { return qrgCodes_1.COLOR_CODE_MAP; } });
// ── Label maps (code → canonical label) ──────────────────────────────────────
// SIZE_LABELS keyed by 3-char TSS code (e.g. '105' → 'L').
const qrgCodes_2 = require("./qrgCodes");
exports.SIZE_LABELS = (() => {
    const labels = { '000': 'One Size' };
    for (const [t, type] of Object.entries(qrgCodes_2.SIZE_TYPES)) {
        if (t === '0')
            continue;
        for (const [ss, label] of Object.entries(type.codes)) {
            labels[`${t}${ss}`] = label;
        }
    }
    return labels;
})();
const qrgCodes_3 = require("./qrgCodes");
exports.COLOR_LABELS = (() => {
    const labels = {};
    for (const [name, code] of Object.entries(qrgCodes_3.COLOR_CODE_MAP)) {
        if (!labels[code])
            labels[code] = name;
    }
    return labels;
})();
// ── Normalization ─────────────────────────────────────────────────────────────
function normalizeProviderSize(text) {
    return (text || '').trim().replace(/[\s_-]+/g, ' ');
}
function normalizeProviderColor(text) {
    return (text || '').trim().replace(/[\s_-]+/g, ' ');
}
// ── Code lookups — return null for unmapped values ────────────────────────────
const qrgCodes_4 = require("./qrgCodes");
/**
 * Returns QRG size code (3-char TSS, e.g. "105") or null if unmapped.
 */
function getQrgSizeCode(sizeText) {
    if (!sizeText)
        return null;
    const normalized = normalizeProviderSize(sizeText);
    if (qrgCodes_4.SIZE_CODE_MAP[normalized] !== undefined)
        return qrgCodes_4.SIZE_CODE_MAP[normalized];
    const upper = normalized.toUpperCase();
    for (const [key, code] of Object.entries(qrgCodes_4.SIZE_CODE_MAP)) {
        if (key.toUpperCase() === upper)
            return code;
    }
    const stripped = normalized.replace(/^(size|us|uk)\s+/i, '').trim();
    if (stripped && qrgCodes_4.SIZE_CODE_MAP[stripped] !== undefined)
        return qrgCodes_4.SIZE_CODE_MAP[stripped];
    for (const [key, code] of Object.entries(qrgCodes_4.SIZE_CODE_MAP)) {
        if (key.toUpperCase() === stripped.toUpperCase())
            return code;
    }
    return null;
}
/**
 * Returns QRG color code ("01"–"99") or null if unmapped.
 */
function getQrgColorCode(colorText) {
    if (!colorText)
        return null;
    const normalized = normalizeProviderColor(colorText);
    if (qrgCodes_3.COLOR_CODE_MAP[normalized] !== undefined)
        return qrgCodes_3.COLOR_CODE_MAP[normalized];
    const lower = normalized.toLowerCase();
    for (const [key, code] of Object.entries(qrgCodes_3.COLOR_CODE_MAP)) {
        if (key.toLowerCase() === lower)
            return code;
    }
    for (const [key, code] of Object.entries(qrgCodes_3.COLOR_CODE_MAP)) {
        if (key.length >= 4 && lower.length >= 4) {
            if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower))
                return code;
        }
    }
    return null;
}
// ── Variant code builders ─────────────────────────────────────────────────────
/** Build the 7-char TSSLLCC variant code. */
function buildVariantCode(sizeCode, lengthCode, colorCode) {
    return `${sizeCode}${lengthCode}${colorCode}`;
}
function parseVariantCode(tssllcc) {
    if (!/^\d{7}$/.test(tssllcc))
        return null;
    const sizeCode = tssllcc.slice(0, 3); // TSS
    const lengthCode = tssllcc.slice(3, 5); // LL
    const colorCode = tssllcc.slice(5, 7); // CC
    return {
        sizeCode,
        lengthCode,
        colorCode,
        sizeLabel: exports.SIZE_LABELS[sizeCode] ?? sizeCode,
        colorLabel: exports.COLOR_LABELS[colorCode] ?? colorCode,
    };
}
//# sourceMappingURL=qrgVariantMappings.js.map