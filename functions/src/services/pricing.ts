import { db } from '../core';
import { DEFAULT_SIZE_UPCHARGES, normalizeSize, sizeUpcharge } from '../../../shared/storefrontTypes';

export async function getSizeUpcharges(): Promise<Record<string, number>> {
  const settings = await db.collection('testSettings').doc('pricing').get();
  return settings.data()?.sizeUpcharges ?? DEFAULT_SIZE_UPCHARGES;
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
  return Math.round((Number(basePrice) + sizeUpcharge(selectedSize, await getSizeUpcharges())) * 100) / 100;
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
    
    // Fallback: Calculate from base costs only if customerPrice is not set
    const settingsDoc = await db.collection('settings').doc('admin').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : {};
    
    const basePrice = parseFloat(product.basePrice || product.base_price || '0');
    const markupPercent = parseFloat(product.markupPercent || product.markup_percent || settings?.globalMarkupPercent || '25');
    const markupFixed = parseFloat(product.markupFixed || product.markup_fixed || settings?.globalMarkupFixed || '0');
    const qrCost = parseFloat(product.qrProductionCost || product.qr_production_cost || settings?.globalQrProductionCost || '2');
    
    let price = basePrice + qrCost;
    price = price * (1 + markupPercent / 100) + markupFixed;
    
    // Upcharges only apply when calculating from base costs (no customerPrice)
    if (hasTextAbove && productLine !== 'dynamic') {
      const upcharge = parseFloat(settings?.textAboveUpcharge || '2');
      price += upcharge;
    }
    if (hasTextBelow && productLine !== 'dynamic') {
      const upcharge = parseFloat(settings?.textBelowUpcharge || '2');
      price += upcharge;
    }
    
    if (productLine === 'template' && templateId) {
      const templateDoc = await db.collection('qrTemplates').doc(templateId).get();
      if (templateDoc.exists) {
        const template = templateDoc.data();
        const upcharge = parseFloat(template?.priceUpcharge || '0');
        price += upcharge;
      }
    }
    
    if (productLine === 'dynamic') {
      const dynamicUpcharge = parseFloat(settings?.dynamicQrUpcharge || '25');
      price += dynamicUpcharge;
    }
    
    if ((productLine === 'template' || productLine === 'custom' || productLine === 'dynamic') && hostingTierCode !== '1_year') {
      const tierSnapshot = await db.collection('hostingTiers').where('tierCode', '==', hostingTierCode).limit(1).get();
      if (!tierSnapshot.empty) {
        const tier = tierSnapshot.docs[0].data();
        if (!tier.isIncluded) {
          const upcharge = parseFloat(tier.priceUpcharge || '0');
          price += upcharge;
        }
      }
    }
    
    return Math.round((price + sizeUpcharge(customization.selectedSize, await getSizeUpcharges())) * 100) / 100;
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
  
