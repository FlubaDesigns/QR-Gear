import type {
  User,
  InsertUser,
  UpsertUser,
  QrDesign,
  InsertQrDesign,
  Product,
  InsertProduct,
  CartItem,
  InsertCartItem,
  Order,
  InsertOrder,
  OrderItem,
  InsertOrderItem,
  HostedImage,
  InsertHostedImage,
  HostingReminder,
  InsertHostingReminder,
  BrowsingHistory,
  InsertBrowsingHistory,
  PricingRule,
  InsertPricingRule,
  AdminSettings,
  InsertAdminSettings,
  HostingTier,
  InsertHostingTier,
  Coupon,
  InsertCoupon,
  QrTemplate,
  InsertQrTemplate,
  DynamicPage,
  InsertDynamicPage,
  DynamicPageAsset,
  InsertDynamicPageAsset,
  ProductCategory,
  InsertProductCategory,
  ProductCategoryAssignment,
  InsertProductCategoryAssignment,
  PartnerStore,
  InsertPartnerStore,
  PartnerStoreProduct,
  InsertPartnerStoreProduct,
  ProductVariant,
  InsertProductVariant,
  PrintifyBlueprint,
  InsertPrintifyBlueprint,
  PrintifyPrintProvider,
  InsertPrintifyPrintProvider,
  PrintifyCatalogSync,
  InsertPrintifyCatalogSync,
  PrintifyCostSync,
  InsertPrintifyCostSync,
  CustomDesign,
  InsertCustomDesign,
  LibraryAsset,
  InsertLibraryAsset,
  MasterProduct,
  InsertMasterProduct,
  ProductDesignVersion,
  InsertProductDesignVersion,
  ChannelConfig,
  InsertChannelConfig,
  ChannelPublishState,
  InsertChannelPublishState,
  ProviderHealthLog,
  InsertProviderHealthLog,
  GiftPackage,
  InsertGiftPackage,
  GiftCode,
  InsertGiftCode,
  GiftRedemption,
  InsertGiftRedemption,
  TemplateCategory,
  InsertTemplateCategory,
  GraphicSet,
  InsertGraphicSet,
  OrderUnified,
  InsertOrderUnified,
  EmailTemplate,
  InsertEmailTemplate,
  EmailLog,
} from "@shared/schema";

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Browsing history operations
  getBrowsingHistory(userId: string): Promise<BrowsingHistory[]>;
  addBrowsingHistory(entry: InsertBrowsingHistory): Promise<BrowsingHistory>;
  clearBrowsingHistory(userId: string): Promise<void>;

  // QR Design operations
  getQrDesign(id: string): Promise<QrDesign | undefined>;
  getQrDesignsByUser(userId: string): Promise<QrDesign[]>;
  getPublicGalleryDesigns(): Promise<QrDesign[]>;
  createQrDesign(design: InsertQrDesign): Promise<QrDesign>;
  updateQrDesign(id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined>;
  deleteQrDesign(id: string): Promise<void>;

  // Product operations
  getProduct(id: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;

  // Cart operations
  getCartItemsByUser(userId: string): Promise<CartItem[]>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  deleteCartItem(id: string): Promise<void>;
  clearCart(userId: string): Promise<void>;

  // Order operations
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  getOrderByStripeSession(sessionId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;

  // Order Item operations
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;

  // Hosted Image operations
  getHostedImage(id: string): Promise<HostedImage | undefined>;
  getHostedImagesByUser(userId: string): Promise<HostedImage[]>;
  getAllHostedImages(): Promise<HostedImage[]>;
  createHostedImage(image: InsertHostedImage): Promise<HostedImage>;
  updateHostedImage(id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined>;
  incrementImageViews(id: string): Promise<void>;
  deleteHostedImage(id: string): Promise<void>;

  // Hosting Reminder operations
  getHostingReminderByImageAndDays(imageId: string, daysRemaining: number): Promise<HostingReminder | undefined>;
  createHostingReminder(reminder: InsertHostingReminder): Promise<HostingReminder>;

  // Admin Settings operations
  getAdminSettings(): Promise<AdminSettings | undefined>;
  upsertAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings>;

  // Pricing Rules operations
  getPricingRules(): Promise<PricingRule[]>;
  getPricingRule(id: string): Promise<PricingRule | undefined>;
  createPricingRule(rule: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;
  deletePricingRule(id: string): Promise<void>;

  // Admin Product operations
  getEnabledProducts(): Promise<Product[]>;
  toggleProductEnabled(id: string, enabled: boolean): Promise<Product | undefined>;

  // Hosting Tier operations
  getHostingTiers(): Promise<HostingTier[]>;
  getHostingTier(id: string): Promise<HostingTier | undefined>;
  getHostingTierByCode(code: string): Promise<HostingTier | undefined>;
  createHostingTier(tier: InsertHostingTier): Promise<HostingTier>;
  updateHostingTier(id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined>;
  deleteHostingTier(id: string): Promise<void>;

  // Coupon operations
  getCoupons(): Promise<Coupon[]>;
  getActiveCoupons(): Promise<Coupon[]>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<void>;
  incrementCouponRedemption(id: string): Promise<void>;

  // QR Template operations
  getQrTemplates(): Promise<QrTemplate[]>;
  getActiveQrTemplates(): Promise<QrTemplate[]>;
  getQrTemplate(id: string): Promise<QrTemplate | undefined>;
  createQrTemplate(template: InsertQrTemplate): Promise<QrTemplate>;
  updateQrTemplate(id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined>;
  deleteQrTemplate(id: string): Promise<void>;

  // Dynamic Page operations
  getDynamicPage(id: string): Promise<DynamicPage | undefined>;
  getDynamicPageBySlug(slug: string): Promise<DynamicPage | undefined>;
  getDynamicPagesByUser(userId: string): Promise<DynamicPage[]>;
  createDynamicPage(page: InsertDynamicPage): Promise<DynamicPage>;
  updateDynamicPage(id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined>;
  deleteDynamicPage(id: string): Promise<void>;
  incrementDynamicPageViews(id: string): Promise<void>;

  // Dynamic Page Asset operations
  getDynamicPageAsset(id: string): Promise<DynamicPageAsset | undefined>;
  getDynamicPageAssets(pageId: string): Promise<DynamicPageAsset[]>;
  createDynamicPageAsset(asset: InsertDynamicPageAsset): Promise<DynamicPageAsset>;
  updateDynamicPageAsset(id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined>;
  deleteDynamicPageAsset(id: string): Promise<void>;
  setActiveAsset(pageId: string, assetId: string): Promise<void>;

  // Product Category operations
  getProductCategories(): Promise<ProductCategory[]>;
  getAllProductCategories(): Promise<ProductCategory[]>;
  getActiveProductCategories(): Promise<ProductCategory[]>;
  getProductCategoriesByTaxonomy(taxonomyType: string): Promise<ProductCategory[]>;
  getProductCategory(id: string): Promise<ProductCategory | undefined>;
  createProductCategory(category: InsertProductCategory): Promise<ProductCategory>;
  updateProductCategory(id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined>;
  deleteProductCategory(id: string): Promise<void>;

  // Product Category Assignment operations
  getProductCategoryAssignments(productId: string): Promise<ProductCategoryAssignment[]>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  assignProductToCategory(assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment>;
  removeProductFromCategory(productId: string, categoryId: string): Promise<void>;
  syncProductCategories(productId: string, categoryIds: string[]): Promise<void>;

  // Partner Store operations
  getPartnerStores(): Promise<PartnerStore[]>;
  getPartnerStore(id: string): Promise<PartnerStore | undefined>;
  getPartnerStoreBySlug(slug: string): Promise<PartnerStore | undefined>;
  createPartnerStore(store: InsertPartnerStore): Promise<PartnerStore>;
  updatePartnerStore(id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined>;
  deletePartnerStore(id: string): Promise<void>;

  // Partner Store Product operations
  getPartnerStoreProducts(partnerStoreId: string): Promise<PartnerStoreProduct[]>;
  getPartnerStoreProduct(partnerStoreId: string, productId: string): Promise<PartnerStoreProduct | undefined>;
  getProductsForStore(storeSlug: string, segment?: string): Promise<Product[]>;
  addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct>;
  updatePartnerStoreProduct(id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined>;
  updatePartnerStoreProductByIds(partnerStoreId: string, productId: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined>;
  removePartnerStoreProduct(id: string): Promise<void>;
  syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void>;

  // Product Variant operations
  getProductVariants(productId: string): Promise<ProductVariant[]>;
  upsertProductVariant(variant: InsertProductVariant): Promise<ProductVariant>;
  toggleVariantEnabled(id: string, enabled: boolean): Promise<ProductVariant | undefined>;

  // Printify Catalog operations
  getPrintifyBlueprints(): Promise<PrintifyBlueprint[]>;
  getPrintifyBlueprint(id: number): Promise<PrintifyBlueprint | undefined>;
  upsertPrintifyBlueprint(blueprint: InsertPrintifyBlueprint): Promise<PrintifyBlueprint>;
  deletePrintifyBlueprint(id: number): Promise<void>;
  clearPrintifyBlueprints(): Promise<void>;
  
  // Printify Print Provider operations
  getAllPrintifyProviders(): Promise<PrintifyPrintProvider[]>;
  getPrintifyPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]>;
  getPrintifyPrintProvider(blueprintId: number, providerId: number): Promise<PrintifyPrintProvider | undefined>;
  upsertPrintifyPrintProvider(provider: InsertPrintifyPrintProvider): Promise<PrintifyPrintProvider>;
  updatePrintifyProviderCosts(blueprintId: number, providerId: number, costs: { minCost: number; maxCost: number; placeholderProductId?: string; availableColors?: any[]; availableSizes?: string[] }): Promise<PrintifyPrintProvider | undefined>;
  updateProductPricesByProvider(blueprintId: number, providerId: number, basePrice: string): Promise<number>;
  deletePrintifyPrintProvidersByBlueprint(blueprintId: number): Promise<void>;
  clearPrintifyPrintProviders(): Promise<void>;
  
  // Printify Catalog Sync operations
  createCatalogSync(sync: InsertPrintifyCatalogSync): Promise<PrintifyCatalogSync>;
  updateCatalogSync(id: string, sync: Partial<InsertPrintifyCatalogSync>): Promise<PrintifyCatalogSync | undefined>;
  getLatestCatalogSync(): Promise<PrintifyCatalogSync | undefined>;
  getCatalogSyncHistory(): Promise<PrintifyCatalogSync[]>;

  // Printify Cost Sync operations
  createCostSync(sync: InsertPrintifyCostSync): Promise<PrintifyCostSync>;
  updateCostSync(id: string, sync: Partial<InsertPrintifyCostSync>): Promise<PrintifyCostSync | undefined>;
  getLatestCostSync(): Promise<PrintifyCostSync | undefined>;
  getActiveCostSync(): Promise<PrintifyCostSync | undefined>;
  getCostSyncHistory(): Promise<PrintifyCostSync[]>;
  getProviderCostStats(): Promise<{ total: number; withCosts: number; stale: number }>;

  // Custom Design operations
  getCustomDesign(id: string): Promise<CustomDesign | undefined>;
  getCustomDesigns(): Promise<CustomDesign[]>;
  getCustomDesignsForLibrary(): Promise<CustomDesign[]>;
  getCustomDesignsByStoreSegment(storeType: string, storeName: string, segment?: string): Promise<CustomDesign[]>;
  createCustomDesign(design: InsertCustomDesign): Promise<CustomDesign>;
  updateCustomDesign(id: string, design: Partial<InsertCustomDesign>): Promise<CustomDesign | undefined>;
  deleteCustomDesign(id: string): Promise<void>;

  // Template Category operations
  getTemplateCategories(): Promise<TemplateCategory[]>;
  getTemplateCategoriesByParent(parentId: string | null): Promise<TemplateCategory[]>;
  createTemplateCategory(category: InsertTemplateCategory): Promise<TemplateCategory>;
  updateTemplateCategory(id: string, category: Partial<InsertTemplateCategory>): Promise<TemplateCategory | undefined>;
  deleteTemplateCategory(id: string): Promise<void>;

  // Graphic Set operations (reusable design assets not tied to products)
  getGraphicSets(): Promise<GraphicSet[]>;
  getGraphicSet(id: string): Promise<GraphicSet | undefined>;
  getGraphicSetsByCategory(categoryId: string): Promise<GraphicSet[]>;
  createGraphicSet(graphicSet: InsertGraphicSet): Promise<GraphicSet>;
  updateGraphicSet(id: string, graphicSet: Partial<InsertGraphicSet>): Promise<GraphicSet | undefined>;
  deleteGraphicSet(id: string): Promise<void>;
  incrementGraphicSetUsage(id: string): Promise<void>;

  // Library Asset operations
  getLibraryAsset(id: string): Promise<LibraryAsset | undefined>;
  getLibraryAssetByUrl(url: string): Promise<LibraryAsset | undefined>;
  getLibraryAssets(filters?: { ownerType?: string; assetType?: string; mediaType?: string; userId?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]>;
  getAdminLibraryAssets(filters?: { assetType?: string; mediaType?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]>;
  getUserLibraryAssets(userId: string, filters?: { assetType?: string; mediaType?: string }): Promise<LibraryAsset[]>;
  createLibraryAsset(asset: InsertLibraryAsset): Promise<LibraryAsset>;
  updateLibraryAsset(id: string, asset: Partial<InsertLibraryAsset>): Promise<LibraryAsset | undefined>;
  deleteLibraryAsset(id: string): Promise<void>;
  incrementLibraryAssetUsage(id: string): Promise<void>;

  // Orchestration: Master Product operations
  getAllMasterProducts(): Promise<MasterProduct[]>;
  getMasterProduct(id: string): Promise<MasterProduct | undefined>;
  createMasterProduct(product: InsertMasterProduct): Promise<MasterProduct>;
  updateMasterProduct(id: string, product: Partial<InsertMasterProduct>): Promise<MasterProduct | undefined>;
  deleteMasterProduct(id: string): Promise<void>;

  // Orchestration: Design Version operations
  getDesignVersions(masterProductId: string): Promise<ProductDesignVersion[]>;
  getActiveDesignVersion(masterProductId: string): Promise<ProductDesignVersion | undefined>;
  createDesignVersion(version: InsertProductDesignVersion): Promise<ProductDesignVersion>;
  updateDesignVersion(id: string, version: Partial<InsertProductDesignVersion>): Promise<ProductDesignVersion | undefined>;

  // Orchestration: Channel Config operations
  getAllChannelConfigs(): Promise<ChannelConfig[]>;
  getChannelConfig(channelType: string): Promise<ChannelConfig | undefined>;
  createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig>;
  updateChannelConfig(channelType: string, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined>;

  // Orchestration: Publish State operations
  getPublishStates(masterProductId: string): Promise<ChannelPublishState[]>;
  getPublishState(masterProductId: string, channelType: string): Promise<ChannelPublishState | undefined>;
  upsertPublishState(state: InsertChannelPublishState): Promise<ChannelPublishState>;

  // Batch retrieval operations for admin
  getUsers(): Promise<User[]>;
  getOrders(): Promise<OrderUnified[]>;
  getOrderUnified(id: string): Promise<OrderUnified | undefined>;
  createOrderUnified(order: InsertOrderUnified): Promise<OrderUnified>;
  updateOrderUnified(id: string, order: Partial<InsertOrderUnified>): Promise<OrderUnified | undefined>;
  getProducts(): Promise<Product[]>;

  // Printful catalog operations (Firestore-only, returns [] in MemStorage)
  getAllPrintfulProducts(): Promise<any[]>;
  getAllPrintfulVariants(): Promise<any[]>;

  // Provider Health operations
  logProviderHealth(log: InsertProviderHealthLog): Promise<ProviderHealthLog>;
  getProviderHealthLogs(limit?: number): Promise<ProviderHealthLog[]>;
  getProviderHealthLogsByType(providerType: string, limit?: number): Promise<ProviderHealthLog[]>;
  getLatestProviderHealth(providerType: string): Promise<ProviderHealthLog | undefined>;
  getAllLatestProviderHealth(): Promise<ProviderHealthLog[]>;
  getProviderHealthStats(providerType: string, hours?: number): Promise<{ uptimePercent: number; avgResponseTime: number; totalChecks: number }>;

  // Gift Mode: Package operations
  getAllGiftPackages(): Promise<GiftPackage[]>;
  getActiveGiftPackages(): Promise<GiftPackage[]>;
  getGiftPackage(id: string): Promise<GiftPackage | undefined>;
  createGiftPackage(pkg: InsertGiftPackage): Promise<GiftPackage>;
  updateGiftPackage(id: string, pkg: Partial<InsertGiftPackage>): Promise<GiftPackage | undefined>;
  deleteGiftPackage(id: string): Promise<void>;

  // Gift Mode: Code operations
  getGiftCode(id: string): Promise<GiftCode | undefined>;
  getGiftCodeByCode(code: string): Promise<GiftCode | undefined>;
  getGiftCodesByBuyer(buyerUserId: string): Promise<GiftCode[]>;
  createGiftCode(code: InsertGiftCode): Promise<GiftCode>;
  updateGiftCode(id: string, code: Partial<InsertGiftCode>): Promise<GiftCode | undefined>;

  // Gift Mode: Redemption operations
  getGiftRedemption(id: string): Promise<GiftRedemption | undefined>;
  getGiftRedemptionByCode(giftCodeId: string): Promise<GiftRedemption | undefined>;
  getGiftRedemptionsByRecipient(recipientEmail: string): Promise<GiftRedemption[]>;
  createGiftRedemption(redemption: InsertGiftRedemption): Promise<GiftRedemption>;
  updateGiftRedemption(id: string, redemption: Partial<InsertGiftRedemption>): Promise<GiftRedemption | undefined>;

  // Email Template operations
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByTrigger(trigger: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: string): Promise<void>;

  // Email Log operations
  getEmailLogs(limit?: number): Promise<EmailLog[]>;
  logEmail(log: Omit<EmailLog, 'id' | 'sentAt'>): Promise<EmailLog>;
}


// In-memory storage implementation
class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private qrDesigns = new Map<string, QrDesign>();
  private products = new Map<string, Product>();
  private cartItems = new Map<string, CartItem>();
  private orders = new Map<string, Order>();
  private orderItems = new Map<string, OrderItem>();
  private ordersUnified = new Map<string, OrderUnified>();
  private hostedImages = new Map<string, HostedImage>();
  private browsingHistory = new Map<string, BrowsingHistory>();
  private adminSettings: AdminSettings | undefined;
  private pricingRules = new Map<string, PricingRule>();
  private partnerStores = new Map<string, PartnerStore>();
  private partnerStoreProducts = new Map<string, PartnerStoreProduct>();
  private providerHealthLogs: ProviderHealthLog[] = [];

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = { 
      ...user, 
      id: user.id || `user_${Date.now()}`,
      firstName: user.firstName ?? null,
      lastName: user.lastName ?? null,
      profileImageUrl: user.profileImageUrl ?? null,
      email: user.email ?? null,
      passwordHash: user.passwordHash ?? null,
      socialFacebook: user.socialFacebook ?? null,
      socialInstagram: user.socialInstagram ?? null,
      socialTwitter: user.socialTwitter ?? null,
      socialLinkedin: user.socialLinkedin ?? null,
      socialTiktok: user.socialTiktok ?? null,
      socialYoutube: user.socialYoutube ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const existing = userData.id ? this.users.get(userData.id) : undefined;
    const user: User = {
      id: userData.id || `user_${Date.now()}`,
      email: userData.email ?? null,
      passwordHash: userData.passwordHash ?? null,
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
      socialFacebook: userData.socialFacebook ?? null,
      socialInstagram: userData.socialInstagram ?? null,
      socialTwitter: userData.socialTwitter ?? null,
      socialLinkedin: userData.socialLinkedin ?? null,
      socialTiktok: userData.socialTiktok ?? null,
      socialYoutube: userData.socialYoutube ?? null,
      createdAt: existing?.createdAt || new Date(),
      updatedAt: new Date(),
    };
    this.users.set(user.id, user);
    return user;
  }

  async getBrowsingHistory(userId: string): Promise<BrowsingHistory[]> {
    return Array.from(this.browsingHistory.values()).filter(h => h.userId === userId);
  }

  async addBrowsingHistory(entry: InsertBrowsingHistory): Promise<BrowsingHistory> {
    const id = `bh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newEntry: BrowsingHistory = {
      id,
      userId: entry.userId,
      productId: entry.productId,
      viewedAt: new Date(),
    };
    this.browsingHistory.set(id, newEntry);
    return newEntry;
  }

  async clearBrowsingHistory(userId: string): Promise<void> {
    const toDelete: string[] = [];
    this.browsingHistory.forEach((entry, id) => {
      if (entry.userId === userId) {
        toDelete.push(id);
      }
    });
    toDelete.forEach(id => this.browsingHistory.delete(id));
  }

  async getQrDesign(id: string): Promise<QrDesign | undefined> {
    return this.qrDesigns.get(id);
  }

  async getQrDesignsByUser(userId: string): Promise<QrDesign[]> {
    return Array.from(this.qrDesigns.values()).filter(d => d.userId === userId);
  }

  async createQrDesign(design: InsertQrDesign): Promise<QrDesign> {
    const id = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newDesign: QrDesign = { 
      ...design, 
      id,
      productId: design.productId ?? null,
      productColor: design.productColor ?? null,
      manufacturer: design.manufacturer ?? null,
      madeInUSA: design.madeInUSA ?? null,
      previewUrl: design.previewUrl ?? null,
      showInGallery: design.showInGallery ?? false,
      galleryTitle: design.galleryTitle ?? null,
      galleryDescription: design.galleryDescription ?? null,
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    this.qrDesigns.set(id, newDesign);
    return newDesign;
  }

  async getPublicGalleryDesigns(): Promise<QrDesign[]> {
    return Array.from(this.qrDesigns.values()).filter(d => d.showInGallery === true);
  }

  async updateQrDesign(id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined> {
    const existing = this.qrDesigns.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...design, updatedAt: new Date() };
    this.qrDesigns.set(id, updated);
    return updated;
  }

  async deleteQrDesign(id: string): Promise<void> {
    this.qrDesigns.delete(id);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getAllProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = product.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const base: Record<string, any> = { ...product };
    for (const key of Object.keys(base)) {
      if (base[key] === undefined) base[key] = null;
    }
    const newProduct: Product = {
      ...base,
      id,
      isEnabled: product.isEnabled ?? false,
      markupPercent: product.markupPercent ?? "0",
      markupFixed: product.markupFixed ?? "0",
      qrProductionCost: product.qrProductionCost ?? "0",
      sortOrder: product.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Product;
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...product, updatedAt: new Date() };
    this.products.set(id, updated);
    return updated;
  }

  async deleteProduct(id: string): Promise<void> {
    Array.from(this.productCategoryAssignments.entries()).forEach(([assignmentId, assignment]) => {
      if (assignment.productId === id) this.productCategoryAssignments.delete(assignmentId);
    });
    this.products.delete(id);
  }

  async getCartItemsByUser(userId: string): Promise<CartItem[]> {
    return Array.from(this.cartItems.values()).filter(item => item.userId === userId);
  }

  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const id = `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem: CartItem = { 
      ...item, 
      id,
      designId: item.designId ?? null,
      quantity: item.quantity ?? 1,
      createdAt: new Date() 
    };
    this.cartItems.set(id, newItem);
    return newItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const existing = this.cartItems.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, quantity };
    this.cartItems.set(id, updated);
    return updated;
  }

  async deleteCartItem(id: string): Promise<void> {
    this.cartItems.delete(id);
  }

  async clearCart(userId: string): Promise<void> {
    const entries = Array.from(this.cartItems.entries());
    for (const [id, item] of entries) {
      if (item.userId === userId) {
        this.cartItems.delete(id);
      }
    }
  }

  async getOrder(id: string): Promise<Order | undefined> {
    return this.orders.get(id);
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.userId === userId);
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return Array.from(this.orders.values()).filter(order => order.status === status);
  }

  async getOrderByStripeSession(sessionId: string): Promise<Order | undefined> {
    return Array.from(this.orders.values()).find(order => order.stripeSessionId === sessionId);
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOrder: Order = { 
      ...order, 
      id,
      stripePaymentId: order.stripePaymentId ?? null,
      stripeSessionId: order.stripeSessionId ?? null,
      stripePaymentIntentId: order.stripePaymentIntentId ?? null,
      printifyOrderId: order.printifyOrderId ?? null,
      trackingNumber: order.trackingNumber ?? null,
      shippingAddress: order.shippingAddress ?? null,
      carrier: order.carrier ?? null,
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    this.orders.set(id, newOrder);
    return newOrder;
  }

  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const existing = this.orders.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...order, updatedAt: new Date() };
    this.orders.set(id, updated);
    return updated;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return Array.from(this.orderItems.values()).filter(item => item.orderId === orderId);
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const id = `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newItem: OrderItem = { 
      ...item, 
      id,
      printifyItemId: item.printifyItemId ?? null
    };
    this.orderItems.set(id, newItem);
    return newItem;
  }

  // Hosted Image operations
  async getHostedImage(id: string): Promise<HostedImage | undefined> {
    return this.hostedImages.get(id);
  }

  async getHostedImagesByUser(userId: string): Promise<HostedImage[]> {
    return Array.from(this.hostedImages.values()).filter(img => img.userId === userId);
  }

  async getAllHostedImages(): Promise<HostedImage[]> {
    return Array.from(this.hostedImages.values());
  }

  async createHostedImage(image: InsertHostedImage): Promise<HostedImage> {
    const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newImage: HostedImage = {
      ...image,
      id,
      userId: image.userId ?? null,
      title: image.title ?? null,
      description: image.description ?? null,
      businessName: image.businessName ?? null,
      businessLogo: image.businessLogo ?? null,
      views: 0,
      isActive: image.isActive ?? true,
      expiresAt: image.expiresAt ?? null,
      createdAt: new Date(),
    };
    this.hostedImages.set(id, newImage);
    return newImage;
  }

  async updateHostedImage(id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined> {
    const existing = this.hostedImages.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...image };
    this.hostedImages.set(id, updated);
    return updated;
  }

  async incrementImageViews(id: string): Promise<void> {
    const image = this.hostedImages.get(id);
    if (image) {
      this.hostedImages.set(id, { ...image, views: (image.views || 0) + 1 });
    }
  }

  async deleteHostedImage(id: string): Promise<void> {
    this.hostedImages.delete(id);
  }

  // Hosting Reminder operations
  private hostingReminders = new Map<string, HostingReminder>();

  async getHostingReminderByImageAndDays(imageId: string, daysRemaining: number): Promise<HostingReminder | undefined> {
    const reminderType = `${daysRemaining}_day`;
    return Array.from(this.hostingReminders.values()).find(
      r => r.customGiftId === imageId && r.reminderType === reminderType
    );
  }

  async createHostingReminder(reminder: InsertHostingReminder): Promise<HostingReminder> {
    const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newReminder: HostingReminder = {
      ...reminder,
      id,
      userId: reminder.userId ?? null,
      sentAt: reminder.sentAt ?? null,
      emailAddress: reminder.emailAddress ?? null,
      status: reminder.status ?? "pending",
      createdAt: new Date(),
    };
    this.hostingReminders.set(id, newReminder);
    return newReminder;
  }

  // Admin Settings operations
  async getAdminSettings(): Promise<AdminSettings | undefined> {
    return this.adminSettings;
  }

  async upsertAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> {
    const newSettings: AdminSettings = {
      id: "default",
      globalMarkupPercent: settings.globalMarkupPercent ?? "25",
      globalMarkupFixed: settings.globalMarkupFixed ?? "0",
      globalQrProductionCost: settings.globalQrProductionCost ?? "2",
      textAboveUpcharge: settings.textAboveUpcharge ?? "2",
      textBelowUpcharge: settings.textBelowUpcharge ?? "2",
      imageHostingUpcharge: settings.imageHostingUpcharge ?? "5",
      dynamicQrUpcharge: settings.dynamicQrUpcharge ?? "25",
      showPricesBeforeCustomization: settings.showPricesBeforeCustomization ?? false,
      additionalPlacementCost: (settings as any).additionalPlacementCost ?? null,
      defaultFulfillmentProvider: (settings as any).defaultFulfillmentProvider ?? null,
      defaultMockupProvider: (settings as any).defaultMockupProvider ?? null,
      updatedAt: new Date(),
    };
    this.adminSettings = newSettings;
    return newSettings;
  }

  // Pricing Rules operations
  async getPricingRules(): Promise<PricingRule[]> {
    return Array.from(this.pricingRules.values());
  }

  async getPricingRule(id: string): Promise<PricingRule | undefined> {
    return this.pricingRules.get(id);
  }

  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newRule: PricingRule = {
      ...rule,
      id,
      scopeValue: rule.scopeValue ?? null,
      qrProductionCost: rule.qrProductionCost ?? "0",
      priority: rule.priority ?? 0,
      isActive: rule.isActive ?? true,
      createdAt: new Date(),
    };
    this.pricingRules.set(id, newRule);
    return newRule;
  }

  async updatePricingRule(id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const existing = this.pricingRules.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...rule };
    this.pricingRules.set(id, updated);
    return updated;
  }

  async deletePricingRule(id: string): Promise<void> {
    this.pricingRules.delete(id);
  }

  // Admin Product operations
  async getEnabledProducts(): Promise<Product[]> {
    return Array.from(this.products.values()).filter(p => p.isEnabled);
  }

  async toggleProductEnabled(id: string, enabled: boolean): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, isEnabled: enabled, updatedAt: new Date() };
    this.products.set(id, updated);
    return updated;
  }

  // Hosting Tier operations (stubs for MemStorage)
  private hostingTiers = new Map<string, HostingTier>();
  private qrTemplates = new Map<string, QrTemplate>();

  async getHostingTiers(): Promise<HostingTier[]> {
    return Array.from(this.hostingTiers.values());
  }

  async getHostingTier(id: string): Promise<HostingTier | undefined> {
    return this.hostingTiers.get(id);
  }

  async getHostingTierByCode(code: string): Promise<HostingTier | undefined> {
    return Array.from(this.hostingTiers.values()).find(t => t.code === code);
  }

  async createHostingTier(tier: InsertHostingTier): Promise<HostingTier> {
    const id = `tier_${Date.now()}`;
    const newTier: HostingTier = {
      ...tier,
      id,
      description: tier.description ?? null,
      isIncluded: tier.isIncluded ?? false,
      priceUpcharge: tier.priceUpcharge ?? "0",
      isActive: tier.isActive ?? true,
      sortOrder: tier.sortOrder ?? 0,
      videoPriceUpcharge: tier.videoPriceUpcharge ?? null,
    };
    this.hostingTiers.set(id, newTier);
    return newTier;
  }

  async updateHostingTier(id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined> {
    const existing = this.hostingTiers.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...tier };
    this.hostingTiers.set(id, updated);
    return updated;
  }

  async deleteHostingTier(id: string): Promise<void> {
    this.hostingTiers.delete(id);
  }

  // Coupon operations
  private couponsMap = new Map<string, Coupon>();

  async getCoupons(): Promise<Coupon[]> {
    return Array.from(this.couponsMap.values());
  }

  async getActiveCoupons(): Promise<Coupon[]> {
    return Array.from(this.couponsMap.values()).filter(c => c.isActive);
  }

  async getCoupon(id: string): Promise<Coupon | undefined> {
    return this.couponsMap.get(id);
  }

  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    return Array.from(this.couponsMap.values()).find(c => c.code === code.toUpperCase());
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const id = `coupon_${Date.now()}`;
    const newCoupon: Coupon = {
      ...coupon,
      id,
      code: coupon.code.toUpperCase(),
      currency: coupon.currency ?? "usd",
      minOrderAmount: coupon.minOrderAmount ?? null,
      maxRedemptions: coupon.maxRedemptions ?? null,
      redemptionCount: 0,
      validFrom: coupon.validFrom ?? null,
      validUntil: coupon.validUntil ?? null,
      stripeCouponId: coupon.stripeCouponId ?? null,
      stripePromotionCodeId: coupon.stripePromotionCodeId ?? null,
      isActive: coupon.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.couponsMap.set(id, newCoupon);
    return newCoupon;
  }

  async updateCoupon(id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const existing = this.couponsMap.get(id);
    if (!existing) return undefined;
    const updated: Coupon = { ...existing, ...coupon, updatedAt: new Date() };
    if (coupon.code) updated.code = coupon.code.toUpperCase();
    this.couponsMap.set(id, updated);
    return updated;
  }

  async deleteCoupon(id: string): Promise<void> {
    this.couponsMap.delete(id);
  }

  async incrementCouponRedemption(id: string): Promise<void> {
    const existing = this.couponsMap.get(id);
    if (existing) {
      existing.redemptionCount = (existing.redemptionCount || 0) + 1;
      this.couponsMap.set(id, existing);
    }
  }

  // QR Template operations
  async getQrTemplates(): Promise<QrTemplate[]> {
    return Array.from(this.qrTemplates.values());
  }

  async getActiveQrTemplates(): Promise<QrTemplate[]> {
    return Array.from(this.qrTemplates.values()).filter(t => t.isActive);
  }

  async getQrTemplate(id: string): Promise<QrTemplate | undefined> {
    return this.qrTemplates.get(id);
  }

  async createQrTemplate(template: InsertQrTemplate): Promise<QrTemplate> {
    const id = `template_${Date.now()}`;
    const newTemplate: QrTemplate = {
      ...template,
      id,
      description: template.description ?? null,
      category: template.category ?? null,
      qrPlacement: template.qrPlacement ?? null,
      availableSizes: template.availableSizes ?? null,
      defaultTextAbove: template.defaultTextAbove ?? null,
      defaultTextBelow: template.defaultTextBelow ?? null,
      textStyle: template.textStyle ?? null,
      priceUpcharge: template.priceUpcharge ?? "0",
      isActive: template.isActive ?? true,
      isFeatured: template.isFeatured ?? false,
      sortOrder: template.sortOrder ?? 0,
      createdAt: new Date(),
    };
    this.qrTemplates.set(id, newTemplate);
    return newTemplate;
  }

  async updateQrTemplate(id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined> {
    const existing = this.qrTemplates.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...template };
    this.qrTemplates.set(id, updated);
    return updated;
  }

  async deleteQrTemplate(id: string): Promise<void> {
    this.qrTemplates.delete(id);
  }

  // Dynamic Page operations (MemStorage)
  private dynamicPages = new Map<string, DynamicPage>();
  private dynamicPageAssets = new Map<string, DynamicPageAsset>();

  async getDynamicPage(id: string): Promise<DynamicPage | undefined> {
    return this.dynamicPages.get(id);
  }

  async getDynamicPageBySlug(slug: string): Promise<DynamicPage | undefined> {
    return Array.from(this.dynamicPages.values()).find(p => p.slug === slug);
  }

  async getDynamicPagesByUser(userId: string): Promise<DynamicPage[]> {
    return Array.from(this.dynamicPages.values()).filter(p => p.userId === userId);
  }

  async createDynamicPage(page: InsertDynamicPage): Promise<DynamicPage> {
    const id = `dp_${Date.now()}`;
    const newPage: DynamicPage = {
      ...page,
      id,
      description: page.description ?? null,
      activeAssetId: page.activeAssetId ?? null,
      hostingTierId: page.hostingTierId ?? null,
      views: 0,
      status: page.status ?? "active",
      expiresAt: page.expiresAt ?? null,
      renewalReminderSent: page.renewalReminderSent ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.dynamicPages.set(id, newPage);
    return newPage;
  }

  async updateDynamicPage(id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined> {
    const existing = this.dynamicPages.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...page, updatedAt: new Date() };
    this.dynamicPages.set(id, updated);
    return updated;
  }

  async deleteDynamicPage(id: string): Promise<void> {
    Array.from(this.dynamicPageAssets.entries()).forEach(([assetId, asset]) => {
      if (asset.pageId === id) this.dynamicPageAssets.delete(assetId);
    });
    this.dynamicPages.delete(id);
  }

  async incrementDynamicPageViews(id: string): Promise<void> {
    const page = this.dynamicPages.get(id);
    if (page) {
      page.views = (page.views || 0) + 1;
      this.dynamicPages.set(id, page);
    }
  }

  async getDynamicPageAsset(id: string): Promise<DynamicPageAsset | undefined> {
    return this.dynamicPageAssets.get(id);
  }

  async getDynamicPageAssets(pageId: string): Promise<DynamicPageAsset[]> {
    return Array.from(this.dynamicPageAssets.values()).filter(a => a.pageId === pageId);
  }

  async createDynamicPageAsset(asset: InsertDynamicPageAsset): Promise<DynamicPageAsset> {
    const id = `dpa_${Date.now()}`;
    const newAsset: DynamicPageAsset = {
      ...asset,
      id,
      title: asset.title ?? null,
      isActive: asset.isActive ?? false,
      activatedAt: asset.activatedAt ?? null,
      createdAt: new Date(),
    };
    this.dynamicPageAssets.set(id, newAsset);
    return newAsset;
  }

  async updateDynamicPageAsset(id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined> {
    const existing = this.dynamicPageAssets.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...asset };
    this.dynamicPageAssets.set(id, updated);
    return updated;
  }

  async deleteDynamicPageAsset(id: string): Promise<void> {
    this.dynamicPageAssets.delete(id);
  }

  async setActiveAsset(pageId: string, assetId: string): Promise<void> {
    Array.from(this.dynamicPageAssets.entries()).forEach(([id, asset]) => {
      if (asset.pageId === pageId) {
        this.dynamicPageAssets.set(id, { ...asset, isActive: false, activatedAt: null });
      }
    });
    const asset = this.dynamicPageAssets.get(assetId);
    if (asset) {
      this.dynamicPageAssets.set(assetId, { ...asset, isActive: true, activatedAt: new Date() });
    }
    const page = this.dynamicPages.get(pageId);
    if (page) {
      this.dynamicPages.set(pageId, { ...page, activeAssetId: assetId, updatedAt: new Date() });
    }
  }

  // Product Category operations (MemStorage stubs)
  private productCategories = new Map<string, ProductCategory>();
  private productCategoryAssignments = new Map<string, ProductCategoryAssignment>();

  async getProductCategories(): Promise<ProductCategory[]> {
    return Array.from(this.productCategories.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getAllProductCategories(): Promise<ProductCategory[]> {
    return Array.from(this.productCategories.values()).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getActiveProductCategories(): Promise<ProductCategory[]> {
    return Array.from(this.productCategories.values()).filter(c => c.isActive).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getProductCategoriesByTaxonomy(taxonomyType: string): Promise<ProductCategory[]> {
    return Array.from(this.productCategories.values()).filter(c => c.taxonomyType === taxonomyType).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getProductCategory(id: string): Promise<ProductCategory | undefined> {
    return this.productCategories.get(id);
  }

  async createProductCategory(category: InsertProductCategory): Promise<ProductCategory> {
    const id = `cat_${Date.now()}`;
    const newCategory: ProductCategory = {
      ...category,
      id,
      description: category.description ?? null,
      icon: category.icon ?? null,
      parentId: category.parentId ?? null,
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
      createdAt: new Date(),
    };
    this.productCategories.set(id, newCategory);
    return newCategory;
  }

  async updateProductCategory(id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> {
    const existing = this.productCategories.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...category };
    this.productCategories.set(id, updated);
    return updated;
  }

  async deleteProductCategory(id: string): Promise<void> {
    Array.from(this.productCategoryAssignments.entries()).forEach(([assignmentId, assignment]) => {
      if (assignment.categoryId === id) this.productCategoryAssignments.delete(assignmentId);
    });
    this.productCategories.delete(id);
  }

  async getProductCategoryAssignments(productId: string): Promise<ProductCategoryAssignment[]> {
    return Array.from(this.productCategoryAssignments.values()).filter(a => a.productId === productId);
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const assignments = Array.from(this.productCategoryAssignments.values()).filter(a => a.categoryId === categoryId);
    const productIds = assignments.map(a => a.productId);
    return Array.from(this.products.values()).filter(p => productIds.includes(p.id));
  }

  async assignProductToCategory(assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment> {
    const id = `pca_${Date.now()}`;
    const newAssignment: ProductCategoryAssignment = {
      ...assignment,
      id,
      createdAt: new Date(),
    };
    this.productCategoryAssignments.set(id, newAssignment);
    return newAssignment;
  }

  async removeProductFromCategory(productId: string, categoryId: string): Promise<void> {
    for (const [id, assignment] of Array.from(this.productCategoryAssignments.entries())) {
      if (assignment.productId === productId && assignment.categoryId === categoryId) {
        this.productCategoryAssignments.delete(id);
        break;
      }
    }
  }

  async syncProductCategories(productId: string, categoryIds: string[]): Promise<void> {
    Array.from(this.productCategoryAssignments.entries()).forEach(([id, assignment]) => {
      if (assignment.productId === productId) {
        this.productCategoryAssignments.delete(id);
      }
    });
    for (const categoryId of categoryIds) {
      await this.assignProductToCategory({ productId, categoryId });
    }
  }

  // Partner Store operations
  async getPartnerStores(): Promise<PartnerStore[]> {
    return Array.from(this.partnerStores.values());
  }

  async getPartnerStore(id: string): Promise<PartnerStore | undefined> {
    return this.partnerStores.get(id);
  }

  async getPartnerStoreBySlug(slug: string): Promise<PartnerStore | undefined> {
    return Array.from(this.partnerStores.values()).find(s => s.slug === slug);
  }

  async createPartnerStore(store: InsertPartnerStore): Promise<PartnerStore> {
    const id = `ps_${Date.now()}`;
    const newStore: PartnerStore = {
      ...store,
      id,
      description: store.description ?? null,
      logoUrl: store.logoUrl ?? null,
      websiteUrl: store.websiteUrl ?? null,
      businessPageUrlPattern: store.businessPageUrlPattern ?? null,
      allowedOrigins: store.allowedOrigins ?? null,
      primaryColor: store.primaryColor ?? null,
      accentColor: store.accentColor ?? null,
      availableSegments: store.availableSegments ?? null,
      annualMemberPerk: store.annualMemberPerk ?? null,
      commissionPercent: store.commissionPercent ?? "0",
      isActive: store.isActive ?? true,
      isInternal: store.isInternal ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.partnerStores.set(id, newStore);
    return newStore;
  }

  async updatePartnerStore(id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined> {
    const existing = this.partnerStores.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...store, updatedAt: new Date() };
    this.partnerStores.set(id, updated);
    return updated;
  }

  async deletePartnerStore(id: string): Promise<void> {
    Array.from(this.partnerStoreProducts.entries()).forEach(([productId, product]) => {
      if (product.partnerStoreId === id) this.partnerStoreProducts.delete(productId);
    });
    this.partnerStores.delete(id);
  }

  // Partner Store Product operations
  async getPartnerStoreProducts(partnerStoreId: string): Promise<PartnerStoreProduct[]> {
    return Array.from(this.partnerStoreProducts.values()).filter(p => p.partnerStoreId === partnerStoreId);
  }

  async getPartnerStoreProduct(partnerStoreId: string, productId: string): Promise<PartnerStoreProduct | undefined> {
    return Array.from(this.partnerStoreProducts.values()).find(
      p => p.partnerStoreId === partnerStoreId && p.productId === productId
    );
  }

  async getProductsForStore(storeSlug: string, segment?: string): Promise<Product[]> {
    // Find store by slug or name (supports partial matching)
    const slugLower = storeSlug.toLowerCase();
    const store = Array.from(this.partnerStores.values()).find(
      s => s.slug === storeSlug || 
           s.slug.toLowerCase().startsWith(slugLower) ||
           s.name.toLowerCase() === slugLower ||
           s.name.toLowerCase().includes(slugLower)
    );
    if (!store) return [];
    
    // Get product IDs linked to this store
    const storeProductLinks = Array.from(this.partnerStoreProducts.values())
      .filter(sp => sp.partnerStoreId === store.id && (sp.isEnabled ?? true));
    
    // Get actual products
    let products = storeProductLinks
      .map(sp => this.products.get(sp.productId))
      .filter((p): p is Product => p !== undefined && (p.isEnabled === true));
    
    // Filter by segment if provided
    if (segment) {
      products = products.filter(p => {
        const category = p.category?.toLowerCase() || "";
        return category.includes(`/${segment.toLowerCase()}`);
      });
    }
    
    return products;
  }

  async addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct> {
    const id = `psp_${Date.now()}`;
    const newProduct: PartnerStoreProduct = {
      ...product,
      id,
      customPrice: product.customPrice ?? null,
      customName: product.customName ?? null,
      kcPlacements: product.kcPlacements ?? null,
      kcBusinessSlug: product.kcBusinessSlug ?? null,
      enabledSizes: product.enabledSizes ?? null,
      enabledColors: product.enabledColors ?? null,
      defaultColor: product.defaultColor ?? null,
      mockupsByColor: product.mockupsByColor ?? null,
      sortOrder: product.sortOrder ?? 0,
      isEnabled: product.isEnabled ?? true,
    };
    this.partnerStoreProducts.set(id, newProduct);
    return newProduct;
  }

  async updatePartnerStoreProduct(id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    const existing = this.partnerStoreProducts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...product };
    this.partnerStoreProducts.set(id, updated);
    return updated;
  }

  async updatePartnerStoreProductByIds(partnerStoreId: string, productId: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    const existing = await this.getPartnerStoreProduct(partnerStoreId, productId);
    if (!existing) return undefined;
    const updated = { ...existing, ...product };
    this.partnerStoreProducts.set(existing.id, updated);
    return updated;
  }

  async removePartnerStoreProduct(id: string): Promise<void> {
    this.partnerStoreProducts.delete(id);
  }

  async syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void> {
    // Get existing configurations before deletion to preserve them
    const existingProducts = Array.from(this.partnerStoreProducts.values())
      .filter(p => p.partnerStoreId === partnerStoreId);
    
    // Create a map of existing configurations by productId
    const existingConfigs = new Map<string, typeof existingProducts[0]>();
    existingProducts.forEach(p => existingConfigs.set(p.productId, p));
    
    // Delete all existing
    Array.from(this.partnerStoreProducts.entries()).forEach(([id, product]) => {
      if (product.partnerStoreId === partnerStoreId) this.partnerStoreProducts.delete(id);
    });
    
    // Add products with preserved or auto-populated configurations
    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      const existingConfig = existingConfigs.get(productId);
      
      if (existingConfig) {
        // Preserve existing configuration
        await this.addPartnerStoreProduct({
          partnerStoreId,
          productId,
          sortOrder: i,
          enabledSizes: existingConfig.enabledSizes,
          enabledColors: existingConfig.enabledColors,
          kcPlacements: existingConfig.kcPlacements,
          kcBusinessSlug: existingConfig.kcBusinessSlug,
          customPrice: existingConfig.customPrice,
          customName: existingConfig.customName,
          isEnabled: existingConfig.isEnabled,
        });
      } else {
        // New product - auto-populate from source product
        const sourceProduct = this.products.get(productId);
        const availableSizes = Array.isArray(sourceProduct?.availableSizes) 
          ? sourceProduct.availableSizes as string[] 
          : null;
        const availableColors = Array.isArray(sourceProduct?.availableColors)
          ? (sourceProduct.availableColors as Array<{name: string; hex: string}>).map(c => c.name)
          : null;
        
        await this.addPartnerStoreProduct({
          partnerStoreId,
          productId,
          sortOrder: i,
          enabledSizes: availableSizes,
          enabledColors: availableColors,
        });
      }
    }
  }

  // Product Variant operations (stub for MemStorage)
  private productVariants = new Map<string, ProductVariant>();

  async getProductVariants(productId: string): Promise<ProductVariant[]> {
    return Array.from(this.productVariants.values()).filter(v => v.productId === productId);
  }

  async upsertProductVariant(variant: InsertProductVariant): Promise<ProductVariant> {
    const id = `pv_${Date.now()}`;
    const newVariant: ProductVariant = {
      ...variant,
      id,
      size: variant.size ?? null,
      color: variant.color ?? null,
      colorHex: variant.colorHex ?? null,
      isEnabled: variant.isEnabled ?? true,
      isInStock: variant.isInStock ?? true,
    };
    this.productVariants.set(id, newVariant);
    return newVariant;
  }

  async toggleVariantEnabled(id: string, enabled: boolean): Promise<ProductVariant | undefined> {
    const existing = this.productVariants.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, isEnabled: enabled };
    this.productVariants.set(id, updated);
    return updated;
  }

  // Printify Catalog operations (stubs for MemStorage)
  private printifyBlueprints = new Map<number, PrintifyBlueprint>();
  private printifyPrintProviders = new Map<string, PrintifyPrintProvider>();
  private catalogSyncs: PrintifyCatalogSync[] = [];

  async getPrintifyBlueprints(): Promise<PrintifyBlueprint[]> {
    return Array.from(this.printifyBlueprints.values());
  }

  async getPrintifyBlueprint(id: number): Promise<PrintifyBlueprint | undefined> {
    return this.printifyBlueprints.get(id);
  }

  async upsertPrintifyBlueprint(blueprint: InsertPrintifyBlueprint): Promise<PrintifyBlueprint> {
    const existing = this.printifyBlueprints.get(blueprint.id);
    const result: PrintifyBlueprint = {
      ...blueprint,
      description: blueprint.description ?? null,
      brand: blueprint.brand ?? null,
      model: blueprint.model ?? null,
      images: blueprint.images ?? null,
      primaryImageUrl: blueprint.primaryImageUrl ?? null,
      category: blueprint.category ?? null,
      lastSyncedAt: new Date(),
      createdAt: existing?.createdAt || new Date(),
    };
    this.printifyBlueprints.set(blueprint.id, result);
    return result;
  }

  async deletePrintifyBlueprint(id: number): Promise<void> {
    this.printifyBlueprints.delete(id);
  }

  async clearPrintifyBlueprints(): Promise<void> {
    this.printifyBlueprints.clear();
  }

  async getAllPrintifyProviders(): Promise<PrintifyPrintProvider[]> {
    return Array.from(this.printifyPrintProviders.values());
  }

  async getPrintifyPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]> {
    return Array.from(this.printifyPrintProviders.values())
      .filter(p => p.blueprintId === blueprintId);
  }

  async getPrintifyPrintProvider(blueprintId: number, providerId: number): Promise<PrintifyPrintProvider | undefined> {
    const id = `pp_${blueprintId}_${providerId}`;
    return this.printifyPrintProviders.get(id);
  }

  async upsertPrintifyPrintProvider(provider: InsertPrintifyPrintProvider): Promise<PrintifyPrintProvider> {
    const id = `pp_${provider.blueprintId}_${provider.providerId}`;
    const result: PrintifyPrintProvider = {
      ...provider,
      id,
      country: provider.country ?? null,
      isUSA: provider.isUSA ?? false,
      minCost: null,
      maxCost: null,
      availableColors: null,
      availableSizes: null,
      placeholderProductId: null,
      costsFetchedAt: null,
      lastSyncedAt: new Date(),
    };
    this.printifyPrintProviders.set(id, result);
    return result;
  }

  async updatePrintifyProviderCosts(blueprintId: number, providerId: number, costs: { minCost: number; maxCost: number; placeholderProductId?: string; availableColors?: any[]; availableSizes?: string[] }): Promise<PrintifyPrintProvider | undefined> {
    const id = `pp_${blueprintId}_${providerId}`;
    const existing = this.printifyPrintProviders.get(id);
    if (!existing) return undefined;
    const updated: any = {
      ...existing,
      minCost: costs.minCost,
      maxCost: costs.maxCost,
      placeholderProductId: costs.placeholderProductId ?? null,
      costsFetchedAt: new Date(),
    };
    if (costs.availableColors !== undefined) {
      updated.availableColors = costs.availableColors;
    }
    if (costs.availableSizes !== undefined) {
      updated.availableSizes = costs.availableSizes;
    }
    this.printifyPrintProviders.set(id, updated);
    return updated;
  }

  async updateProductPricesByProvider(blueprintId: number, providerId: number, basePrice: string): Promise<number> {
    let count = 0;
    this.products.forEach((product, id) => {
      if (product.blueprintId === blueprintId && product.printProviderId === providerId) {
        this.products.set(id, { ...product, basePrice, updatedAt: new Date() });
        count++;
      }
    });
    return count;
  }

  async deletePrintifyPrintProvidersByBlueprint(blueprintId: number): Promise<void> {
    Array.from(this.printifyPrintProviders.entries()).forEach(([id, p]) => {
      if (p.blueprintId === blueprintId) this.printifyPrintProviders.delete(id);
    });
  }

  async clearPrintifyPrintProviders(): Promise<void> {
    this.printifyPrintProviders.clear();
  }

  async createCatalogSync(sync: InsertPrintifyCatalogSync): Promise<PrintifyCatalogSync> {
    const result: PrintifyCatalogSync = {
      ...sync,
      id: `sync_${Date.now()}`,
      blueprintsCount: sync.blueprintsCount ?? 0,
      providersCount: sync.providersCount ?? 0,
      errorMessage: sync.errorMessage ?? null,
      startedAt: sync.startedAt ?? new Date(),
      completedAt: sync.completedAt ?? null,
    };
    this.catalogSyncs.unshift(result);
    return result;
  }

  async updateCatalogSync(id: string, sync: Partial<InsertPrintifyCatalogSync>): Promise<PrintifyCatalogSync | undefined> {
    const index = this.catalogSyncs.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.catalogSyncs[index] = { ...this.catalogSyncs[index], ...sync };
    return this.catalogSyncs[index];
  }

  async getLatestCatalogSync(): Promise<PrintifyCatalogSync | undefined> {
    return this.catalogSyncs[0];
  }

  async getCatalogSyncHistory(): Promise<PrintifyCatalogSync[]> {
    return this.catalogSyncs.slice(0, 20);
  }

  // Printify Cost Sync operations (MemStorage)
  private costSyncs: PrintifyCostSync[] = [];

  async createCostSync(sync: InsertPrintifyCostSync): Promise<PrintifyCostSync> {
    const result: PrintifyCostSync = {
      ...sync,
      id: `cost_sync_${Date.now()}`,
      totalProviders: sync.totalProviders ?? 0,
      processedCount: sync.processedCount ?? 0,
      successCount: sync.successCount ?? 0,
      failedCount: sync.failedCount ?? 0,
      skippedCount: sync.skippedCount ?? 0,
      lastProcessedProviderId: sync.lastProcessedProviderId ?? null,
      errorMessage: sync.errorMessage ?? null,
      startedAt: sync.startedAt ?? new Date(),
      completedAt: sync.completedAt ?? null,
    };
    this.costSyncs.unshift(result);
    return result;
  }

  async updateCostSync(id: string, sync: Partial<InsertPrintifyCostSync>): Promise<PrintifyCostSync | undefined> {
    const index = this.costSyncs.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    this.costSyncs[index] = { ...this.costSyncs[index], ...sync };
    return this.costSyncs[index];
  }

  async getLatestCostSync(): Promise<PrintifyCostSync | undefined> {
    return this.costSyncs[0];
  }

  async getActiveCostSync(): Promise<PrintifyCostSync | undefined> {
    return this.costSyncs.find(s => s.status === 'running');
  }

  async getCostSyncHistory(): Promise<PrintifyCostSync[]> {
    return this.costSyncs.slice(0, 20);
  }

  async getProviderCostStats(): Promise<{ total: number; withCosts: number; stale: number }> {
    const providers = Array.from(this.printifyPrintProviders.values());
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000;
    
    let withCosts = 0;
    let stale = 0;
    
    for (const p of providers) {
      if (p.minCost && p.minCost > 0) {
        withCosts++;
        if (p.costsFetchedAt && now - new Date(p.costsFetchedAt).getTime() > staleThreshold) {
          stale++;
        }
      }
    }
    
    return { total: providers.length, withCosts, stale };
  }

  // Custom Design operations (MemStorage)
  private customDesigns = new Map<string, CustomDesign>();

  async getCustomDesign(id: string): Promise<CustomDesign | undefined> {
    return this.customDesigns.get(id);
  }

  async getCustomDesigns(): Promise<CustomDesign[]> {
    return Array.from(this.customDesigns.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCustomDesignsForLibrary(): Promise<CustomDesign[]> {
    return Array.from(this.customDesigns.values())
      .filter(d => d.savedToLibrary)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getCustomDesignsByStoreSegment(storeType: string, storeName: string, segment?: string): Promise<CustomDesign[]> {
    return Array.from(this.customDesigns.values())
      .filter(d => {
        if (!d.savedToStore) return false;
        if (d.storeType?.toLowerCase() !== storeType.toLowerCase()) return false;
        if (d.storeName?.toLowerCase() !== storeName.toLowerCase()) return false;
        if (segment && d.segment?.toLowerCase() !== segment.toLowerCase()) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createCustomDesign(design: InsertCustomDesign): Promise<CustomDesign> {
    // Use provided id (slug) or fallback to timestamp-based id
    const id = design.id || `custom_${Date.now()}`;
    const designBase: Record<string, any> = { ...design };
    for (const key of Object.keys(designBase)) {
      if (designBase[key] === undefined) designBase[key] = null;
    }
    const newDesign: CustomDesign = {
      ...designBase,
      id,
      textUpcharge: design.textUpcharge ?? "2.00",
      isFeatured: design.isFeatured ?? false,
      isSeasonalPromo: design.isSeasonalPromo ?? false,
      savedToLibrary: design.savedToLibrary ?? false,
      savedToStore: design.savedToStore ?? false,
      placementConfigs: design.placementConfigs ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CustomDesign;
    this.customDesigns.set(newDesign.id, newDesign);
    return newDesign;
  }

  async updateCustomDesign(id: string, design: Partial<InsertCustomDesign>): Promise<CustomDesign | undefined> {
    const existing = this.customDesigns.get(id);
    if (!existing) return undefined;
    const updated: CustomDesign = {
      ...existing,
      ...design,
      updatedAt: new Date(),
    };
    this.customDesigns.set(id, updated);
    return updated;
  }

  async deleteCustomDesign(id: string): Promise<void> {
    this.customDesigns.delete(id);
  }

  // Template Category operations (MemStorage)
  private templateCategories = new Map<string, TemplateCategory>();

  async getTemplateCategories(): Promise<TemplateCategory[]> {
    return Array.from(this.templateCategories.values())
      .filter(c => c.isActive)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getTemplateCategoriesByParent(parentId: string | null): Promise<TemplateCategory[]> {
    return Array.from(this.templateCategories.values())
      .filter(c => c.isActive && c.parentId === parentId)
      .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async createTemplateCategory(category: InsertTemplateCategory): Promise<TemplateCategory> {
    const id = crypto.randomUUID();
    const newCategory: TemplateCategory = {
      id,
      name: category.name,
      parentId: category.parentId ?? null,
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
      createdAt: new Date(),
    };
    this.templateCategories.set(id, newCategory);
    return newCategory;
  }

  async updateTemplateCategory(id: string, category: Partial<InsertTemplateCategory>): Promise<TemplateCategory | undefined> {
    const existing = this.templateCategories.get(id);
    if (!existing) return undefined;
    const updated: TemplateCategory = { ...existing, ...category };
    this.templateCategories.set(id, updated);
    return updated;
  }

  async deleteTemplateCategory(id: string): Promise<void> {
    const existing = this.templateCategories.get(id);
    if (existing) {
      this.templateCategories.set(id, { ...existing, isActive: false });
    }
  }

  // Graphic Set operations (MemStorage)
  private graphicSets = new Map<string, GraphicSet>();

  async getGraphicSets(): Promise<GraphicSet[]> {
    return Array.from(this.graphicSets.values())
      .filter(g => g.isActive)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getGraphicSet(id: string): Promise<GraphicSet | undefined> {
    return this.graphicSets.get(id);
  }

  async getGraphicSetsByCategory(categoryId: string): Promise<GraphicSet[]> {
    return Array.from(this.graphicSets.values())
      .filter(g => g.isActive && g.categoryId === categoryId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createGraphicSet(graphicSet: InsertGraphicSet): Promise<GraphicSet> {
    const id = crypto.randomUUID();
    const newGraphicSet: GraphicSet = {
      id,
      name: graphicSet.name,
      description: graphicSet.description ?? null,
      categoryId: graphicSet.categoryId ?? null,
      subcategoryId: graphicSet.subcategoryId ?? null,
      fullGraphicUrl: graphicSet.fullGraphicUrl ?? null,
      qrOnlyUrl: graphicSet.qrOnlyUrl ?? null,
      destinationUrl: graphicSet.destinationUrl ?? null,
      storagePath: graphicSet.storagePath ?? null,
      tags: graphicSet.tags ?? null,
      isActive: graphicSet.isActive ?? true,
      isFeatured: graphicSet.isFeatured ?? false,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.graphicSets.set(id, newGraphicSet);
    return newGraphicSet;
  }

  async updateGraphicSet(id: string, graphicSet: Partial<InsertGraphicSet>): Promise<GraphicSet | undefined> {
    const existing = this.graphicSets.get(id);
    if (!existing) return undefined;
    const updated: GraphicSet = { ...existing, ...graphicSet, updatedAt: new Date() };
    this.graphicSets.set(id, updated);
    return updated;
  }

  async deleteGraphicSet(id: string): Promise<void> {
    const existing = this.graphicSets.get(id);
    if (existing) {
      this.graphicSets.set(id, { ...existing, isActive: false });
    }
  }

  async incrementGraphicSetUsage(id: string): Promise<void> {
    const existing = this.graphicSets.get(id);
    if (existing) {
      this.graphicSets.set(id, { ...existing, usageCount: (existing.usageCount || 0) + 1 });
    }
  }

  // Library Asset operations (MemStorage)
  private libraryAssets = new Map<string, LibraryAsset>();
  
  async getLibraryAsset(id: string): Promise<LibraryAsset | undefined> {
    return this.libraryAssets.get(id);
  }

  async getLibraryAssetByUrl(url: string): Promise<LibraryAsset | undefined> {
    return Array.from(this.libraryAssets.values()).find(a => a.publicUrl === url || a.storageUrl === url);
  }

  async getLibraryAssets(filters?: { ownerType?: string; assetType?: string; mediaType?: string; userId?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
    let assets = Array.from(this.libraryAssets.values()).filter(a => a.isActive);
    if (filters?.ownerType) assets = assets.filter(a => a.ownerType === filters.ownerType);
    if (filters?.assetType) assets = assets.filter(a => a.assetType === filters.assetType);
    if (filters?.mediaType) assets = assets.filter(a => a.mediaType === filters.mediaType);
    if (filters?.userId) assets = assets.filter(a => a.userId === filters.userId);
    if (filters?.category) assets = assets.filter(a => a.category === filters.category);
    if (filters?.season) assets = assets.filter(a => a.season === filters.season);
    if (filters?.event) assets = assets.filter(a => a.event === filters.event);
    return assets.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  }

  async getAdminLibraryAssets(filters?: { assetType?: string; mediaType?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
    return this.getLibraryAssets({ ...filters, ownerType: 'admin' });
  }

  async getUserLibraryAssets(userId: string, filters?: { assetType?: string; mediaType?: string }): Promise<LibraryAsset[]> {
    return this.getLibraryAssets({ ...filters, ownerType: 'user', userId });
  }

  async createLibraryAsset(asset: InsertLibraryAsset): Promise<LibraryAsset> {
    const id = crypto.randomUUID();
    const assetBase: Record<string, any> = { ...asset };
    for (const key of Object.keys(assetBase)) {
      if (assetBase[key] === undefined) assetBase[key] = null;
    }
    const newAsset: LibraryAsset = {
      ...assetBase,
      id,
      isActive: asset.isActive ?? true,
      isFeatured: asset.isFeatured ?? false,
      sortOrder: asset.sortOrder ?? 0,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LibraryAsset;
    this.libraryAssets.set(id, newAsset);
    return newAsset;
  }

  async updateLibraryAsset(id: string, asset: Partial<InsertLibraryAsset>): Promise<LibraryAsset | undefined> {
    const existing = this.libraryAssets.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...asset, updatedAt: new Date() };
    this.libraryAssets.set(id, updated);
    return updated;
  }

  async deleteLibraryAsset(id: string): Promise<void> {
    this.libraryAssets.delete(id);
  }

  async incrementLibraryAssetUsage(id: string): Promise<void> {
    const asset = this.libraryAssets.get(id);
    if (asset) {
      asset.usageCount = (asset.usageCount || 0) + 1;
      this.libraryAssets.set(id, asset);
    }
  }

  // Orchestration: Master Product operations (stub implementations for MemStorage)
  private orchestrationMasterProducts = new Map<string, MasterProduct>();
  private orchestrationDesignVersions = new Map<string, ProductDesignVersion>();
  private orchestrationChannelConfigs = new Map<string, ChannelConfig>();
  private orchestrationPublishStates = new Map<string, ChannelPublishState>();

  async getAllMasterProducts(): Promise<MasterProduct[]> {
    return Array.from(this.orchestrationMasterProducts.values());
  }

  async getMasterProduct(id: string): Promise<MasterProduct | undefined> {
    return this.orchestrationMasterProducts.get(id);
  }

  async createMasterProduct(product: InsertMasterProduct): Promise<MasterProduct> {
    const id = crypto.randomUUID();
    const newProduct: MasterProduct = {
      id,
      sku: product.sku,
      title: product.title,
      description: product.description ?? null,
      productType: product.productType,
      currentDesignVersionId: null,
      pricingProfileId: null,
      baseCost: null,
      retailPrice: null,
      status: product.status ?? "draft",
      channels: null,
      tags: product.tags ?? [],
      bundleParentId: null,
      bundleDiscount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orchestrationMasterProducts.set(id, newProduct);
    return newProduct;
  }

  async updateMasterProduct(id: string, product: Partial<InsertMasterProduct>): Promise<MasterProduct | undefined> {
    const existing = this.orchestrationMasterProducts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...product, updatedAt: new Date() };
    this.orchestrationMasterProducts.set(id, updated);
    return updated;
  }

  async deleteMasterProduct(id: string): Promise<void> {
    this.orchestrationMasterProducts.delete(id);
  }

  async getDesignVersions(masterProductId: string): Promise<ProductDesignVersion[]> {
    return Array.from(this.orchestrationDesignVersions.values()).filter(v => v.masterProductId === masterProductId);
  }

  async getActiveDesignVersion(masterProductId: string): Promise<ProductDesignVersion | undefined> {
    return Array.from(this.orchestrationDesignVersions.values()).find(v => v.masterProductId === masterProductId && v.isActive);
  }

  async createDesignVersion(version: InsertProductDesignVersion): Promise<ProductDesignVersion> {
    const id = crypto.randomUUID();
    const newVersion: ProductDesignVersion = {
      id,
      masterProductId: version.masterProductId,
      versionNumber: version.versionNumber ?? 1,
      headerText: version.headerText ?? null,
      headerStyle: version.headerStyle ?? null,
      footerText: version.footerText ?? null,
      footerStyle: version.footerStyle ?? null,
      qrUrl: version.qrUrl,
      renderedPngUrl: version.renderedPngUrl ?? null,
      renderedSvgUrl: version.renderedSvgUrl ?? null,
      qrCodeUrl: null,
      placementImages: null,
      isActive: version.isActive ?? true,
      createdAt: new Date(),
    };
    this.orchestrationDesignVersions.set(id, newVersion);
    return newVersion;
  }

  async updateDesignVersion(id: string, version: Partial<InsertProductDesignVersion>): Promise<ProductDesignVersion | undefined> {
    const existing = this.orchestrationDesignVersions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...version };
    this.orchestrationDesignVersions.set(id, updated);
    return updated;
  }

  async getAllChannelConfigs(): Promise<ChannelConfig[]> {
    return Array.from(this.orchestrationChannelConfigs.values());
  }

  async getChannelConfig(channelType: string): Promise<ChannelConfig | undefined> {
    return this.orchestrationChannelConfigs.get(channelType);
  }

  async createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig> {
    const id = crypto.randomUUID();
    const newConfig: ChannelConfig = {
      id,
      channelType: config.channelType,
      displayName: config.displayName,
      isEnabled: config.isEnabled ?? false,
      apiKeySecretName: config.apiKeySecretName ?? null,
      apiSecretSecretName: null,
      shopId: config.shopId ?? null,
      rateLimit: 60,
      rateLimitWindow: 60,
      webhookSecret: null,
      webhookUrl: null,
      lastHealthCheck: null,
      settings: config.settings ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orchestrationChannelConfigs.set(config.channelType, newConfig);
    return newConfig;
  }

  async updateChannelConfig(channelType: string, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined> {
    const existing = this.orchestrationChannelConfigs.get(channelType);
    if (!existing) return undefined;
    // Only update provided fields, don't auto-set lastHealthCheck
    const updated = { ...existing, ...config };
    this.orchestrationChannelConfigs.set(channelType, updated);
    return updated;
  }

  async getPublishStates(masterProductId: string): Promise<ChannelPublishState[]> {
    return Array.from(this.orchestrationPublishStates.values()).filter(s => s.masterProductId === masterProductId);
  }

  async getPublishState(masterProductId: string, channelType: string): Promise<ChannelPublishState | undefined> {
    return this.orchestrationPublishStates.get(`${masterProductId}-${channelType}`);
  }

  async upsertPublishState(state: InsertChannelPublishState): Promise<ChannelPublishState> {
    const key = `${state.masterProductId}-${state.channelType}`;
    const existing = this.orchestrationPublishStates.get(key);
    const newState: ChannelPublishState = {
      id: existing?.id ?? crypto.randomUUID(),
      masterProductId: state.masterProductId,
      publishedDesignVersionId: state.publishedDesignVersionId ?? null,
      channelType: state.channelType,
      externalProductId: state.externalProductId ?? null,
      externalListingId: null,
      externalVariantIds: null,
      status: state.status ?? "pending",
      lastPublishedAt: null,
      lastSyncedAt: new Date(),
      lastError: state.lastError ?? null,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    this.orchestrationPublishStates.set(key, newState);
    return newState;
  }

  // Batch retrieval operations for admin
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async getOrders(): Promise<OrderUnified[]> {
    return Array.from(this.ordersUnified.values()).sort((a, b) => 
      (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)
    );
  }

  async getOrderUnified(id: string): Promise<OrderUnified | undefined> {
    return this.ordersUnified.get(id);
  }

  async createOrderUnified(order: InsertOrderUnified): Promise<OrderUnified> {
    const newOrder: OrderUnified = {
      id: crypto.randomUUID(),
      sourceChannel: order.sourceChannel,
      externalOrderId: order.externalOrderId ?? null,
      customerEmail: order.customerEmail ?? null,
      customerName: order.customerName ?? null,
      shippingAddress: order.shippingAddress ?? null,
      items: order.items,
      subtotal: order.subtotal,
      shippingTotal: order.shippingTotal ?? null,
      taxTotal: order.taxTotal ?? null,
      total: order.total,
      routedProvider: order.routedProvider ?? null,
      providerOrderId: order.providerOrderId ?? null,
      status: order.status ?? "pending",
      statusHistory: order.statusHistory ?? null,
      trackingNumber: order.trackingNumber ?? null,
      trackingUrl: order.trackingUrl ?? null,
      shippedAt: null,
      deliveredAt: null,
      productionCost: order.productionCost ?? null,
      profit: order.profit ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.ordersUnified.set(newOrder.id, newOrder);
    return newOrder;
  }

  async updateOrderUnified(id: string, order: Partial<InsertOrderUnified>): Promise<OrderUnified | undefined> {
    const existing = this.ordersUnified.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...order, updatedAt: new Date() };
    this.ordersUnified.set(id, updated);
    return updated;
  }

  async getProducts(): Promise<Product[]> {
    return Array.from(this.products.values());
  }

  async getAllPrintfulProducts(): Promise<any[]> {
    return [];
  }

  async getAllPrintfulVariants(): Promise<any[]> {
    return [];
  }

  // Provider Health operations
  async logProviderHealth(log: InsertProviderHealthLog): Promise<ProviderHealthLog> {
    const newLog: ProviderHealthLog = {
      id: crypto.randomUUID(),
      providerType: log.providerType,
      checkTime: new Date(),
      isHealthy: log.isHealthy ?? true,
      responseTimeMs: log.responseTimeMs ?? null,
      errorMessage: log.errorMessage ?? null,
      errorCode: log.errorCode ?? null,
      uptimePercent24h: null,
      avgResponseTime24h: null,
    };
    this.providerHealthLogs.push(newLog);
    // Keep only last 1000 logs in memory
    if (this.providerHealthLogs.length > 1000) {
      this.providerHealthLogs = this.providerHealthLogs.slice(-1000);
    }
    return newLog;
  }

  async getProviderHealthLogs(limit: number = 100): Promise<ProviderHealthLog[]> {
    return this.providerHealthLogs
      .sort((a, b) => (b.checkTime?.getTime() || 0) - (a.checkTime?.getTime() || 0))
      .slice(0, limit);
  }

  async getProviderHealthLogsByType(providerType: string, limit: number = 100): Promise<ProviderHealthLog[]> {
    return this.providerHealthLogs
      .filter(l => l.providerType === providerType)
      .sort((a, b) => (b.checkTime?.getTime() || 0) - (a.checkTime?.getTime() || 0))
      .slice(0, limit);
  }

  async getLatestProviderHealth(providerType: string): Promise<ProviderHealthLog | undefined> {
    const logs = await this.getProviderHealthLogsByType(providerType, 1);
    return logs[0];
  }

  async getAllLatestProviderHealth(): Promise<ProviderHealthLog[]> {
    const providerTypes = ['printify', 'printful', 'apliiq'];
    const results: ProviderHealthLog[] = [];
    for (const type of providerTypes) {
      const latest = await this.getLatestProviderHealth(type);
      if (latest) results.push(latest);
    }
    return results;
  }

  async getProviderHealthStats(providerType: string, hours: number = 24): Promise<{ uptimePercent: number; avgResponseTime: number; totalChecks: number }> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const logs = this.providerHealthLogs.filter(l => 
      l.providerType === providerType && 
      (l.checkTime?.getTime() || 0) > cutoff
    );
    
    if (logs.length === 0) {
      return { uptimePercent: 0, avgResponseTime: 0, totalChecks: 0 };
    }
    
    const healthyCount = logs.filter(l => l.isHealthy).length;
    const totalResponseTime = logs.reduce((sum, l) => sum + (l.responseTimeMs || 0), 0);
    
    return {
      uptimePercent: Math.round((healthyCount / logs.length) * 100 * 100) / 100,
      avgResponseTime: Math.round(totalResponseTime / logs.length),
      totalChecks: logs.length,
    };
  }

  // Gift Mode: Package operations
  private giftPackages = new Map<string, GiftPackage>();
  private giftCodes = new Map<string, GiftCode>();
  private giftRedemptions = new Map<string, GiftRedemption>();

  async getAllGiftPackages(): Promise<GiftPackage[]> {
    return Array.from(this.giftPackages.values());
  }

  async getActiveGiftPackages(): Promise<GiftPackage[]> {
    return Array.from(this.giftPackages.values()).filter(p => p.isActive);
  }

  async getGiftPackage(id: string): Promise<GiftPackage | undefined> {
    return this.giftPackages.get(id);
  }

  async createGiftPackage(pkg: InsertGiftPackage): Promise<GiftPackage> {
    const newPkg: GiftPackage = {
      id: crypto.randomUUID(),
      name: pkg.name,
      description: pkg.description ?? null,
      giftType: pkg.giftType ?? "product",
      masterProductId: pkg.masterProductId ?? null,
      dynamicsTier: pkg.dynamicsTier ?? null,
      dynamicsMonths: pkg.dynamicsMonths ?? null,
      price: pkg.price,
      allowColorChoice: pkg.allowColorChoice ?? true,
      allowSizeChoice: pkg.allowSizeChoice ?? true,
      allowQrCustomization: pkg.allowQrCustomization ?? true,
      includePersonalMessage: pkg.includePersonalMessage ?? true,
      redemptionValidDays: pkg.redemptionValidDays ?? 365,
      displayImage: pkg.displayImage ?? null,
      isActive: pkg.isActive ?? true,
      sortOrder: pkg.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.giftPackages.set(newPkg.id, newPkg);
    return newPkg;
  }

  async updateGiftPackage(id: string, pkg: Partial<InsertGiftPackage>): Promise<GiftPackage | undefined> {
    const existing = this.giftPackages.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...pkg, updatedAt: new Date() };
    this.giftPackages.set(id, updated);
    return updated;
  }

  async deleteGiftPackage(id: string): Promise<void> {
    this.giftPackages.delete(id);
  }

  // Gift Mode: Code operations
  async getGiftCode(id: string): Promise<GiftCode | undefined> {
    return this.giftCodes.get(id);
  }

  async getGiftCodeByCode(code: string): Promise<GiftCode | undefined> {
    return Array.from(this.giftCodes.values()).find(c => c.code === code);
  }

  async getGiftCodesByBuyer(buyerUserId: string): Promise<GiftCode[]> {
    return Array.from(this.giftCodes.values()).filter(c => c.buyerUserId === buyerUserId);
  }

  async createGiftCode(code: InsertGiftCode): Promise<GiftCode> {
    const newCode: GiftCode = {
      id: crypto.randomUUID(),
      code: code.code,
      giftPackageId: code.giftPackageId,
      buyerUserId: code.buyerUserId ?? null,
      buyerEmail: code.buyerEmail ?? null,
      buyerName: code.buyerName ?? null,
      personalMessage: code.personalMessage ?? null,
      orderId: code.orderId ?? null,
      stripePaymentId: code.stripePaymentId ?? null,
      purchasedAt: new Date(),
      expiresAt: code.expiresAt,
      status: code.status ?? "active",
      lastEmailedTo: code.lastEmailedTo ?? null,
      lastEmailedAt: code.lastEmailedAt ?? null,
      createdAt: new Date(),
    };
    this.giftCodes.set(newCode.id, newCode);
    return newCode;
  }

  async updateGiftCode(id: string, code: Partial<InsertGiftCode>): Promise<GiftCode | undefined> {
    const existing = this.giftCodes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...code };
    this.giftCodes.set(id, updated);
    return updated;
  }

  // Gift Mode: Redemption operations
  async getGiftRedemption(id: string): Promise<GiftRedemption | undefined> {
    return this.giftRedemptions.get(id);
  }

  async getGiftRedemptionByCode(giftCodeId: string): Promise<GiftRedemption | undefined> {
    return Array.from(this.giftRedemptions.values()).find(r => r.giftCodeId === giftCodeId);
  }

  async getGiftRedemptionsByRecipient(recipientEmail: string): Promise<GiftRedemption[]> {
    return Array.from(this.giftRedemptions.values()).filter(r => r.recipientEmail === recipientEmail);
  }

  async createGiftRedemption(redemption: InsertGiftRedemption): Promise<GiftRedemption> {
    const newRedemption: GiftRedemption = {
      id: crypto.randomUUID(),
      giftCodeId: redemption.giftCodeId,
      recipientUserId: redemption.recipientUserId ?? null,
      recipientEmail: redemption.recipientEmail ?? null,
      recipientName: redemption.recipientName ?? null,
      selectedColor: redemption.selectedColor ?? null,
      selectedSize: redemption.selectedSize ?? null,
      qrContent: redemption.qrContent ?? null,
      qrStyle: redemption.qrStyle ?? null,
      shippingAddress: redemption.shippingAddress ?? null,
      dynamicsSubscriptionId: redemption.dynamicsSubscriptionId ?? null,
      dynamicsContentSetId: redemption.dynamicsContentSetId ?? null,
      fulfillmentOrderId: redemption.fulfillmentOrderId ?? null,
      fulfillmentProvider: redemption.fulfillmentProvider ?? null,
      fulfillmentStatus: redemption.fulfillmentStatus ?? "pending",
      trackingNumber: redemption.trackingNumber ?? null,
      trackingUrl: redemption.trackingUrl ?? null,
      redeemedAt: new Date(),
      fulfilledAt: redemption.fulfilledAt ?? null,
      shippedAt: redemption.shippedAt ?? null,
      deliveredAt: redemption.deliveredAt ?? null,
    };
    this.giftRedemptions.set(newRedemption.id, newRedemption);
    return newRedemption;
  }

  async updateGiftRedemption(id: string, redemption: Partial<InsertGiftRedemption>): Promise<GiftRedemption | undefined> {
    const existing = this.giftRedemptions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...redemption };
    this.giftRedemptions.set(id, updated);
    return updated;
  }

  // Email Template operations (in-memory stubs)
  private emailTemplates = new Map<string, EmailTemplate>();
  private emailLogs: EmailLog[] = [];

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return Array.from(this.emailTemplates.values());
  }

  async getEmailTemplate(id: string): Promise<EmailTemplate | undefined> {
    return this.emailTemplates.get(id);
  }

  async getEmailTemplateByTrigger(trigger: string): Promise<EmailTemplate | undefined> {
    return Array.from(this.emailTemplates.values()).find(t => t.trigger === trigger);
  }

  async createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate> {
    const newTemplate: EmailTemplate = {
      id: crypto.randomUUID(),
      trigger: template.trigger,
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent ?? null,
      isEnabled: template.isEnabled ?? true,
      description: template.description ?? null,
      variables: template.variables ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.emailTemplates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  async updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const existing = this.emailTemplates.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...template, updatedAt: new Date() };
    this.emailTemplates.set(id, updated);
    return updated;
  }

  async deleteEmailTemplate(id: string): Promise<void> {
    this.emailTemplates.delete(id);
  }

  async getEmailLogs(limit: number = 100): Promise<EmailLog[]> {
    return this.emailLogs.slice(0, limit);
  }

  async logEmail(log: Omit<EmailLog, 'id' | 'sentAt'>): Promise<EmailLog> {
    const newLog: EmailLog = {
      ...log,
      id: crypto.randomUUID(),
      sentAt: new Date(),
    };
    this.emailLogs.unshift(newLog);
    return newLog;
  }
}

const baseStorage: IStorage = new MemStorage();

// Export storage with dual-write support
// The storage factory wraps the base storage when STORAGE_MODE is set to 'dual-write' or 'firestore-only'
let wrappedStorage: IStorage | null = null;
let storageInitialized = false;
let initPromise: Promise<IStorage> | null = null;

export async function initializeWrappedStorage(): Promise<IStorage> {
  if (wrappedStorage && storageInitialized) {
    return wrappedStorage;
  }
  
  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    const mode = process.env.STORAGE_MODE || 'firestore-only';
    console.log(`[Storage] Initializing with mode: ${mode}`);
    
    try {
      const { FirestoreAdapter } = await import('./lib/firestore-adapter');
      wrappedStorage = new FirestoreAdapter();
      console.log('[Storage] Firestore-only mode enabled');
    } catch (error) {
      console.error('[Storage] Failed to initialize firestore-only mode:', error);
      wrappedStorage = baseStorage;
    }
    
    storageInitialized = true;
    return wrappedStorage;
  })();
  
  return initPromise;
}

// Returns true if storage is ready for use
export function isStorageReady(): boolean {
  return storageInitialized;
}

// Get the current storage mode (defaults to firestore-only for Firebase independence)
export function getStorageMode(): string {
  return process.env.STORAGE_MODE || 'firestore-only';
}

// Export a proxy that uses the wrapped storage once initialized
export const storage: IStorage = new Proxy(baseStorage, {
  get(target, prop, receiver) {
    const actualStorage = wrappedStorage || target;
    const value = Reflect.get(actualStorage, prop, actualStorage);
    if (typeof value === 'function') {
      return value.bind(actualStorage);
    }
    return value;
  }
});
