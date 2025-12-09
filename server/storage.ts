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
      description: product.description ?? null,
      imageUrl: product.imageUrl ?? null,
      manufacturer: product.manufacturer ?? null,
      madeInUSA: product.madeInUSA ?? null,
      availablePlacements: product.availablePlacements ?? null,
      availableColors: product.availableColors ?? null,
      metadata: product.metadata ?? null,
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
}

// Use database storage if DATABASE_URL is available, otherwise use in-memory
export const storage: IStorage = db ? new DbStorage() : new MemStorage();
