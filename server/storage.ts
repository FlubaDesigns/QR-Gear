import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, sql } from "drizzle-orm";
import * as schema from "@shared/schema";
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
} from "@shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;
const neonSql = DATABASE_URL ? neon(DATABASE_URL) : null;
const db = neonSql ? drizzle(neonSql, { schema }) : null;

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
  addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct>;
  updatePartnerStoreProduct(id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined>;
  removePartnerStoreProduct(id: string): Promise<void>;
  syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void>;
}

export class DbStorage implements IStorage {
  private db = db!; // Safe because DbStorage is only used when db is non-null
  
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await this.db.insert(schema.users).values(user).returning();
    return newUser;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await this.db
      .insert(schema.users)
      .values(userData)
      .onConflictDoUpdate({
        target: schema.users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Browsing history operations
  async getBrowsingHistory(userId: string): Promise<BrowsingHistory[]> {
    return this.db.select().from(schema.browsingHistory).where(eq(schema.browsingHistory.userId, userId));
  }

  async addBrowsingHistory(entry: InsertBrowsingHistory): Promise<BrowsingHistory> {
    const [newEntry] = await this.db.insert(schema.browsingHistory).values(entry).returning();
    return newEntry;
  }

  async clearBrowsingHistory(userId: string): Promise<void> {
    await this.db.delete(schema.browsingHistory).where(eq(schema.browsingHistory.userId, userId));
  }

  // QR Design operations
  async getQrDesign(id: string): Promise<QrDesign | undefined> {
    const [design] = await this.db.select().from(schema.qrDesigns).where(eq(schema.qrDesigns.id, id));
    return design;
  }

  async getQrDesignsByUser(userId: string): Promise<QrDesign[]> {
    return this.db.select().from(schema.qrDesigns).where(eq(schema.qrDesigns.userId, userId));
  }

  async createQrDesign(design: InsertQrDesign): Promise<QrDesign> {
    const [newDesign] = await this.db.insert(schema.qrDesigns).values(design).returning();
    return newDesign;
  }

  async updateQrDesign(id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined> {
    const [updated] = await this.db
      .update(schema.qrDesigns)
      .set({ ...design, updatedAt: new Date() })
      .where(eq(schema.qrDesigns.id, id))
      .returning();
    return updated;
  }

  async deleteQrDesign(id: string): Promise<void> {
    await this.db.delete(schema.qrDesigns).where(eq(schema.qrDesigns.id, id));
  }

  async getPublicGalleryDesigns(): Promise<QrDesign[]> {
    return this.db
      .select()
      .from(schema.qrDesigns)
      .where(eq(schema.qrDesigns.showInGallery, true))
      .orderBy(schema.qrDesigns.createdAt);
  }

  // Product operations
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await this.db.select().from(schema.products).where(eq(schema.products.id, id));
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return this.db.select().from(schema.products);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await this.db.insert(schema.products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await this.db
      .update(schema.products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();
    return updated;
  }

  // Cart operations
  async getCartItemsByUser(userId: string): Promise<CartItem[]> {
    return this.db.select().from(schema.cartItems).where(eq(schema.cartItems.userId, userId));
  }

  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const [newItem] = await this.db.insert(schema.cartItems).values(item).returning();
    return newItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [updated] = await this.db
      .update(schema.cartItems)
      .set({ quantity })
      .where(eq(schema.cartItems.id, id))
      .returning();
    return updated;
  }

  async deleteCartItem(id: string): Promise<void> {
    await this.db.delete(schema.cartItems).where(eq(schema.cartItems.id, id));
  }

  async clearCart(userId: string): Promise<void> {
    await this.db.delete(schema.cartItems).where(eq(schema.cartItems.userId, userId));
  }

  // Order operations
  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await this.db.select().from(schema.orders).where(eq(schema.orders.id, id));
    return order;
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    return this.db.select().from(schema.orders).where(eq(schema.orders.userId, userId));
  }

  async getOrdersByStatus(status: string): Promise<Order[]> {
    return this.db.select().from(schema.orders).where(eq(schema.orders.status, status));
  }

  async getOrderByStripeSession(sessionId: string): Promise<Order | undefined> {
    const [order] = await this.db.select().from(schema.orders).where(eq(schema.orders.stripeSessionId, sessionId));
    return order;
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await this.db.insert(schema.orders).values(order).returning();
    return newOrder;
  }

  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updated] = await this.db
      .update(schema.orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(schema.orders.id, id))
      .returning();
    return updated;
  }

  // Order Item operations
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return this.db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [newItem] = await this.db.insert(schema.orderItems).values(item).returning();
    return newItem;
  }

  // Hosted Image operations
  async getHostedImage(id: string): Promise<HostedImage | undefined> {
    const [image] = await this.db.select().from(schema.hostedImages).where(eq(schema.hostedImages.id, id));
    return image;
  }

  async getHostedImagesByUser(userId: string): Promise<HostedImage[]> {
    return this.db.select().from(schema.hostedImages).where(eq(schema.hostedImages.userId, userId));
  }

  async getAllHostedImages(): Promise<HostedImage[]> {
    return this.db.select().from(schema.hostedImages);
  }

  async createHostedImage(image: InsertHostedImage): Promise<HostedImage> {
    const [newImage] = await this.db.insert(schema.hostedImages).values(image).returning();
    return newImage;
  }

  async updateHostedImage(id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined> {
    const [updated] = await this.db
      .update(schema.hostedImages)
      .set(image)
      .where(eq(schema.hostedImages.id, id))
      .returning();
    return updated;
  }

  async incrementImageViews(id: string): Promise<void> {
    const image = await this.getHostedImage(id);
    if (image) {
      await this.db
        .update(schema.hostedImages)
        .set({ views: (image.views || 0) + 1 })
        .where(eq(schema.hostedImages.id, id));
    }
  }

  async deleteHostedImage(id: string): Promise<void> {
    await this.db.delete(schema.hostedImages).where(eq(schema.hostedImages.id, id));
  }

  // Hosting Reminder operations
  async getHostingReminderByImageAndDays(imageId: string, daysRemaining: number): Promise<HostingReminder | undefined> {
    const reminderType = `${daysRemaining}_day`;
    const results = await this.db.select().from(schema.hostingReminders).where(eq(schema.hostingReminders.customGiftId, imageId));
    return results.find(r => r.reminderType === reminderType);
  }

  async createHostingReminder(reminder: InsertHostingReminder): Promise<HostingReminder> {
    const [newReminder] = await this.db.insert(schema.hostingReminders).values(reminder).returning();
    return newReminder;
  }

  // Admin Settings operations
  async getAdminSettings(): Promise<AdminSettings | undefined> {
    const [settings] = await this.db.select().from(schema.adminSettings).where(eq(schema.adminSettings.id, "default"));
    return settings;
  }

  async upsertAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings> {
    const [result] = await this.db
      .insert(schema.adminSettings)
      .values({ ...settings, id: "default" })
      .onConflictDoUpdate({
        target: schema.adminSettings.id,
        set: { ...settings, updatedAt: new Date() },
      })
      .returning();
    return result;
  }

  // Pricing Rules operations
  async getPricingRules(): Promise<PricingRule[]> {
    return this.db.select().from(schema.pricingRules);
  }

  async getPricingRule(id: string): Promise<PricingRule | undefined> {
    const [rule] = await this.db.select().from(schema.pricingRules).where(eq(schema.pricingRules.id, id));
    return rule;
  }

  async createPricingRule(rule: InsertPricingRule): Promise<PricingRule> {
    const [newRule] = await this.db.insert(schema.pricingRules).values(rule).returning();
    return newRule;
  }

  async updatePricingRule(id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined> {
    const [updated] = await this.db
      .update(schema.pricingRules)
      .set(rule)
      .where(eq(schema.pricingRules.id, id))
      .returning();
    return updated;
  }

  async deletePricingRule(id: string): Promise<void> {
    await this.db.delete(schema.pricingRules).where(eq(schema.pricingRules.id, id));
  }

  // Admin Product operations
  async getEnabledProducts(): Promise<Product[]> {
    return this.db.select().from(schema.products).where(eq(schema.products.isEnabled, true));
  }

  async toggleProductEnabled(id: string, enabled: boolean): Promise<Product | undefined> {
    const [updated] = await this.db
      .update(schema.products)
      .set({ isEnabled: enabled, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();
    return updated;
  }

  // Hosting Tier operations
  async getHostingTiers(): Promise<HostingTier[]> {
    return this.db.select().from(schema.hostingTiers);
  }

  async getHostingTier(id: string): Promise<HostingTier | undefined> {
    const [tier] = await this.db.select().from(schema.hostingTiers).where(eq(schema.hostingTiers.id, id));
    return tier;
  }

  async getHostingTierByCode(code: string): Promise<HostingTier | undefined> {
    const [tier] = await this.db.select().from(schema.hostingTiers).where(eq(schema.hostingTiers.code, code));
    return tier;
  }

  async createHostingTier(tier: InsertHostingTier): Promise<HostingTier> {
    const [newTier] = await this.db.insert(schema.hostingTiers).values(tier).returning();
    return newTier;
  }

  async updateHostingTier(id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined> {
    const [updated] = await this.db
      .update(schema.hostingTiers)
      .set(tier)
      .where(eq(schema.hostingTiers.id, id))
      .returning();
    return updated;
  }

  async deleteHostingTier(id: string): Promise<void> {
    await this.db.delete(schema.hostingTiers).where(eq(schema.hostingTiers.id, id));
  }

  // QR Template operations
  async getQrTemplates(): Promise<QrTemplate[]> {
    return this.db.select().from(schema.qrTemplates);
  }

  async getActiveQrTemplates(): Promise<QrTemplate[]> {
    return this.db.select().from(schema.qrTemplates).where(eq(schema.qrTemplates.isActive, true));
  }

  async getQrTemplate(id: string): Promise<QrTemplate | undefined> {
    const [template] = await this.db.select().from(schema.qrTemplates).where(eq(schema.qrTemplates.id, id));
    return template;
  }

  async createQrTemplate(template: InsertQrTemplate): Promise<QrTemplate> {
    const [newTemplate] = await this.db.insert(schema.qrTemplates).values(template).returning();
    return newTemplate;
  }

  async updateQrTemplate(id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined> {
    const [updated] = await this.db
      .update(schema.qrTemplates)
      .set(template)
      .where(eq(schema.qrTemplates.id, id))
      .returning();
    return updated;
  }

  async deleteQrTemplate(id: string): Promise<void> {
    await this.db.delete(schema.qrTemplates).where(eq(schema.qrTemplates.id, id));
  }

  // Dynamic Page operations
  async getDynamicPage(id: string): Promise<DynamicPage | undefined> {
    const [page] = await this.db.select().from(schema.dynamicPages).where(eq(schema.dynamicPages.id, id));
    return page;
  }

  async getDynamicPageBySlug(slug: string): Promise<DynamicPage | undefined> {
    const [page] = await this.db.select().from(schema.dynamicPages).where(eq(schema.dynamicPages.slug, slug));
    return page;
  }

  async getDynamicPagesByUser(userId: string): Promise<DynamicPage[]> {
    return this.db.select().from(schema.dynamicPages).where(eq(schema.dynamicPages.userId, userId));
  }

  async createDynamicPage(page: InsertDynamicPage): Promise<DynamicPage> {
    const [newPage] = await this.db.insert(schema.dynamicPages).values(page).returning();
    return newPage;
  }

  async updateDynamicPage(id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined> {
    const [updated] = await this.db
      .update(schema.dynamicPages)
      .set({ ...page, updatedAt: new Date() })
      .where(eq(schema.dynamicPages.id, id))
      .returning();
    return updated;
  }

  async deleteDynamicPage(id: string): Promise<void> {
    await this.db.delete(schema.dynamicPageAssets).where(eq(schema.dynamicPageAssets.pageId, id));
    await this.db.delete(schema.dynamicPages).where(eq(schema.dynamicPages.id, id));
  }

  async incrementDynamicPageViews(id: string): Promise<void> {
    await this.db.update(schema.dynamicPages)
      .set({ views: sql`${schema.dynamicPages.views} + 1` })
      .where(eq(schema.dynamicPages.id, id));
  }

  // Dynamic Page Asset operations
  async getDynamicPageAsset(id: string): Promise<DynamicPageAsset | undefined> {
    const [asset] = await this.db.select().from(schema.dynamicPageAssets).where(eq(schema.dynamicPageAssets.id, id));
    return asset;
  }

  async getDynamicPageAssets(pageId: string): Promise<DynamicPageAsset[]> {
    return this.db.select().from(schema.dynamicPageAssets).where(eq(schema.dynamicPageAssets.pageId, pageId));
  }

  async createDynamicPageAsset(asset: InsertDynamicPageAsset): Promise<DynamicPageAsset> {
    const [newAsset] = await this.db.insert(schema.dynamicPageAssets).values(asset).returning();
    return newAsset;
  }

  async updateDynamicPageAsset(id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined> {
    const [updated] = await this.db
      .update(schema.dynamicPageAssets)
      .set(asset)
      .where(eq(schema.dynamicPageAssets.id, id))
      .returning();
    return updated;
  }

  async deleteDynamicPageAsset(id: string): Promise<void> {
    await this.db.delete(schema.dynamicPageAssets).where(eq(schema.dynamicPageAssets.id, id));
  }

  async setActiveAsset(pageId: string, assetId: string): Promise<void> {
    await this.db.update(schema.dynamicPageAssets)
      .set({ isActive: false, activatedAt: null })
      .where(eq(schema.dynamicPageAssets.pageId, pageId));
    await this.db.update(schema.dynamicPageAssets)
      .set({ isActive: true, activatedAt: new Date() })
      .where(eq(schema.dynamicPageAssets.id, assetId));
    await this.db.update(schema.dynamicPages)
      .set({ activeAssetId: assetId, updatedAt: new Date() })
      .where(eq(schema.dynamicPages.id, pageId));
  }

  // Product Category operations
  async getProductCategories(): Promise<ProductCategory[]> {
    return await this.db.select().from(schema.productCategories).orderBy(schema.productCategories.sortOrder);
  }

  async getAllProductCategories(): Promise<ProductCategory[]> {
    return await this.db.select().from(schema.productCategories)
      .orderBy(schema.productCategories.sortOrder);
  }

  async getActiveProductCategories(): Promise<ProductCategory[]> {
    return await this.db.select().from(schema.productCategories)
      .where(eq(schema.productCategories.isActive, true))
      .orderBy(schema.productCategories.sortOrder);
  }

  async getProductCategoriesByTaxonomy(taxonomyType: string): Promise<ProductCategory[]> {
    return await this.db.select().from(schema.productCategories)
      .where(eq(schema.productCategories.taxonomyType, taxonomyType))
      .orderBy(schema.productCategories.sortOrder);
  }

  async getProductCategory(id: string): Promise<ProductCategory | undefined> {
    const [category] = await this.db.select().from(schema.productCategories).where(eq(schema.productCategories.id, id));
    return category;
  }

  async createProductCategory(category: InsertProductCategory): Promise<ProductCategory> {
    const [newCategory] = await this.db.insert(schema.productCategories).values(category).returning();
    return newCategory;
  }

  async updateProductCategory(id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> {
    const [updated] = await this.db
      .update(schema.productCategories)
      .set(category)
      .where(eq(schema.productCategories.id, id))
      .returning();
    return updated;
  }

  async deleteProductCategory(id: string): Promise<void> {
    await this.db.delete(schema.productCategoryAssignments).where(eq(schema.productCategoryAssignments.categoryId, id));
    await this.db.delete(schema.productCategories).where(eq(schema.productCategories.id, id));
  }

  // Product Category Assignment operations
  async getProductCategoryAssignments(productId: string): Promise<ProductCategoryAssignment[]> {
    return await this.db.select().from(schema.productCategoryAssignments)
      .where(eq(schema.productCategoryAssignments.productId, productId));
  }

  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const assignments = await this.db.select().from(schema.productCategoryAssignments)
      .where(eq(schema.productCategoryAssignments.categoryId, categoryId));
    const productIds = assignments.map(a => a.productId);
    if (productIds.length === 0) return [];
    const products = await this.db.select().from(schema.products);
    return products.filter(p => productIds.includes(p.id));
  }

  async assignProductToCategory(assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment> {
    const [newAssignment] = await this.db.insert(schema.productCategoryAssignments).values(assignment).returning();
    return newAssignment;
  }

  async removeProductFromCategory(productId: string, categoryId: string): Promise<void> {
    const assignments = await this.db.select().from(schema.productCategoryAssignments)
      .where(eq(schema.productCategoryAssignments.productId, productId));
    const toDelete = assignments.find(a => a.categoryId === categoryId);
    if (toDelete) {
      await this.db.delete(schema.productCategoryAssignments).where(eq(schema.productCategoryAssignments.id, toDelete.id));
    }
  }

  async syncProductCategories(productId: string, categoryIds: string[]): Promise<void> {
    await this.db.delete(schema.productCategoryAssignments).where(eq(schema.productCategoryAssignments.productId, productId));
    if (categoryIds.length > 0) {
      const assignments = categoryIds.map(categoryId => ({
        productId,
        categoryId,
      }));
      await this.db.insert(schema.productCategoryAssignments).values(assignments);
    }
  }

  // Partner Store operations
  async getPartnerStores(): Promise<PartnerStore[]> {
    return await this.db.select().from(schema.partnerStores);
  }

  async getPartnerStore(id: string): Promise<PartnerStore | undefined> {
    const [store] = await this.db.select().from(schema.partnerStores).where(eq(schema.partnerStores.id, id));
    return store;
  }

  async getPartnerStoreBySlug(slug: string): Promise<PartnerStore | undefined> {
    const [store] = await this.db.select().from(schema.partnerStores).where(eq(schema.partnerStores.slug, slug));
    return store;
  }

  async createPartnerStore(store: InsertPartnerStore): Promise<PartnerStore> {
    const [newStore] = await this.db.insert(schema.partnerStores).values(store).returning();
    return newStore;
  }

  async updatePartnerStore(id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined> {
    const [updated] = await this.db
      .update(schema.partnerStores)
      .set({ ...store, updatedAt: new Date() })
      .where(eq(schema.partnerStores.id, id))
      .returning();
    return updated;
  }

  async deletePartnerStore(id: string): Promise<void> {
    await this.db.delete(schema.partnerStoreProducts).where(eq(schema.partnerStoreProducts.partnerStoreId, id));
    await this.db.delete(schema.partnerStores).where(eq(schema.partnerStores.id, id));
  }

  // Partner Store Product operations
  async getPartnerStoreProducts(partnerStoreId: string): Promise<PartnerStoreProduct[]> {
    return await this.db.select().from(schema.partnerStoreProducts)
      .where(eq(schema.partnerStoreProducts.partnerStoreId, partnerStoreId));
  }

  async addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct> {
    const [newProduct] = await this.db.insert(schema.partnerStoreProducts).values(product).returning();
    return newProduct;
  }

  async updatePartnerStoreProduct(id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    const [updated] = await this.db
      .update(schema.partnerStoreProducts)
      .set(product)
      .where(eq(schema.partnerStoreProducts.id, id))
      .returning();
    return updated;
  }

  async removePartnerStoreProduct(id: string): Promise<void> {
    await this.db.delete(schema.partnerStoreProducts).where(eq(schema.partnerStoreProducts.id, id));
  }

  async syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void> {
    await this.db.delete(schema.partnerStoreProducts).where(eq(schema.partnerStoreProducts.partnerStoreId, partnerStoreId));
    if (productIds.length > 0) {
      const products = productIds.map((productId, index) => ({
        partnerStoreId,
        productId,
        sortOrder: index,
      }));
      await this.db.insert(schema.partnerStoreProducts).values(products);
    }
  }
}

// In-memory storage implementation
class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private qrDesigns = new Map<string, QrDesign>();
  private products = new Map<string, Product>();
  private cartItems = new Map<string, CartItem>();
  private orders = new Map<string, Order>();
  private orderItems = new Map<string, OrderItem>();
  private hostedImages = new Map<string, HostedImage>();
  private browsingHistory = new Map<string, BrowsingHistory>();
  private adminSettings: AdminSettings | undefined;
  private pricingRules = new Map<string, PricingRule>();
  private partnerStores = new Map<string, PartnerStore>();
  private partnerStoreProducts = new Map<string, PartnerStoreProduct>();

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
      firstName: userData.firstName ?? null,
      lastName: userData.lastName ?? null,
      profileImageUrl: userData.profileImageUrl ?? null,
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
    const newProduct: Product = { 
      ...product,
      id,
      printifyId: product.printifyId ?? null,
      blueprintId: product.blueprintId ?? null,
      printProviderId: product.printProviderId ?? null,
      description: product.description ?? null,
      imageUrl: product.imageUrl ?? null,
      manufacturer: product.manufacturer ?? null,
      madeInUSA: product.madeInUSA ?? null,
      availablePlacements: product.availablePlacements ?? null,
      availableColors: product.availableColors ?? null,
      availableSizes: product.availableSizes ?? null,
      metadata: product.metadata ?? null,
      isEnabled: product.isEnabled ?? false,
      markupPercent: product.markupPercent ?? "0",
      markupFixed: product.markupFixed ?? "0",
      qrProductionCost: product.qrProductionCost ?? "0",
      sortOrder: product.sortOrder ?? 0,
      productLine: product.productLine ?? null,
      defaultPlacement: product.defaultPlacement ?? null,
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
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
    for (const [assetId, asset] of this.dynamicPageAssets) {
      if (asset.pageId === id) this.dynamicPageAssets.delete(assetId);
    }
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
    for (const [id, asset] of this.dynamicPageAssets) {
      if (asset.pageId === pageId) {
        this.dynamicPageAssets.set(id, { ...asset, isActive: false, activatedAt: null });
      }
    }
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
    for (const [assignmentId, assignment] of this.productCategoryAssignments) {
      if (assignment.categoryId === id) this.productCategoryAssignments.delete(assignmentId);
    }
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
    for (const [id, assignment] of this.productCategoryAssignments) {
      if (assignment.productId === productId && assignment.categoryId === categoryId) {
        this.productCategoryAssignments.delete(id);
        break;
      }
    }
  }

  async syncProductCategories(productId: string, categoryIds: string[]): Promise<void> {
    for (const [id, assignment] of this.productCategoryAssignments) {
      if (assignment.productId === productId) {
        this.productCategoryAssignments.delete(id);
      }
    }
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
      allowedOrigins: store.allowedOrigins ?? null,
      primaryColor: store.primaryColor ?? null,
      accentColor: store.accentColor ?? null,
      commissionPercent: store.commissionPercent ?? "0",
      isActive: store.isActive ?? true,
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
    for (const [productId, product] of this.partnerStoreProducts) {
      if (product.partnerStoreId === id) this.partnerStoreProducts.delete(productId);
    }
    this.partnerStores.delete(id);
  }

  // Partner Store Product operations
  async getPartnerStoreProducts(partnerStoreId: string): Promise<PartnerStoreProduct[]> {
    return Array.from(this.partnerStoreProducts.values()).filter(p => p.partnerStoreId === partnerStoreId);
  }

  async addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct> {
    const id = `psp_${Date.now()}`;
    const newProduct: PartnerStoreProduct = {
      ...product,
      id,
      customPrice: product.customPrice ?? null,
      customName: product.customName ?? null,
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

  async removePartnerStoreProduct(id: string): Promise<void> {
    this.partnerStoreProducts.delete(id);
  }

  async syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void> {
    for (const [id, product] of this.partnerStoreProducts) {
      if (product.partnerStoreId === partnerStoreId) this.partnerStoreProducts.delete(id);
    }
    for (let i = 0; i < productIds.length; i++) {
      await this.addPartnerStoreProduct({ partnerStoreId, productId: productIds[i], sortOrder: i });
    }
  }
}

// Use database storage if DATABASE_URL is available, otherwise use in-memory
export const storage: IStorage = db ? new DbStorage() : new MemStorage();
