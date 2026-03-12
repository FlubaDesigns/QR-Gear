"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateAuthoritativePrice = calculateAuthoritativePrice;
exports.getAuthoritativePrice = getAuthoritativePrice;
const core_1 = require("../core");
async function calculateAuthoritativePrice(customization) {
    try {
        const { productId, productLine = 'text', hasTextAbove, hasTextBelow, templateId, hostingTierCode = '1_year' } = customization;
        const productDoc = await core_1.db.collection('products').doc(productId).get();
        if (!productDoc.exists) {
            console.warn(`[Pricing] Product not found: ${productId}`);
            return null;
        }
        const product = productDoc.data();
        // Per replit.md: "Prices are set by the admin and stored in products.customer_price. 
        // This value is the single source of truth for retail pricing and is never recalculated from base costs."
        const customerPrice = parseFloat(product.customerPrice || product.customer_price || '0');
        if (customerPrice > 0) {
            // customerPrice is the FINAL authoritative price - no upcharges added
            return customerPrice;
        }
        // Fallback: Calculate from base costs only if customerPrice is not set
        const settingsDoc = await core_1.db.collection('settings').doc('admin').get();
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
            const templateDoc = await core_1.db.collection('qrTemplates').doc(templateId).get();
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
            const tierSnapshot = await core_1.db.collection('hostingTiers').where('tierCode', '==', hostingTierCode).limit(1).get();
            if (!tierSnapshot.empty) {
                const tier = tierSnapshot.docs[0].data();
                if (!tier.isIncluded) {
                    const upcharge = parseFloat(tier.priceUpcharge || '0');
                    price += upcharge;
                }
            }
        }
        return Math.round(price * 100) / 100;
    }
    catch (error) {
        console.error('[Pricing] Error calculating price:', error);
        return null;
    }
}
async function getAuthoritativePrice(productId) {
    return calculateAuthoritativePrice({ productId });
}
//# sourceMappingURL=pricing.js.map