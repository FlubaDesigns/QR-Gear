import { catalogSaleVariants } from './catalog-sale-variants';
import { requireFulfillmentProvider } from '../../../shared/fulfillmentSettings';
import { calculatePacketPricing, withInsideLabel } from './pricing';

/** QRG is the authority for supplier, size/color combinations and print areas. */
export function memberProductOptions(master: any, item: any, providerValue: unknown, settings: any) {
  const provider = requireFulfillmentProvider(providerValue);
  const variants = catalogSaleVariants({ enabledColors: item.availableColors, enabledSizes: item.availableSizes }, master, provider);
  const availableColors = item.availableColors.filter((c: any) => variants.some(v => v.color === c.name));
  const availableSizes = item.availableSizes.filter((s: string) => variants.some(v => v.size === s));
  const placements = (master.qrgPrintSpecs?.[provider]?.locations || []).filter((p: any) =>
    p.id !== 'label_inside' && p.provider === provider && p.dimensions?.widthPx > 0 && p.dimensions?.heightPx > 0 &&
    variants.some(v => p.verifiedVariantIds?.includes(Number(v.mapping.variantId))));
  let pricing: any = null, pricingError: string | null = null;
  try {
    const first = placements.find((p: any) => p.id === 'front') || placements[0];
    if (!first) throw new Error('QRG print areas need to be refreshed before building.');
    const snapshot = withInsideLabel(master, { graphics: { content: { graphicLayoutMode: 'zone', qrSizePercent: 75 } }, qrConfig: { qrProductState: 'qr_basics' },
      layoutConfig: { selectedPlacements: [first.id], providerLayouts: { [first.id]: first } },
      metadata: { fulfillmentProvider: provider } });
    pricing = calculatePacketPricing(master, snapshot, settings);
  } catch (error: any) { pricingError = error.message; }
  return { fulfillmentProvider: provider, provider, availableColors, availableSizes, placements,
    availableVariants: variants.map(v => ({ size: v.size, color: v.color })),
    baseCost: pricing?.baseProductCost ?? null, cost: pricing?.baseProductCost ?? null,
    retailPrice: pricing?.customerPrice ?? null,
    memberEarnings: pricing ? Math.round((pricing.customerPrice - pricing.subtotal) * settings.memberProfitShare * 100) / 100 : null,
    pricingError, pricingKind: 'base-qr-basic' };
}
