import { db } from '../core';
import { pricingSettingsSchema, type PricingSettings } from '../../../shared/schema-orders';
import { requireBuilderSnapshot } from '../../../shared/builderSnapshot';
import { requireFulfillmentProvider } from '../../../shared/fulfillmentSettings';
import { normalizeSize, sizeUpcharge } from '../../../shared/storefrontTypes';

export async function getSizeUpcharges(): Promise<Record<string, number>> {
  const settings = await db.collection('testSettings').doc('pricing').get();
  const parsed = pricingSettingsSchema.pick({ sizeUpcharges: true }).safeParse(settings.data());
  if (!parsed.success) throw new Error('Save valid Admin Pricing settings before selling.');
  return parsed.data.sizeUpcharges;
}

export async function getCatalogInstancePrice(instanceId: string, selectedSize?: string | null): Promise<number | null> {
  const instance = await db.collection('admin_catalog_instances').doc(instanceId).get();
  if (!instance.exists) return null;
  const data = instance.data()!;
  const sizes = (data.enabledSizes || data.resolved?.sizes || []).map((s: any) => typeof s === 'string' ? s : s?.name || s?.label);
  if (sizes.length && (!selectedSize || !sizes.some((s: string) => normalizeSize(s) === normalizeSize(selectedSize)))) {
    throw new Error('Select an available product size');
  }
  let basePrice = data.resolved?.pricing?.customerPrice;
  if (basePrice == null && data.currentPacketId) {
    const packet = await db.collection('productPackets').doc(data.currentPacketId).get();
    basePrice = packet.data()?.pricing?.customerPrice;
  }
  if (!Number.isFinite(Number(basePrice)) || Number(basePrice) <= 0) throw new Error('Product price is unavailable');
  const upcharges = await getSizeUpcharges();
  if (selectedSize && upcharges[normalizeSize(selectedSize)] == null) throw new Error('Save the selected size upcharge in Admin Pricing.');
  return Math.round((Number(basePrice) + sizeUpcharge(selectedSize, upcharges)) * 100) / 100;
}

  interface CustomizationPricing {
  productId: string;
  selectedSize?: string;
  productLine?: string;
  hasTextAbove?: boolean;
  hasTextBelow?: boolean;
  templateId?: string;
  hostingTierCode?: string;
}

async function calculateAuthoritativePrice(customization: CustomizationPricing): Promise<number | null> {
  try {
    const { productId, productLine = 'text', hasTextAbove, hasTextBelow, templateId, hostingTierCode = '1_year' } = customization;
    
    const productDoc = await db.collection('products').doc(productId).get();
    if (!productDoc.exists) {
      console.warn(`[Pricing] Product not found: ${productId}`);
      return null;
    }
    const product = productDoc.data()!;
    
    // Per REPLIT.md: "Prices are set by the admin and stored in products.customer_price. 
    // This value is the single source of truth for retail pricing and is never recalculated from base costs."
    const customerPrice = parseFloat(product.customerPrice || product.customer_price || '0');
    if (customerPrice > 0) {
      // The saved price is the base retail price; only the selected size is added.
      return Math.round((customerPrice + sizeUpcharge(customization.selectedSize, await getSizeUpcharges())) * 100) / 100;
    }
    
    throw new Error('Product has no saved sale price. Generate and save its pricing in Admin Products.');
  } catch (error) {
    console.error('[Pricing] Error calculating price:', error);
    return null;
  }
}

async function getAuthoritativePrice(productId: string): Promise<number | null> {
  return calculateAuthoritativePrice({ productId });
}


  export { calculateAuthoritativePrice, getAuthoritativePrice };
  export type { CustomizationPricing };
  


const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const labelPlacements = ['label_inside', 'label_outside'];

/** One calculation for generated packets and the existing catalog price preview.
 * QRG is the only product-cost source. Provider tables never enter this calculation.
 */
export function calculatePacketPricing(master: any, value: any, rawSettings: unknown) {
  const settings = pricingSettingsSchema.parse(rawSettings);
  const snapshot = requireBuilderSnapshot(value);
  const provider = requireFulfillmentProvider(snapshot.metadata.fulfillmentProvider);
  const pm = master?.providerMappings;
  const mapping = Array.isArray(pm) ? pm.find((m: any) => m.provider === provider) : pm?.[provider];
  // The saved sale price is for the base variant. Larger sizes receive the
  // single Admin Pricing surcharge at selection/cart time, never the maximum
  // supplier size cost here as well.
  const baseProductCost = mapping?.minPrice;
  if (typeof baseProductCost !== 'number' || !Number.isFinite(baseProductCost) || baseProductCost < 0) {
    throw new Error(`QRG has no valid ${provider} production cost. Refresh that provider through the QRG catalog import.`);
  }
  const placements: string[] = snapshot.layoutConfig.selectedPlacements;
  if (!placements.length || new Set(placements).size !== placements.length) throw new Error('Choose distinct print placements before pricing.');
  const labels = placements.filter(p => labelPlacements.includes(p));
  if (!labels.includes('label_inside')) throw new Error('Regenerate this saved build with its required inside brand label before applying pricing.');
  const productionPlacements = placements.filter(p => !labelPlacements.includes(p));
  if (!productionPlacements.length) throw new Error('Choose a product print placement.');
  const placementCost = money(Math.max(0, productionPlacements.length - 1) * settings.additionalPlacementCost);
  const content = snapshot.graphics.content;
  const zoneCount = [content.headerStyle, content.footerStyle].filter(zone => zone?.enabled &&
    (zone.mode === 'image' ? !!zone.imageUrl?.trim() : !!zone.text?.trim())).length;
  const textUpcharge = money(zoneCount * settings.textLineUpcharge);
  const centerGraphicUpcharge = content.areaImageUrl?.trim() ? settings.centerGraphicUpcharge : 0;
  const mode = snapshot.qrConfig.qrProductState;
  if (!['qr_basics','qr_plus','qr_canvas','qr_play','qr_compose'].includes(mode)) throw new Error('Select a QR product mode before pricing.');
  const hosted = ['qr_canvas','qr_play','qr_compose'].includes(mode);
  const hostingTierCode = hosted ? (mode === 'qr_compose' && content.composeHostingTerm
    ? content.composeHostingTerm.replace('-', '_') : content.hostingTierCode) : null;
  const tier = hosted ? settings.hostingTiers.find(t => t.code === hostingTierCode) : null;
  if (hosted && !tier) throw new Error(`Hosting tier ${hostingTierCode || '(not selected)'} is not configured in Admin Pricing.`);
  const hostingCost = tier?.price ?? 0;
  const brandLabelPosition = 'inside';
  const brandLabelCosts = Object.fromEntries(labels.map(label => {
    const key = `${provider}${label === 'label_inside' ? 'Inside' : 'Outside'}` as keyof PricingSettings['brandLabelPricing'];
    return [label, settings.brandLabelPricing[key]];
  }));
  const brandLabelCost = money(Object.values(brandLabelCosts).reduce((sum, cost) => sum + cost, 0));
  const shippingCost = settings.builtInShippingCost;
  const subtotal = money(baseProductCost + placementCost + textUpcharge + centerGraphicUpcharge + hostingCost + brandLabelCost + shippingCost);
  const customerPrice = money(subtotal * (1 + settings.markupPercent / 100) + settings.markupFixed);
  if (!Number.isFinite(customerPrice) || customerPrice <= 0) throw new Error('Saved settings produce an invalid sale price.');
  return { baseProductCost, placementCost, textUpcharge, centerGraphicUpcharge, hostingCost, brandLabelCost,
    brandLabelPosition, brandLabelCosts, shippingCost, subtotal, markupPercent: settings.markupPercent, markupFixed: settings.markupFixed,
    markupAmount: money(customerPrice - subtotal), customerPrice, hostingTierCode, fulfillmentProvider: provider,
    pricingVersion: 3, sizeUpcharges: settings.sizeUpcharges };
}

/** New packets retain the mandatory inside brand label when QRG verifies that area.
 * The same saved placement and artwork then go through the ordinary GRF/print pipeline.
 */
export function withInsideLabel(master: any, value: any) {
  const snapshot = requireBuilderSnapshot(value);
  const provider = requireFulfillmentProvider(snapshot.metadata.fulfillmentProvider);
  const label = 'label_inside';
  const spec = master.qrgPrintSpecs?.[provider]?.locations?.find((p: any) => p.id === label);
  if (!(spec?.dimensions?.widthPx > 0 && spec?.dimensions?.heightPx > 0 && spec.providerPlacementId && spec.provider === provider)) {
    throw new Error('Refresh the QRG print areas: this product needs a verified inside label before it can be generated.');
  }
  if (!snapshot.layoutConfig.selectedPlacements.includes(label)) snapshot.layoutConfig.selectedPlacements.push(label);
  snapshot.layoutConfig.providerLayouts = { ...snapshot.layoutConfig.providerLayouts, [label]: spec };
  return snapshot;
}

export async function priceNewPacket(database: any, value: any, brandedTagUrl: string) {
  const input = requireBuilderSnapshot(value);
  const provider = requireFulfillmentProvider(input.metadata.fulfillmentProvider);
  const { refreshQrgProviderPricing } = await import('./master-catalog');
  const master = await refreshQrgProviderPricing(database, input.metadata.selectedProductDocId, provider);
  const settings = pricingSettingsSchema.parse((await database.collection('testSettings').doc('pricing').get()).data());
  const snapshot = withInsideLabel(master, input);
  if (!/^https:\/\//.test(brandedTagUrl)) throw new Error('The configured brand label artwork is unavailable.');
  const placementGraphicUrls = { label_inside: brandedTagUrl };
  const pricing = calculatePacketPricing(master, snapshot, settings);
  return { builderSnapshot: snapshot, pricing, placementGraphicUrls };
}
