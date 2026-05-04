/**
 * shared/qrgVariantMappings.ts
 *
 * Canonical provider → QRG size/color mapping for client-side use.
 *
 * KEY RULE: getQrgSizeCode and getQrgColorCode return null if a value cannot
 * be mapped. The caller MUST track these as unmapped — never silently ignore.
 */

export { SIZE_CODE_MAP, COLOR_CODE_MAP } from './qrgCodes';

// ── Label maps (code → canonical label) ──────────────────────────────────────
export const SIZE_LABELS: Record<string, string> = {
  '00': 'One Size',
  '01': 'XXS', '02': 'XS', '03': 'S', '04': 'M', '05': 'L',
  '06': 'XL', '07': '2XL', '08': '3XL', '09': '4XL', '10': '5XL',
};

import { COLOR_CODE_MAP } from './qrgCodes';

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

import { SIZE_CODE_MAP } from './qrgCodes';

/**
 * Returns QRG size code ("01"–"10" / "00") or null if unmapped.
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
 */
export function getQrgColorCode(colorText: string): string | null {
  if (!colorText) return null;
  const normalized = normalizeProviderColor(colorText);
  if (COLOR_CODE_MAP[normalized] !== undefined) return COLOR_CODE_MAP[normalized];
  const lower = normalized.toLowerCase();
  for (const [key, code] of Object.entries(COLOR_CODE_MAP)) {
    if (key.toLowerCase() === lower) return code;
  }
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
