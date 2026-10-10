/**
 * shared/storefrontTypes.ts
 *
 * Canonical types for the public-facing storefront product contract.
 * Used by:
 *   - Frontend storefront views (client/src/features/storefront/)
 *   - Backend store API (functions/src/routes/store-files.ts)
 *   - Marketplace adapters that need structured option data
 *
 * Single source of truth. Do not redefine these shapes locally.
 */

import { resolveColorHex } from './colorUtils';

// ── Media ────────────────────────────────────────────────────────────────────

export interface MockupsByColor {
  [color: string]: { front?: string; lifestyle?: string; angles?: string[] };
}

export interface ProductMedia {
  images: string[];
  mockupPriority: boolean;
  heroStrategy: 'mockupFirst' | 'catalogFirst';
}

// ── Options ──────────────────────────────────────────────────────────────────

export interface ProductOptionValue {
  label: string;
  hex?: string;
  available: boolean;
  image?: string | null;
}

export interface ProductOption {
  name: string;
  displayType: 'swatches' | 'pills' | 'dropdown';
  isPrimary: boolean;
  values: ProductOptionValue[];
}

/**
 * Build structured color + size option groups from raw string arrays.
 * Uses the canonical COLOR_HEX_MAP for hex resolution.
 * Used by the storefront API when serializing a product for the frontend.
 */
export const APPAREL_SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
export const DEFAULT_SIZE_UPCHARGES: Record<string, number> = { XS: 0, S: 0, M: 0, L: 0, XL: 0, '2XL': 3, '3XL': 6, '4XL': 9, '5XL': 12 };

export function normalizeSize(size: string): string {
  const value = size.trim().toUpperCase();
  const repeated = /^(XX+)L$/.exec(value);
  return repeated ? `${repeated[1].length}XL` : value;
}

/** UI selection consumes the combinations already approved by the QRG resolver. */
export interface ProductVariantOption { color: string; size: string }

export function productSizesForColor(variants: readonly ProductVariantOption[] | null | undefined, color: string | null | undefined): string[] {
  return sortProductSizes(Array.from(new Set((variants ?? []).filter(v => v.color === color).map(v => normalizeSize(v.size)))));
}

export function isAvailableProductVariant(variants: readonly ProductVariantOption[] | null | undefined, color: string | null | undefined, size: string | null | undefined): boolean {
  return !!color && !!size && (variants ?? []).some(v => v.color === color && normalizeSize(v.size) === normalizeSize(size));
}

export function sortProductSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const rank = (s: string) => {
      const index = APPAREL_SIZE_ORDER.indexOf(normalizeSize(s));
      return index < 0 ? APPAREL_SIZE_ORDER.length : index;
    };
    return rank(a) - rank(b) || a.localeCompare(b, undefined, { numeric: true });
  });
}

export function sizeUpcharge(size: string | null | undefined, upcharges: Record<string, number>): number {
  const value = Number(upcharges[normalizeSize(size || '')] ?? 0);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function buildStructuredOptions(colors: string[], sizes: string[]): ProductOption[] {
  const opts: ProductOption[] = [];
  if (colors.length > 0) {
    opts.push({
      name: 'color',
      displayType: 'swatches',
      isPrimary: true,
      values: colors.map(label => ({
        label,
        hex: resolveColorHex(label),
        available: true,
      })),
    });
  }
  if (sizes.length > 0) {
    opts.push({
      name: 'size',
      displayType: 'pills',
      isPrimary: false,
      values: sortProductSizes(sizes).map(label => ({ label, available: true })),
    });
  }
  return opts;
}

/**
 * Derive whether a product card should require color/size selection before
 * adding to cart ('browseOnly') or can be added directly ('quickAdd').
 */
export function deriveCardMode(colors: string[], sizes: string[]): 'browseOnly' | 'quickAdd' {
  return colors.length > 0 && sizes.length > 0 ? 'browseOnly' : 'quickAdd';
}

// ── Product ──────────────────────────────────────────────────────────────────

export interface StoreProduct {
  id: string;
  name: string;
  imageUrl: string | null;
  /** Full ordered gallery array — primary image source. First item is hero. */
  images?: string[] | null;
  packetImageUrl?: string | null;
  /** Firestore segment field — the bridge layer maps this to collection slugs. */
  segment: string | null;
  isFeatured: boolean;
  isSeasonalPromo: boolean;
  templateVariant: string | null;
  qrProductType: string;
  qrCodeUrl?: string | null;
  selectedColors?: string[] | null;
  availableSizes?: string[] | null;
  defaultColor?: string | null;
  mockupsByColor?: MockupsByColor | null;
  price?: number | null;
  createdAt: string;
  /** Structured display-intent options emitted by the builder layer */
  options?: ProductOption[] | null;
  /** How this product should behave on listing cards */
  cardMode?: 'browseOnly' | 'quickAdd' | null;
  /** Media contract — defines hero strategy and ordered gallery */
  media?: ProductMedia | null;
}

// ── Store response ────────────────────────────────────────────────────────────

export interface StoreResponse {
  storeType: string;
  storeName: string;
  segment: string | null;
  channelId?: string | null;
  channelName?: string | null;
  collection?: string | null;
  products: StoreProduct[];
}
