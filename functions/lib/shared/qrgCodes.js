"use strict";
/**
 * shared/qrgCodes.ts
 *
 * QRG variant suffix tables — physical item identification.
 *
 * Variant suffix format: [SS][CC]  (4 digits, barcode/tracking only)
 *   SS = 2-digit size code  (01=XXS … 10=5XL)
 *   CC = 2-digit color code (01=Black, 02=White, 03=Navy, …)
 *
 * These codes are barcode-only — never in URLs or packet names.
 * Full QRG code format: QRG-[STNNN]-[C]-[IIIIII]-[SSCC]
 * Example: QRG-11101-I-000001-0501  (L=05, Black=01)
 *
 * Context letter [C]: I=Internal, M=Member, E=External, O=Owner
 * Providers (Printify/Printful) are suppliers only — NEVER in [C].
 *
 * Rules:
 *   - Codes are GLOBAL and FIXED — never renumber once assigned
 *   - Aliases (e.g. "Gray" / "Grey") share the same code
 *   - Unknown sizes → "00", unknown colors → "00"
 *   - Not all products support all sizes/colors
 *   - Do not use letters (S, M, L, XL) in IDs — always numeric
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARENT_CATEGORY_LABELS = exports.getSizeDigit = exports.COLOR_CODE_MAP = exports.SIZE_CODE_MAP = void 0;
exports.getSizeCode = getSizeCode;
exports.getColorCode = getColorCode;
exports.buildVariantSuffix = buildVariantSuffix;
exports.isValidQrgBlankId = isValidQrgBlankId;
exports.isValidMasterCatalogDocId = isValidMasterCatalogDocId;
exports.buildMasterCatalogDocId = buildMasterCatalogDocId;
exports.parseMasterCatalogDocId = parseMasterCatalogDocId;
exports.getQrgParentCategory = getQrgParentCategory;
exports.getQrgProductType = getQrgProductType;
exports.getQrgItemNumber = getQrgItemNumber;
exports.normalizeQrgBlankId = normalizeQrgBlankId;
exports.buildFullQrgCode = buildFullQrgCode;
exports.parseFullQrgCode = parseFullQrgCode;
// ── Size codes (2 digits, 01–10) ─────────────────────────────────────────────
// GLOBAL FIXED — never change these assignments.
exports.SIZE_CODE_MAP = {
    "XXS": "01", "Extra Extra Small": "01",
    "XS": "02", "Extra Small": "02",
    "S": "03", "Small": "03",
    "M": "04", "Medium": "04",
    "L": "05", "Large": "05",
    "XL": "06", "Extra Large": "06", "Extra-Large": "06",
    "2XL": "07", "XXL": "07", "2X": "07",
    "3XL": "08", "XXXL": "08", "3X": "08",
    "4XL": "09", "XXXXL": "09", "4X": "09",
    "5XL": "10", "XXXXXL": "10", "5X": "10",
    // One Size
    "One Size": "00", "OSFA": "00", "OS": "00",
    // Numeric youth/apparel sizes mapped to nearest standard
    "4": "01", "6": "01",
    "8": "02",
    "10": "03", "12": "04", "14": "05", "16": "06",
};
// ── Color codes (2 digits, 01–99) ─────────────────────────────────────────────
// GLOBAL FIXED — never change these assignments.
// Canonical anchors: Black=01, White=02, Navy=03, Red=04, Royal Blue=05
exports.COLOR_CODE_MAP = {
    // ── Blacks (01) ───────────────────────────────────────────────────────────
    "Black": "01", "Black Heather": "01", "Vintage Black": "01", "Oxblood Black": "01",
    // ── Whites (02) ───────────────────────────────────────────────────────────
    "White": "02", "Solid White Blend": "02", "Vintage White": "02",
    // ── Navy (03) ─────────────────────────────────────────────────────────────
    "Navy": "03", "Navy Blue": "03",
    // ── Red (04) ──────────────────────────────────────────────────────────────
    "Red": "04",
    // ── Royal Blue (05) ───────────────────────────────────────────────────────
    "Royal Blue": "05", "True Royal": "05",
    // ── Gray / Grey family (06–12) ────────────────────────────────────────────
    "Gray": "06", "Grey": "06",
    "Heather Gray": "07", "Heather Grey": "07", "Athletic Heather": "07",
    "Sport Gray": "07", "Sport Grey": "07",
    "Charcoal": "08",
    "Dark Heather": "09", "Asphalt": "09",
    "Dark Grey": "10", "Dark Grey Heather": "10", "Heather Slate": "10",
    "Heather Cool Grey": "11",
    "Ash": "12", "Silver": "12",
    // ── Creams / Naturals (13–15) ─────────────────────────────────────────────
    "Cream": "13", "Soft Cream": "13", "Natural": "13", "Heather Natural": "13",
    "Sand": "14", "Heather Sand Dune": "14", "Pebble": "14", "Heather Dust": "14",
    "Tan": "15", "Toast": "15",
    // ── Navy variants (16) ────────────────────────────────────────────────────
    "Heather Navy": "16", "Heather Midnight Navy": "16",
    // ── Blues (17–23) ─────────────────────────────────────────────────────────
    "Heather True Royal": "17",
    "Sapphire": "18",
    "Steel Blue": "19", "Ocean Blue": "19",
    "Heather Columbia Blue": "20", "Heather Carolina Blue": "20",
    "Light Blue": "21", "Baby Blue": "21",
    "Heather Ice Blue": "22", "Heather Prism Ice Blue": "22", "Heather Prism Dusty Blue": "22",
    "Blue": "23",
    // ── Teals / Aquas (24–27) ─────────────────────────────────────────────────
    "Teal": "24",
    "Heather Deep Teal": "25",
    "Aqua": "26", "Heather Aqua": "26",
    "Turquoise": "27",
    // ── Greens (28–37) ────────────────────────────────────────────────────────
    "Green": "28",
    "Mint": "29", "Heather Mint": "29", "Heather Prism Mint": "29",
    "Sage": "30", "Leaf": "30",
    "Heather Grass Green": "31",
    "Heather Emerald": "32",
    "Kelly": "33", "Kelly Green": "33", "Irish Green": "33", "Heather Kelly": "33",
    "Olive": "34", "Heather Olive": "34",
    "Military Green": "35", "Army": "35",
    "Forest": "36", "Forest Green": "36", "Heather Forest": "36",
    "Safety Green": "37",
    // ── Yellows / Golds / Oranges (38–41) ────────────────────────────────────
    "Yellow": "38", "Daisy": "38",
    "Gold": "39", "Mustard": "39", "Heather Yellow Gold": "39",
    "Autumn": "40", "Heather Autumn": "40",
    "Orange": "41", "Burnt Orange": "41", "Tennessee Orange": "41",
    "Heather Orange": "41", "Safety Orange": "41",
    // ── Reds / Maroons (42–46) ────────────────────────────────────────────────
    "Cardinal": "42",
    "Maroon": "43",
    "Burgundy": "44", "Berry": "44",
    "Heather Red": "45",
    "Heather Raspberry": "46",
    // ── Pinks (47–49) ─────────────────────────────────────────────────────────
    "Pink": "47", "Soft Pink": "47", "Charity Pink": "47",
    "Heather Clay": "48", "Heather Prism Peach": "48",
    "Heather Mauve": "49", "Mauve": "49",
    // ── Purples / Lavenders (50–52) ───────────────────────────────────────────
    "Purple": "50", "Team Purple": "50", "Heather Team Purple": "50", "Heather Orchid": "50",
    "Lilac": "51", "Heather Prism Lilac": "51",
    "Heather Prism Dusty Lavender": "52",
    // ── Browns (53) ───────────────────────────────────────────────────────────
    "Brown": "53", "Heather Brown": "53",
    // ── 54–98 reserved for future colors ─────────────────────────────────────
    // 99 = Reserved
};
// ── Lookup helpers ─────────────────────────────────────────────────────────────
/** Returns the 2-digit size code (01–10), or "00" for unknown/one-size. */
function getSizeCode(size) {
    if (!size)
        return "00";
    const trimmed = size.trim();
    const direct = exports.SIZE_CODE_MAP[trimmed];
    if (direct !== undefined)
        return direct;
    for (const [key, val] of Object.entries(exports.SIZE_CODE_MAP)) {
        if (key.toUpperCase() === trimmed.toUpperCase())
            return val;
    }
    return "00";
}
/** @deprecated Use getSizeCode — now returns 2-digit string */
exports.getSizeDigit = getSizeCode;
/** Returns the 2-digit color code (01–99), or "00" for unknown colors. */
function getColorCode(color) {
    if (!color)
        return "00";
    const trimmed = color.trim();
    const direct = exports.COLOR_CODE_MAP[trimmed];
    if (direct !== undefined)
        return direct;
    for (const [key, val] of Object.entries(exports.COLOR_CODE_MAP)) {
        if (key.toLowerCase() === trimmed.toLowerCase())
            return val;
    }
    return "00";
}
/**
 * Build the 4-character variant suffix [SS][CC].
 * Returns null only if both inputs are empty/null.
 * Example: buildVariantSuffix("L", "Black") → "0501"
 *          buildVariantSuffix("M", "Navy")  → "0403"
 */
function buildVariantSuffix(size, color) {
    if (!size && !color)
        return null;
    const ss = getSizeCode(size ?? "");
    const cc = getColorCode(color ?? "");
    return `${ss}${cc}`;
}
// ── QRG Identity Helpers ──────────────────────────────────────────────────────
// Format: STNNN where S=1-6 (super-category), T=1-9 (type), NNN=001-999 (item)
// docId format: qrg_STNNN  e.g. qrg_11101
// Full QRG code: QRG-[STNNN]-[C]-[IIIIII]-[SSCC]
// Context [C]: I=Internal (admin), M=Member (user), E=External (API/partner), O=Owner (post-purchase)
// Providers (Printify/Printful) are suppliers only — never in [C].
// Design/build data is NOT embedded in the QRG code — stored as a separate field or linked asset.
const QRG_BLANK_ID_RE = /^[1-6][1-9][0-9]{3}$/;
const QRG_DOC_ID_RE = /^qrg_[1-6][1-9][0-9]{3}$/;
const QRG_FULL_CODE_RE = /^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})-(\d{4})$/;
exports.PARENT_CATEGORY_LABELS = {
    "1": "Apparel",
    "2": "Houseware",
    "3": "Print & Display",
    "4": "Accessories",
    "5": "Pet Products",
    "6": "Holiday & Seasonal",
};
/** Validates STNNN format: S=1-6, T=1-9, NNN=000-999 */
function isValidQrgBlankId(value) {
    return QRG_BLANK_ID_RE.test(String(value ?? ""));
}
/** Validates qrg_STNNN format */
function isValidMasterCatalogDocId(value) {
    return QRG_DOC_ID_RE.test(String(value ?? ""));
}
/** "11101" → "qrg_11101" */
function buildMasterCatalogDocId(qrgBlankId) {
    if (!isValidQrgBlankId(qrgBlankId))
        throw new Error(`Invalid qrgBlankId: ${qrgBlankId}`);
    return `qrg_${qrgBlankId}`;
}
/** "qrg_11101" → parsed parts or null */
function parseMasterCatalogDocId(docId) {
    if (!isValidMasterCatalogDocId(docId))
        return null;
    const stnnn = docId.slice(4);
    return {
        qrgBlankId: stnnn,
        parentCategory: stnnn[0],
        parentCategoryLabel: exports.PARENT_CATEGORY_LABELS[stnnn[0]] ?? "Unknown",
        productType: stnnn[1],
        itemNumber: stnnn.slice(2),
    };
}
/** Returns S digit (super-category) or null */
function getQrgParentCategory(qrgBlankId) {
    return isValidQrgBlankId(qrgBlankId) ? qrgBlankId[0] : null;
}
/** Returns T digit (product type) or null */
function getQrgProductType(qrgBlankId) {
    return isValidQrgBlankId(qrgBlankId) ? qrgBlankId[1] : null;
}
/** Returns NNN segment (3-digit item number) or null */
function getQrgItemNumber(qrgBlankId) {
    return isValidQrgBlankId(qrgBlankId) ? qrgBlankId.slice(2) : null;
}
/** Normalizes a value to STNNN string, or null if invalid */
function normalizeQrgBlankId(value) {
    const s = String(value ?? "").trim();
    return isValidQrgBlankId(s) ? s : null;
}
/** Build the full QRG-[STNNN]-[C]-[IIIIII]-[SSCC] string */
function buildFullQrgCode(parts) {
    const { qrgBlankId, contextCode, instanceNumber, sizeCode, colorCode } = parts;
    if (!isValidQrgBlankId(qrgBlankId))
        throw new Error(`Invalid qrgBlankId: ${qrgBlankId}`);
    if (!/^[IMEO]$/.test(contextCode))
        throw new Error(`Invalid contextCode: ${contextCode}. Must be I, M, E, or O.`);
    const iiiiii = String(instanceNumber).padStart(6, "0");
    return `QRG-${qrgBlankId}-${contextCode}-${iiiiii}-${sizeCode}${colorCode}`;
}
/** Parse a full QRG code, returns null if format is invalid */
function parseFullQrgCode(code) {
    const m = QRG_FULL_CODE_RE.exec(code);
    if (!m)
        return null;
    return {
        qrgBlankId: m[1],
        contextCode: m[2],
        instanceNumber: m[3],
        sizeCode: m[4].slice(0, 2),
        colorCode: m[4].slice(2, 4),
    };
}
//# sourceMappingURL=qrgCodes.js.map