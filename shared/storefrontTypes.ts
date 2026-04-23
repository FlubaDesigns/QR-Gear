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

import { COLOR_HEX_MAP } from './colorUtils';

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
export function buildStructuredOptions(colors: string[], sizes: string[]): ProductOption[] {
  const opts: ProductOption[] = [];
  if (colors.length > 0) {
    opts.push({
      name: 'color',
      displayType: 'swatches',
      isPrimary: true,
      values: colors.map(label => ({
        label,
        hex: COLOR_HEX_MAP[label] ?? '#CCCCCC',
        available: true,
      })),
    });
  }
  if (sizes.length > 0) {
    opts.push({
      name: 'size',
      displayType: 'pills',
      isPrimary: false,
      values: sizes.map(label => ({ label, available: true })),
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
