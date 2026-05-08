"use strict";
/**
 * shared/qrgCodes.ts
 *
 * QRG variant suffix tables — physical item identification.
 *
 * Variant suffix format: [TSS][LL][CC]  (7 digits, barcode/tracking only)
 *   T   = 1-digit size type  (0=One Size, 1=Adult Alpha, 2=Adult Numeric/waist, …)
 *   SS  = 2-digit size within type  (01–10; "00" only for One Size / T=0)
 *   LL  = 2-digit length code  (00=no length; first digit=length type, second=position)
 *         LL is only populated when T=2 (Adult Numeric/waist); all other types use 00.
 *   CC  = 2-digit color code  (01=Black, 02=White, 03=Navy, …)
 *
 * T — size type digit:
 *   0 = One Size / unknown
 *   1 = Adult Alpha      (XXS–5XL)
 *   2 = Adult Numeric    (waist 28"–46")
 *   3 = Children Alpha   (Youth XS–XXL)
 *   4 = Children Numeric (sizes 6–20)
 *   5 = Toddler Alpha    (NB, 3M–24M infant months)
 *   6 = Toddler Numeric  (2T–6T)
 *
 * LL — length type digit (first L):
 *   0 = No length (default for all non-waist sizes)
 *   1 = Alpha length  (Short / Regular / Long / Extra Long)
 *   2 = Numeric inseam  (28"–36")
 *
 * These codes are barcode-only — never in URLs or packet names.
 * Full QRG code format: QRG-[STNNN]-[C]-[NNNNNN]-[TSSLLCC]
 * Example: QRG-11101-I-000001-1050001  (Adult Alpha L=05, No Length, Black=01)
 *
 * Context letter [C]: I=Internal, M=Member, E=External, O=Owner
 * Providers (Printify/Printful) are suppliers only — NEVER in [C].
 *
 * Rules:
 *   - Codes are GLOBAL and FIXED — never renumber once assigned
 *   - Aliases (e.g. "Gray" / "Grey") share the same color code
 *   - Unknown sizes → "000", unknown lengths → "00", unknown colors → "00"
 *   - For children/toddler alpha sizes prefix with "Youth " / "Kids " to disambiguate from adult alpha
 *   - Not all products support all sizes/colors
 *   - Do not use letters (S, M, L, XL) in IDs — always numeric
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PARENT_CATEGORY_LABELS = exports.getSizeDigit = exports.COLOR_CODE_MAP = exports.LENGTH_CODE_MAP = exports.LENGTH_TYPES = exports.SIZE_CODE_MAP = exports.SIZE_TYPES = void 0;
exports.getSizeCode = getSizeCode;
exports.getSizeType = getSizeType;
exports.getSizeTypeEntry = getSizeTypeEntry;
exports.getLengthCode = getLengthCode;
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
exports.isValidQrgBase = isValidQrgBase;
exports.isValidQrgFull = isValidQrgFull;
exports.isValidQrgCode = isValidQrgCode;
exports.assertValidQrgCode = assertValidQrgCode;
exports.getQrgContext = getQrgContext;
// ── Size type table (T digit) ─────────────────────────────────────────────────
// T = first digit of the TSSLLCC suffix.
// codes = { SS: label } where SS is the 2-digit position within that type.
exports.SIZE_TYPES = {
    '0': {
        label: 'One Size',
        description: 'One size fits all / no size applicable',
        codes: { '00': 'One Size' },
    },
    '1': {
        label: 'Adult Alpha',
        description: 'Standard adult letter sizing (XXS–5XL)',
        codes: {
            '01': 'XXS', '02': 'XS', '03': 'S', '04': 'M', '05': 'L',
            '06': 'XL', '07': '2XL', '08': '3XL', '09': '4XL', '10': '5XL',
        },
    },
    '2': {
        label: 'Adult Numeric',
        description: 'Waist sizing for adults (28"–46"). LL length codes apply only to this type.',
        codes: {
            '01': '28"', '02': '30"', '03': '32"', '04': '34"', '05': '36"',
            '06': '38"', '07': '40"', '08': '42"', '09': '44"', '10': '46"',
        },
    },
    '3': {
        label: 'Children Alpha',
        description: 'Youth / kids letter sizing (XS–XXL)',
        codes: {
            '01': 'Youth XS', '02': 'Youth S', '03': 'Youth M',
            '04': 'Youth L', '05': 'Youth XL', '06': 'Youth XXL',
        },
    },
    '4': {
        label: 'Children Numeric',
        description: 'Numeric sizing for children (6–20)',
        codes: {
            '01': '6', '02': '8', '03': '10', '04': '12',
            '05': '14', '06': '16', '07': '18', '08': '20',
        },
    },
    '5': {
        label: 'Toddler Alpha',
        description: 'Infant month-based sizing (NB, 3M–24M)',
        codes: {
            '01': 'NB', '02': '3M', '03': '6M', '04': '9M',
            '05': '12M', '06': '18M', '07': '24M',
        },
    },
    '6': {
        label: 'Toddler Numeric',
        description: 'T-sizing for toddlers (2T–6T)',
        codes: {
            '01': '2T', '02': '3T', '03': '4T', '04': '5T', '05': '6T',
        },
    },
};
// ── Size codes (3 chars: TSS) ─────────────────────────────────────────────────
// GLOBAL FIXED — never change these assignments.
// T = size type digit (0–6), SS = 2-digit position within that type.
// Returns "000" for unknown / one-size.
exports.SIZE_CODE_MAP = {
    // ── One Size (T=0, SS=00 → "000") ─────────────────────────────────────────
    "One Size": "000", "OSFA": "000", "OS": "000", "One Size Fits All": "000",
    // ── Adult Alpha (T=1, SS=01–10) ────────────────────────────────────────────
    "XXS": "101", "Extra Extra Small": "101",
    "XS": "102", "Extra Small": "102",
    "S": "103", "Small": "103",
    "M": "104", "Medium": "104",
    "L": "105", "Large": "105",
    "XL": "106", "Extra Large": "106", "Extra-Large": "106",
    "2XL": "107", "XXL": "107", "2X": "107",
    "3XL": "108", "XXXL": "108", "3X": "108",
    "4XL": "109", "XXXXL": "109", "4X": "109",
    "5XL": "110", "XXXXXL": "110", "5X": "110",
    // ── Adult Numeric / Waist (T=2, SS=01–10) ──────────────────────────────────
    // Prefix with waist number or "W" suffix; length (LL) applies to this type only.
    '28': "201", '28W': "201", '28"': "201",
    '30': "202", '30W': "202", '30"': "202",
    '32': "203", '32W': "203", '32"': "203",
    '34': "204", '34W': "204", '34"': "204",
    '36': "205", '36W': "205", '36"': "205",
    '38': "206", '38W': "206", '38"': "206",
    '40': "207", '40W': "207", '40"': "207",
    '42': "208", '42W': "208", '42"': "208",
    '44': "209", '44W': "209", '44"': "209",
    '46': "210", '46W': "210", '46"': "210",
    // ── Children Alpha (T=3, SS=01–06) ─────────────────────────────────────────
    // Prefix with "Youth " or "Kids " to disambiguate from adult alpha.
    "Youth XS": "301", "Kids XS": "301",
    "Youth S": "302", "Kids S": "302",
    "Youth M": "303", "Kids M": "303",
    "Youth L": "304", "Kids L": "304",
    "Youth XL": "305", "Kids XL": "305",
    "Youth XXL": "306", "Kids XXL": "306",
    // ── Children Numeric (T=4, SS=01–08) ───────────────────────────────────────
    "Size 6": "401", "6": "401",
    "Size 8": "402", "8": "402",
    "Size 10": "403", "10": "403",
    "Size 12": "404", "12": "404",
    "Size 14": "405", "14": "405",
    "Size 16": "406", "16": "406",
    "Size 18": "407", "18": "407",
    "Size 20": "408", "20": "408",
    // ── Toddler Alpha (T=5, SS=01–07) ──────────────────────────────────────────
    "NB": "501", "Newborn": "501",
    "3M": "502", "3 Months": "502",
    "6M": "503", "6 Months": "503",
    "9M": "504", "9 Months": "504",
    "12M": "505", "12 Months": "505",
    "18M": "506", "18 Months": "506",
    "24M": "507", "24 Months": "507",
    // ── Toddler Numeric (T=6, SS=01–05) ────────────────────────────────────────
    "2T": "601",
    "3T": "602",
    "4T": "603",
    "5T": "604",
    "6T": "605",
};
// ── Length type table (first L digit) ────────────────────────────────────────
// LL is only populated when T=2 (Adult Numeric/waist). All other types use "00".
// codes = { LL: label } where LL is the full 2-digit length code.
exports.LENGTH_TYPES = {
    '0': {
        label: 'No Length',
        description: 'No length dimension (default for all non-waist sizes)',
        codes: { '00': 'N/A' },
    },
    '1': {
        label: 'Alpha Length',
        description: 'Letter-based length (Short / Regular / Long / Extra Long)',
        codes: {
            '11': 'Short', '12': 'Regular', '13': 'Long', '14': 'Extra Long',
        },
    },
    '2': {
        label: 'Numeric Inseam',
        description: 'Inseam length in inches (28"–36")',
        codes: {
            '21': '28"', '22': '30"', '23': '32"', '24': '34"', '25': '36"',
        },
    },
};
// ── Length codes (2 chars: LL) ────────────────────────────────────────────────
// GLOBAL FIXED — never change these assignments.
// First L = length type, second L = position within type.
// "00" = no length (default — use for all non-waist size types).
exports.LENGTH_CODE_MAP = {
    // ── No length ──────────────────────────────────────────────────────────────
    "": "00",
    "None": "00",
    "N/A": "00",
    // ── Alpha length (first L = 1) ─────────────────────────────────────────────
    "Short": "11", "S": "11",
    "Regular": "12", "R": "12",
    "Long": "13", "L": "13",
    "Extra Long": "14", "XL": "14",
    // ── Numeric inseam (first L = 2) ──────────────────────────────────────────
    '28in': "21", '28"': "21", "Inseam 28": "21",
    '30in': "22", '30"': "22", "Inseam 30": "22",
    '32in': "23", '32"': "23", "Inseam 32": "23",
    '34in': "24", '34"': "24", "Inseam 34": "24",
    '36in': "25", '36"': "25", "Inseam 36": "25",
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
/**
 * Returns the 3-char TSS size code (e.g. "105" = Adult Alpha L), or "000" for unknown/one-size.
 * T = size type digit, SS = 2-digit position within that type.
 * Use "Youth S" / "Kids S" etc. for children alpha to disambiguate from adult alpha.
 */
function getSizeCode(size) {
    if (!size)
        return "000";
    const trimmed = size.trim();
    const direct = exports.SIZE_CODE_MAP[trimmed];
    if (direct !== undefined)
        return direct;
    for (const [key, val] of Object.entries(exports.SIZE_CODE_MAP)) {
        if (key.toUpperCase() === trimmed.toUpperCase())
            return val;
    }
    return "000";
}
/** Returns the T digit (size type) from a 3-char TSS code, or null if invalid. */
function getSizeType(tssCode) {
    if (tssCode === '000')
        return '0';
    if (/^\d{3}$/.test(tssCode))
        return tssCode[0];
    return null;
}
/** Returns the SIZE_TYPES entry for a given TSS code, or null if unrecognised. */
function getSizeTypeEntry(tssCode) {
    const typeDigit = getSizeType(tssCode);
    if (!typeDigit)
        return null;
    return exports.SIZE_TYPES[typeDigit] ?? null;
}
/**
 * Returns the 2-char LL length code (e.g. "12" = Regular), or "00" for no length.
 * LL should only be non-00 when T=2 (Adult Numeric / waist).
 */
function getLengthCode(length) {
    if (!length)
        return "00";
    const trimmed = length.trim();
    const direct = exports.LENGTH_CODE_MAP[trimmed];
    if (direct !== undefined)
        return direct;
    for (const [key, val] of Object.entries(exports.LENGTH_CODE_MAP)) {
        if (key.toUpperCase() === trimmed.toUpperCase())
            return val;
    }
    return "00";
}
/** @deprecated Use getSizeCode */
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
 * Build the 7-character variant suffix [TSS][LL][CC].
 * Returns null only if all inputs are empty/null.
 * LL should only be non-"00" when size type T=2 (Adult Numeric/waist).
 * Example: buildVariantSuffix("L", null, "Black")     → "1050001"
 *          buildVariantSuffix("34W", "Regular", "Navy") → "2041201"
 */
function buildVariantSuffix(size, length, color) {
    if (!size && !length && !color)
        return null;
    const tss = getSizeCode(size ?? "");
    const ll = getLengthCode(length ?? "");
    const cc = getColorCode(color ?? "");
    return `${tss}${ll}${cc}`;
}
// ── QRG Identity Helpers ──────────────────────────────────────────────────────
// Format: STNNN where S=1-6 (super-category), T=1-9 (type), NNN=001-999 (item)
// docId format: qrg_STNNN  e.g. qrg_11101
// Full QRG code: QRG-[STNNN]-[C]-[NNNNNN]-[TSSLLCC]
// Context [C]: I=Internal (admin), M=Member (user), E=External (API/partner), O=Owner (post-purchase)
// Providers (Printify/Printful) are suppliers only — never in [C].
// Design/build data is NOT embedded in the QRG code — stored as a separate field or linked asset.
const QRG_BLANK_ID_RE = /^[1-6][1-9][0-9]{3}$/;
const QRG_DOC_ID_RE = /^qrg_[1-6][1-9][0-9]{3}$/;
const QRG_FULL_CODE_RE = /^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})-(\d{7})$/;
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
/** Build the full QRG-[STNNN]-[C]-[NNNNNN]-[TSSLLCC] string */
function buildFullQrgCode(parts) {
    const { qrgBlankId, contextCode, instanceNumber, sizeCode, lengthCode, colorCode } = parts;
    if (!isValidQrgBlankId(qrgBlankId))
        throw new Error(`Invalid qrgBlankId: ${qrgBlankId}`);
    if (!/^[IMEO]$/.test(contextCode))
        throw new Error(`Invalid contextCode: ${contextCode}. Must be I, M, E, or O.`);
    const iiiiii = String(instanceNumber).padStart(6, "0");
    return `QRG-${qrgBlankId}-${contextCode}-${iiiiii}-${sizeCode}${lengthCode}${colorCode}`;
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
        sizeCode: m[4].slice(0, 3), // TSS
        lengthCode: m[4].slice(3, 5), // LL
        colorCode: m[4].slice(5, 7), // CC
    };
}
// ── QRG Code Validation Helpers ───────────────────────────────────────────────
// Use these everywhere — do not hand-roll QRG regexes outside this file.
const QRG_BASE_CODE_RE = /^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})$/;
/** Validates the base QRG format: QRG-[STNNN]-[C]-[NNNNNN] */
function isValidQrgBase(code) {
    return QRG_BASE_CODE_RE.test(String(code ?? ''));
}
/** Validates the full QRG format: QRG-[STNNN]-[C]-[NNNNNN]-[SSCC] */
function isValidQrgFull(code) {
    return QRG_FULL_CODE_RE.test(String(code ?? ''));
}
/** Validates either base or full QRG format */
function isValidQrgCode(code) {
    return isValidQrgBase(code) || isValidQrgFull(code);
}
/**
 * Throws if code is not a valid QRG base or full code.
 * Use before any marketplace action that requires a real QRG identity.
 */
function assertValidQrgCode(code, context) {
    if (!isValidQrgCode(code)) {
        const prefix = context ? `[${context}] ` : '';
        throw new Error(`${prefix}Marketplace action blocked: valid QRG identity required. Got: ${String(code ?? 'undefined')}`);
    }
}
/** Returns the context letter (I/M/E/O) from a base or full QRG code, or null if invalid */
function getQrgContext(code) {
    const s = String(code ?? '');
    const baseMatch = QRG_BASE_CODE_RE.exec(s);
    if (baseMatch)
        return baseMatch[2];
    const fullMatch = QRG_FULL_CODE_RE.exec(s);
    if (fullMatch)
        return fullMatch[2];
    return null;
}
//# sourceMappingURL=qrgCodes.js.map