/**
 * shared/qrgCodes.ts
 *
 * QRG variant suffix tables — physical item identification.
 *
 * Variant suffix format: [SS][CC]  (4 digits, barcode/tracking only)
 *   SS = 2-digit size code — first digit = size type, second digit = size position
 *   CC = 2-digit color code (01=Black, 02=White, 03=Navy, …)
 *
 * SS size type digit (first S):
 *   0 = One Size / unknown
 *   1 = Adult Alpha    (XXS–5XL)
 *   2 = Adult Numeric  (waist 28"–46")
 *   3 = Children Alpha (Youth XS–XXL)
 *   4 = Children Numeric (sizes 6–20)
 *   5 = Toddler Alpha  (NB, 3M–24M infant months)
 *   6 = Toddler Numeric (2T–6T)
 *
 * These codes are barcode-only — never in URLs or packet names.
 * Full QRG code format: QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]
 * Example: QRG-11101-I-000001-1401  (Adult Alpha L=14, Black=01)
 *
 * Context letter [C]: I=Internal, M=Member, E=External, O=Owner
 * Providers (Printify/Printful) are suppliers only — NEVER in [C].
 *
 * Rules:
 *   - Codes are GLOBAL and FIXED — never renumber once assigned
 *   - Aliases (e.g. "Gray" / "Grey") share the same color code
 *   - Unknown sizes → "00", unknown colors → "00"
 *   - For children/toddler alpha sizes prefix with "Youth " / "Kids " to disambiguate from adult alpha
 *   - Not all products support all sizes/colors
 *   - Do not use letters (S, M, L, XL) in IDs — always numeric
 */

// ── Size type table ───────────────────────────────────────────────────────────
// First digit of SS — defines the sizing system used.

export const SIZE_TYPES: Record<string, { label: string; description: string; codes: Record<string, string> }> = {
  '0': {
    label: 'One Size',
    description: 'One size fits all / no size applicable',
    codes: { '00': 'One Size' },
  },
  '1': {
    label: 'Adult Alpha',
    description: 'Standard adult letter sizing (XXS–5XL)',
    codes: {
      '10': 'XXS', '11': 'XS', '12': 'S', '13': 'M', '14': 'L',
      '15': 'XL', '16': '2XL', '17': '3XL', '18': '4XL', '19': '5XL',
    },
  },
  '2': {
    label: 'Adult Numeric',
    description: 'Waist / numeric sizing for adults (28"–46")',
    codes: {
      '20': '28"', '21': '30"', '22': '32"', '23': '34"', '24': '36"',
      '25': '38"', '26': '40"', '27': '42"', '28': '44"', '29': '46"',
    },
  },
  '3': {
    label: 'Children Alpha',
    description: 'Youth / kids letter sizing (XS–XXL)',
    codes: {
      '31': 'Youth XS', '32': 'Youth S', '33': 'Youth M',
      '34': 'Youth L', '35': 'Youth XL', '36': 'Youth XXL',
    },
  },
  '4': {
    label: 'Children Numeric',
    description: 'Numeric sizing for children (6–20)',
    codes: {
      '41': '6', '42': '8', '43': '10', '44': '12',
      '45': '14', '46': '16', '47': '18', '48': '20',
    },
  },
  '5': {
    label: 'Toddler Alpha',
    description: 'Infant month-based sizing (NB, 3M–24M)',
    codes: {
      '50': 'NB', '51': '3M', '52': '6M', '53': '9M',
      '54': '12M', '55': '18M', '56': '24M',
    },
  },
  '6': {
    label: 'Toddler Numeric',
    description: 'T-sizing for toddlers (2T–6T)',
    codes: {
      '61': '2T', '62': '3T', '63': '4T', '64': '5T', '65': '6T',
    },
  },
};

// ── Size codes (2 digits) ─────────────────────────────────────────────────────
// GLOBAL FIXED — never change these assignments.
// Format: first digit = size type (see SIZE_TYPES), second digit = position within type.

export const SIZE_CODE_MAP: Record<string, string> = {
  // ── One Size (00) ──────────────────────────────────────────────────────────
  "One Size": "00", "OSFA": "00", "OS": "00", "One Size Fits All": "00",

  // ── Adult Alpha (type 1, codes 10–19) ──────────────────────────────────────
  "XXS": "10", "Extra Extra Small": "10",
  "XS":  "11", "Extra Small": "11",
  "S":   "12", "Small": "12",
  "M":   "13", "Medium": "13",
  "L":   "14", "Large": "14",
  "XL":  "15", "Extra Large": "15", "Extra-Large": "15",
  "2XL": "16", "XXL": "16", "2X": "16",
  "3XL": "17", "XXXL": "17", "3X": "17",
  "4XL": "18", "XXXXL": "18", "4X": "18",
  "5XL": "19", "XXXXXL": "19", "5X": "19",

  // ── Adult Numeric / Waist (type 2, codes 20–29) ────────────────────────────
  '28': "20", '28W': "20",
  '30': "21", '30W': "21",
  '32': "22", '32W': "22",
  '34': "23", '34W': "23",
  '36': "24", '36W': "24",
  '38': "25", '38W': "25",
  '40': "26", '40W': "26",
  '42': "27", '42W': "27",
  '44': "28", '44W': "28",
  '46': "29", '46W': "29",

  // ── Children Alpha (type 3, codes 31–36) ───────────────────────────────────
  // Prefix with "Youth " or "Kids " to disambiguate from adult alpha
  "Youth XS": "31", "Kids XS": "31",
  "Youth S":  "32", "Kids S":  "32",
  "Youth M":  "33", "Kids M":  "33",
  "Youth L":  "34", "Kids L":  "34",
  "Youth XL": "35", "Kids XL": "35",
  "Youth XXL":"36", "Kids XXL":"36",

  // ── Children Numeric (type 4, codes 41–48) ─────────────────────────────────
  "6":  "41", "Size 6":  "41",
  "8":  "42", "Size 8":  "42",
  "10": "43", "Size 10": "43",
  "12": "44", "Size 12": "44",
  "14": "45", "Size 14": "45",
  "16": "46", "Size 16": "46",
  "18": "47", "Size 18": "47",
  "20": "48", "Size 20": "48",

  // ── Toddler Alpha (type 5, codes 50–56) ────────────────────────────────────
  // Infant month-based sizing
  "NB": "50", "Newborn": "50",
  "3M": "51", "3 Months": "51",
  "6M": "52", "6 Months": "52",
  "9M": "53", "9 Months": "53",
  "12M": "54", "12 Months": "54",
  "18M": "55", "18 Months": "55",
  "24M": "56", "24 Months": "56",

  // ── Toddler Numeric (type 6, codes 61–65) ──────────────────────────────────
  "2T": "61",
  "3T": "62",
  "4T": "63",
  "5T": "64",
  "6T": "65",
};

// ── Color codes (2 digits, 01–99) ─────────────────────────────────────────────
// GLOBAL FIXED — never change these assignments.
// Canonical anchors: Black=01, White=02, Navy=03, Red=04, Royal Blue=05

export const COLOR_CODE_MAP: Record<string, string> = {
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
 * Returns the 2-digit SS size code, or "00" for unknown/one-size.
 * First digit = size type (1=Adult Alpha, 2=Adult Numeric, etc.)
 * Second digit = position within that type.
 * Use "Youth S" / "Kids S" etc. for children alpha to disambiguate from adult alpha.
 */
export function getSizeCode(size: string): string {
  if (!size) return "00";
  const trimmed = size.trim();
  const direct = SIZE_CODE_MAP[trimmed];
  if (direct !== undefined) return direct;
  for (const [key, val] of Object.entries(SIZE_CODE_MAP)) {
    if (key.toUpperCase() === trimmed.toUpperCase()) return val;
  }
  return "00";
}

/** Returns the size type digit (first S) from a 2-digit SS code, or null if invalid. */
export function getSizeType(ssCode: string): string | null {
  if (ssCode === '00') return '0';
  if (/^\d{2}$/.test(ssCode)) return ssCode[0];
  return null;
}

/** Returns the SIZE_TYPES entry for a given SS code, or null if unrecognised. */
export function getSizeTypeEntry(ssCode: string): { label: string; description: string } | null {
  const typeDigit = getSizeType(ssCode);
  if (!typeDigit) return null;
  return SIZE_TYPES[typeDigit] ?? null;
}

/** @deprecated Use getSizeCode */
export const getSizeDigit = getSizeCode;

/** Returns the 2-digit color code (01–99), or "00" for unknown colors. */
export function getColorCode(color: string): string {
  if (!color) return "00";
  const trimmed = color.trim();
  const direct = COLOR_CODE_MAP[trimmed];
  if (direct !== undefined) return direct;
  for (const [key, val] of Object.entries(COLOR_CODE_MAP)) {
    if (key.toLowerCase() === trimmed.toLowerCase()) return val;
  }
  return "00";
}

/**
 * Build the 4-character variant suffix [SS][CC].
 * Returns null only if both inputs are empty/null.
 * Example: buildVariantSuffix("L", "Black") → "0501"
 *          buildVariantSuffix("M", "Navy")  → "0403"
 */
export function buildVariantSuffix(size: string | null, color: string | null): string | null {
  if (!size && !color) return null;
  const ss = getSizeCode(size ?? "");
  const cc = getColorCode(color ?? "");
  return `${ss}${cc}`;
}

// ── QRG Identity Helpers ──────────────────────────────────────────────────────
// Format: STNNN where S=1-6 (super-category), T=1-9 (type), NNN=001-999 (item)
// docId format: qrg_STNNN  e.g. qrg_11101
// Full QRG code: QRG-[STNNN]-[C]-[NNNNNN]-[SSCC]
// Context [C]: I=Internal (admin), M=Member (user), E=External (API/partner), O=Owner (post-purchase)
// Providers (Printify/Printful) are suppliers only — never in [C].
// Design/build data is NOT embedded in the QRG code — stored as a separate field or linked asset.

const QRG_BLANK_ID_RE = /^[1-6][1-9][0-9]{3}$/;
const QRG_DOC_ID_RE = /^qrg_[1-6][1-9][0-9]{3}$/;
const QRG_FULL_CODE_RE = /^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})-(\d{4})$/;

export const PARENT_CATEGORY_LABELS: Record<string, string> = {
  "1": "Apparel",
  "2": "Houseware",
  "3": "Print & Display",
  "4": "Accessories",
  "5": "Pet Products",
  "6": "Holiday & Seasonal",
};

/** Validates STNNN format: S=1-6, T=1-9, NNN=000-999 */
export function isValidQrgBlankId(value: unknown): boolean {
  return QRG_BLANK_ID_RE.test(String(value ?? ""));
}

/** Validates qrg_STNNN format */
export function isValidMasterCatalogDocId(value: unknown): boolean {
  return QRG_DOC_ID_RE.test(String(value ?? ""));
}

/** "11101" → "qrg_11101" */
export function buildMasterCatalogDocId(qrgBlankId: string): string {
  if (!isValidQrgBlankId(qrgBlankId)) throw new Error(`Invalid qrgBlankId: ${qrgBlankId}`);
  return `qrg_${qrgBlankId}`;
}

/** "qrg_11101" → parsed parts or null */
export function parseMasterCatalogDocId(docId: string): {
  qrgBlankId: string;
  parentCategory: string;
  parentCategoryLabel: string;
  productType: string;
  itemNumber: string;
} | null {
  if (!isValidMasterCatalogDocId(docId)) return null;
  const stnnn = docId.slice(4);
  return {
    qrgBlankId: stnnn,
    parentCategory: stnnn[0],
    parentCategoryLabel: PARENT_CATEGORY_LABELS[stnnn[0]] ?? "Unknown",
    productType: stnnn[1],
    itemNumber: stnnn.slice(2),
  };
}

/** Returns S digit (super-category) or null */
export function getQrgParentCategory(qrgBlankId: string): string | null {
  return isValidQrgBlankId(qrgBlankId) ? qrgBlankId[0] : null;
}

/** Returns T digit (product type) or null */
export function getQrgProductType(qrgBlankId: string): string | null {
  return isValidQrgBlankId(qrgBlankId) ? qrgBlankId[1] : null;
}

/** Returns NNN segment (3-digit item number) or null */
export function getQrgItemNumber(qrgBlankId: string): string | null {
  return isValidQrgBlankId(qrgBlankId) ? qrgBlankId.slice(2) : null;
}

/** Normalizes a value to STNNN string, or null if invalid */
export function normalizeQrgBlankId(value: unknown): string | null {
  const s = String(value ?? "").trim();
  return isValidQrgBlankId(s) ? s : null;
}

export interface QrgCodeParts {
  qrgBlankId: string;
  /** Context letter: I=Internal, M=Member, E=External, O=Owner */
  contextCode: string;
  instanceNumber: string;
  sizeCode: string;
  colorCode: string;
}

/** Build the full QRG-[STNNN]-[C]-[NNNNNN]-[SSCC] string */
export function buildFullQrgCode(parts: QrgCodeParts): string {
  const { qrgBlankId, contextCode, instanceNumber, sizeCode, colorCode } = parts;
  if (!isValidQrgBlankId(qrgBlankId)) throw new Error(`Invalid qrgBlankId: ${qrgBlankId}`);
  if (!/^[IMEO]$/.test(contextCode)) throw new Error(`Invalid contextCode: ${contextCode}. Must be I, M, E, or O.`);
  const iiiiii = String(instanceNumber).padStart(6, "0");
  return `QRG-${qrgBlankId}-${contextCode}-${iiiiii}-${sizeCode}${colorCode}`;
}

/** Parse a full QRG code, returns null if format is invalid */
export function parseFullQrgCode(code: string): QrgCodeParts | null {
  const m = QRG_FULL_CODE_RE.exec(code);
  if (!m) return null;
  return {
    qrgBlankId: m[1],
    contextCode: m[2],
    instanceNumber: m[3],
    sizeCode: m[4].slice(0, 2),
    colorCode: m[4].slice(2, 4),
  };
}

// ── QRG Code Validation Helpers ───────────────────────────────────────────────
// Use these everywhere — do not hand-roll QRG regexes outside this file.

const QRG_BASE_CODE_RE = /^QRG-([1-6][1-9][0-9]{3})-([IMEO])-(\d{6})$/;

/** Validates the base QRG format: QRG-[STNNN]-[C]-[NNNNNN] */
export function isValidQrgBase(code: unknown): boolean {
  return QRG_BASE_CODE_RE.test(String(code ?? ''));
}

/** Validates the full QRG format: QRG-[STNNN]-[C]-[NNNNNN]-[SSCC] */
export function isValidQrgFull(code: unknown): boolean {
  return QRG_FULL_CODE_RE.test(String(code ?? ''));
}

/** Validates either base or full QRG format */
export function isValidQrgCode(code: unknown): boolean {
  return isValidQrgBase(code) || isValidQrgFull(code);
}

/**
 * Throws if code is not a valid QRG base or full code.
 * Use before any marketplace action that requires a real QRG identity.
 */
export function assertValidQrgCode(code: unknown, context?: string): asserts code is string {
  if (!isValidQrgCode(code)) {
    const prefix = context ? `[${context}] ` : '';
    throw new Error(
      `${prefix}Marketplace action blocked: valid QRG identity required. Got: ${String(code ?? 'undefined')}`,
    );
  }
}

/** Returns the context letter (I/M/E/O) from a base or full QRG code, or null if invalid */
export function getQrgContext(code: unknown): 'I' | 'M' | 'E' | 'O' | null {
  const s = String(code ?? '');
  const baseMatch = QRG_BASE_CODE_RE.exec(s);
  if (baseMatch) return baseMatch[2] as 'I' | 'M' | 'E' | 'O';
  const fullMatch = QRG_FULL_CODE_RE.exec(s);
  if (fullMatch) return fullMatch[2] as 'I' | 'M' | 'E' | 'O';
  return null;
}
