/**
 * CANONICAL FIELD AUTHORITY — catalog.adapter.ts
 *
 * This is the ONE approved translation boundary between raw provider/Firestore
 * data and the canonical UI view-model fields consumed by all components.
 *
 * Rules:
 *  - Components may ONLY consume canonical fields from this interface.
 *  - Components must NOT alias, rename, or fall back to provider field names.
 *  - All raw → canonical translation happens here. Never in components.
 *
 * ONE FIELD. ONE NAME. ONE AUTHORITY.
 */

export interface ProductColor {
  name: string;
  hex: string;
}

/**
 * Canonical UI view-model for a selectable product item.
 * All components that display product selection must use this type.
 *
 * Canonical field names (non-negotiable):
 *   availableColors  — NOT colorsAvailable, colorOptions, blankColors, colors
 *   availableSizes   — NOT sizesAvailable, sizeOptions, sizes
 */
export interface CanonicalProductSelectItem {
  id: string;
  name: string;
  providerTitle?: string | null;
  adminCatalogTitle?: string | null;
  price: number | null;
  cost: number | null;
  manufacturer: string | null;
  model?: string | null;
  madeInUSA: boolean;
  primaryImageUrl: string | null;
  images?: string[];
  description: string | null;
  providerDescription?: string | null;
  adminCatalogDescription?: string | null;
  providerDescriptionRaw?: string | null;
  availableColors: ProductColor[];
  availableSizes: string[];
  defaultColor: string | null;
  qrgBlankId?: string | null;
}

/**
 * Normalize a raw catalog product's availableColors into canonical {name, hex} objects.
 *
 * Firestore stores availableColors as QRG color codes ("01","02","03"), NOT hex values.
 * The real hex data lives in providerMappings.printful.colors / providerMappings.printify.colors.
 * colorMap (injected by Cloud Functions) is the preferred canonical source when present.
 */
export function normalizeProductColors(raw: Record<string, any>): ProductColor[] {
  // 1. colorMap — preferred canonical source (CF-injected, already has name+hex)
  const colorMap = raw.colorMap;
  if (Array.isArray(colorMap) && colorMap.length > 0) {
    return colorMap.map((c: any) => ({
      name: c.colorName || c.name || '',
      hex: c.hex || '#CCCCCC',
    }));
  }

  // 2. providerMappings — carries full {name, hex} per provider
  const pm = raw.providerMappings || {};
  const providerColors: Array<{ name: string; hex: string }> =
    pm.printful?.colors || pm.printify?.colors || [];
  if (providerColors.length > 0) {
    return providerColors.map((c: any) => ({
      name: c.name || '',
      hex: c.hex || '#CCCCCC',
    }));
  }

  // 3. availableColors field — may be objects or raw QRG code strings; best-effort
  const existing = raw.availableColors || raw.colors || [];
  return (existing as any[]).map((c: any) => ({
    name: typeof c === 'string' ? c : (c.name || c.colorName || c.label || ''),
    hex: typeof c === 'object' && c.hex ? c.hex : '#CCCCCC',
  }));
}

/**
 * Normalize raw sizes into a canonical string array.
 * sizeMap (CF-injected) is preferred; falls back to availableSizes / sizes.
 */
/**
 * Dev-time assertion: verify that a ProductSelectItem has canonical fields populated.
 * Call this at adapter boundaries to catch normalization gaps early.
 */
export function assertCanonicalProduct(
  item: Partial<CanonicalProductSelectItem>,
  context: string,
): void {
  if (process.env.NODE_ENV !== "production") {
    if (!Array.isArray(item.availableColors)) {
      console.warn(`[CFA] ${context}: availableColors missing or not an array`, item);
    }
    if (!Array.isArray(item.availableSizes)) {
      console.warn(`[CFA] ${context}: availableSizes missing or not an array`, item);
    }
  }
}

export function normalizeProductSizes(raw: Record<string, any>): string[] {
  const sizeMap = raw.sizeMap;
  if (Array.isArray(sizeMap) && sizeMap.length > 0) {
    return sizeMap.map((s: any) => s.sizeLabel || s.label || s.qrgSizeCode || s);
  }
  const existing = raw.availableSizes || raw.sizes || [];
  return (existing as any[]).map((s: any) =>
    typeof s === 'string' ? s : (s.sizeLabel || s.label || '')
  );
}
