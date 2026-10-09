import { getQrgSizeCode, getQrgColorCode, SIZE_LABELS, COLOR_LABELS } from '../../../shared/qrgVariantMappings';
import { printfulClient } from './printful';
import { normalizePlacement, isEmbroideryPlacement } from '../../../shared/placements';


/** One supplier row per existing SSCC identity. Never let an alias overwrite the
 * canonical color, or pair one color label with a different supplier variant. */
export function selectQrgPrintfulVariants(rows: any[], existing: any = {}) {
  const groups = new Map<string, any[]>(), unmapped: any[] = [];
  for (const row of rows) {
    const size = getQrgSizeCode(row.size || ''), color = getQrgColorCode(row.color || '');
    if (!size || !color) { unmapped.push(row); continue; }
    const key = size.slice(-2) + color;
    groups.set(key, [...(groups.get(key) || []), row]);
  }
  const norm = (value: string) => String(value || '').trim().toLowerCase();
  return [...groups.entries()].map(([key, values]) => {
    const canonical = COLOR_LABELS[key.slice(-2)], previous = existing[key]?.colorLabel;
    const rank = (row: any) => norm(row.color) === norm(canonical) ? 0 : previous && norm(row.color) === norm(previous) ? 1 : 2;
    return values.sort((a, b) => rank(a) - rank(b) || String(a.color).localeCompare(String(b.color)) || Number(a.id || a.variantId) - Number(b.id || b.variantId))[0];
  }).concat(unmapped);
}

async function refreshQrgVariants(product: any, productId: number) {
  const detail = await printfulClient.getProduct(productId);
  if (Number(detail.product?.id) !== productId || !detail.variants?.length) throw new Error('QRG supplier refresh returned the wrong or empty product.');
  const selected = selectQrgPrintfulVariants(detail.variants, product.qrgVariants).filter(row => getQrgSizeCode(row.size) && getQrgColorCode(row.color));
  if (!selected.length) throw new Error('QRG supplier refresh has no recognized variants.');
  const variants: Record<string, any> = {};
  for (const [key, row] of Object.entries(product.qrgVariants || {}) as [string, any][]) {
    const { printful, ...providers } = row.providerVariants || {};
    if (Object.keys(providers).length) variants[key] = { ...row, providerVariants: providers, availableVia: (row.availableVia || []).filter((p: string) => p !== 'printful') };
  }
  for (const row of selected) {
    const size = getQrgSizeCode(row.size)!, color = getQrgColorCode(row.color)!, key = size.slice(-2) + color;
    if (!Number.isSafeInteger(Number(row.id)) || Number(row.id) <= 0) throw new Error('QRG supplier variant ID is invalid.');
    variants[key] = { ...variants[key], sizeCode: size.slice(-2), colorCode: color, sizeLabel: SIZE_LABELS[size], colorLabel: row.color,
      providerVariants: { ...variants[key]?.providerVariants, printful: { productId: String(productId), variantId: String(row.id) } },
      availableVia: [...new Set([...(variants[key]?.availableVia || []), 'printful'])] };
  }
  product.qrgVariants = variants;
}

/** QRG owns supplier imports; callers consume only this normalized QRG projection. */
export function qrgPrintfulProductId(product: any): number | null {
  const pm = product.providerMappings;
  const mapping = Array.isArray(pm) ? pm.find((p: any) => p.provider === 'printful') : pm?.printful;
  const ids = new Set(Object.values(product.qrgVariants || {}).map((v: any) => Number(v.providerVariants?.printful?.productId)).filter(n => n > 0));
  const id = Number(mapping?.productId || product.printfulProductId || (ids.size === 1 ? [...ids][0] : 0));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function projectQrgPrintfiles(product: any, data: any) {
  const variants = Object.values(product.qrgVariants || {}).map((v: any) => Number(v.providerVariants?.printful?.variantId)).filter(n => n > 0);
  if (!variants.length) throw new Error('QRG has no mapped print variants.');
  const files = new Map((data?.printfiles || []).map((f: any) => [Number(f.printfile_id), f]));
  const rows = new Map((data?.variant_printfiles || []).map((v: any) => [Number(v.variant_id), v]));
  const mappings = variants.map(id => rows.get(id) as any);
  if (mappings.some(v => !v?.placements)) throw new Error('Printer specifications do not cover all QRG variants.');
  const common = Object.keys(mappings[0].placements).filter(p => !isEmbroideryPlacement(p) && mappings.every(v => v.placements[p]));
  const locations: any[] = [];
  for (const placement of common) {
    const specs = mappings.map(v => files.get(Number(v.placements[placement])) as any);
    if (specs.some(f => !f || !Number.isFinite(f.width) || !Number.isFinite(f.height) || !Number.isFinite(f.dpi) || f.width <= 0 || f.height <= 0 || f.dpi <= 0)) continue;
    const first = specs[0];
    // A single full-canvas file must have the same physical print area for every
    // offered variant. Do not silently stretch it onto a smaller-size template.
    if (specs.some(f => f.width / f.dpi !== first.width / first.dpi || f.height / f.dpi !== first.height / first.dpi)) continue;
    const id = normalizePlacement('printful', placement);
    if (locations.some(p => p.id === id)) continue;
    locations.push({ id, label: id.replace(/_/g, ' '), canonicalLocationCode: id,
      provider: 'printful', providerPlacement: placement, providerPlacementId: placement,
      sourceTable: 'master_catalog.qrgPrintSpecs.printful', layoutSource: 'qrg_verified_printfiles',
      dimensions: { widthPx: first.width, heightPx: first.height, widthIn: first.width / first.dpi, heightIn: first.height / first.dpi, dpi: first.dpi },
      printArea: { widthPx: first.width, heightPx: first.height }, dpi: first.dpi,
      verifiedVariantIds: [...new Set(variants)],
    });
  }
  if (!locations.length) throw new Error('QRG needs a shared verified print area for the offered sizes; no compatible placement was returned.');
  return locations;
}

export async function resolveQrgPrintSpecs(product: any, ref: any, getPrintfiles: (id: number) => Promise<any>, refresh = false) {
  const productId = qrgPrintfulProductId(product);
  if (!productId) throw new Error('QRG is missing its printer product mapping.');
  if (refresh) await refreshQrgVariants(product, productId);
  const cache = product.qrgPrintSpecs?.printful;
  const variantIds = [...new Set(Object.values(product.qrgVariants || {}).map((v: any) => Number(v.providerVariants?.printful?.variantId)).filter(n => n > 0))].sort((a,b) => a-b);
  if (!refresh && cache?.productId === productId && cache?.locations?.length &&
      JSON.stringify(cache.variantIds) === JSON.stringify(variantIds)) return cache.locations;
  const locations = projectQrgPrintfiles(product, await getPrintfiles(productId));
  await ref.update({ ...(refresh ? { qrgVariants: product.qrgVariants } : {}), 'qrgPrintSpecs.printful': { productId, variantIds, locations, checkedAt: new Date().toISOString() } });
  return locations;
}
