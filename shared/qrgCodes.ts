/**
 * shared/qrgCodes.ts
 *
 * QRG barcode suffix tables for physical item identification.
 *
 * Full barcode format:  QRG-I-{storeId}-{productId}-{instanceSeq}-{X}{CC}
 *   {X}  = 1-digit size code  (3=S, 4=M, 5=L, 6=XL, 7=2XL, ...)
 *   {CC} = 2-digit color code (01=White, 14=Black, 31=Navy, ...)
 *
 * These codes are barcode-only — never in URLs or packet names.
 * They exist so fulfillment staff can scan an item and look it up by
 * the exact size+color variant that was ordered.
 *
 * Rules:
 *   - Codes must be STABLE — never renumber once assigned
 *   - Aliases (e.g. "Gray" / "Grey") share the same code
 *   - Unknown colors → "00", unknown sizes → "0"
 */

// ── Size codes (1 digit) ─────────────────────────────────────────────────────

export const SIZE_DIGIT_MAP: Record<string, string> = {
  "One Size": "0", "OSFA": "0", "OS": "0",
  "XS": "2",
  "S":  "3",
  "M":  "4",
  "L":  "5",
  "XL": "6",
  "2XL": "7", "XXL": "7",
  "3XL": "8", "XXXL": "8",
  "4XL": "9", "XXXXL": "9",
  // Numeric sizes (apparel / accessories)
  "4":   "1", "6":   "1", "8":   "2",
  "10":  "3", "12":  "4", "14":  "5", "16":  "6",
};

// ── Color codes (2 digits, 01–99) ────────────────────────────────────────────

export const COLOR_CODE_MAP: Record<string, string> = {
  // Whites / Creams / Naturals (01–13)
  "White": "01", "Solid White Blend": "02", "Vintage White": "03",
  "Soft Cream": "04", "Cream": "05", "Natural": "06",
  "Heather Natural": "07", "Sand": "08", "Heather Sand Dune": "09",
  "Pebble": "10", "Heather Dust": "11", "Tan": "12", "Toast": "13",

  // Blacks / Very Dark (14–20)
  "Black": "14", "Vintage Black": "15", "Oxblood Black": "16",
  "Black Heather": "17", "Dark Heather": "18", "Charcoal": "19", "Asphalt": "20",

  // Greys (21–30)
  "Ash": "21", "Silver": "22",
  "Gray": "23", "Grey": "23",
  "Heather Gray": "24", "Heather Grey": "24",
  "Athletic Heather": "25",
  "Sport Gray": "26", "Sport Grey": "26",
  "Heather Cool Grey": "27",
  "Dark Grey": "28", "Dark Grey Heather": "29", "Heather Slate": "30",

  // Navy / Dark Blues (31–33)
  "Navy": "31", "Navy Blue": "31",
  "Heather Navy": "32", "Heather Midnight Navy": "33",

  // Blues (34–47)
  "Blue": "34", "Royal Blue": "35",
  "True Royal": "36", "Heather True Royal": "37",
  "Sapphire": "38", "Ocean Blue": "39", "Steel Blue": "40",
  "Heather Columbia Blue": "41", "Heather Carolina Blue": "42",
  "Light Blue": "43", "Baby Blue": "44",
  "Heather Ice Blue": "45",
  "Heather Prism Ice Blue": "46", "Heather Prism Dusty Blue": "47",

  // Teals / Aquas (48–52)
  "Teal": "48", "Heather Deep Teal": "49",
  "Aqua": "50", "Heather Aqua": "51", "Turquoise": "52",

  // Greens / Mints (53–70)
  "Green": "53", "Mint": "54",
  "Heather Mint": "55", "Heather Prism Mint": "56",
  "Sage": "57", "Leaf": "58",
  "Heather Grass Green": "59", "Heather Emerald": "60",
  "Kelly": "61", "Kelly Green": "61",
  "Irish Green": "62", "Heather Kelly": "63",
  "Olive": "64", "Heather Olive": "65",
  "Military Green": "66", "Army": "67",
  "Forest": "68", "Forest Green": "68",
  "Heather Forest": "69", "Safety Green": "70",

  // Yellows / Golds / Oranges (71–82)
  "Yellow": "71", "Daisy": "72", "Gold": "73", "Mustard": "74",
  "Heather Yellow Gold": "75",
  "Autumn": "76", "Heather Autumn": "77",
  "Orange": "78", "Burnt Orange": "79",
  "Tennessee Orange": "80", "Heather Orange": "81", "Safety Orange": "82",

  // Reds (83–89)
  "Red": "83", "Heather Red": "84", "Cardinal": "85",
  "Maroon": "86", "Burgundy": "87", "Berry": "88", "Heather Raspberry": "89",

  // Pinks (90–96)
  "Pink": "90", "Soft Pink": "91", "Charity Pink": "92",
  "Heather Clay": "93", "Heather Prism Peach": "94",
  "Heather Mauve": "95", "Mauve": "96",

  // Purples / Lavenders (97–99)
  "Purple": "97", "Team Purple": "97",
  "Heather Team Purple": "97", "Heather Orchid": "97",
  "Lilac": "98", "Heather Prism Lilac": "98",
  "Heather Prism Dusty Lavender": "99",

  // Browns (99)
  "Brown": "99", "Heather Brown": "99",
};

// ── Lookup helpers ───────────────────────────────────────────────────────────

/** Returns the 1-digit size code, or "0" for unknown sizes. */
export function getSizeDigit(size: string): string {
  if (!size) return "0";
  const trimmed = size.trim();
  const direct = SIZE_DIGIT_MAP[trimmed];
  if (direct !== undefined) return direct;
  const lower = trimmed.toUpperCase();
  for (const [key, val] of Object.entries(SIZE_DIGIT_MAP)) {
    if (key.toUpperCase() === lower) return val;
  }
  return "0";
}

/** Returns the 2-digit color code, or "00" for unknown colors. */
export function getColorCode(color: string): string {
  if (!color) return "00";
  const trimmed = color.trim();
  const direct = COLOR_CODE_MAP[trimmed];
  if (direct !== undefined) return direct;
  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(COLOR_CODE_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }
  return "00";
}

/**
 * Build the 3-character barcode suffix for a size+color combination.
 * Format: {X}{CC}  e.g. "401" for M+Black, "531" for L+Navy
 * Returns null only if both inputs are empty.
 */
export function buildVariantSuffix(size: string | null, color: string | null): string | null {
  if (!size && !color) return null;
  const x  = getSizeDigit(size ?? "");
  const cc = getColorCode(color ?? "");
  return `${x}${cc}`;
}
