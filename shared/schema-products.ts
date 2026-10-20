import { z } from "zod";
// Shared Firestore/API contracts. Persistence is owned by Firebase services.
export type GraphicPlacement = 'front' | 'back' | 'left_sleeve' | 'right_sleeve' | 'pocket';
export type QRSize = 'small' | 'medium' | 'large';
export interface GraphicConfig {
    id: string;
    imageUrl: string;
    placement: GraphicPlacement;
    qrSize: QRSize;
    artworkVariant?: 'black' | 'white';
}
export const insertCustomDesignSchema = z.object({
    "id": z.string(),
    "projectName": z.string(),
    "productId": z.number().min(-2147483648).max(2147483647).int(),
    "productName": z.string(),
    "productImage": z.string().nullable().optional(),
    "placements": z.array(z.string()),
    "placementConfigs": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "placementImages": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "backgroundImageUrl": z.string().nullable().optional(),
    "backgroundAssetId": z.string().nullable().optional(),
    "topText": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "bottomText": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "textUpcharge": z.string().nullable().optional(),
    "landingOverlay": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "templateVariant": z.string().nullable().optional(),
    "externalUrl": z.string().nullable().optional(),
    "dynamicContentSetId": z.string().nullable().optional(),
    "storeType": z.string().nullable().optional(),
    "storeName": z.string().nullable().optional(),
    "segment": z.string().nullable().optional(),
    "isFeatured": z.boolean().nullable().optional(),
    "isSeasonalPromo": z.boolean().nullable().optional(),
    "qrCodeUrl": z.string().nullable().optional(),
    "printifyCompositeUrl": z.string().nullable().optional(),
    "savedToLibrary": z.boolean().nullable().optional(),
    "savedToStore": z.boolean().nullable().optional(),
    "visibility": z.string().nullable().optional(),
    "templateName": z.string().nullable().optional(),
    "templateCategory": z.string().nullable().optional(),
    "templateSubcategory": z.string().nullable().optional(),
    "ownerUserId": z.string().nullable().optional(),
    "campaignName": z.string().nullable().optional(),
    "blueprintId": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "printProviderId": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "printifyProductId": z.string().nullable().optional(),
    "printReadyArtUrl": z.string().nullable().optional(),
    "selectedColors": z.array(z.string()).nullable().optional(),
    "defaultColor": z.string().nullable().optional(),
    "mockupsByColor": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "graphicsConfig": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "selectedVariantIds": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "publishStatus": z.string().nullable().optional(),
    "publishError": z.string().nullable().optional(),
});
export const insertTemplateCategorySchema = z.object({
    "name": z.string(),
    "parentId": z.string().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
});
export const insertGraphicSetSchema = z.object({
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "categoryId": z.string().nullable().optional(),
    "subcategoryId": z.string().nullable().optional(),
    "fullGraphicUrl": z.string().nullable().optional(),
    "qrOnlyUrl": z.string().nullable().optional(),
    "destinationUrl": z.string().nullable().optional(),
    "storagePath": z.string().nullable().optional(),
    "tags": z.array(z.string()).nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "isFeatured": z.boolean().nullable().optional(),
});
export const insertProductSchema = z.object({
    "id": z.string(),
    "printifyId": z.string().nullable().optional(),
    "blueprintId": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "printProviderId": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "category": z.string(),
    "productLine": z.string().nullable().optional(),
    "basePrice": z.string(),
    "imageUrl": z.string().nullable().optional(),
    "manufacturer": z.string().nullable().optional(),
    "madeInUSA": z.boolean().nullable().optional(),
    "defaultPlacement": z.string().nullable().optional(),
    "availablePlacements": z.array(z.string()).nullable().optional(),
    "availableColors": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "availableSizes": z.array(z.string()).nullable().optional(),
    "defaultColor": z.string().nullable().optional(),
    "metadata": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "isEnabled": z.boolean().nullable().optional(),
    "markupPercent": z.string().nullable().optional(),
    "markupFixed": z.string().nullable().optional(),
    "qrProductionCost": z.string().nullable().optional(),
    "customerPrice": z.string().nullable().optional(),
    "isFeatured": z.boolean().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "mockupsByColor": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
});
export const insertQrDesignSchema = z.object({
    "userId": z.string(),
    "name": z.string(),
    "qrType": z.string(),
    "qrContent": z.string(),
    "qrStyle": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]),
    "productId": z.string().nullable().optional(),
    "placement": z.string(),
    "productColor": z.string().nullable().optional(),
    "manufacturer": z.string().nullable().optional(),
    "madeInUSA": z.boolean().nullable().optional(),
    "previewUrl": z.string().nullable().optional(),
    "showInGallery": z.boolean().nullable().optional(),
    "galleryTitle": z.string().nullable().optional(),
    "galleryDescription": z.string().nullable().optional(),
});
export const insertBrowsingHistorySchema = z.object({
    "userId": z.string(),
    "productId": z.string(),
});
export const insertProductVariantSchema = z.object({
    "productId": z.string(),
    "printifyVariantId": z.number().min(-2147483648).max(2147483647).int(),
    "title": z.string(),
    "size": z.string().nullable().optional(),
    "color": z.string().nullable().optional(),
    "colorHex": z.string().nullable().optional(),
    "price": z.string(),
    "isEnabled": z.boolean().nullable().optional(),
    "isInStock": z.boolean().nullable().optional(),
});
export const insertQrTemplateSchema = z.object({
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "category": z.string().nullable().optional(),
    "thumbnailUrl": z.string(),
    "fullImageUrl": z.string(),
    "storageUrl": z.string(),
    "qrPlacement": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "availableSizes": z.array(z.string()).nullable().optional(),
    "defaultTextAbove": z.string().nullable().optional(),
    "defaultTextBelow": z.string().nullable().optional(),
    "textStyle": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "priceUpcharge": z.string().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "isFeatured": z.boolean().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
});
export const insertLibraryAssetSchema = z.object({
    "userId": z.string().nullable().optional(),
    "ownerType": z.string(),
    "assetType": z.string(),
    "mediaType": z.string(),
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "fileName": z.string(),
    "originalName": z.string(),
    "mimeType": z.string(),
    "sizeBytes": z.number().min(-2147483648).max(2147483647).int(),
    "storageUrl": z.string(),
    "publicUrl": z.string(),
    "thumbnailUrl": z.string().nullable().optional(),
    "duration": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "sourceAssetId": z.string().nullable().optional(),
    "width": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "height": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "cropData": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "libraryCategoryId": z.string().nullable().optional(),
    "librarySubcategoryId": z.string().nullable().optional(),
    "category": z.string().nullable().optional(),
    "season": z.string().nullable().optional(),
    "event": z.string().nullable().optional(),
    "tags": z.array(z.string()).nullable().optional(),
    "visibleStoreSlugs": z.array(z.string()).nullable().optional(),
    "visibleSegments": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
    "isFeatured": z.boolean().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
});
export const insertProductCategorySchema = z.object({
    "name": z.string(),
    "slug": z.string(),
    "description": z.string().nullable().optional(),
    "taxonomyType": z.string(),
    "icon": z.string().nullable().optional(),
    "parentId": z.string().nullable().optional(),
    "sortOrder": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
});
export const insertProductCategoryAssignmentSchema = z.object({
    "productId": z.string(),
    "categoryId": z.string(),
});
export const insertDynamicContentSetSchema = z.object({
    "name": z.string(),
    "description": z.string().nullable().optional(),
    "scheduleType": z.string().optional(),
    "startDate": z.date(),
    "endDate": z.date().nullable().optional(),
    "loopBehavior": z.string().nullable().optional(),
    "totalSlots": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "userId": z.string().nullable().optional(),
    "isActive": z.boolean().nullable().optional(),
});
export const insertDynamicContentSlotSchema = z.object({
    "contentSetId": z.string(),
    "slotNumber": z.number().min(-2147483648).max(2147483647).int(),
    "title": z.string().nullable().optional(),
    "description": z.string().nullable().optional(),
    "imageUrl": z.string().nullable().optional(),
    "videoUrl": z.string().nullable().optional(),
    "linkUrl": z.string().nullable().optional(),
    "linkText": z.string().nullable().optional(),
    "textColor": z.string().nullable().optional(),
    "overlayPosition": z.string().nullable().optional(),
    "fontFamily": z.string().nullable().optional(),
});
export const insertPrintifyBlueprintSchema = z.object({
    "id": z.number().min(-2147483648).max(2147483647).int(),
    "title": z.string(),
    "description": z.string().nullable().optional(),
    "brand": z.string().nullable().optional(),
    "model": z.string().nullable().optional(),
    "images": z.array(z.string()).nullable().optional(),
    "primaryImageUrl": z.string().nullable().optional(),
    "category": z.string().nullable().optional(),
    "lastSyncedAt": z.date().optional(),
    "createdAt": z.date().optional(),
});
export const insertPrintifyPrintProviderSchema = z.object({
    "blueprintId": z.number().min(-2147483648).max(2147483647).int(),
    "providerId": z.number().min(-2147483648).max(2147483647).int(),
    "title": z.string(),
    "country": z.string().nullable().optional(),
    "isUSA": z.boolean().nullable().optional(),
    "minCost": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "maxCost": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "availableColors": z.union([z.union([z.string(), z.number(), z.boolean(), z.null()]), z.record(z.string(), z.any()), z.array(z.any())]).nullable().optional(),
    "availableSizes": z.array(z.string()).nullable().optional(),
    "placeholderProductId": z.string().nullable().optional(),
    "costsFetchedAt": z.date().nullable().optional(),
    "lastSyncedAt": z.date().optional(),
});
export const insertPrintifyCatalogSyncSchema = z.object({
    "syncType": z.string(),
    "status": z.string(),
    "blueprintsCount": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "providersCount": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "errorMessage": z.string().nullable().optional(),
    "startedAt": z.date().optional(),
    "completedAt": z.date().nullable().optional(),
});
export const insertPrintifyCostSyncSchema = z.object({
    "status": z.string(),
    "totalProviders": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "processedCount": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "successCount": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "failedCount": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "skippedCount": z.number().min(-2147483648).max(2147483647).int().nullable().optional(),
    "lastProcessedProviderId": z.string().nullable().optional(),
    "errorMessage": z.string().nullable().optional(),
    "startedAt": z.date().optional(),
    "completedAt": z.date().nullable().optional(),
});
export type InsertCustomDesign = z.infer<typeof insertCustomDesignSchema>;
export type CustomDesign = {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    projectName: string;
    productId: number;
    productName: string;
    productImage: string | null;
    placements: string[];
    placementConfigs: unknown;
    placementImages: unknown;
    backgroundImageUrl: string | null;
    isFeatured: boolean | null;
    backgroundAssetId: string | null;
    topText: unknown;
    bottomText: unknown;
    textUpcharge: string | null;
    landingOverlay: unknown;
    templateVariant: string | null;
    externalUrl: string | null;
    dynamicContentSetId: string | null;
    storeType: string | null;
    storeName: string | null;
    segment: string | null;
    isSeasonalPromo: boolean | null;
    qrCodeUrl: string | null;
    printifyCompositeUrl: string | null;
    savedToLibrary: boolean | null;
    savedToStore: boolean | null;
    visibility: string | null;
    templateName: string | null;
    templateCategory: string | null;
    templateSubcategory: string | null;
    ownerUserId: string | null;
    campaignName: string | null;
    blueprintId: number | null;
    printProviderId: number | null;
    printifyProductId: string | null;
    printReadyArtUrl: string | null;
    selectedColors: string[] | null;
    defaultColor: string | null;
    mockupsByColor: unknown;
    graphicsConfig: unknown;
    selectedVariantIds: unknown;
    publishStatus: string | null;
    publishError: string | null;
};
export type InsertTemplateCategory = z.infer<typeof insertTemplateCategorySchema>;
export type TemplateCategory = {
    id: string;
    name: string;
    createdAt: Date;
    isActive: boolean | null;
    parentId: string | null;
    sortOrder: number | null;
};
export type InsertGraphicSet = z.infer<typeof insertGraphicSetSchema>;
export type GraphicSet = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    isActive: boolean | null;
    tags: string[] | null;
    isFeatured: boolean | null;
    usageCount: number | null;
    categoryId: string | null;
    subcategoryId: string | null;
    fullGraphicUrl: string | null;
    qrOnlyUrl: string | null;
    destinationUrl: string | null;
    storagePath: string | null;
};
export type Product = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    description: string | null;
    isEnabled: boolean | null;
    sortOrder: number | null;
    category: string;
    isFeatured: boolean | null;
    blueprintId: number | null;
    printProviderId: number | null;
    defaultColor: string | null;
    mockupsByColor: unknown;
    printifyId: string | null;
    productLine: string | null;
    basePrice: string;
    imageUrl: string | null;
    manufacturer: string | null;
    madeInUSA: boolean | null;
    defaultPlacement: string | null;
    availablePlacements: string[] | null;
    availableColors: unknown;
    availableSizes: string[] | null;
    metadata: unknown;
    markupPercent: string | null;
    markupFixed: string | null;
    qrProductionCost: string | null;
    customerPrice: string | null;
};
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type QrDesign = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string;
    productId: string | null;
    manufacturer: string | null;
    madeInUSA: boolean | null;
    qrType: string;
    qrContent: string;
    qrStyle: unknown;
    placement: string;
    productColor: string | null;
    previewUrl: string | null;
    showInGallery: boolean | null;
    galleryTitle: string | null;
    galleryDescription: string | null;
};
export type InsertQrDesign = z.infer<typeof insertQrDesignSchema>;
export type BrowsingHistory = {
    id: string;
    userId: string;
    productId: string;
    viewedAt: Date;
};
export type InsertBrowsingHistory = z.infer<typeof insertBrowsingHistorySchema>;
export type ProductVariant = {
    id: string;
    title: string;
    isEnabled: boolean | null;
    size: string | null;
    productId: string;
    printifyVariantId: number;
    color: string | null;
    colorHex: string | null;
    price: string;
    isInStock: boolean | null;
};
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type QrTemplate = {
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
    availableSizes: string[] | null;
    fullImageUrl: string;
    qrPlacement: unknown;
    defaultTextAbove: string | null;
    defaultTextBelow: string | null;
    textStyle: unknown;
    priceUpcharge: string | null;
};
export type InsertQrTemplate = z.infer<typeof insertQrTemplateSchema>;
export type LibraryAsset = {
    duration: number | null;
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    fileName: string;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    storageUrl: string;
    publicUrl: string;
    description: string | null;
    isActive: boolean | null;
    ownerType: string;
    assetType: string;
    mediaType: string;
    thumbnailUrl: string | null;
    sourceAssetId: string | null;
    width: number | null;
    height: number | null;
    cropData: unknown;
    sortOrder: number | null;
    libraryCategoryId: string | null;
    librarySubcategoryId: string | null;
    category: string | null;
    season: string | null;
    event: string | null;
    tags: string[] | null;
    visibleStoreSlugs: string[] | null;
    visibleSegments: unknown;
    isFeatured: boolean | null;
    usageCount: number | null;
};
export type InsertLibraryAsset = z.infer<typeof insertLibraryAssetSchema>;
export type ProductCategory = {
    id: string;
    name: string;
    createdAt: Date;
    description: string | null;
    isActive: boolean | null;
    parentId: string | null;
    sortOrder: number | null;
    slug: string;
    taxonomyType: string;
    icon: string | null;
};
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type ProductCategoryAssignment = {
    id: string;
    createdAt: Date;
    productId: string;
    categoryId: string;
};
export type InsertProductCategoryAssignment = z.infer<typeof insertProductCategoryAssignmentSchema>;
export type DynamicContentSet = {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    userId: string | null;
    description: string | null;
    isActive: boolean | null;
    scheduleType: string;
    startDate: Date;
    endDate: Date | null;
    loopBehavior: string | null;
    totalSlots: number | null;
};
export type InsertDynamicContentSet = z.infer<typeof insertDynamicContentSetSchema>;
export type DynamicContentSlot = {
    id: string;
    createdAt: Date;
    title: string | null;
    description: string | null;
    imageUrl: string | null;
    contentSetId: string;
    slotNumber: number;
    videoUrl: string | null;
    linkUrl: string | null;
    linkText: string | null;
    textColor: string | null;
    overlayPosition: string | null;
    fontFamily: string | null;
};
export type InsertDynamicContentSlot = z.infer<typeof insertDynamicContentSlotSchema>;
export type PrintifyBlueprint = {
    id: number;
    brand: string | null;
    createdAt: Date;
    title: string;
    description: string | null;
    category: string | null;
    model: string | null;
    images: string[] | null;
    primaryImageUrl: string | null;
    lastSyncedAt: Date;
};
export type InsertPrintifyBlueprint = z.infer<typeof insertPrintifyBlueprintSchema>;
export type PrintifyPrintProvider = {
    id: string;
    title: string;
    blueprintId: number;
    availableColors: unknown;
    availableSizes: string[] | null;
    lastSyncedAt: Date;
    providerId: number;
    country: string | null;
    isUSA: boolean | null;
    minCost: number | null;
    maxCost: number | null;
    placeholderProductId: string | null;
    costsFetchedAt: Date | null;
};
export type InsertPrintifyPrintProvider = z.infer<typeof insertPrintifyPrintProviderSchema>;
export type PrintifyCatalogSync = {
    id: string;
    status: string;
    errorMessage: string | null;
    syncType: string;
    blueprintsCount: number | null;
    providersCount: number | null;
    startedAt: Date;
    completedAt: Date | null;
};
export type InsertPrintifyCatalogSync = z.infer<typeof insertPrintifyCatalogSyncSchema>;
export type PrintifyCostSync = {
    id: string;
    status: string;
    errorMessage: string | null;
    startedAt: Date;
    completedAt: Date | null;
    totalProviders: number | null;
    processedCount: number | null;
    successCount: number | null;
    failedCount: number | null;
    skippedCount: number | null;
    lastProcessedProviderId: string | null;
};
export type InsertPrintifyCostSync = z.infer<typeof insertPrintifyCostSyncSchema>;
