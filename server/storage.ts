import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
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
} from "@shared/schema";

const DATABASE_URL = process.env.DATABASE_URL;
const sql = DATABASE_URL ? neon(DATABASE_URL) : null;
const db = sql ? drizzle(sql, { schema }) : null;

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
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;

  // Order Item operations
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;

  // Hosted Image operations
  getHostedImage(id: string): Promise<HostedImage | undefined>;
  getHostedImagesByUser(userId: string): Promise<HostedImage[]>;
  createHostedImage(image: InsertHostedImage): Promise<HostedImage>;
  incrementImageViews(id: string): Promise<void>;
  deleteHostedImage(id: string): Promise<void>;

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

  async createHostedImage(image: InsertHostedImage): Promise<HostedImage> {
    const [newImage] = await this.db.insert(schema.hostedImages).values(image).returning();
    return newImage;
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
      createdAt: new Date(), 
      updatedAt: new Date() 
    };
    this.qrDesigns.set(id, newDesign);
    return newDesign;
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
      metadata: product.metadata ?? null,
      isEnabled: product.isEnabled ?? false,
      markupPercent: product.markupPercent ?? "0",
      markupFixed: product.markupFixed ?? "0",
      qrProductionCost: product.qrProductionCost ?? "0",
      sortOrder: product.sortOrder ?? 0,
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

  async createOrder(order: InsertOrder): Promise<Order> {
    const id = `order_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newOrder: Order = { 
      ...order, 
      id,
      stripePaymentId: order.stripePaymentId ?? null,
      printifyOrderId: order.printifyOrderId ?? null,
      trackingNumber: order.trackingNumber ?? null,
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

  async incrementImageViews(id: string): Promise<void> {
    const image = this.hostedImages.get(id);
    if (image) {
      this.hostedImages.set(id, { ...image, views: (image.views || 0) + 1 });
    }
  }

  async deleteHostedImage(id: string): Promise<void> {
    this.hostedImages.delete(id);
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
}

// Use database storage if DATABASE_URL is available, otherwise use in-memory
export const storage: IStorage = db ? new DbStorage() : new MemStorage();
