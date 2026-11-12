import { masterBlankImages } from "./productImages";
import { masterPrintTextBackground, type PrintTextBackground } from './printTextColor';
import { COLOR_LABELS, SIZE_LABELS } from './qrgVariantMappings';

/**
 * Build normalized colorMap and sizeMap from a Firestore master_catalog doc.
 * Reads qrgVariants as the canonical source (colorLabel, sizeLabel, colorCode, sizeCode).
 * Falls back to legacy availableColors/availableSizes only if qrgVariants is absent.
 */
export function buildColorSizeFromDoc(p: any): {
  colorMap: Array<PrintTextBackground & { qrgColorCode: string; colorName: string; hex: string; available: boolean }>;
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
    return { qrgColorCode: code, colorName, ...masterPrintTextBackground(p, colorName), available: true };
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
    availableColors: colorMap.map(c => ({ name: c.colorName, hex: c.hex, contrastHex: c.contrastHex, textColorMode: c.textColorMode })),
    availableSizes: sizeMap.map(s => s.sizeLabel),
    fulfillmentProvider,
    availableVia,
    providers: availableVia,
    providerMappings,
  };
}


// ── QRG Top-Level Category Definitions ───────────────────────────────────────
// Canonical category allocation definitions used by lookup, master projection and Products.
// Each top-level gets a X000 code. Subcategories get X100–X900.
// Each subcategory holds up to 99 products (X101–X199, etc.).
export const QRG_TOP_LEVEL_CATEGORIES = [
  { name: 'Apparel',            code: 1000 },
  { name: 'Houseware',          code: 2000 },
  { name: 'Print & Display',    code: 3000 },
  { name: 'Accessories',        code: 4000 },
  { name: 'Pet Products',       code: 5000 },
  { name: 'Holiday & Seasonal', code: 6000 },
] as const;

// ── QRG Blank Category Definitions (5-digit BBBBB scheme) ────────────────────
// Structure: [category 1-6][subcategory 1-9][slot 001-999]
// Each subcategory holds up to 999 blanks. If a subcategory ever exceeds 999,
// allocation simply continues past rangeEnd (no hard stop — "screw it").
export const QRG_BLANK_CATEGORIES = [
  // ── 1x000 Apparel ─────────────────────────────────────────────────────────
  { name: 'T-Shirts',              parent: 'Apparel',            rangeStart: 11101, rangeEnd: 11999, schemaType: 'tshirt', schemaCollection: 'tshirts' },
  { name: 'Hoodies & Sweatshirts', parent: 'Apparel',            rangeStart: 12101, rangeEnd: 12999, schemaType: 'hoodie', schemaCollection: 'hoodies' },
  { name: 'Hats',                  parent: 'Apparel',            rangeStart: 13101, rangeEnd: 13999, schemaType: 'hat', schemaCollection: 'hats' },
  { name: 'Tank Tops',             parent: 'Apparel',            rangeStart: 14101, rangeEnd: 14999, schemaType: 'tank', schemaCollection: 'tanks' },
  { name: 'Long Sleeve',           parent: 'Apparel',            rangeStart: 15101, rangeEnd: 15999, schemaType: 'longsleeve', schemaCollection: 'longsleeves' },
  { name: "Youth/Kids",            parent: 'Apparel',            rangeStart: 16101, rangeEnd: 16999, schemaType: 'youth', schemaCollection: 'youth' },
  { name: "Women's",               parent: 'Apparel',            rangeStart: 17101, rangeEnd: 17999, schemaType: 'womens', schemaCollection: 'womens' },
  { name: 'Specialty Apparel',     parent: 'Apparel',            rangeStart: 18101, rangeEnd: 18999, schemaType: 'specialty_apparel', schemaCollection: 'specialty_apparel' },
  // ── 2x000 Houseware ───────────────────────────────────────────────────────
  { name: 'Drinkware',             parent: 'Houseware',          rangeStart: 21101, rangeEnd: 21999, schemaType: 'drinkware', schemaCollection: 'drinkware' },
  { name: 'Barware',               parent: 'Houseware',          rangeStart: 22101, rangeEnd: 22999, schemaType: 'barware', schemaCollection: 'barware' },
  { name: 'Drinkware Accessories', parent: 'Houseware',          rangeStart: 23101, rangeEnd: 23999, schemaType: 'drinkware_accessory', schemaCollection: 'drinkware_accessories' },
  { name: 'Kitchen & Dining',      parent: 'Houseware',          rangeStart: 24101, rangeEnd: 24999, schemaType: 'kitchen', schemaCollection: 'kitchen' },
  { name: 'Bedding & Textiles',    parent: 'Houseware',          rangeStart: 25101, rangeEnd: 25999, schemaType: 'bedding', schemaCollection: 'bedding' },
  { name: 'Home Décor',            parent: 'Houseware',          rangeStart: 26101, rangeEnd: 26999, schemaType: 'home_decor', schemaCollection: 'home_decor' },
  // ── 3x000 Print & Display ─────────────────────────────────────────────────
  { name: 'Wall Art & Prints',     parent: 'Print & Display',    rangeStart: 31101, rangeEnd: 31999, schemaType: 'poster', schemaCollection: 'posters' },
  { name: 'Stickers & Magnets',    parent: 'Print & Display',    rangeStart: 32101, rangeEnd: 32999, schemaType: 'sticker', schemaCollection: 'stickers' },
  { name: 'Stationery & Paper',    parent: 'Print & Display',    rangeStart: 33101, rangeEnd: 33999, schemaType: 'card', schemaCollection: 'cards' },
  { name: 'Signs & Display',       parent: 'Print & Display',    rangeStart: 34101, rangeEnd: 34999, schemaType: 'sign', schemaCollection: 'signs' },
  { name: 'Books & Photo',         parent: 'Print & Display',    rangeStart: 35101, rangeEnd: 35999, schemaType: 'book', schemaCollection: 'books' },
  { name: 'Pins & Patches',        parent: 'Print & Display',    rangeStart: 36101, rangeEnd: 36999, schemaType: 'patch', schemaCollection: 'patches' },
  { name: 'Tags',                  parent: 'Print & Display',    rangeStart: 37101, rangeEnd: 37999, schemaType: 'tag', schemaCollection: 'tags' },
  { name: 'Puzzles & Games',       parent: 'Print & Display',    rangeStart: 38101, rangeEnd: 38999, schemaType: 'puzzle', schemaCollection: 'puzzles' },
  { name: 'Novelty',               parent: 'Print & Display',    rangeStart: 39101, rangeEnd: 39999, schemaType: 'novelty', schemaCollection: 'novelty' },
  // ── 4x000 Accessories ─────────────────────────────────────────────────────
  { name: 'Bags & Pouches',        parent: 'Accessories',        rangeStart: 41101, rangeEnd: 41999, schemaType: 'bag', schemaCollection: 'bags' },
  { name: 'Jewelry',               parent: 'Accessories',        rangeStart: 42101, rangeEnd: 42999, schemaType: 'jewelry', schemaCollection: 'jewelry' },
  { name: 'Phone & Tech Cases',    parent: 'Accessories',        rangeStart: 43101, rangeEnd: 43999, schemaType: 'phone_case', schemaCollection: 'phone_cases' },
  { name: 'Travel Accessories',    parent: 'Accessories',        rangeStart: 44101, rangeEnd: 44999, schemaType: 'travel_accessory', schemaCollection: 'travel_accessories' },
  { name: 'Small Accessories',     parent: 'Accessories',        rangeStart: 45101, rangeEnd: 45999, schemaType: 'accessory', schemaCollection: 'accessories' },
  // ── 5x000 Pet Products ────────────────────────────────────────────────────
  { name: 'Pet Apparel',           parent: 'Pet Products',       rangeStart: 51101, rangeEnd: 51999, schemaType: 'pet_apparel', schemaCollection: 'pet_apparel' },
  { name: 'Pet Accessories',       parent: 'Pet Products',       rangeStart: 52101, rangeEnd: 52999, schemaType: 'pet_accessory', schemaCollection: 'pet_accessories' },
  // ── 6x000 Holiday & Seasonal ──────────────────────────────────────────────
  { name: 'Ornaments & Décor',     parent: 'Holiday & Seasonal', rangeStart: 61101, rangeEnd: 61999, schemaType: 'ornament', schemaCollection: 'ornaments' },
  { name: 'Stockings & Gifting',   parent: 'Holiday & Seasonal', rangeStart: 62101, rangeEnd: 62999, schemaType: 'stocking', schemaCollection: 'stockings' },
  { name: 'Seasonal Apparel',      parent: 'Holiday & Seasonal', rangeStart: 63101, rangeEnd: 63999, schemaType: 'seasonal_apparel', schemaCollection: 'seasonal_apparel' },
] as const;

/** Read assigned QRG type metadata; this never allocates or changes an identity. */
export function qrgProductSchema(docId: string) {
  if (!/^qrg_[1-6][1-9]\d{3}$/.test(docId)) throw new Error('Invalid QRG blank identity');
  const prefix = Number(docId.slice(4, 6));
  const category = QRG_BLANK_CATEGORIES.find(c => Math.floor(c.rangeStart / 1000) === prefix);
  if (!category) throw new Error('QRG product type is not defined');
  const families: Record<string, string> = { 'Apparel': 'apparel', 'Houseware': 'houseware', 'Print & Display': 'print_display', 'Accessories': 'accessories', 'Pet Products': 'pet', 'Holiday & Seasonal': 'holiday' };
  const schemaFamily = families[category.parent];
  return { category: category.name, schemaFamily, schemaType: category.schemaType,
    schemaCollection: category.schemaCollection,
    canonicalProfilePath: `layout_profiles/${schemaFamily}/${category.schemaCollection}` };
}
