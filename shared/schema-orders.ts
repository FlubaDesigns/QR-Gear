import { z } from "zod";
// Shared Firestore/API contracts. Persistence is owned by Firebase services.
const pricingAmount = z.number().finite().nonnegative();
export const pricingSettingsSchema = z.object({
    markupPercent: pricingAmount,
    markupFixed: pricingAmount,
    additionalPlacementCost: pricingAmount,
    textLineUpcharge: pricingAmount,
    centerGraphicUpcharge: pricingAmount,
    memberProfitShare: pricingAmount.max(1),
    builtInShippingCost: pricingAmount,
    sizeUpcharges: z.record(pricingAmount),
    hostingTiers: z.array(z.object({ code: z.string().trim().min(1), name: z.string().trim().min(1), price: pricingAmount }))
        .refine(tiers => new Set(tiers.map(t => t.code)).size === tiers.length, 'Hosting tier codes must be unique'),
    brandLabelPricing: z.object({ printifyInside: pricingAmount, printifyOutside: pricingAmount, printfulInside: pricingAmount, printfulOutside: pricingAmount }),
    preferredLabelPosition: z.enum(['inside', 'outside']),
});
export type PricingSettings = z.infer<typeof pricingSettingsSchema>;
export const insertCartItemSchema = z.object({
    "userId": z.string(),
    "designId": z.string().nullable().optional(),
    "productId": z.string(),
    "quantity": z.number().min(-2147483648).max(2147483647).int().optional(),
    "customization": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]),
    "price": z.string(),
});
export const insertOrderSchema = z.object({
    "userId": z.string(),
    "status": z.string(),
    "totalAmount": z.string(),
    "stripePaymentId": z.string().nullable().optional(),
    "stripeSessionId": z.string().nullable().optional(),
    "stripePaymentIntentId": z.string().nullable().optional(),
    "printifyOrderId": z.string().nullable().optional(),
    "shippingAddress": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "trackingNumber": z.string().nullable().optional(),
    "carrier": z.string().nullable().optional(),
});
export const insertOrderItemSchema = z.object({
    "orderId": z.string(),
    "productId": z.string(),
    "quantity": z.number().min(-2147483648).max(2147483647).int(),
    "customization": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]),
    "price": z.string(),
    "printifyItemId": z.string().nullable().optional(),
});
export const insertGiftBackgroundSchema = z.object({
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "category": z.string().nullable().optional(),
    "thumbnailUrl": z.string(),
    "fullImageUrl": z.string(),
    "storageUrl": z.string(),
    "isActive": z.boolean().nullable().optional(),
    "isFeatured": z.boolean().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
});
export const insertHostingTierSchema = z.object({
    "code": z.string(),
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "durationDays": z.number().min(-2147483648).max(2147483647).int(),
    "isIncluded": z.boolean().nullable().optional(),
    "priceUpcharge": z.string().nullable().optional(),
    "videoPriceUpcharge": z.string().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
});
export const insertCouponSchema = z.object({
    "code": z.string(),
    "name": z.string(),
    "discountType": z.string(),
    "discountValue": z.string(),
    "currency": z.string().nullable().optional(),
    "minOrderAmount": z.string().nullable().optional(),
    "maxRedemptions": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "validFrom": z.date().nullable().optional(),
    "validUntil": z.date().nullable().optional(),
    "stripeCouponId": z.string().nullable().optional(),
    "stripePromotionCodeId": z.string().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
});
export const insertCustomGiftSchema = z.object({
    "userId": z.string().nullable().optional(),
    "slug": z.string(),
    "backgroundSource": z.string(),
    "backgroundId": z.string().nullable().optional(),
    "uploadedImageId": z.string().nullable().optional(),
    "compositeImageUrl": z.string().nullable().optional(),
    "overlayConfig": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "textAboveQr": z.string().nullable().optional(),
    "textBelowQr": z.string().nullable().optional(),
    "qrTextContent": z.string().nullable().optional(),
    "hostingTierId": z.string().nullable().optional(),
    "disclaimerAccepted": z.boolean().nullable().optional(),
    "disclaimerAcceptedAt": z.date().nullable().optional(),
    "pricingSnapshot": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "status": z.string().nullable().optional(),
    "expiresAt": z.date().nullable().optional(),
});
export const insertHostingReminderSchema = z.object({
    "customGiftId": z.string(),
    "userId": z.string().nullable().optional(),
    "reminderType": z.string(),
    "scheduledFor": z.date(),
    "sentAt": z.date().nullable().optional(),
    "emailAddress": z.string().nullable().optional(),
    "status": z.string().nullable().optional(),
});
export const insertDynamicPageSchema = z.object({
    "userId": z.string(),
    "slug": z.string(),
    "title": z.string(),
    "description": z.string().nullable().optional(),
    "activeAssetId": z.string().nullable().optional(),
    "hostingTierId": z.string().nullable().optional(),
    "status": z.string().nullable().optional(),
    "expiresAt": z.date().nullable().optional(),
    "renewalReminderSent": z.boolean().nullable().optional(),
});
export const insertDynamicPageAssetSchema = z.object({
    "pageId": z.string(),
    "hostedImageId": z.string(),
    "title": z.string().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "activatedAt": z.date().nullable().optional(),
});
export const insertPricingRuleSchema = z.object({
    "name": z.string(),
    "scope": z.string(),
    "scopeValue": z.string().nullable().optional(),
    "markupType": z.string(),
    "markupValue": z.string(),
    "qrProductionCost": z.string().nullable().optional(),
    "priority": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
});
export const insertAdminSettingsSchema = z.object({
    "id": z.string().optional(),
    "globalMarkupPercent": z.string().nullable().optional(),
    "globalMarkupFixed": z.string().nullable().optional(),
    "globalQrProductionCost": z.string().nullable().optional(),
    "additionalPlacementCost": z.string().nullable().optional(),
    "textAboveUpcharge": z.string().nullable().optional(),
    "textBelowUpcharge": z.string().nullable().optional(),
    "imageHostingUpcharge": z.string().nullable().optional(),
    "dynamicQrUpcharge": z.string().nullable().optional(),
    "showPricesBeforeCustomization": z.boolean().nullable().optional(),
    "defaultFulfillmentProvider": z.string().nullable().optional(),
    "defaultMockupProvider": z.string().nullable().optional(),
});
export const insertProductBundleSchema = z.object({
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "bundleType": z.string().optional(),
    "displayImage": z.string().nullable().optional(),
    "displayOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "pricingType": z.string().optional(),
    "discountPercent": z.string().nullable().optional(),
    "fixedPrice": z.string().nullable().optional(),
    "discountAmount": z.string().nullable().optional(),
    "minItems": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "maxItems": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "displayLocations": z.array(z.string()).nullable().optional(),
    "triggerProductIds": z.array(z.string()).nullable().optional(),
    "startDate": z.date().nullable().optional(),
    "endDate": z.date().nullable().optional(),
});
export const insertBundleItemSchema = z.object({
    "bundleId": z.string(),
    "masterProductId": z.string().nullable().optional(),
    "productId": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "displayOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "quantity": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isRequired": z.boolean().nullable().optional(),
    "itemDiscountPercent": z.string().nullable().optional(),
});
export const insertGiftPackageSchema = z.object({
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "giftType": z.string().optional(),
    "masterProductId": z.string().nullable().optional(),
    "dynamicsTier": z.string().nullable().optional(),
    "dynamicsMonths": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "price": z.string(),
    "allowColorChoice": z.boolean().nullable().optional(),
    "allowSizeChoice": z.boolean().nullable().optional(),
    "allowQrCustomization": z.boolean().nullable().optional(),
    "includePersonalMessage": z.boolean().nullable().optional(),
    "redemptionValidDays": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "displayImage": z.string().nullable().optional(),
    "isFreePromotion": z.boolean().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
});
export const insertGiftCodeSchema = z.object({
    "code": z.string().max(32),
    "giftPackageId": z.string(),
    "buyerUserId": z.string().nullable().optional(),
    "buyerEmail": z.string().nullable().optional(),
    "buyerName": z.string().nullable().optional(),
    "personalMessage": z.string().nullable().optional(),
    "orderId": z.string().nullable().optional(),
    "stripePaymentId": z.string().nullable().optional(),
    "purchasedAt": z.date().optional(),
    "expiresAt": z.date(),
    "status": z.string().optional(),
    "lastEmailedTo": z.string().nullable().optional(),
    "lastEmailedAt": z.date().nullable().optional(),
});
export const insertGiftRedemptionSchema = z.object({
    "giftCodeId": z.string(),
    "recipientUserId": z.string().nullable().optional(),
    "recipientEmail": z.string().nullable().optional(),
    "recipientName": z.string().nullable().optional(),
    "selectedColor": z.string().nullable().optional(),
    "selectedSize": z.string().nullable().optional(),
    "qrContent": z.string().nullable().optional(),
    "qrStyle": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "shippingAddress": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "dynamicsSubscriptionId": z.string().nullable().optional(),
    "dynamicsContentSetId": z.string().nullable().optional(),
    "fulfillmentOrderId": z.string().nullable().optional(),
    "fulfillmentProvider": z.string().nullable().optional(),
    "fulfillmentStatus": z.string().nullable().optional(),
    "trackingNumber": z.string().nullable().optional(),
    "trackingUrl": z.string().nullable().optional(),
    "redeemedAt": z.date().optional(),
    "fulfilledAt": z.date().nullable().optional(),
    "shippedAt": z.date().nullable().optional(),
    "deliveredAt": z.date().nullable().optional(),
});
export type CartItem = {
    id: string;
    createdAt: Date;
    userId: string;
    productId: string;
    price: string;
    designId: string | null;
    quantity: number;
    customization: unknown;
};
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type Order = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    status: string;
    totalAmount: string;
    stripePaymentId: string | null;
    stripeSessionId: string | null;
    stripePaymentIntentId: string | null;
    printifyOrderId: string | null;
    shippingAddress: unknown;
    trackingNumber: string | null;
    carrier: string | null;
};
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = {
    id: string;
    orderId: string;
    productId: string;
    price: string;
    quantity: number;
    customization: unknown;
    printifyItemId: string | null;
};
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type GiftBackground = {
    id: string;
    name: string;
    createdAt: Date;
    storageUrl: string;
    description: string | null;
    isActive: boolean | null;
    thumbnailUrl: string;
    sortOrder: number | null;
    category: string | null;
    isFeatured: boolean | null;
    fullImageUrl: string;
};
export type InsertGiftBackground = z.infer<typeof insertGiftBackgroundSchema>;
export type HostingTier = {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean | null;
    sortOrder: number | null;
    priceUpcharge: string | null;
    code: string;
    durationDays: number;
    isIncluded: boolean | null;
    videoPriceUpcharge: string | null;
};
export type InsertHostingTier = z.infer<typeof insertHostingTierSchema>;
export type Coupon = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean | null;
    code: string;
    discountType: string;
    discountValue: string;
    currency: string | null;
    minOrderAmount: string | null;
    maxRedemptions: number | null;
    redemptionCount: number | null;
    validFrom: Date | null;
    validUntil: Date | null;
    stripeCouponId: string | null;
    stripePromotionCodeId: string | null;
};
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type CustomGift = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    views: number | null;
    expiresAt: Date | null;
    status: string | null;
    slug: string;
    backgroundSource: string;
    backgroundId: string | null;
    uploadedImageId: string | null;
    compositeImageUrl: string | null;
    overlayConfig: unknown;
    textAboveQr: string | null;
    textBelowQr: string | null;
    qrTextContent: string | null;
    hostingTierId: string | null;
    disclaimerAccepted: boolean | null;
    disclaimerAcceptedAt: Date | null;
    pricingSnapshot: unknown;
};
export type InsertCustomGift = z.infer<typeof insertCustomGiftSchema>;
export type HostingReminder = {
    id: string;
    createdAt: Date;
    userId: string | null;
    status: string | null;
    sentAt: Date | null;
    customGiftId: string;
    reminderType: string;
    scheduledFor: Date;
    emailAddress: string | null;
};
export type InsertHostingReminder = z.infer<typeof insertHostingReminderSchema>;
export type DynamicPage = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    title: string;
    description: string | null;
    views: number | null;
    expiresAt: Date | null;
    status: string | null;
    slug: string;
    hostingTierId: string | null;
    activeAssetId: string | null;
    renewalReminderSent: boolean | null;
};
export type InsertDynamicPage = z.infer<typeof insertDynamicPageSchema>;
export type DynamicPageAsset = {
    id: string;
    createdAt: Date;
    title: string | null;
    isActive: boolean | null;
    pageId: string;
    hostedImageId: string;
    activatedAt: Date | null;
};
export type InsertDynamicPageAsset = z.infer<typeof insertDynamicPageAssetSchema>;
export type PricingRule = {
    id: string;
    name: string;
    createdAt: Date;
    isActive: boolean | null;
    qrProductionCost: string | null;
    scope: string;
    scopeValue: string | null;
    markupType: string;
    markupValue: string;
    priority: number | null;
};
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
export type AdminSettings = {
    id: string;
    updatedAt: Date;
    globalMarkupPercent: string | null;
    globalMarkupFixed: string | null;
    globalQrProductionCost: string | null;
    additionalPlacementCost: string | null;
    textAboveUpcharge: string | null;
    textBelowUpcharge: string | null;
    imageHostingUpcharge: string | null;
    dynamicQrUpcharge: string | null;
    showPricesBeforeCustomization: boolean | null;
    defaultFulfillmentProvider: string | null;
    defaultMockupProvider: string | null;
};
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type ProductBundle = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    isActive: boolean | null;
    startDate: Date | null;
    endDate: Date | null;
    bundleType: string;
    displayImage: string | null;
    displayOrder: number | null;
    pricingType: string;
    discountPercent: string | null;
    fixedPrice: string | null;
    discountAmount: string | null;
    minItems: number | null;
    maxItems: number | null;
    displayLocations: string[] | null;
    triggerProductIds: string[] | null;
};
export type InsertProductBundle = z.infer<typeof insertProductBundleSchema>;
export type BundleItem = {
    id: string;
    createdAt: Date;
    productId: number | null;
    quantity: number | null;
    displayOrder: number | null;
    bundleId: string;
    masterProductId: string | null;
    isRequired: boolean | null;
    itemDiscountPercent: string | null;
};
export type InsertBundleItem = z.infer<typeof insertBundleItemSchema>;
export type GiftPackage = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    isActive: boolean | null;
    sortOrder: number | null;
    price: string;
    displayImage: string | null;
    masterProductId: string | null;
    giftType: string;
    dynamicsTier: string | null;
    dynamicsMonths: number | null;
    allowColorChoice: boolean | null;
    allowSizeChoice: boolean | null;
    allowQrCustomization: boolean | null;
    includePersonalMessage: boolean | null;
    redemptionValidDays: number | null;
    isFreePromotion: boolean | null;
};
export type InsertGiftPackage = z.infer<typeof insertGiftPackageSchema>;
export type GiftCode = {
    id: string;
    createdAt: Date;
    expiresAt: Date;
    status: string;
    orderId: string | null;
    stripePaymentId: string | null;
    code: string;
    giftPackageId: string;
    buyerUserId: string | null;
    buyerEmail: string | null;
    buyerName: string | null;
    personalMessage: string | null;
    purchasedAt: Date;
    lastEmailedTo: string | null;
    lastEmailedAt: Date | null;
};
export type InsertGiftCode = z.infer<typeof insertGiftCodeSchema>;
export type GiftRedemption = {
    id: string;
    recipientEmail: string | null;
    qrContent: string | null;
    qrStyle: unknown;
    shippingAddress: unknown;
    trackingNumber: string | null;
    giftCodeId: string;
    recipientUserId: string | null;
    recipientName: string | null;
    selectedColor: string | null;
    selectedSize: string | null;
    dynamicsSubscriptionId: string | null;
    dynamicsContentSetId: string | null;
    fulfillmentOrderId: string | null;
    fulfillmentProvider: string | null;
    fulfillmentStatus: string | null;
    trackingUrl: string | null;
    redeemedAt: Date;
    fulfilledAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
};
export type InsertGiftRedemption = z.infer<typeof insertGiftRedemptionSchema>;
