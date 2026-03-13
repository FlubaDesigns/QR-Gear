import type { Firestore } from 'firebase-admin/firestore';
import { getFirestoreDb, isFirebaseInitialized } from './firebase-admin';
import type { IStorage } from '../storage';
import type {
  User, InsertUser, UpsertUser,
  Product, InsertProduct,
  CustomDesign, InsertCustomDesign,
  Order, InsertOrder,
  OrderItem, InsertOrderItem,
  CartItem, InsertCartItem,
  AdminSettings, InsertAdminSettings,
  QrDesign, InsertQrDesign,
  HostedImage, InsertHostedImage,
  HostingReminder, InsertHostingReminder,
  BrowsingHistory, InsertBrowsingHistory,
  PricingRule, InsertPricingRule,
  HostingTier, InsertHostingTier,
  Coupon, InsertCoupon,
  QrTemplate, InsertQrTemplate,
  DynamicPage, InsertDynamicPage,
  DynamicPageAsset, InsertDynamicPageAsset,
  ProductCategory, InsertProductCategory,
  ProductCategoryAssignment, InsertProductCategoryAssignment,
  PartnerStore, InsertPartnerStore,
  PartnerStoreProduct, InsertPartnerStoreProduct,
  ProductVariant, InsertProductVariant,
  PrintifyBlueprint, InsertPrintifyBlueprint,
  PrintifyPrintProvider, InsertPrintifyPrintProvider,
  PrintifyCatalogSync, InsertPrintifyCatalogSync,
  PrintifyCostSync, InsertPrintifyCostSync,
  LibraryAsset, InsertLibraryAsset,
  MasterProduct, InsertMasterProduct,
  ProductDesignVersion, InsertProductDesignVersion,
  ChannelConfig, InsertChannelConfig,
  ChannelPublishState, InsertChannelPublishState,
  ProviderHealthLog, InsertProviderHealthLog,
  GiftPackage, InsertGiftPackage,
  GiftCode, InsertGiftCode,
  GiftRedemption, InsertGiftRedemption,
  TemplateCategory, InsertTemplateCategory,
  GraphicSet, InsertGraphicSet,
  OrderUnified, InsertOrderUnified,
  EmailTemplate, InsertEmailTemplate,
  EmailLog,
} from '@shared/schema';

import * as products from './firestore-adapter-products';
import * as orders from './firestore-adapter-orders';
import * as stores from './firestore-adapter-stores';
import * as users from './firestore-adapter-users';
import * as misc from './firestore-adapter-misc';

export class FirestoreAdapter implements IStorage {
  private db: Firestore;

  constructor() {
    if (!isFirebaseInitialized()) {
      console.log('[FirestoreAdapter] Initializing Firebase...');
    }
    this.db = getFirestoreDb();
  }

  async getProduct(id: string): Promise<Product | undefined> { return products.getProduct(this.db, id); }
  async getAllProducts(): Promise<Product[]> { return products.getAllProducts(this.db); }
  async getProducts(): Promise<Product[]> { return products.getAllProducts(this.db); }
  async getEnabledProducts(): Promise<Product[]> { return products.getEnabledProducts(this.db); }
  async createProduct(product: InsertProduct): Promise<Product> { return products.createProduct(this.db, product); }
  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> { return products.updateProduct(this.db, id, product); }
  async deleteProduct(id: string): Promise<void> { return products.deleteProduct(this.db, id); }
  async toggleProductEnabled(id: string, enabled: boolean): Promise<Product | undefined> { return products.toggleProductEnabled(this.db, id, enabled); }

  async getCustomDesign(id: string): Promise<CustomDesign | undefined> { return products.getCustomDesign(this.db, id); }
  async getCustomDesigns(): Promise<CustomDesign[]> { return products.getCustomDesigns(this.db); }
  async getCustomDesignsForLibrary(): Promise<CustomDesign[]> { return products.getCustomDesignsForLibrary(this.db); }
  async getCustomDesignsByStoreSegment(storeType: string, storeName: string, segment?: string): Promise<CustomDesign[]> { return products.getCustomDesignsByStoreSegment(this.db, storeType, storeName, segment); }
  async createCustomDesign(design: InsertCustomDesign): Promise<CustomDesign> { return products.createCustomDesign(this.db, design); }
  async updateCustomDesign(id: string, design: Partial<InsertCustomDesign>): Promise<CustomDesign | undefined> { return products.updateCustomDesign(this.db, id, design); }
  async deleteCustomDesign(id: string): Promise<void> { return products.deleteCustomDesign(this.db, id); }

  async getProductCategories(): Promise<ProductCategory[]> { return products.getProductCategories(this.db); }
  async getAllProductCategories(): Promise<ProductCategory[]> { return products.getProductCategories(this.db); }
  async getActiveProductCategories(): Promise<ProductCategory[]> { return products.getActiveProductCategories(this.db); }
  async getProductCategoriesByTaxonomy(taxonomyType: string): Promise<ProductCategory[]> { return products.getProductCategoriesByTaxonomy(this.db, taxonomyType); }
  async getProductCategory(id: string): Promise<ProductCategory | undefined> { return products.getProductCategory(this.db, id); }
  async createProductCategory(category: InsertProductCategory): Promise<ProductCategory> { return products.createProductCategory(this.db, category); }
  async updateProductCategory(id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> { return products.updateProductCategory(this.db, id, category); }
  async deleteProductCategory(id: string): Promise<void> { return products.deleteProductCategory(this.db, id); }

  async getProductCategoryAssignments(productId: string): Promise<ProductCategoryAssignment[]> { return products.getProductCategoryAssignments(this.db, productId); }
  async getProductsByCategory(categoryId: string): Promise<Product[]> { return products.getProductsByCategory(this.db, categoryId); }
  async assignProductToCategory(assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment> { return products.assignProductToCategory(this.db, assignment); }
  async removeProductFromCategory(productId: string, categoryId: string): Promise<void> { return products.removeProductFromCategory(this.db, productId, categoryId); }
  async syncProductCategories(productId: string, categoryIds: string[]): Promise<void> { return products.syncProductCategories(this.db, productId, categoryIds); }

  async getProductVariants(productId: string): Promise<ProductVariant[]> { return products.getProductVariants(this.db, productId); }
  async upsertProductVariant(variant: InsertProductVariant): Promise<ProductVariant> { return products.upsertProductVariant(this.db, variant); }
  async toggleVariantEnabled(id: string, enabled: boolean): Promise<ProductVariant | undefined> { return products.toggleVariantEnabled(this.db, id, enabled); }

  async getAllMasterProducts(): Promise<MasterProduct[]> { return products.getAllMasterProducts(this.db); }
  async getMasterProduct(id: string): Promise<MasterProduct | undefined> { return products.getMasterProduct(this.db, id); }
  async createMasterProduct(product: InsertMasterProduct): Promise<MasterProduct> { return products.createMasterProduct(this.db, product); }
  async updateMasterProduct(id: string, product: Partial<InsertMasterProduct>): Promise<MasterProduct | undefined> { return products.updateMasterProduct(this.db, id, product); }
  async deleteMasterProduct(id: string): Promise<void> { return products.deleteMasterProduct(this.db, id); }

  async getDesignVersions(masterProductId: string): Promise<ProductDesignVersion[]> { return products.getDesignVersions(this.db, masterProductId); }
  async getActiveDesignVersion(masterProductId: string): Promise<ProductDesignVersion | undefined> { return products.getActiveDesignVersion(this.db, masterProductId); }
  async createDesignVersion(version: InsertProductDesignVersion): Promise<ProductDesignVersion> { return products.createDesignVersion(this.db, version); }
  async updateDesignVersion(id: string, version: Partial<InsertProductDesignVersion>): Promise<ProductDesignVersion | undefined> { return products.updateDesignVersion(this.db, id, version); }

  async getLibraryAsset(id: string): Promise<LibraryAsset | undefined> { return products.getLibraryAsset(this.db, id); }
  async getLibraryAssetByUrl(url: string): Promise<LibraryAsset | undefined> { return products.getLibraryAssetByUrl(this.db, url); }
  async getLibraryAssets(filters?: { ownerType?: string; assetType?: string; mediaType?: string; userId?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> { return products.getLibraryAssets(this.db, filters); }
  async getAdminLibraryAssets(filters?: { assetType?: string; mediaType?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> { return products.getAdminLibraryAssets(this.db, filters); }
  async getUserLibraryAssets(userId: string, filters?: { assetType?: string; mediaType?: string }): Promise<LibraryAsset[]> { return products.getUserLibraryAssets(this.db, userId, filters); }
  async createLibraryAsset(asset: InsertLibraryAsset): Promise<LibraryAsset> { return products.createLibraryAsset(this.db, asset); }
  async createLibraryAssetWithId(id: string, asset: InsertLibraryAsset): Promise<LibraryAsset> { return products.createLibraryAssetWithId(this.db, id, asset); }
  async updateLibraryAsset(id: string, asset: Partial<InsertLibraryAsset>): Promise<LibraryAsset | undefined> { return products.updateLibraryAsset(this.db, id, asset); }
  async deleteLibraryAsset(id: string): Promise<void> { return products.deleteLibraryAsset(this.db, id); }
  async incrementLibraryAssetUsage(id: string): Promise<void> { return products.incrementLibraryAssetUsage(this.db, id); }

  async getGraphicSets(): Promise<GraphicSet[]> { return products.getGraphicSets(this.db); }
  async getGraphicSet(id: string): Promise<GraphicSet | undefined> { return products.getGraphicSet(this.db, id); }
  async getGraphicSetsByCategory(categoryId: string): Promise<GraphicSet[]> { return products.getGraphicSetsByCategory(this.db, categoryId); }
  async createGraphicSet(graphicSet: InsertGraphicSet): Promise<GraphicSet> { return products.createGraphicSet(this.db, graphicSet); }
  async updateGraphicSet(id: string, graphicSet: Partial<InsertGraphicSet>): Promise<GraphicSet | undefined> { return products.updateGraphicSet(this.db, id, graphicSet); }
  async deleteGraphicSet(id: string): Promise<void> { return products.deleteGraphicSet(this.db, id); }
  async incrementGraphicSetUsage(id: string): Promise<void> { return products.incrementGraphicSetUsage(this.db, id); }

  async getTemplateCategories(): Promise<TemplateCategory[]> { return products.getTemplateCategories(this.db); }
  async getTemplateCategoriesByParent(parentId: string | null): Promise<TemplateCategory[]> { return products.getTemplateCategoriesByParent(this.db, parentId); }
  async createTemplateCategory(category: InsertTemplateCategory): Promise<TemplateCategory> { return products.createTemplateCategory(this.db, category); }
  async updateTemplateCategory(id: string, category: Partial<InsertTemplateCategory>): Promise<TemplateCategory | undefined> { return products.updateTemplateCategory(this.db, id, category); }
  async deleteTemplateCategory(id: string): Promise<void> { return products.deleteTemplateCategory(this.db, id); }

  async getOrder(id: string): Promise<Order | undefined> { return orders.getOrder(this.db, id); }
  async getOrders(): Promise<OrderUnified[]> { return orders.getOrders(this.db); }
  async getOrdersByUser(userId: string): Promise<Order[]> { return orders.getOrdersByUser(this.db, userId); }
  async getOrdersByStatus(status: string): Promise<Order[]> { return orders.getOrdersByStatus(this.db, status); }
  async getOrderByStripeSession(sessionId: string): Promise<Order | undefined> { return orders.getOrderByStripeSession(this.db, sessionId); }
  async createOrder(order: InsertOrder): Promise<Order> { return orders.createOrder(this.db, order); }
  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined> { return orders.updateOrder(this.db, id, order); }

  async getOrderUnified(id: string): Promise<OrderUnified | undefined> { return orders.getOrderUnified(this.db, id); }
  async createOrderUnified(order: InsertOrderUnified): Promise<OrderUnified> { return orders.createOrderUnified(this.db, order); }
  async updateOrderUnified(id: string, order: Partial<InsertOrderUnified>): Promise<OrderUnified | undefined> { return orders.updateOrderUnified(this.db, id, order); }

  async getOrderItems(orderId: string): Promise<OrderItem[]> { return orders.getOrderItems(this.db, orderId); }
  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> { return orders.createOrderItem(this.db, item); }

  async getCartItemsByUser(userId: string): Promise<CartItem[]> { return orders.getCartItemsByUser(this.db, userId); }
  async addCartItem(item: InsertCartItem): Promise<CartItem> { return orders.addCartItem(this.db, item); }
  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> { return orders.updateCartItem(this.db, id, quantity); }
  async deleteCartItem(id: string): Promise<void> { return orders.deleteCartItem(this.db, id); }
  async clearCart(userId: string): Promise<void> { return orders.clearCart(this.db, userId); }

  async getUser(id: string): Promise<User | undefined> { return users.getUser(this.db, id); }
  async getUserByEmail(email: string): Promise<User | undefined> { return users.getUserByEmail(this.db, email); }
  async getUsers(): Promise<User[]> { return users.getUsers(this.db); }
  async createUser(user: InsertUser): Promise<User> { return users.createUser(this.db, user); }
  async upsertUser(userData: UpsertUser): Promise<User> { return users.upsertUser(this.db, userData); }

  async getAdminSettings(): Promise<AdminSettings | undefined> { return users.getAdminSettings(this.db); }
  async upsertAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> { return users.upsertAdminSettings(this.db, settings); }

  async getBrowsingHistory(userId: string): Promise<BrowsingHistory[]> { return users.getBrowsingHistory(this.db, userId); }
  async addBrowsingHistory(entry: InsertBrowsingHistory): Promise<BrowsingHistory> { return users.addBrowsingHistory(this.db, entry); }
  async clearBrowsingHistory(userId: string): Promise<void> { return users.clearBrowsingHistory(this.db, userId); }

  async getPartnerStores(): Promise<PartnerStore[]> { return stores.getPartnerStores(this.db); }
  async getPartnerStore(id: string): Promise<PartnerStore | undefined> { return stores.getPartnerStore(this.db, id); }
  async getPartnerStoreBySlug(slug: string): Promise<PartnerStore | undefined> { return stores.getPartnerStoreBySlug(this.db, slug); }
  async createPartnerStore(store: InsertPartnerStore): Promise<PartnerStore> { return stores.createPartnerStore(this.db, store); }
  async updatePartnerStore(id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined> { return stores.updatePartnerStore(this.db, id, store); }
  async deletePartnerStore(id: string): Promise<void> { return stores.deletePartnerStore(this.db, id); }

  async getPartnerStoreProducts(partnerStoreId: string): Promise<PartnerStoreProduct[]> { return stores.getPartnerStoreProducts(this.db, partnerStoreId); }
  async getPartnerStoreProduct(partnerStoreId: string, productId: string): Promise<PartnerStoreProduct | undefined> { return stores.getPartnerStoreProduct(this.db, partnerStoreId, productId); }
  async getProductsForStore(storeSlug: string, segment?: string): Promise<Product[]> { return stores.getProductsForStore(this.db, storeSlug, segment); }
  async addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct> { return stores.addPartnerStoreProduct(this.db, product); }
  async updatePartnerStoreProduct(id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> { return stores.updatePartnerStoreProduct(this.db, id, product); }
  async updatePartnerStoreProductByIds(partnerStoreId: string, productId: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> { return stores.updatePartnerStoreProductByIds(this.db, partnerStoreId, productId, product); }
  async removePartnerStoreProduct(id: string): Promise<void> { return stores.removePartnerStoreProduct(this.db, id); }
  async syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void> { return stores.syncPartnerStoreProducts(this.db, partnerStoreId, productIds); }

  async getPrintifyBlueprints(): Promise<PrintifyBlueprint[]> { return stores.getPrintifyBlueprints(this.db); }
  async getPrintifyBlueprint(id: number): Promise<PrintifyBlueprint | undefined> { return stores.getPrintifyBlueprint(this.db, id); }
  async upsertPrintifyBlueprint(blueprint: InsertPrintifyBlueprint): Promise<PrintifyBlueprint> { return stores.upsertPrintifyBlueprint(this.db, blueprint); }
  async deletePrintifyBlueprint(id: number): Promise<void> { return stores.deletePrintifyBlueprint(this.db, id); }
  async clearPrintifyBlueprints(): Promise<void> { return stores.clearPrintifyBlueprints(this.db); }

  async getAllPrintifyProviders(): Promise<PrintifyPrintProvider[]> { return stores.getAllPrintifyProviders(this.db); }
  async getPrintifyPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> { return stores.getPrintifyPrintProviders(this.db, blueprintId); }
  async getPrintifyPrintProvider(blueprintId: number, providerId: number): Promise<PrintifyPrintProvider | undefined> { return stores.getPrintifyPrintProvider(this.db, blueprintId, providerId); }
  async upsertPrintifyPrintProvider(provider: InsertPrintifyPrintProvider): Promise<PrintifyPrintProvider> { return stores.upsertPrintifyPrintProvider(this.db, provider); }
  async updatePrintifyProviderCosts(blueprintId: number, providerId: number, costs: { minCost: number; maxCost: number; placeholderProductId?: string; availableColors?: any[]; availableSizes?: string[] }): Promise<PrintifyPrintProvider | undefined> { return stores.updatePrintifyProviderCosts(this.db, blueprintId, providerId, costs); }
  async updateProductPricesByProvider(blueprintId: number, providerId: number, basePrice: string): Promise<number> { return stores.updateProductPricesByProvider(this.db, blueprintId, providerId, basePrice); }
  async deletePrintifyPrintProvidersByBlueprint(blueprintId: number): Promise<void> { return stores.deletePrintifyPrintProvidersByBlueprint(this.db, blueprintId); }
  async clearPrintifyPrintProviders(): Promise<void> { return stores.clearPrintifyPrintProviders(this.db); }

  async getAllPrintfulProducts(): Promise<any[]> { return stores.getAllPrintfulProducts(this.db); }
  async getAllPrintfulVariants(): Promise<any[]> { return stores.getAllPrintfulVariants(this.db); }

  async createCatalogSync(sync: InsertPrintifyCatalogSync): Promise<PrintifyCatalogSync> { return stores.createCatalogSync(this.db, sync); }
  async updateCatalogSync(id: string, sync: Partial<InsertPrintifyCatalogSync>): Promise<PrintifyCatalogSync | undefined> { return stores.updateCatalogSync(this.db, id, sync); }
  async getLatestCatalogSync(): Promise<PrintifyCatalogSync | undefined> { return stores.getLatestCatalogSync(this.db); }
  async getCatalogSyncHistory(): Promise<PrintifyCatalogSync[]> { return stores.getCatalogSyncHistory(this.db); }

  async createCostSync(sync: InsertPrintifyCostSync): Promise<PrintifyCostSync> { return stores.createCostSync(this.db, sync); }
  async updateCostSync(id: string, sync: Partial<InsertPrintifyCostSync>): Promise<PrintifyCostSync | undefined> { return stores.updateCostSync(this.db, id, sync); }
  async getLatestCostSync(): Promise<PrintifyCostSync | undefined> { return stores.getLatestCostSync(this.db); }
  async getActiveCostSync(): Promise<PrintifyCostSync | undefined> { return stores.getActiveCostSync(this.db); }
  async getCostSyncHistory(): Promise<PrintifyCostSync[]> { return stores.getCostSyncHistory(this.db); }
  async getProviderCostStats(): Promise<{ total: number; withCosts: number; stale: number }> { return stores.getProviderCostStats(this.db); }

  async getAllChannelConfigs(): Promise<ChannelConfig[]> { return stores.getAllChannelConfigs(this.db); }
  async getChannelConfig(channelType: string): Promise<ChannelConfig | undefined> { return stores.getChannelConfig(this.db, channelType); }
  async createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig> { return stores.createChannelConfig(this.db, config); }
  async updateChannelConfig(channelType: string, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined> { return stores.updateChannelConfig(this.db, channelType, config); }

  async getPublishStates(masterProductId: string): Promise<ChannelPublishState[]> { return stores.getPublishStates(this.db, masterProductId); }
  async getPublishState(masterProductId: string, channelType: string): Promise<ChannelPublishState | undefined> { return stores.getPublishState(this.db, masterProductId, channelType); }
  async upsertPublishState(state: InsertChannelPublishState): Promise<ChannelPublishState> { return stores.upsertPublishState(this.db, state); }

  async getQrDesign(id: string): Promise<QrDesign | undefined> { return misc.getQrDesign(this.db, id); }
  async getQrDesignsByUser(userId: string): Promise<QrDesign[]> { return misc.getQrDesignsByUser(this.db, userId); }
  async getPublicGalleryDesigns(): Promise<QrDesign[]> { return misc.getPublicGalleryDesigns(this.db); }
  async createQrDesign(design: InsertQrDesign): Promise<QrDesign> { return misc.createQrDesign(this.db, design); }
  async updateQrDesign(id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined> { return misc.updateQrDesign(this.db, id, design); }
  async deleteQrDesign(id: string): Promise<void> { return misc.deleteQrDesign(this.db, id); }

  async getHostedImage(id: string): Promise<HostedImage | undefined> { return misc.getHostedImage(this.db, id); }
  async getHostedImagesByUser(userId: string): Promise<HostedImage[]> { return misc.getHostedImagesByUser(this.db, userId); }
  async getAllHostedImages(): Promise<HostedImage[]> { return misc.getAllHostedImages(this.db); }
  async createHostedImage(image: InsertHostedImage): Promise<HostedImage> { return misc.createHostedImage(this.db, image); }
  async updateHostedImage(id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined> { return misc.updateHostedImage(this.db, id, image); }
  async incrementImageViews(id: string): Promise<void> { return misc.incrementImageViews(this.db, id); }
  async deleteHostedImage(id: string): Promise<void> { return misc.deleteHostedImage(this.db, id); }

  async getHostingReminderByImageAndDays(imageId: string, daysRemaining: number): Promise<HostingReminder | undefined> { return misc.getHostingReminderByImageAndDays(this.db, imageId, daysRemaining); }
  async createHostingReminder(reminder: InsertHostingReminder): Promise<HostingReminder> { return misc.createHostingReminder(this.db, reminder); }

  async getPricingRules(): Promise<PricingRule[]> { return misc.getPricingRules(this.db); }
  async getPricingRule(id: string): Promise<PricingRule | undefined> { return misc.getPricingRule(this.db, id); }
  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> { return misc.createPricingRule(this.db, rule); }
  async updatePricingRule(id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined> { return misc.updatePricingRule(this.db, id, rule); }
  async deletePricingRule(id: string): Promise<void> { return misc.deletePricingRule(this.db, id); }

  async getHostingTiers(): Promise<HostingTier[]> { return misc.getHostingTiers(this.db); }
  async getHostingTier(id: string): Promise<HostingTier | undefined> { return misc.getHostingTier(this.db, id); }
  async getHostingTierByCode(code: string): Promise<HostingTier | undefined> { return misc.getHostingTierByCode(this.db, code); }
  async createHostingTier(tier: InsertHostingTier): Promise<HostingTier> { return misc.createHostingTier(this.db, tier); }
  async updateHostingTier(id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined> { return misc.updateHostingTier(this.db, id, tier); }
  async deleteHostingTier(id: string): Promise<void> { return misc.deleteHostingTier(this.db, id); }

  async getCoupons(): Promise<Coupon[]> { return misc.getCoupons(this.db); }
  async getActiveCoupons(): Promise<Coupon[]> { return misc.getActiveCoupons(this.db); }
  async getCoupon(id: string): Promise<Coupon | undefined> { return misc.getCoupon(this.db, id); }
  async getCouponByCode(code: string): Promise<Coupon | undefined> { return misc.getCouponByCode(this.db, code); }
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> { return misc.createCoupon(this.db, coupon); }
  async updateCoupon(id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined> { return misc.updateCoupon(this.db, id, coupon); }
  async deleteCoupon(id: string): Promise<void> { return misc.deleteCoupon(this.db, id); }
  async incrementCouponRedemption(id: string): Promise<void> { return misc.incrementCouponRedemption(this.db, id); }

  async getQrTemplates(): Promise<QrTemplate[]> { return misc.getQrTemplates(this.db); }
  async getActiveQrTemplates(): Promise<QrTemplate[]> { return misc.getActiveQrTemplates(this.db); }
  async getQrTemplate(id: string): Promise<QrTemplate | undefined> { return misc.getQrTemplate(this.db, id); }
  async createQrTemplate(template: InsertQrTemplate): Promise<QrTemplate> { return misc.createQrTemplate(this.db, template); }
  async updateQrTemplate(id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined> { return misc.updateQrTemplate(this.db, id, template); }
  async deleteQrTemplate(id: string): Promise<void> { return misc.deleteQrTemplate(this.db, id); }

  async getDynamicPage(id: string): Promise<DynamicPage | undefined> { return misc.getDynamicPage(this.db, id); }
  async getDynamicPageBySlug(slug: string): Promise<DynamicPage | undefined> { return misc.getDynamicPageBySlug(this.db, slug); }
  async getDynamicPagesByUser(userId: string): Promise<DynamicPage[]> { return misc.getDynamicPagesByUser(this.db, userId); }
  async createDynamicPage(page: InsertDynamicPage): Promise<DynamicPage> { return misc.createDynamicPage(this.db, page); }
  async updateDynamicPage(id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined> { return misc.updateDynamicPage(this.db, id, page); }
  async deleteDynamicPage(id: string): Promise<void> { return misc.deleteDynamicPage(this.db, id); }
  async incrementDynamicPageViews(id: string): Promise<void> { return misc.incrementDynamicPageViews(this.db, id); }

  async getDynamicPageAsset(id: string): Promise<DynamicPageAsset | undefined> { return misc.getDynamicPageAsset(this.db, id); }
  async getDynamicPageAssets(pageId: string): Promise<DynamicPageAsset[]> { return misc.getDynamicPageAssets(this.db, pageId); }
  async createDynamicPageAsset(asset: InsertDynamicPageAsset): Promise<DynamicPageAsset> { return misc.createDynamicPageAsset(this.db, asset); }
  async updateDynamicPageAsset(id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined> { return misc.updateDynamicPageAsset(this.db, id, asset); }
  async deleteDynamicPageAsset(id: string): Promise<void> { return misc.deleteDynamicPageAsset(this.db, id); }
  async setActiveAsset(pageId: string, assetId: string): Promise<void> { return misc.setActiveAsset(this.db, pageId, assetId); }

  async logProviderHealth(log: InsertProviderHealthLog): Promise<ProviderHealthLog> { return misc.logProviderHealth(this.db, log); }
  async getProviderHealthLogs(limit: number = 100): Promise<ProviderHealthLog[]> { return misc.getProviderHealthLogs(this.db, limit); }
  async getProviderHealthLogsByType(providerType: string, limit: number = 100): Promise<ProviderHealthLog[]> { return misc.getProviderHealthLogsByType(this.db, providerType, limit); }
  async getLatestProviderHealth(providerType: string): Promise<ProviderHealthLog | undefined> { return misc.getLatestProviderHealth(this.db, providerType); }
  async getAllLatestProviderHealth(): Promise<ProviderHealthLog[]> { return misc.getAllLatestProviderHealth(this.db); }
  async getProviderHealthStats(providerType: string, hours: number = 24): Promise<{ uptimePercent: number; avgResponseTime: number; totalChecks: number }> { return misc.getProviderHealthStats(this.db, providerType, hours); }

  async getAllGiftPackages(): Promise<GiftPackage[]> { return misc.getAllGiftPackages(this.db); }
  async getActiveGiftPackages(): Promise<GiftPackage[]> { return misc.getActiveGiftPackages(this.db); }
  async getGiftPackage(id: string): Promise<GiftPackage | undefined> { return misc.getGiftPackage(this.db, id); }
  async createGiftPackage(pkg: InsertGiftPackage): Promise<GiftPackage> { return misc.createGiftPackage(this.db, pkg); }
  async updateGiftPackage(id: string, pkg: Partial<InsertGiftPackage>): Promise<GiftPackage | undefined> { return misc.updateGiftPackage(this.db, id, pkg); }
  async deleteGiftPackage(id: string): Promise<void> { return misc.deleteGiftPackage(this.db, id); }

  async getGiftCode(id: string): Promise<GiftCode | undefined> { return misc.getGiftCode(this.db, id); }
  async getGiftCodeByCode(code: string): Promise<GiftCode | undefined> { return misc.getGiftCodeByCode(this.db, code); }
  async getGiftCodesByBuyer(buyerUserId: string): Promise<GiftCode[]> { return misc.getGiftCodesByBuyer(this.db, buyerUserId); }
  async createGiftCode(code: InsertGiftCode): Promise<GiftCode> { return misc.createGiftCode(this.db, code); }
  async updateGiftCode(id: string, code: Partial<InsertGiftCode>): Promise<GiftCode | undefined> { return misc.updateGiftCode(this.db, id, code); }

  async getGiftRedemption(id: string): Promise<GiftRedemption | undefined> { return misc.getGiftRedemption(this.db, id); }
  async getGiftRedemptionByCode(giftCodeId: string): Promise<GiftRedemption | undefined> { return misc.getGiftRedemptionByCode(this.db, giftCodeId); }
  async getGiftRedemptionsByRecipient(recipientEmail: string): Promise<GiftRedemption[]> { return misc.getGiftRedemptionsByRecipient(this.db, recipientEmail); }
  async createGiftRedemption(redemption: InsertGiftRedemption): Promise<GiftRedemption> { return misc.createGiftRedemption(this.db, redemption); }
  async updateGiftRedemption(id: string, redemption: Partial<InsertGiftRedemption>): Promise<GiftRedemption | undefined> { return misc.updateGiftRedemption(this.db, id, redemption); }

  async getEmailTemplates(): Promise<EmailTemplate[]> { return misc.getEmailTemplates(this.db); }
  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> { return misc.getEmailTemplate(this.db, id); }
  async getEmailTemplateByTrigger(trigger: string): Promise<EmailTemplate | undefined> { return misc.getEmailTemplateByTrigger(this.db, trigger); }
  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> { return misc.createEmailTemplate(this.db, template); }
  async updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> { return misc.updateEmailTemplate(this.db, id, template); }
  async deleteEmailTemplate(id: string): Promise<void> { return misc.deleteEmailTemplate(this.db, id); }

  async getEmailLogs(limit: number = 100): Promise<EmailLog[]> { return misc.getEmailLogs(this.db, limit); }
  async logEmail(log: Omit<EmailLog, 'id' | 'sentAt'>): Promise<EmailLog> { return misc.logEmail(this.db, log); }
}
