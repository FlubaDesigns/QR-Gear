import { z } from "zod";
// Shared Firestore/API contracts. Persistence is owned by Firebase services.
export const insertPartnerStoreSchema = z.object({
    "slug": z.string(),
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "logoUrl": z.string().nullable().optional(),
    "websiteUrl": z.string().nullable().optional(),
    "businessPageUrlPattern": z.string().nullable().optional(),
    "apiKey": z.string(),
    "allowedOrigins": z.array(z.string()).nullable().optional(),
    "primaryColor": z.string().nullable().optional(),
    "accentColor": z.string().nullable().optional(),
    "commissionPercent": z.string().nullable().optional(),
    "availableSegments": z.array(z.string()).nullable().optional(),
    "isInternal": z.boolean().nullable().optional(),
    "annualMemberPerk": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
});
export const insertPartnerStoreProductSchema = z.object({
    "partnerStoreId": z.string(),
    "productId": z.string(),
    "customPrice": z.string().nullable().optional(),
    "customName": z.string().nullable().optional(),
    "kcPlacements": z.array(z.string()).nullable().optional(),
    "kcBusinessSlug": z.string().nullable().optional(),
    "enabledSizes": z.array(z.string()).nullable().optional(),
    "enabledColors": z.array(z.string()).nullable().optional(),
    "defaultColor": z.string().nullable().optional(),
    "mockupsByColor": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isEnabled": z.boolean().nullable().optional(),
});
export const insertMasterProductSchema = z.object({
    "sku": z.string(),
    "title": z.string(),
    "description": z.string().nullable().optional(),
    "productType": z.string(),
    "currentDesignVersionId": z.string().nullable().optional(),
    "pricingProfileId": z.string().nullable().optional(),
    "baseCost": z.string().nullable().optional(),
    "retailPrice": z.string().nullable().optional(),
    "status": z.string().nullable().optional(),
    "channels": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "tags": z.array(z.string()).nullable().optional(),
    "bundleParentId": z.string().nullable().optional(),
    "bundleDiscount": z.string().nullable().optional(),
});
export const insertProductDesignVersionSchema = z.object({
    "masterProductId": z.string(),
    "versionNumber": z.number().min(-2147483648).max(2147483647).int().optional(),
    "headerText": z.string().nullable().optional(),
    "headerStyle": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "footerText": z.string().nullable().optional(),
    "footerStyle": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "qrUrl": z.string(),
    "renderedPngUrl": z.string().nullable().optional(),
    "renderedSvgUrl": z.string().nullable().optional(),
    "qrCodeUrl": z.string().nullable().optional(),
    "placementImages": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
});
export const insertChannelConfigSchema = z.object({
    "channelType": z.string(),
    "displayName": z.string(),
    "isEnabled": z.boolean().nullable().optional(),
    "apiKeySecretName": z.string().nullable().optional(),
    "apiSecretSecretName": z.string().nullable().optional(),
    "shopId": z.string().nullable().optional(),
    "rateLimit": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "rateLimitWindow": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "webhookSecret": z.string().nullable().optional(),
    "webhookUrl": z.string().nullable().optional(),
    "lastHealthCheck": z.date().nullable().optional(),
    "settings": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
});
export const insertChannelPublishStateSchema = z.object({
    "masterProductId": z.string(),
    "channelType": z.string(),
    "externalProductId": z.string().nullable().optional(),
    "externalListingId": z.string().nullable().optional(),
    "externalVariantIds": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "status": z.string().nullable().optional(),
    "lastPublishedAt": z.date().nullable().optional(),
    "lastSyncedAt": z.date().nullable().optional(),
    "lastError": z.string().nullable().optional(),
    "publishedDesignVersionId": z.string().nullable().optional(),
});
export const insertProviderQuoteSchema = z.object({
    "masterProductId": z.string(),
    "providerType": z.string(),
    "productionCost": z.string(),
    "shippingCost": z.string().nullable().optional(),
    "estimatedDays": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isAvailable": z.boolean().nullable().optional(),
    "quotedAt": z.date().optional(),
    "expiresAt": z.date().nullable().optional(),
});
export const insertPricingProfileSchema = z.object({
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "markupType": z.string().optional(),
    "markupPercent": z.string().nullable().optional(),
    "markupFixed": z.string().nullable().optional(),
    "minMarginPercent": z.string().nullable().optional(),
    "channelAdjustments": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "autoRepriceEnabled": z.boolean().nullable().optional(),
    "autoRepriceMinMargin": z.string().nullable().optional(),
    "isDefault": z.boolean().nullable().optional(),
});
export const insertOrderUnifiedSchema = z.object({
    "sourceChannel": z.string(),
    "externalOrderId": z.string().nullable().optional(),
    "customerEmail": z.string().nullable().optional(),
    "customerName": z.string().nullable().optional(),
    "shippingAddress": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "items": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]),
    "subtotal": z.string(),
    "shippingTotal": z.string().nullable().optional(),
    "taxTotal": z.string().nullable().optional(),
    "total": z.string(),
    "routedProvider": z.string().nullable().optional(),
    "providerOrderId": z.string().nullable().optional(),
    "status": z.string().nullable().optional(),
    "statusHistory": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "trackingNumber": z.string().nullable().optional(),
    "trackingUrl": z.string().nullable().optional(),
    "shippedAt": z.date().nullable().optional(),
    "deliveredAt": z.date().nullable().optional(),
    "productionCost": z.string().nullable().optional(),
    "profit": z.string().nullable().optional(),
});
export const insertQrScanEventSchema = z.object({
    "masterProductId": z.string().nullable().optional(),
    "customDesignId": z.string().nullable().optional(),
    "qrUrl": z.string().nullable().optional(),
    "scanDate": z.date().optional(),
    "scanCount": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "country": z.string().nullable().optional(),
    "region": z.string().nullable().optional(),
    "deviceType": z.string().nullable().optional(),
    "userAgent": z.string().nullable().optional(),
});
export const insertProviderHealthLogSchema = z.object({
    "providerType": z.string(),
    "checkTime": z.date().optional(),
    "isHealthy": z.boolean().nullable().optional(),
    "responseTimeMs": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "errorMessage": z.string().nullable().optional(),
    "errorCode": z.string().nullable().optional(),
    "uptimePercent24h": z.string().nullable().optional(),
    "avgResponseTime24h": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
});
export const insertRepricingRuleSchema = z.object({
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "priority": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "conditions": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "actionType": z.string(),
    "actionParams": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "appliesTo": z.string().nullable().optional(),
    "appliesToIds": z.array(z.string()).nullable().optional(),
});
export const insertRepricingHistorySchema = z.object({
    "ruleId": z.string().nullable().optional(),
    "masterProductId": z.string().nullable().optional(),
    "channel": z.string().nullable().optional(),
    "previousPrice": z.string(),
    "newPrice": z.string(),
    "reason": z.string(),
    "previousMargin": z.string().nullable().optional(),
    "newMargin": z.string().nullable().optional(),
    "wasAutomatic": z.boolean().nullable().optional(),
});
export type PartnerStore = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    isActive: boolean | null;
    slug: string;
    logoUrl: string | null;
    websiteUrl: string | null;
    businessPageUrlPattern: string | null;
    apiKey: string;
    allowedOrigins: string[] | null;
    primaryColor: string | null;
    accentColor: string | null;
    commissionPercent: string | null;
    availableSegments: string[] | null;
    isInternal: boolean | null;
    annualMemberPerk: unknown;
};
export type InsertPartnerStore = z.infer<typeof insertPartnerStoreSchema>;
export type PartnerStoreProduct = {
    id: string;
    isEnabled: boolean | null;
    productId: string;
    sortOrder: number | null;
    defaultColor: string | null;
    mockupsByColor: unknown;
    partnerStoreId: string;
    customPrice: string | null;
    customName: string | null;
    kcPlacements: string[] | null;
    kcBusinessSlug: string | null;
    enabledSizes: string[] | null;
    enabledColors: string[] | null;
};
export type InsertPartnerStoreProduct = z.infer<typeof insertPartnerStoreProductSchema>;
export type MasterProduct = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    title: string;
    description: string | null;
    status: string | null;
    tags: string[] | null;
    sku: string;
    productType: string;
    currentDesignVersionId: string | null;
    pricingProfileId: string | null;
    baseCost: string | null;
    retailPrice: string | null;
    channels: unknown;
    bundleParentId: string | null;
    bundleDiscount: string | null;
};
export type InsertMasterProduct = z.infer<typeof insertMasterProductSchema>;
export type ProductDesignVersion = {
    id: string;
    createdAt: Date;
    isActive: boolean | null;
    placementImages: unknown;
    qrCodeUrl: string | null;
    masterProductId: string;
    versionNumber: number;
    headerText: string | null;
    headerStyle: unknown;
    footerText: string | null;
    footerStyle: unknown;
    qrUrl: string;
    renderedPngUrl: string | null;
    renderedSvgUrl: string | null;
};
export type InsertProductDesignVersion = z.infer<typeof insertProductDesignVersionSchema>;
export type ChannelConfig = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isEnabled: boolean | null;
    channelType: string;
    displayName: string;
    apiKeySecretName: string | null;
    apiSecretSecretName: string | null;
    shopId: string | null;
    rateLimit: number | null;
    rateLimitWindow: number | null;
    webhookSecret: string | null;
    webhookUrl: string | null;
    lastHealthCheck: Date | null;
    settings: unknown;
};
export type InsertChannelConfig = z.infer<typeof insertChannelConfigSchema>;
export type ChannelPublishState = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: string | null;
    lastSyncedAt: Date | null;
    masterProductId: string;
    channelType: string;
    externalProductId: string | null;
    externalListingId: string | null;
    externalVariantIds: unknown;
    lastPublishedAt: Date | null;
    lastError: string | null;
    publishedDesignVersionId: string | null;
};
export type InsertChannelPublishState = z.infer<typeof insertChannelPublishStateSchema>;
export type ProviderQuote = {
    id: string;
    expiresAt: Date | null;
    masterProductId: string;
    providerType: string;
    productionCost: string;
    shippingCost: string | null;
    estimatedDays: number | null;
    isAvailable: boolean | null;
    quotedAt: Date;
};
export type InsertProviderQuote = z.infer<typeof insertProviderQuoteSchema>;
export type PricingProfile = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    markupPercent: string | null;
    markupFixed: string | null;
    markupType: string;
    minMarginPercent: string | null;
    channelAdjustments: unknown;
    autoRepriceEnabled: boolean | null;
    autoRepriceMinMargin: string | null;
    isDefault: boolean | null;
};
export type InsertPricingProfile = z.infer<typeof insertPricingProfileSchema>;
export type OrderUnified = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    status: string | null;
    shippingAddress: unknown;
    trackingNumber: string | null;
    trackingUrl: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    productionCost: string | null;
    sourceChannel: string;
    externalOrderId: string | null;
    customerEmail: string | null;
    customerName: string | null;
    items: unknown;
    subtotal: string;
    shippingTotal: string | null;
    taxTotal: string | null;
    total: string;
    routedProvider: string | null;
    providerOrderId: string | null;
    statusHistory: unknown;
    profit: string | null;
};
export type InsertOrderUnified = z.infer<typeof insertOrderUnifiedSchema>;
export type QrScanEvent = {
    id: string;
    country: string | null;
    masterProductId: string | null;
    qrUrl: string | null;
    customDesignId: string | null;
    scanDate: Date;
    scanCount: number | null;
    region: string | null;
    deviceType: string | null;
    userAgent: string | null;
};
export type InsertQrScanEvent = z.infer<typeof insertQrScanEventSchema>;
export type ProviderHealthLog = {
    id: string;
    errorMessage: string | null;
    providerType: string;
    checkTime: Date;
    isHealthy: boolean | null;
    responseTimeMs: number | null;
    errorCode: string | null;
    uptimePercent24h: string | null;
    avgResponseTime24h: number | null;
};
export type InsertProviderHealthLog = z.infer<typeof insertProviderHealthLogSchema>;
export type RepricingRule = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    isActive: boolean | null;
    priority: number | null;
    conditions: {
        marginBelow?: number;
        marginAbove?: number;
        channel?: string;
        productCategory?: string;
        costIncreasePercent?: number;
        competitorPriceBelow?: number;
    } | null;
    actionType: string;
    actionParams: {
        targetMarginPercent?: number;
        adjustPercent?: number;
        minPrice?: number;
        maxPrice?: number;
        roundTo?: number;
    } | null;
    appliesTo: string | null;
    appliesToIds: string[] | null;
};
export type InsertRepricingRule = z.infer<typeof insertRepricingRuleSchema>;
export type RepricingHistoryEntry = {
    id: string;
    masterProductId: string | null;
    ruleId: string | null;
    channel: string | null;
    previousPrice: string;
    newPrice: string;
    reason: string;
    previousMargin: string | null;
    newMargin: string | null;
    appliedAt: Date;
    wasAutomatic: boolean | null;
};
export type InsertRepricingHistoryEntry = z.infer<typeof insertRepricingHistorySchema>;
