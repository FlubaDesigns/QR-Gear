import { masterBlankImages } from "./productImages";
import { resolveColorHex } from './colorUtils';
import { COLOR_LABELS, SIZE_LABELS } from './qrgVariantMappings';

/**
 * Build normalized colorMap and sizeMap from a Firestore master_catalog doc.
 * Reads qrgVariants as the canonical source (colorLabel, sizeLabel, colorCode, sizeCode).
 * Falls back to legacy availableColors/availableSizes only if qrgVariants is absent.
 */
export function buildColorSizeFromDoc(p: any): {
  colorMap: Array<{ qrgColorCode: string; colorName: string; hex: string; available: boolean }>;
  sizeMap: Array<{ qrgSizeCode: string; sizeLabel: string; available: boolean }>;
} {
  const qrgVariants: Record<string, any> = p.qrgVariants || {};
  const colorCodesSeen = new Map<string, { label: string; providerLabels: Set<string> }>();
  const sizeCodesSeen = new Map<string, { label: string; providerLabels: Set<string> }>();

  for (const [vc, variant] of Object.entries(qrgVariants)) {
    if (!/^(?:\d{4}|\d{5}|\d{7})$/.test(vc)) continue;
    const v = variant as any;
    // SSCC is canonical; retain the stored size code on older TSSCC/TSSLLCC rows.
    const sc = vc.slice(0, vc.length === 4 ? 2 : 3);
    const cc = vc.slice(-2);
    if (cc) {
      if (!colorCodesSeen.has(cc)) {
        colorCodesSeen.set(cc, { label: v.colorLabel || COLOR_LABELS[cc] || cc, providerLabels: new Set() });
      }
      if (v.colorLabel) colorCodesSeen.get(cc)!.providerLabels.add(v.colorLabel);
    }
    if (sc) {
      if (!sizeCodesSeen.has(sc)) {
        sizeCodesSeen.set(sc, { label: v.sizeLabel || SIZE_LABELS[sc] || SIZE_LABELS[sc === '00' ? '000' : `1${sc}`] || sc, providerLabels: new Set() });
      }
      if (v.sizeLabel) sizeCodesSeen.get(sc)!.providerLabels.add(v.sizeLabel);
    }
  }

  if (Object.keys(qrgVariants).length === 0) {
    for (const code of (p.availableColors || [])) {
      if (typeof code === 'string' && /^\d{2}$/.test(code)) {
        colorCodesSeen.set(code, { label: COLOR_LABELS[code] || code, providerLabels: new Set() });
      }
    }
    for (const code of (p.availableSizes || [])) {
      if (typeof code === 'string' && /^\d{2,3}$/.test(code)) {
        sizeCodesSeen.set(code, { label: SIZE_LABELS[code] || SIZE_LABELS[code === '00' ? '000' : `1${code}`] || code, providerLabels: new Set() });
      }
    }
  }

  const colorMap = Array.from(colorCodesSeen.entries()).map(([code, info]) => {
    const colorName = info.providerLabels.size > 0 ? Array.from(info.providerLabels)[0] : info.label;
    return { qrgColorCode: code, colorName, hex: resolveColorHex(colorName), available: true };
  });

  const sizeMap = Array.from(sizeCodesSeen.entries()).map(([code, info]) => {
    const sizeLabel = info.providerLabels.size > 0 ? Array.from(info.providerLabels)[0] : info.label;
    return { qrgSizeCode: code, sizeLabel, available: true };
  });

  return { colorMap, sizeMap };
}

/** Project the canonical master record without reading or mutating provider tables. */
export function masterCatalogProduct(docId: string, p: Record<string, any>) {
  // Extract provider IDs from providerMappings (new format) or legacy fields
  const providerMappings: any[] = Array.isArray(p.providerMappings) ? p.providerMappings
    : Object.entries(p.providerMappings || {})
        .filter(([provider, mapping]) => ['printify', 'printful'].includes(provider) && !!mapping)
        .map(([provider, mapping]) => ({ ...(mapping as object), provider }));
  const pyMapping = providerMappings.find((m: any) => m.provider === 'printify') || null;
  const pfMapping = providerMappings.find((m: any) => m.provider === 'printful') || null;

  const blueprintId = pyMapping?.blueprintId ?? p.printifyBlueprintId ?? p.blueprintId ?? null;
  const printfulId = pfMapping?.productId ?? p.printfulProductId ?? p.printfulId ?? null;

  // availableVia is the provider badge: ["printify"], ["printful"], or ["printify","printful"]
  const availableVia: string[] = Array.isArray(p.availableVia) && p.availableVia.length > 0
    ? p.availableVia
    : (blueprintId != null && printfulId != null ? ['printify', 'printful'] : blueprintId != null ? ['printify'] : printfulId != null ? ['printful'] : []);

  // fulfillmentProvider for backward compat with existing frontend code
  const fulfillmentProvider = availableVia.length > 1 ? 'both' : (availableVia[0] || 'printify');

  const { colorMap, sizeMap } = buildColorSizeFromDoc(p);
  const allImages = masterBlankImages(p);
  const imageUrl = allImages[0] ?? null;

  // madeInUSA: true if any provider mapping is USA
  const madeInUSA = p.madeInUSA ??
    providerMappings.some((m: any) => m.isUSA) ??
    ((p.originCountry || '').toUpperCase() === 'US');

  // id: numeric ID for backward compat — prefer Printify blueprint ID
  const id = blueprintId ?? printfulId;

  const canonicalDescription = (p.canonicalDescription || p.richDescription || p.description || '').trim() || null;

  return {
    docId,
    qrgBlankId: p.qrgBlankId ?? null,
    qrgCategory: p.qrgCategory ?? null,
    qrgParentCategory: p.qrgParentCategory ?? null,
    categorySource: p.categorySource ?? null,
    id,
    canonicalTitle: (p.canonicalTitle || p.title || '').trim() || null,
    title: (p.canonicalTitle || p.title || '').trim(),
    canonicalDescription,
    description: canonicalDescription,
    brand: p.brand ?? null,
    maker: p.brand ?? null,
    model: p.model ?? null,
    images: allImages,
    imageUrl,
    printifyImages: Array.isArray(p.printifyImages) ? p.printifyImages : [],
    printfulImages: Array.isArray(p.printfulImages) ? p.printfulImages : [],
    madeInUSA,
    blueprintId,
    printfulId,
    printProviderId: pyMapping?.printProviderId ?? p.printProviderId ?? null,
    minPrice: p.minPrice ?? null,
    maxPrice: p.maxPrice ?? null,
    colorMap,
    sizeMap,
    colorCount: colorMap.length,
    availableColors: colorMap.map(c => ({ name: c.colorName, hex: c.hex })),
    availableSizes: sizeMap.map(s => s.sizeLabel),
    fulfillmentProvider,
    availableVia,
    providers: availableVia,
    providerMappings,
  };
}
