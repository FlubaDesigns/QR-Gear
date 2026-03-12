"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BUILDER_PERMISSIONS = void 0;
exports.checkSurfaceReadiness = checkSurfaceReadiness;
exports.computePricingSnapshot = computePricingSnapshot;
exports.DEFAULT_BUILDER_PERMISSIONS = {
    allowHeaderText: true,
    allowHeaderImage: false,
    allowFooterText: true,
    allowFooterImage: false,
    allowCenterGraphic: true,
    allowQrModeSwitch: false,
    allowUpload: false,
    allowAssetLibrary: true,
    allowProductChange: false,
    allowVariantChange: true,
    allowSaveDraft: false,
    allowBuyNow: true,
};
function checkSurfaceReadiness(surface, variants) {
    const errors = [];
    let score = 0;
    const totalChecks = 7;
    if (!surface.title || surface.title.trim().length === 0) {
        errors.push('Title is required');
    }
    else {
        score++;
    }
    if (!surface.description || surface.description.trim().length === 0) {
        errors.push('Description is required');
    }
    else {
        score++;
    }
    if (!surface.images || surface.images.length === 0) {
        errors.push('At least one image is required');
    }
    else {
        score++;
    }
    if (surface.retailPrice == null || surface.retailPrice <= 0) {
        errors.push('Retail price must be greater than zero');
    }
    else {
        score++;
    }
    if (!surface.sku || surface.sku.trim().length === 0) {
        errors.push('SKU is required');
    }
    else {
        score++;
    }
    const enabledVariants = variants.filter((v) => v.enabled);
    if (enabledVariants.length === 0) {
        errors.push('At least one enabled variant is required');
    }
    else {
        score++;
    }
    const variantSkus = enabledVariants.map((v) => v.sku).filter(Boolean);
    const uniqueSkus = new Set(variantSkus);
    if (variantSkus.length !== uniqueSkus.size) {
        errors.push('All variant SKUs must be unique');
    }
    for (const v of enabledVariants) {
        if (!v.sku || v.sku.trim().length === 0) {
            errors.push(`Variant ${v.size}/${v.color} is missing a SKU`);
        }
    }
    const hasAnyPlatform = (surface.enabledPlatforms && surface.enabledPlatforms.length > 0)
        || surface.supportsEmbedStore || surface.supportsEmbedProduct || surface.supportsEmbedBuilder
        || surface.supportsEtsy || surface.supportsEbay || surface.supportsAmazon;
    if (!hasAnyPlatform) {
        errors.push('At least one selling channel must be enabled (marketplace or embed)');
    }
    else {
        score++;
    }
    const readinessScore = Math.round((score / totalChecks) * 100);
    return { ready: errors.length === 0, errors, score: readinessScore };
}
function computePricingSnapshot(input) {
    const salePrice = input.salePrice;
    const productCost = input.productCost;
    const providerCost = input.providerCost || 0;
    const platformFeeAmount = input.platformFeeAmount || 0;
    const shippingCostBurden = input.shippingCostBurden || 0;
    const discountBurden = input.discountBurden || 0;
    const affiliatePercent = input.affiliatePercent || 25;
    const grossProfitAmount = salePrice - productCost - providerCost - platformFeeAmount - shippingCostBurden - discountBurden;
    const affiliateAmount = grossProfitAmount > 0 ? Math.round(grossProfitAmount * (affiliatePercent / 100) * 100) / 100 : 0;
    const netPlatformProfitAmount = grossProfitAmount - affiliateAmount;
    return {
        baseSalePrice: salePrice,
        displaySalePrice: salePrice,
        productCost,
        providerCost,
        platformFeeAmount,
        shippingCostBurden,
        discountBurden,
        grossProfitAmount: Math.round(grossProfitAmount * 100) / 100,
        affiliatePercent,
        affiliateBasis: 'gross_profit',
        affiliateAmount,
        netPlatformProfitAmount: Math.round(netPlatformProfitAmount * 100) / 100,
        currency: input.currency || 'USD',
        pricingSnapshotVersion: '1.0',
        createdAt: new Date().toISOString(),
    };
}
//# sourceMappingURL=surfaces.js.map