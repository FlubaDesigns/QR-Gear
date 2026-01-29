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

export class DualWriteAdapter implements IStorage {
  private failedWrites: Array<{ operation: string; error: unknown; timestamp: Date }> = [];
  
  constructor(
    private primary: IStorage,
    private secondary: IStorage
  ) {
    console.log('[DualWriteAdapter] Initialized - Firestore is single source of truth for reads');
  }
  
  // Use Firestore as the single source of truth for all reads
  private get reader(): IStorage {
    return this.secondary;
  }
  
  private logDualWriteError(operation: string, error: unknown): void {
    const entry = { operation, error, timestamp: new Date() };
    this.failedWrites.push(entry);
    if (this.failedWrites.length > 100) {
      this.failedWrites.shift();
    }
    console.error(`[DualWrite] ALERT: Secondary write failed for ${operation}:`, error);
  }
  
  getFailedWrites() {
    return [...this.failedWrites];
  }
  
  private async mirrorWriteVoid(
    operation: string,
    secondaryFn: () => Promise<void>
  ): Promise<void> {
    try {
      await secondaryFn();
    } catch (error) {
      this.logDualWriteError(operation, error);
    }
  }
  
  // ============================================
  // USER OPERATIONS
  // ============================================
  
  async getUser(id: string): Promise<User | undefined> {
    return this.reader.getUser(id);
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    return this.reader.getUserByEmail(email);
  }
  
  async getUsers(): Promise<User[]> {
    return this.reader.getUsers();
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const result = await this.primary.createUser(user);
    try {
      await this.secondary.upsertUser({ ...result, id: result.id } as UpsertUser);
    } catch (error) {
      this.logDualWriteError('createUser', error);
    }
    return result;
  }
  
  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await this.primary.upsertUser(userData);
    try {
      await this.secondary.upsertUser({ ...result, id: result.id } as UpsertUser);
    } catch (error) {
      this.logDualWriteError('upsertUser', error);
    }
    return result;
  }
  
  // ============================================
  // PRODUCT OPERATIONS
  // ============================================
  
  async getProduct(id: string): Promise<Product | undefined> {
    return this.reader.getProduct(id);
  }
  
  async getAllProducts(): Promise<Product[]> {
    return this.reader.getAllProducts();
  }
  
  async getProducts(): Promise<Product[]> {
    return this.reader.getProducts();
  }
  
  async getEnabledProducts(): Promise<Product[]> {
    return this.reader.getEnabledProducts();
  }
  
  async createProduct(product: InsertProduct): Promise<Product> {
    const result = await this.primary.createProduct(product);
    try {
      await this.secondary.updateProduct(result.id, result as unknown as Partial<InsertProduct>);
    } catch (error) {
      this.logDualWriteError('createProduct', error);
    }
    return result;
  }
  
  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const result = await this.primary.updateProduct(id, product);
    if (result) {
      try {
        await this.secondary.updateProduct(id, result as unknown as Partial<InsertProduct>);
      } catch (error) {
        this.logDualWriteError('updateProduct', error);
      }
    }
    return result;
  }
  
  async deleteProduct(id: string): Promise<void> {
    await this.primary.deleteProduct(id);
    await this.mirrorWriteVoid('deleteProduct', () => this.secondary.deleteProduct(id));
  }
  
  async toggleProductEnabled(id: string, enabled: boolean): Promise<Product | undefined> {
    const result = await this.primary.toggleProductEnabled(id, enabled);
    if (result) {
      try {
        await this.secondary.updateProduct(id, result as unknown as Partial<InsertProduct>);
      } catch (error) {
        this.logDualWriteError('toggleProductEnabled', error);
      }
    }
    return result;
  }
  
  // ============================================
  // CUSTOM DESIGN OPERATIONS
  // ============================================
  
  async getCustomDesign(id: string): Promise<CustomDesign | undefined> {
    return this.reader.getCustomDesign(id);
  }
  
  async getCustomDesigns(): Promise<CustomDesign[]> {
    return this.reader.getCustomDesigns();
  }
  
  async getCustomDesignsForLibrary(): Promise<CustomDesign[]> {
    return this.reader.getCustomDesignsForLibrary();
  }
  
  async getCustomDesignsByStoreSegment(storeType: string, storeName: string, segment?: string): Promise<CustomDesign[]> {
    return this.reader.getCustomDesignsByStoreSegment(storeType, storeName, segment);
  }
  
  async createCustomDesign(design: InsertCustomDesign): Promise<CustomDesign> {
    const result = await this.primary.createCustomDesign(design);
    try {
      await this.secondary.updateCustomDesign(result.id, result as unknown as Partial<InsertCustomDesign>);
    } catch (error) {
      this.logDualWriteError('createCustomDesign', error);
    }
    return result;
  }
  
  async updateCustomDesign(id: string, design: Partial<InsertCustomDesign>): Promise<CustomDesign | undefined> {
    const result = await this.primary.updateCustomDesign(id, design);
    if (result) {
      try {
        await this.secondary.updateCustomDesign(id, result as unknown as Partial<InsertCustomDesign>);
      } catch (error) {
        this.logDualWriteError('updateCustomDesign', error);
      }
    }
    return result;
  }
  
  async deleteCustomDesign(id: string): Promise<void> {
    await this.primary.deleteCustomDesign(id);
    await this.mirrorWriteVoid('deleteCustomDesign', () => this.secondary.deleteCustomDesign(id));
  }
  
  // ============================================
  // ORDER OPERATIONS
  // ============================================
  
  async getOrder(id: string): Promise<Order | undefined> {
    return this.reader.getOrder(id);
  }
  
  async getOrders(): Promise<OrderUnified[]> {
    return this.reader.getOrders();
  }
  
  async getOrdersByUser(userId: string): Promise<Order[]> {
    return this.reader.getOrdersByUser(userId);
  }
  
  async getOrdersByStatus(status: string): Promise<Order[]> {
    return this.reader.getOrdersByStatus(status);
  }
  
  async getOrderByStripeSession(sessionId: string): Promise<Order | undefined> {
    return this.reader.getOrderByStripeSession(sessionId);
  }
  
  async createOrder(order: InsertOrder): Promise<Order> {
    const result = await this.primary.createOrder(order);
    try {
      await this.secondary.updateOrder(result.id, result as unknown as Partial<InsertOrder>);
    } catch (error) {
      this.logDualWriteError('createOrder', error);
    }
    return result;
  }
  
  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const result = await this.primary.updateOrder(id, order);
    if (result) {
      try {
        await this.secondary.updateOrder(id, result as unknown as Partial<InsertOrder>);
      } catch (error) {
        this.logDualWriteError('updateOrder', error);
      }
    }
    return result;
  }
  
  // ============================================
  // ORDER UNIFIED OPERATIONS
  // ============================================
  
  async getOrderUnified(id: string): Promise<OrderUnified | undefined> {
    return this.reader.getOrderUnified(id);
  }
  
  async createOrderUnified(order: InsertOrderUnified): Promise<OrderUnified> {
    const result = await this.primary.createOrderUnified(order);
    try {
      await this.secondary.updateOrderUnified(result.id, result as unknown as Partial<InsertOrderUnified>);
    } catch (error) {
      this.logDualWriteError('createOrderUnified', error);
    }
    return result;
  }
  
  async updateOrderUnified(id: string, order: Partial<InsertOrderUnified>): Promise<OrderUnified | undefined> {
    const result = await this.primary.updateOrderUnified(id, order);
    if (result) {
      try {
        await this.secondary.updateOrderUnified(id, result as unknown as Partial<InsertOrderUnified>);
      } catch (error) {
        this.logDualWriteError('updateOrderUnified', error);
      }
    }
    return result;
  }
  
  // ============================================
  // ORDER ITEM OPERATIONS
  // ============================================
  
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return this.reader.getOrderItems(orderId);
  }
  
  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const result = await this.primary.createOrderItem(item);
    try {
      await this.secondary.createOrderItem(result as unknown as InsertOrderItem);
    } catch (error) {
      this.logDualWriteError('createOrderItem', error);
    }
    return result;
  }
  
  // ============================================
  // ADMIN SETTINGS
  // ============================================
  
  async getAdminSettings(): Promise<AdminSettings | undefined> {
    return this.reader.getAdminSettings();
  }
  
  async upsertAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> {
    const result = await this.primary.upsertAdminSettings(settings);
    try {
      await this.secondary.upsertAdminSettings(result as unknown as InsertAdminSettings);
    } catch (error) {
      this.logDualWriteError('upsertAdminSettings', error);
    }
    return result;
  }
  
  // ============================================
  // DELEGATE ALL OTHER OPERATIONS TO PRIMARY
  // Secondary writes will be added as needed
  // ============================================
  
  // Browsing History
  async getBrowsingHistory(userId: string): Promise<BrowsingHistory[]> {
    return this.reader.getBrowsingHistory(userId);
  }
  async addBrowsingHistory(entry: InsertBrowsingHistory): Promise<BrowsingHistory> {
    return this.reader.addBrowsingHistory(entry);
  }
  async clearBrowsingHistory(userId: string): Promise<void> {
    return this.reader.clearBrowsingHistory(userId);
  }
  
  // QR Design
  async getQrDesign(id: string): Promise<QrDesign | undefined> {
    return this.reader.getQrDesign(id);
  }
  async getQrDesignsByUser(userId: string): Promise<QrDesign[]> {
    return this.reader.getQrDesignsByUser(userId);
  }
  async getPublicGalleryDesigns(): Promise<QrDesign[]> {
    return this.reader.getPublicGalleryDesigns();
  }
  async createQrDesign(design: InsertQrDesign): Promise<QrDesign> {
    return this.reader.createQrDesign(design);
  }
  async updateQrDesign(id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined> {
    return this.reader.updateQrDesign(id, design);
  }
  async deleteQrDesign(id: string): Promise<void> {
    return this.reader.deleteQrDesign(id);
  }
  
  // Cart
  async getCartItemsByUser(userId: string): Promise<CartItem[]> {
    return this.reader.getCartItemsByUser(userId);
  }
  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    return this.reader.addCartItem(item);
  }
  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    return this.reader.updateCartItem(id, quantity);
  }
  async deleteCartItem(id: string): Promise<void> {
    return this.reader.deleteCartItem(id);
  }
  async clearCart(userId: string): Promise<void> {
    return this.reader.clearCart(userId);
  }
  
  // Hosted Image
  async getHostedImage(id: string): Promise<HostedImage | undefined> {
    return this.reader.getHostedImage(id);
  }
  async getHostedImagesByUser(userId: string): Promise<HostedImage[]> {
    return this.reader.getHostedImagesByUser(userId);
  }
  async getAllHostedImages(): Promise<HostedImage[]> {
    return this.reader.getAllHostedImages();
  }
  async createHostedImage(image: InsertHostedImage): Promise<HostedImage> {
    return this.reader.createHostedImage(image);
  }
  async updateHostedImage(id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined> {
    return this.reader.updateHostedImage(id, image);
  }
  async incrementImageViews(id: string): Promise<void> {
    return this.reader.incrementImageViews(id);
  }
  async deleteHostedImage(id: string): Promise<void> {
    return this.reader.deleteHostedImage(id);
  }
  
  // Hosting Reminder
  async getHostingReminderByImageAndDays(imageId: string, daysRemaining: number): Promise<HostingReminder | undefined> {
    return this.reader.getHostingReminderByImageAndDays(imageId, daysRemaining);
  }
  async createHostingReminder(reminder: InsertHostingReminder): Promise<HostingReminder> {
    return this.reader.createHostingReminder(reminder);
  }
  
  // Pricing Rules
  async getPricingRules(): Promise<PricingRule[]> {
    return this.reader.getPricingRules();
  }
  async getPricingRule(id: string): Promise<PricingRule | undefined> {
    return this.reader.getPricingRule(id);
  }
  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> {
    return this.reader.createPricingRule(rule);
  }
  async updatePricingRule(id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    return this.reader.updatePricingRule(id, rule);
  }
  async deletePricingRule(id: string): Promise<void> {
    return this.reader.deletePricingRule(id);
  }
  
  // Hosting Tiers
  async getHostingTiers(): Promise<HostingTier[]> {
    return this.reader.getHostingTiers();
  }
  async getHostingTier(id: string): Promise<HostingTier | undefined> {
    return this.reader.getHostingTier(id);
  }
  async getHostingTierByCode(code: string): Promise<HostingTier | undefined> {
    return this.reader.getHostingTierByCode(code);
  }
  async createHostingTier(tier: InsertHostingTier): Promise<HostingTier> {
    return this.reader.createHostingTier(tier);
  }
  async updateHostingTier(id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined> {
    return this.reader.updateHostingTier(id, tier);
  }
  async deleteHostingTier(id: string): Promise<void> {
    return this.reader.deleteHostingTier(id);
  }
  
  // Coupons
  async getCoupons(): Promise<Coupon[]> {
    return this.reader.getCoupons();
  }
  async getActiveCoupons(): Promise<Coupon[]> {
    return this.reader.getActiveCoupons();
  }
  async getCoupon(id: string): Promise<Coupon | undefined> {
    return this.reader.getCoupon(id);
  }
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    return this.reader.getCouponByCode(code);
  }
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    return this.reader.createCoupon(coupon);
  }
  async updateCoupon(id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    return this.reader.updateCoupon(id, coupon);
  }
  async deleteCoupon(id: string): Promise<void> {
    return this.reader.deleteCoupon(id);
  }
  async incrementCouponRedemption(id: string): Promise<void> {
    return this.reader.incrementCouponRedemption(id);
  }
  
  // QR Templates
  async getQrTemplates(): Promise<QrTemplate[]> {
    return this.reader.getQrTemplates();
  }
  async getActiveQrTemplates(): Promise<QrTemplate[]> {
    return this.reader.getActiveQrTemplates();
  }
  async getQrTemplate(id: string): Promise<QrTemplate | undefined> {
    return this.reader.getQrTemplate(id);
  }
  async createQrTemplate(template: InsertQrTemplate): Promise<QrTemplate> {
    return this.reader.createQrTemplate(template);
  }
  async updateQrTemplate(id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined> {
    return this.reader.updateQrTemplate(id, template);
  }
  async deleteQrTemplate(id: string): Promise<void> {
    return this.reader.deleteQrTemplate(id);
  }
  
  // Dynamic Pages
  async getDynamicPage(id: string): Promise<DynamicPage | undefined> {
    return this.reader.getDynamicPage(id);
  }
  async getDynamicPageBySlug(slug: string): Promise<DynamicPage | undefined> {
    return this.reader.getDynamicPageBySlug(slug);
  }
  async getDynamicPagesByUser(userId: string): Promise<DynamicPage[]> {
    return this.reader.getDynamicPagesByUser(userId);
  }
  async createDynamicPage(page: InsertDynamicPage): Promise<DynamicPage> {
    return this.reader.createDynamicPage(page);
  }
  async updateDynamicPage(id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined> {
    return this.reader.updateDynamicPage(id, page);
  }
  async deleteDynamicPage(id: string): Promise<void> {
    return this.reader.deleteDynamicPage(id);
  }
  async incrementDynamicPageViews(id: string): Promise<void> {
    return this.reader.incrementDynamicPageViews(id);
  }
  
  // Dynamic Page Assets
  async getDynamicPageAsset(id: string): Promise<DynamicPageAsset | undefined> {
    return this.reader.getDynamicPageAsset(id);
  }
  async getDynamicPageAssets(pageId: string): Promise<DynamicPageAsset[]> {
    return this.reader.getDynamicPageAssets(pageId);
  }
  async createDynamicPageAsset(asset: InsertDynamicPageAsset): Promise<DynamicPageAsset> {
    return this.reader.createDynamicPageAsset(asset);
  }
  async updateDynamicPageAsset(id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined> {
    return this.reader.updateDynamicPageAsset(id, asset);
  }
  async deleteDynamicPageAsset(id: string): Promise<void> {
    return this.reader.deleteDynamicPageAsset(id);
  }
  async setActiveAsset(pageId: string, assetId: string): Promise<void> {
    return this.reader.setActiveAsset(pageId, assetId);
  }
  
  // Product Categories
  async getProductCategories(): Promise<ProductCategory[]> {
    return this.reader.getProductCategories();
  }
  async getAllProductCategories(): Promise<ProductCategory[]> {
    return this.reader.getAllProductCategories();
  }
  async getActiveProductCategories(): Promise<ProductCategory[]> {
    return this.reader.getActiveProductCategories();
  }
  async getProductCategoriesByTaxonomy(taxonomyType: string): Promise<ProductCategory[]> {
    return this.reader.getProductCategoriesByTaxonomy(taxonomyType);
  }
  async getProductCategory(id: string): Promise<ProductCategory | undefined> {
    return this.reader.getProductCategory(id);
  }
  async createProductCategory(category: InsertProductCategory): Promise<ProductCategory> {
    return this.reader.createProductCategory(category);
  }
  async updateProductCategory(id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> {
    return this.reader.updateProductCategory(id, category);
  }
  async deleteProductCategory(id: string): Promise<void> {
    return this.reader.deleteProductCategory(id);
  }
  
  // Product Category Assignments
  async getProductCategoryAssignments(productId: string): Promise<ProductCategoryAssignment[]> {
    return this.reader.getProductCategoryAssignments(productId);
  }
  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    return this.reader.getProductsByCategory(categoryId);
  }
  async assignProductToCategory(assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment> {
    return this.reader.assignProductToCategory(assignment);
  }
  async removeProductFromCategory(productId: string, categoryId: string): Promise<void> {
    return this.reader.removeProductFromCategory(productId, categoryId);
  }
  async syncProductCategories(productId: string, categoryIds: string[]): Promise<void> {
    return this.reader.syncProductCategories(productId, categoryIds);
  }
  
  // Partner Stores
  async getPartnerStores(): Promise<PartnerStore[]> {
    return this.reader.getPartnerStores();
  }
  async getPartnerStore(id: string): Promise<PartnerStore | undefined> {
    return this.reader.getPartnerStore(id);
  }
  async getPartnerStoreBySlug(slug: string): Promise<PartnerStore | undefined> {
    return this.reader.getPartnerStoreBySlug(slug);
  }
  async createPartnerStore(store: InsertPartnerStore): Promise<PartnerStore> {
    return this.reader.createPartnerStore(store);
  }
  async updatePartnerStore(id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined> {
    return this.reader.updatePartnerStore(id, store);
  }
  async deletePartnerStore(id: string): Promise<void> {
    return this.reader.deletePartnerStore(id);
  }
  
  // Partner Store Products
  async getPartnerStoreProducts(partnerStoreId: string): Promise<PartnerStoreProduct[]> {
    return this.reader.getPartnerStoreProducts(partnerStoreId);
  }
  async getPartnerStoreProduct(partnerStoreId: string, productId: string): Promise<PartnerStoreProduct | undefined> {
    return this.reader.getPartnerStoreProduct(partnerStoreId, productId);
  }
  async getProductsForStore(storeSlug: string, segment?: string): Promise<Product[]> {
    return this.reader.getProductsForStore(storeSlug, segment);
  }
  async addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct> {
    return this.reader.addPartnerStoreProduct(product);
  }
  async updatePartnerStoreProduct(id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    return this.reader.updatePartnerStoreProduct(id, product);
  }
  async updatePartnerStoreProductByIds(partnerStoreId: string, productId: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    return this.reader.updatePartnerStoreProductByIds(partnerStoreId, productId, product);
  }
  async removePartnerStoreProduct(id: string): Promise<void> {
    return this.reader.removePartnerStoreProduct(id);
  }
  async syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void> {
    return this.reader.syncPartnerStoreProducts(partnerStoreId, productIds);
  }
  
  // Product Variants
  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return this.reader.getProductVariants(productId);
  }
  async upsertProductVariant(variant: InsertProductVariant): Promise<ProductVariant> {
    return this.reader.upsertProductVariant(variant);
  }
  async toggleVariantEnabled(id: string, enabled: boolean): Promise<ProductVariant | undefined> {
    return this.reader.toggleVariantEnabled(id, enabled);
  }
  
  // Printify Blueprints
  async getPrintifyBlueprints(): Promise<PrintifyBlueprint[]> {
    return this.reader.getPrintifyBlueprints();
  }
  async getPrintifyBlueprint(id: number): Promise<PrintifyBlueprint | undefined> {
    return this.reader.getPrintifyBlueprint(id);
  }
  async upsertPrintifyBlueprint(blueprint: InsertPrintifyBlueprint): Promise<PrintifyBlueprint> {
    return this.reader.upsertPrintifyBlueprint(blueprint);
  }
  async deletePrintifyBlueprint(id: number): Promise<void> {
    return this.reader.deletePrintifyBlueprint(id);
  }
  async clearPrintifyBlueprints(): Promise<void> {
    return this.reader.clearPrintifyBlueprints();
  }
  
  // Printify Print Providers
  async getAllPrintifyProviders(): Promise<PrintifyPrintProvider[]> {
    return this.reader.getAllPrintifyProviders();
  }
  async getPrintifyPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> {
    return this.reader.getPrintifyPrintProviders(blueprintId);
  }
  async getPrintifyPrintProvider(blueprintId: number, providerId: number): Promise<PrintifyPrintProvider | undefined> {
    return this.reader.getPrintifyPrintProvider(blueprintId, providerId);
  }
  async upsertPrintifyPrintProvider(provider: InsertPrintifyPrintProvider): Promise<PrintifyPrintProvider> {
    const result = await this.primary.upsertPrintifyPrintProvider(provider);
    // Sync to Firestore for production access
    this.secondary.upsertPrintifyPrintProvider(provider).catch(e => console.error('[DualWrite] Provider sync failed:', e));
    return result;
  }
  async updatePrintifyProviderCosts(blueprintId: number, providerId: number, costs: { minCost: number; maxCost: number; placeholderProductId?: string; availableColors?: any[]; availableSizes?: string[] }): Promise<PrintifyPrintProvider | undefined> {
    const result = await this.primary.updatePrintifyProviderCosts(blueprintId, providerId, costs);
    // Sync to Firestore for production access
    this.secondary.updatePrintifyProviderCosts(blueprintId, providerId, costs).catch(e => console.error('[DualWrite] Provider cost sync failed:', e));
    return result;
  }
  async updateProductPricesByProvider(blueprintId: number, providerId: number, basePrice: string): Promise<number> {
    return this.reader.updateProductPricesByProvider(blueprintId, providerId, basePrice);
  }
  async deletePrintifyPrintProvidersByBlueprint(blueprintId: number): Promise<void> {
    return this.reader.deletePrintifyPrintProvidersByBlueprint(blueprintId);
  }
  async clearPrintifyPrintProviders(): Promise<void> {
    return this.reader.clearPrintifyPrintProviders();
  }
  
  // Catalog Sync
  async createCatalogSync(sync: InsertPrintifyCatalogSync): Promise<PrintifyCatalogSync> {
    return this.reader.createCatalogSync(sync);
  }
  async updateCatalogSync(id: string, sync: Partial<InsertPrintifyCatalogSync>): Promise<PrintifyCatalogSync | undefined> {
    return this.reader.updateCatalogSync(id, sync);
  }
  async getLatestCatalogSync(): Promise<PrintifyCatalogSync | undefined> {
    return this.reader.getLatestCatalogSync();
  }
  async getCatalogSyncHistory(): Promise<PrintifyCatalogSync[]> {
    return this.reader.getCatalogSyncHistory();
  }
  
  // Cost Sync
  async createCostSync(sync: InsertPrintifyCostSync): Promise<PrintifyCostSync> {
    return this.reader.createCostSync(sync);
  }
  async updateCostSync(id: string, sync: Partial<InsertPrintifyCostSync>): Promise<PrintifyCostSync | undefined> {
    return this.reader.updateCostSync(id, sync);
  }
  async getLatestCostSync(): Promise<PrintifyCostSync | undefined> {
    return this.reader.getLatestCostSync();
  }
  async getActiveCostSync(): Promise<PrintifyCostSync | undefined> {
    return this.reader.getActiveCostSync();
  }
  async getCostSyncHistory(): Promise<PrintifyCostSync[]> {
    return this.reader.getCostSyncHistory();
  }
  async getProviderCostStats(): Promise<{ total: number; withCosts: number; stale: number }> {
    return this.reader.getProviderCostStats();
  }
  
  // Template Categories
  async getTemplateCategories(): Promise<TemplateCategory[]> {
    return this.reader.getTemplateCategories();
  }
  async getTemplateCategoriesByParent(parentId: string | null): Promise<TemplateCategory[]> {
    return this.reader.getTemplateCategoriesByParent(parentId);
  }
  async createTemplateCategory(category: InsertTemplateCategory): Promise<TemplateCategory> {
    return this.reader.createTemplateCategory(category);
  }
  async updateTemplateCategory(id: string, category: Partial<InsertTemplateCategory>): Promise<TemplateCategory | undefined> {
    return this.reader.updateTemplateCategory(id, category);
  }
  async deleteTemplateCategory(id: string): Promise<void> {
    return this.reader.deleteTemplateCategory(id);
  }
  
  // Graphic Sets
  async getGraphicSets(): Promise<GraphicSet[]> {
    return this.reader.getGraphicSets();
  }

  async getGraphicSet(id: string): Promise<GraphicSet | undefined> {
    return this.reader.getGraphicSet(id);
  }

  async getGraphicSetsByCategory(categoryId: string): Promise<GraphicSet[]> {
    return this.reader.getGraphicSetsByCategory(categoryId);
  }

  async createGraphicSet(graphicSet: InsertGraphicSet): Promise<GraphicSet> {
    const result = await this.primary.createGraphicSet(graphicSet);
    try {
      await this.secondary.createGraphicSet(graphicSet);
    } catch (error) {
      this.logDualWriteError('createGraphicSet', error);
    }
    return result;
  }

  async updateGraphicSet(id: string, graphicSet: Partial<InsertGraphicSet>): Promise<GraphicSet | undefined> {
    const result = await this.primary.updateGraphicSet(id, graphicSet);
    try {
      await this.secondary.updateGraphicSet(id, graphicSet);
    } catch (error) {
      this.logDualWriteError('updateGraphicSet', error);
    }
    return result;
  }

  async deleteGraphicSet(id: string): Promise<void> {
    await this.primary.deleteGraphicSet(id);
    await this.mirrorWriteVoid('deleteGraphicSet', () => this.secondary.deleteGraphicSet(id));
  }

  async incrementGraphicSetUsage(id: string): Promise<void> {
    await this.primary.incrementGraphicSetUsage(id);
    await this.mirrorWriteVoid('incrementGraphicSetUsage', () => this.secondary.incrementGraphicSetUsage(id));
  }
  
  // Library Assets
  async getLibraryAsset(id: string): Promise<LibraryAsset | undefined> {
    return this.reader.getLibraryAsset(id);
  }
  async getLibraryAssetByUrl(url: string): Promise<LibraryAsset | undefined> {
    return this.reader.getLibraryAssetByUrl(url);
  }
  async getLibraryAssets(filters?: { ownerType?: string; assetType?: string; mediaType?: string; userId?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
    // Read from Firestore (secondary) for consistency with production
    return this.reader.getLibraryAssets(filters);
  }
  async getAdminLibraryAssets(filters?: { assetType?: string; mediaType?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
    // Read from Firestore (secondary) for consistency with production
    return this.reader.getAdminLibraryAssets(filters);
  }
  async getUserLibraryAssets(userId: string, filters?: { assetType?: string; mediaType?: string }): Promise<LibraryAsset[]> {
    // Read from Firestore (secondary) for consistency with production
    return this.reader.getUserLibraryAssets(userId, filters);
  }
  async createLibraryAsset(asset: InsertLibraryAsset): Promise<LibraryAsset> {
    return this.reader.createLibraryAsset(asset);
  }
  async updateLibraryAsset(id: string, asset: Partial<InsertLibraryAsset>): Promise<LibraryAsset | undefined> {
    return this.reader.updateLibraryAsset(id, asset);
  }
  async deleteLibraryAsset(id: string): Promise<void> {
    return this.reader.deleteLibraryAsset(id);
  }
  async incrementLibraryAssetUsage(id: string): Promise<void> {
    return this.reader.incrementLibraryAssetUsage(id);
  }
  
  // Master Products
  async getAllMasterProducts(): Promise<MasterProduct[]> {
    return this.reader.getAllMasterProducts();
  }
  async getMasterProduct(id: string): Promise<MasterProduct | undefined> {
    return this.reader.getMasterProduct(id);
  }
  async createMasterProduct(product: InsertMasterProduct): Promise<MasterProduct> {
    return this.reader.createMasterProduct(product);
  }
  async updateMasterProduct(id: string, product: Partial<InsertMasterProduct>): Promise<MasterProduct | undefined> {
    return this.reader.updateMasterProduct(id, product);
  }
  async deleteMasterProduct(id: string): Promise<void> {
    return this.reader.deleteMasterProduct(id);
  }
  
  // Design Versions
  async getDesignVersions(masterProductId: string): Promise<ProductDesignVersion[]> {
    return this.reader.getDesignVersions(masterProductId);
  }
  async getActiveDesignVersion(masterProductId: string): Promise<ProductDesignVersion | undefined> {
    return this.reader.getActiveDesignVersion(masterProductId);
  }
  async createDesignVersion(version: InsertProductDesignVersion): Promise<ProductDesignVersion> {
    return this.reader.createDesignVersion(version);
  }
  async updateDesignVersion(id: string, version: Partial<InsertProductDesignVersion>): Promise<ProductDesignVersion | undefined> {
    return this.reader.updateDesignVersion(id, version);
  }
  
  // Channel Configs
  async getAllChannelConfigs(): Promise<ChannelConfig[]> {
    return this.reader.getAllChannelConfigs();
  }
  async getChannelConfig(channelType: string): Promise<ChannelConfig | undefined> {
    return this.reader.getChannelConfig(channelType);
  }
  async createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig> {
    return this.reader.createChannelConfig(config);
  }
  async updateChannelConfig(channelType: string, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined> {
    return this.reader.updateChannelConfig(channelType, config);
  }
  
  // Publish States
  async getPublishStates(masterProductId: string): Promise<ChannelPublishState[]> {
    return this.reader.getPublishStates(masterProductId);
  }
  async getPublishState(masterProductId: string, channelType: string): Promise<ChannelPublishState | undefined> {
    return this.reader.getPublishState(masterProductId, channelType);
  }
  async upsertPublishState(state: InsertChannelPublishState): Promise<ChannelPublishState> {
    return this.reader.upsertPublishState(state);
  }
  
  // Provider Health
  async logProviderHealth(log: InsertProviderHealthLog): Promise<ProviderHealthLog> {
    return this.reader.logProviderHealth(log);
  }
  async getProviderHealthLogs(limit?: number): Promise<ProviderHealthLog[]> {
    return this.reader.getProviderHealthLogs(limit);
  }
  async getProviderHealthLogsByType(providerType: string, limit?: number): Promise<ProviderHealthLog[]> {
    return this.reader.getProviderHealthLogsByType(providerType, limit);
  }
  async getLatestProviderHealth(providerType: string): Promise<ProviderHealthLog | undefined> {
    return this.reader.getLatestProviderHealth(providerType);
  }
  async getAllLatestProviderHealth(): Promise<ProviderHealthLog[]> {
    return this.reader.getAllLatestProviderHealth();
  }
  async getProviderHealthStats(providerType: string, hours?: number): Promise<{ uptimePercent: number; avgResponseTime: number; totalChecks: number }> {
    return this.reader.getProviderHealthStats(providerType, hours);
  }
  
  // Gift Packages
  async getAllGiftPackages(): Promise<GiftPackage[]> {
    return this.reader.getAllGiftPackages();
  }
  async getActiveGiftPackages(): Promise<GiftPackage[]> {
    return this.reader.getActiveGiftPackages();
  }
  async getGiftPackage(id: string): Promise<GiftPackage | undefined> {
    return this.reader.getGiftPackage(id);
  }
  async createGiftPackage(pkg: InsertGiftPackage): Promise<GiftPackage> {
    return this.reader.createGiftPackage(pkg);
  }
  async updateGiftPackage(id: string, pkg: Partial<InsertGiftPackage>): Promise<GiftPackage | undefined> {
    return this.reader.updateGiftPackage(id, pkg);
  }
  async deleteGiftPackage(id: string): Promise<void> {
    return this.reader.deleteGiftPackage(id);
  }
  
  // Gift Codes
  async getGiftCode(id: string): Promise<GiftCode | undefined> {
    return this.reader.getGiftCode(id);
  }
  async getGiftCodeByCode(code: string): Promise<GiftCode | undefined> {
    return this.reader.getGiftCodeByCode(code);
  }
  async getGiftCodesByBuyer(buyerUserId: string): Promise<GiftCode[]> {
    return this.reader.getGiftCodesByBuyer(buyerUserId);
  }
  async createGiftCode(code: InsertGiftCode): Promise<GiftCode> {
    return this.reader.createGiftCode(code);
  }
  async updateGiftCode(id: string, code: Partial<InsertGiftCode>): Promise<GiftCode | undefined> {
    return this.reader.updateGiftCode(id, code);
  }
  
  // Gift Redemptions
  async getGiftRedemption(id: string): Promise<GiftRedemption | undefined> {
    return this.reader.getGiftRedemption(id);
  }
  async getGiftRedemptionByCode(giftCodeId: string): Promise<GiftRedemption | undefined> {
    return this.reader.getGiftRedemptionByCode(giftCodeId);
  }
  async getGiftRedemptionsByRecipient(recipientEmail: string): Promise<GiftRedemption[]> {
    return this.reader.getGiftRedemptionsByRecipient(recipientEmail);
  }
  async createGiftRedemption(redemption: InsertGiftRedemption): Promise<GiftRedemption> {
    return this.reader.createGiftRedemption(redemption);
  }
  async updateGiftRedemption(id: string, redemption: Partial<InsertGiftRedemption>): Promise<GiftRedemption | undefined> {
    return this.reader.updateGiftRedemption(id, redemption);
  }
  
  // Email Templates
  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return this.reader.getEmailTemplates();
  }
  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    return this.reader.getEmailTemplate(id);
  }
  async getEmailTemplateByTrigger(trigger: string): Promise<EmailTemplate | undefined> {
    return this.reader.getEmailTemplateByTrigger(trigger);
  }
  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    return this.reader.createEmailTemplate(template);
  }
  async updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    return this.reader.updateEmailTemplate(id, template);
  }
  async deleteEmailTemplate(id: string): Promise<void> {
    return this.reader.deleteEmailTemplate(id);
  }
  
  // Email Logs
  async getEmailLogs(limit?: number): Promise<EmailLog[]> {
    return this.reader.getEmailLogs(limit);
  }
  async logEmail(log: Omit<EmailLog, 'id' | 'sentAt'>): Promise<EmailLog> {
    return this.reader.logEmail(log);
  }
}
