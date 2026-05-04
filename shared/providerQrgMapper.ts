/**
 * shared/providerQrgMapper.ts
 *
 * Maps raw provider data (Printify / Printful) into QRG master blank format.
 *
 * CORE LAW:
 * - Provider IDs are supplier metadata only
 * - QRG identity (STNNN → qrg_STNNN) is assigned by QR Gear, never by providers
 * - All unmapped variants must be reported, never silently dropped
 */

import { getQrgSizeCode, getQrgColorCode, buildVariantCode, SIZE_LABELS, COLOR_LABELS } from './qrgVariantMappings';
import { isValidQrgBlankId } from './qrgCodes';

export { isValidQrgBlankId };

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QrgProviderVariantInput {
  size?: string | null;
  color?: string | null;
  variantId?: string | number | null;
  price?: number | null;
  blueprintId?: string | number | null;
  printProviderId?: string | number | null;
  productId?: string | number | null;
  provider: 'printify' | 'printful';
}

export interface QrgVariantMapping {
  isUnmapped: false;
  variantCode: string;
  sizeCode: string;
  colorCode: string;
  sizeLabel: string;
  colorLabel: string;
  providerVariantId?: string;
}

export interface QrgUnmappedVariant {
  isUnmapped: true;
  reason: 'size' | 'color' | 'both';
  providerSize?: string;
  providerColor?: string;
}

export type QrgVariantResult = QrgVariantMapping | QrgUnmappedVariant;

// ── Variant mapping ───────────────────────────────────────────────────────────

/**
 * Map a single provider variant to a QRG SSCC code.
 * Returns QrgVariantMapping on success, or QrgUnmappedVariant if unmapped.
 */
export function mapProviderVariantToQrgVariant(
  input: QrgProviderVariantInput
): QrgVariantResult {
  const sizeCode = input.size ? getQrgSizeCode(input.size) : null;
  const colorCode = input.color ? getQrgColorCode(input.color) : null;

  if (!sizeCode && !colorCode) {
    return { isUnmapped: true, reason: 'both', providerSize: input.size ?? undefined, providerColor: input.color ?? undefined };
  }
  if (!sizeCode) {
    return { isUnmapped: true, reason: 'size', providerSize: input.size ?? undefined, providerColor: input.color ?? undefined };
  }
  if (!colorCode) {
    return { isUnmapped: true, reason: 'color', providerSize: input.size ?? undefined, providerColor: input.color ?? undefined };
  }

  return {
    isUnmapped: false,
    variantCode: buildVariantCode(sizeCode, colorCode),
    sizeCode,
    colorCode,
    sizeLabel: SIZE_LABELS[sizeCode] ?? sizeCode,
    colorLabel: input.color ?? COLOR_LABELS[colorCode] ?? colorCode,
    providerVariantId: input.variantId ? String(input.variantId) : undefined,
  };
}

// ── Blank mappers ─────────────────────────────────────────────────────────────

/**
 * Normalize a Printify blueprint to QRG master blank input shape.
 * Does NOT assign qrgBlankId — that is the sync service's job.
 */
export function mapPrintifyBlankToQrgMaster(blueprint: {
  id: number | string;
  title?: string;
  description?: string;
  brand?: string;
  model?: string;
  images?: string[];
  [k: string]: unknown;
}) {
  return {
    providerKey: `py_${blueprint.id}`,
    providerBlueprintId: String(blueprint.id),
    rawTitle: blueprint.title ?? null,
    rawDescription: blueprint.description ?? null,
    brand: blueprint.brand ?? null,
    model: blueprint.model ?? null,
    images: Array.isArray(blueprint.images) ? blueprint.images.filter(Boolean) : [],
    provider: 'printify' as const,
  };
}

/**
 * Normalize a Printful product to QRG master blank input shape.
 * Does NOT assign qrgBlankId — that is the sync service's job.
 */
export function mapPrintfulBlankToQrgMaster(product: {
  id: number | string;
  title?: string;
  typeName?: string;
  description?: string;
  brand?: string;
  model?: string;
  image?: string;
  images?: string[];
  [k: string]: unknown;
}) {
  const images = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : product.image ? [product.image] : [];

  return {
    providerKey: `pf_${product.id}`,
    providerProductId: String(product.id),
    rawTitle: product.title ?? product.typeName ?? null,
    rawDescription: product.description ?? null,
    brand: product.brand ?? null,
    model: product.model ?? null,
    images,
    provider: 'printful' as const,
  };
}

/**
 * Normalize brand+model for cross-provider matching.
 */
export function resolveProviderAliases(product: {
  brand?: string | null;
  model?: string | null;
}): { brand: string; model: string } {
  return {
    brand: (product.brand ?? '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''),
    model: (product.model ?? '').toLowerCase().trim().replace(/[^a-z0-9]/g, ''),
  };
}

/**
 * Resolve the canonical QRG doc ID for an input key.
 * Returns the existing docId if found in the provided map, else null.
 * Never invents IDs.
 */
export function resolveCanonicalQrgDocId(
  inputKey: string,
  masterProducts: Map<string, string>
): string | null {
  return masterProducts.get(inputKey) ?? null;
}
