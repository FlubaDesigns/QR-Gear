import { z } from "zod";
// Shared Firestore/API contracts. Persistence is owned by Firebase services.
export const insertCanonicalPlacementSchema = z.object({
    "id": z.string(),
    "label": z.string(),
    "description": z.string().nullable().optional(),
    "category": z.string(),
    "previewX": z.string().nullable().optional(),
    "previewY": z.string().nullable().optional(),
    "previewScale": z.string().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
});
export const insertPodProviderSchema = z.object({
    "id": z.string(),
    "name": z.string(),
    "logoUrl": z.string().nullable().optional(),
    "websiteUrl": z.string().nullable().optional(),
    "apiBaseUrl": z.string().nullable().optional(),
    "supportsWhiteLabel": z.boolean().nullable().optional(),
    "supportsRush": z.boolean().nullable().optional(),
    "averageShipDays": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "healthStatus": z.string().nullable().optional(),
    "lastHealthCheck": z.date().nullable().optional(),
});
export const insertProviderPlacementMappingSchema = z.object({
    "podProviderId": z.string(),
    "canonicalPlacementId": z.string(),
    "providerPlacementKey": z.string(),
    "overrideX": z.string().nullable().optional(),
    "overrideY": z.string().nullable().optional(),
    "overrideScale": z.string().nullable().optional(),
    "metadata": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
});
export const insertProductPlacementAvailabilitySchema = z.object({
    "productId": z.string(),
    "canonicalPlacementId": z.string(),
    "artworkBlackUrl": z.string().nullable().optional(),
    "artworkWhiteUrl": z.string().nullable().optional(),
    "isPrimary": z.boolean().nullable().optional(),
    "isEnabled": z.boolean().nullable().optional(),
});
export const insertMockupCacheSchema = z.object({
    "productId": z.string().nullable().optional(),
    "blueprintId": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "printProviderId": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "colorName": z.string(),
    "colorHex": z.string().nullable().optional(),
    "canonicalPlacementId": z.string().nullable().optional(),
    "qrSize": z.string().optional(),
    "artworkUrl": z.string().nullable().optional(),
    "artworkVariant": z.string().nullable().optional(),
    "mockupUrl": z.string(),
    "mockupUrlHq": z.string().nullable().optional(),
    "lifestyleMockupUrl": z.string().nullable().optional(),
    "podProviderId": z.string().nullable().optional(),
    "providerMockupId": z.string().nullable().optional(),
    "status": z.string().nullable().optional(),
    "generatedAt": z.date().optional(),
    "expiresAt": z.date().nullable().optional(),
});
export const insertPrintifyPrintfulMappingSchema = z.object({
    "printifyBlueprintId": z.number().min(-2147483648).max(2147483647).int(),
    "printifyPrintProviderId": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "printifyBrand": z.string().nullable().optional(),
    "printifyModel": z.string().nullable().optional(),
    "printfulProductId": z.number().min(-2147483648).max(2147483647).int(),
    "printfulBrand": z.string().nullable().optional(),
    "printfulModel": z.string().nullable().optional(),
    "placementMapping": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "colorMapping": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "matchConfidence": z.string().nullable().optional(),
    "notes": z.string().nullable().optional(),
});
export const insertPrintfulProductSchema = z.object({
    "id": z.number().min(-2147483648).max(2147483647).int(),
    "type": z.string(),
    "typeName": z.string(),
    "brand": z.string().nullable().optional(),
    "model": z.string().nullable().optional(),
    "title": z.string(),
    "image": z.string().nullable().optional(),
    "variantCount": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "currency": z.string().nullable().optional(),
    "minPrice": z.string().nullable().optional(),
    "maxPrice": z.string().nullable().optional(),
    "printfileWidth": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "printfileHeight": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "printfileDpi": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "description": z.string().nullable().optional(),
    "avgFulfillmentTime": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "originCountry": z.string().nullable().optional(),
    "isDiscontinued": z.boolean().nullable().optional(),
    "availablePlacements": z.array(z.string()).nullable().optional(),
    "lastSyncedAt": z.date().optional(),
});
export const insertPrintfulVariantSchema = z.object({
    "id": z.number().min(-2147483648).max(2147483647).int(),
    "productId": z.number().min(-2147483648).max(2147483647).int(),
    "name": z.string(),
    "size": z.string().nullable().optional(),
    "color": z.string().nullable().optional(),
    "colorCode": z.string().nullable().optional(),
    "colorCode2": z.string().nullable().optional(),
    "image": z.string().nullable().optional(),
    "price": z.string(),
    "inStock": z.boolean().nullable().optional(),
    "availabilityStatus": z.string().nullable().optional(),
    "lastSyncedAt": z.date().optional(),
});
export const insertMockupJobSchema = z.object({
    "productId": z.string(),
    "colorName": z.string(),
    "qrSize": z.string().optional(),
    "placement": z.string().optional(),
    "jobData": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]),
    "status": z.string().optional(),
    "priority": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "attempts": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "maxAttempts": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "priorityUpdatedAt": z.date().nullable().optional(),
    "priorityOwner": z.string().nullable().optional(),
    "priorityExpiresAt": z.date().nullable().optional(),
    "resultData": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "errorMessage": z.string().nullable().optional(),
    "startedAt": z.date().nullable().optional(),
    "completedAt": z.date().nullable().optional(),
    "nextRetryAt": z.date().nullable().optional(),
});
export type CanonicalPlacement = {
    id: string;
    createdAt: Date;
    description: string | null;
    isActive: boolean | null;
    sortOrder: number | null;
    category: string;
    label: string;
    previewX: string | null;
    previewY: string | null;
    previewScale: string | null;
};
export type InsertCanonicalPlacement = z.infer<typeof insertCanonicalPlacementSchema>;
export type PodProvider = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean | null;
    logoUrl: string | null;
    websiteUrl: string | null;
    lastHealthCheck: Date | null;
    apiBaseUrl: string | null;
    supportsWhiteLabel: boolean | null;
    supportsRush: boolean | null;
    averageShipDays: number | null;
    healthStatus: string | null;
};
export type InsertPodProvider = z.infer<typeof insertPodProviderSchema>;
export type ProviderPlacementMapping = {
    id: string;
    createdAt: Date;
    metadata: unknown;
    podProviderId: string;
    canonicalPlacementId: string;
    providerPlacementKey: string;
    overrideX: string | null;
    overrideY: string | null;
    overrideScale: string | null;
};
export type InsertProviderPlacementMapping = z.infer<typeof insertProviderPlacementMappingSchema>;
export type ProductPlacementAvailability = {
    id: string;
    createdAt: Date;
    isEnabled: boolean | null;
    productId: string;
    canonicalPlacementId: string;
    artworkBlackUrl: string | null;
    artworkWhiteUrl: string | null;
    isPrimary: boolean | null;
};
export type InsertProductPlacementAvailability = z.infer<typeof insertProductPlacementAvailabilitySchema>;
export type MockupCache = {
    id: string;
    createdAt: Date;
    expiresAt: Date | null;
    status: string | null;
    productId: string | null;
    blueprintId: number | null;
    printProviderId: number | null;
    colorHex: string | null;
    podProviderId: string | null;
    canonicalPlacementId: string | null;
    colorName: string;
    qrSize: string;
    artworkUrl: string | null;
    artworkVariant: string | null;
    mockupUrl: string;
    mockupUrlHq: string | null;
    lifestyleMockupUrl: string | null;
    providerMockupId: string | null;
    generatedAt: Date;
};
export type InsertMockupCache = z.infer<typeof insertMockupCacheSchema>;
export type PrintifyPrintfulMapping = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    isActive: boolean | null;
    printifyBlueprintId: number;
    printifyPrintProviderId: number | null;
    printifyBrand: string | null;
    printifyModel: string | null;
    printfulProductId: number;
    printfulBrand: string | null;
    printfulModel: string | null;
    placementMapping: unknown;
    colorMapping: unknown;
    matchConfidence: string | null;
    notes: string | null;
};
export type InsertPrintifyPrintfulMapping = z.infer<typeof insertPrintifyPrintfulMappingSchema>;
export type PrintfulProduct = {
    id: number;
    brand: string | null;
    createdAt: Date;
    title: string;
    description: string | null;
    availablePlacements: string[] | null;
    model: string | null;
    lastSyncedAt: Date;
    currency: string | null;
    type: string;
    typeName: string;
    image: string | null;
    variantCount: number | null;
    minPrice: string | null;
    maxPrice: string | null;
    printfileWidth: number | null;
    printfileHeight: number | null;
    printfileDpi: number | null;
    avgFulfillmentTime: number | null;
    originCountry: string | null;
    isDiscontinued: boolean | null;
};
export type InsertPrintfulProduct = z.infer<typeof insertPrintfulProductSchema>;
export type PrintfulVariant = {
    id: number;
    name: string;
    createdAt: Date;
    size: string | null;
    productId: number;
    color: string | null;
    price: string;
    lastSyncedAt: Date;
    image: string | null;
    colorCode: string | null;
    colorCode2: string | null;
    inStock: boolean | null;
    availabilityStatus: string | null;
};
export type InsertPrintfulVariant = z.infer<typeof insertPrintfulVariantSchema>;
export type MockupJob = {
    id: string;
    createdAt: Date;
    status: string;
    errorMessage: string | null;
    productId: string;
    placement: string;
    startedAt: Date | null;
    completedAt: Date | null;
    priority: number | null;
    colorName: string;
    qrSize: string;
    jobData: unknown;
    attempts: number | null;
    maxAttempts: number | null;
    priorityUpdatedAt: Date | null;
    priorityOwner: string | null;
    priorityExpiresAt: Date | null;
    resultData: unknown;
    nextRetryAt: Date | null;
};
export type InsertMockupJob = z.infer<typeof insertMockupJobSchema>;
