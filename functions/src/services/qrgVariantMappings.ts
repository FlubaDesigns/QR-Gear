/**
 * functions/src/services/qrgVariantMappings.ts
 *
 * Canonical provider → QRG size/color mapping for use in Cloud Functions.
 *
 * KEY RULE: getQrgSizeCode and getQrgColorCode return null if a value cannot
 * be mapped. The caller MUST track these as unmapped — never silently ignore.
 */

// ── Size codes (2-digit, 01–10) ────────────────────────────────────────────────
export const SIZE_CODE_MAP: Record<string, string> = {
  'XXS': '01', 'Extra Extra Small': '01',
  'XS':  '02', 'Extra Small': '02',
  'S':   '03', 'Small': '03',
  'M':   '04', 'Medium': '04',
  'L':   '05', 'Large': '05',
  'XL':  '06', 'Extra Large': '06', 'Extra-Large': '06',
  '2XL': '07', 'XXL': '07', '2X': '07',
  '3XL': '08', 'XXXL': '08', '3X': '08',
  '4XL': '09', 'XXXXL': '09', '4X': '09',
  '5XL': '10', 'XXXXXL': '10', '5X': '10',
  'One Size': '00', 'OSFA': '00', 'OS': '00',
  '4': '01', '6': '01',
  '8': '02',
  '10': '03', '12': '04', '14': '05', '16': '06',
};

// ── Color codes (2-digit, 01–99) ──────────────────────────────────────────────
export const COLOR_CODE_MAP: Record<string, string> = {
  'Black': '01', 'Black Heather': '01', 'Vintage Black': '01', 'Oxblood Black': '01',
  'White': '02', 'Solid White Blend': '02', 'Vintage White': '02',
  'Navy': '03', 'Navy Blue': '03',
  'Red': '04',
  'Royal Blue': '05', 'True Royal': '05',
  'Gray': '06', 'Grey': '06',
  'Heather Gray': '07', 'Heather Grey': '07', 'Athletic Heather': '07',
  'Sport Gray': '07', 'Sport Grey': '07',
  'Charcoal': '08',
  'Dark Heather': '09', 'Asphalt': '09',
  'Dark Grey': '10', 'Dark Grey Heather': '10', 'Heather Slate': '10',
  'Heather Cool Grey': '11',
  'Ash': '12', 'Silver': '12',
  'Cream': '13', 'Soft Cream': '13', 'Natural': '13', 'Heather Natural': '13',
  'Sand': '14', 'Heather Sand Dune': '14', 'Pebble': '14', 'Heather Dust': '14',
  'Tan': '15', 'Toast': '15',
  'Heather Navy': '16', 'Heather Midnight Navy': '16',
  'Heather True Royal': '17',
  'Sapphire': '18',
  'Steel Blue': '19', 'Ocean Blue': '19',
  'Heather Columbia Blue': '20', 'Heather Carolina Blue': '20',
  'Light Blue': '21', 'Baby Blue': '21',
  'Heather Ice Blue': '22', 'Heather Prism Ice Blue': '22', 'Heather Prism Dusty Blue': '22',
  'Blue': '23',
  'Teal': '24',
  'Heather Deep Teal': '25',
  'Aqua': '26', 'Heather Aqua': '26',
  'Turquoise': '27',
  'Green': '28',
  'Mint': '29', 'Heather Mint': '29', 'Heather Prism Mint': '29',
  'Sage': '30', 'Leaf': '30',
  'Heather Grass Green': '31',
  'Heather Emerald': '32',
  'Kelly': '33', 'Kelly Green': '33', 'Irish Green': '33', 'Heather Kelly': '33',
  'Olive': '34', 'Heather Olive': '34',
  'Military Green': '35', 'Army': '35',
  'Forest': '36', 'Forest Green': '36', 'Heather Forest': '36',
  'Safety Green': '37',
  'Yellow': '38', 'Daisy': '38',
  'Gold': '39', 'Mustard': '39', 'Heather Yellow Gold': '39',
  'Autumn': '40', 'Heather Autumn': '40',
  'Orange': '41', 'Burnt Orange': '41', 'Tennessee Orange': '41',
  'Heather Orange': '41', 'Safety Orange': '41',
  'Cardinal': '42',
  'Maroon': '43',
  'Burgundy': '44', 'Berry': '44',
  'Heather Red': '45',
  'Heather Raspberry': '46',
  'Pink': '47', 'Soft Pink': '47', 'Charity Pink': '47',
  'Heather Clay': '48', 'Heather Prism Peach': '48',
  'Heather Mauve': '49', 'Mauve': '49',
  'Purple': '50', 'Team Purple': '50', 'Heather Team Purple': '50', 'Heather Orchid': '50',
  'Lilac': '51', 'Heather Prism Lilac': '51',
  'Heather Prism Dusty Lavender': '52',
  'Brown': '53', 'Heather Brown': '53',
};

// ── Label maps (code → canonical label) ──────────────────────────────────────
export const SIZE_LABELS: Record<string, string> = {
  '00': 'One Size',
  '01': 'XXS', '02': 'XS', '03': 'S', '04': 'M', '05': 'L',
  '06': 'XL', '07': '2XL', '08': '3XL', '09': '4XL', '10': '5XL',
};

export const COLOR_LABELS: Record<string, string> = (() => {
  const labels: Record<string, string> = {};
  for (const [name, code] of Object.entries(COLOR_CODE_MAP)) {
    if (!labels[code]) labels[code] = name;
  }
  return labels;
})();

// ── Normalization ─────────────────────────────────────────────────────────────

export function normalizeProviderSize(text: string): string {
  return (text || '').trim().replace(/[\s_-]+/g, ' ');
}

export function normalizeProviderColor(text: string): string {
  return (text || '').trim().replace(/[\s_-]+/g, ' ');
}

// ── Code lookups — return null for unmapped values ────────────────────────────

/**
 * Returns QRG size code ("01"–"10" / "00") or null if unmapped.
 * null = caller must track as unmapped.
 */
export function getQrgSizeCode(sizeText: string): string | null {
  if (!sizeText) return null;
  const normalized = normalizeProviderSize(sizeText);

  if (SIZE_CODE_MAP[normalized] !== undefined) return SIZE_CODE_MAP[normalized];

  const upper = normalized.toUpperCase();
  for (const [key, code] of Object.entries(SIZE_CODE_MAP)) {
    if (key.toUpperCase() === upper) return code;
  }

  const stripped = normalized.replace(/^(size|us|uk)\s+/i, '').trim();
  if (stripped && SIZE_CODE_MAP[stripped] !== undefined) return SIZE_CODE_MAP[stripped];
  for (const [key, code] of Object.entries(SIZE_CODE_MAP)) {
    if (key.toUpperCase() === stripped.toUpperCase()) return code;
  }

  return null;
}

/**
 * Returns QRG color code ("01"–"99") or null if unmapped.
 * null = caller must track as unmapped — never silently drop.
 */
export function getQrgColorCode(colorText: string): string | null {
  if (!colorText) return null;
  const normalized = normalizeProviderColor(colorText);

  if (COLOR_CODE_MAP[normalized] !== undefined) return COLOR_CODE_MAP[normalized];

  const lower = normalized.toLowerCase();
  for (const [key, code] of Object.entries(COLOR_CODE_MAP)) {
    if (key.toLowerCase() === lower) return code;
  }

  // Substring match (only if both strings are at least 4 chars to avoid false positives)
  for (const [key, code] of Object.entries(COLOR_CODE_MAP)) {
    if (key.length >= 4 && lower.length >= 4) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return code;
    }
  }

  return null;
}

// ── Variant code builders ─────────────────────────────────────────────────────

export function buildVariantCode(sizeCode: string, colorCode: string): string {
  return `${sizeCode}${colorCode}`;
}

export function parseVariantCode(sscc: string): {
  sizeCode: string;
  colorCode: string;
  sizeLabel: string;
  colorLabel: string;
} | null {
  if (!/^\d{4}$/.test(sscc)) return null;
  const sizeCode = sscc.slice(0, 2);
  const colorCode = sscc.slice(2, 4);
  return {
    sizeCode,
    colorCode,
    sizeLabel: SIZE_LABELS[sizeCode] ?? sizeCode,
    colorLabel: COLOR_LABELS[colorCode] ?? colorCode,
  };
}
