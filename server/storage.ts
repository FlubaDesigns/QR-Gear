import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import type {
  User,
  InsertUser,
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
} from "@shared/schema";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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
}

export class DbStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(schema.users).values(user).returning();
    return newUser;
  }

  // QR Design operations
  async getQrDesign(id: string): Promise<QrDesign | undefined> {
    const [design] = await db.select().from(schema.qrDesigns).where(eq(schema.qrDesigns.id, id));
    return design;
  }

  async getQrDesignsByUser(userId: string): Promise<QrDesign[]> {
    return db.select().from(schema.qrDesigns).where(eq(schema.qrDesigns.userId, userId));
  }

  async createQrDesign(design: InsertQrDesign): Promise<QrDesign> {
    const [newDesign] = await db.insert(schema.qrDesigns).values(design).returning();
    return newDesign;
  }

  async updateQrDesign(id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined> {
    const [updated] = await db
      .update(schema.qrDesigns)
      .set({ ...design, updatedAt: new Date() })
      .where(eq(schema.qrDesigns.id, id))
      .returning();
    return updated;
  }

  async deleteQrDesign(id: string): Promise<void> {
    await db.delete(schema.qrDesigns).where(eq(schema.qrDesigns.id, id));
  }

  // Product operations
  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(schema.products).where(eq(schema.products.id, id));
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return db.select().from(schema.products);
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const [newProduct] = await db.insert(schema.products).values(product).returning();
    return newProduct;
  }

  async updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const [updated] = await db
      .update(schema.products)
      .set({ ...product, updatedAt: new Date() })
      .where(eq(schema.products.id, id))
      .returning();
    return updated;
  }

  // Cart operations
  async getCartItemsByUser(userId: string): Promise<CartItem[]> {
    return db.select().from(schema.cartItems).where(eq(schema.cartItems.userId, userId));
  }

  async addCartItem(item: InsertCartItem): Promise<CartItem> {
    const [newItem] = await db.insert(schema.cartItems).values(item).returning();
    return newItem;
  }

  async updateCartItem(id: string, quantity: number): Promise<CartItem | undefined> {
    const [updated] = await db
      .update(schema.cartItems)
      .set({ quantity })
      .where(eq(schema.cartItems.id, id))
      .returning();
    return updated;
  }

  async deleteCartItem(id: string): Promise<void> {
    await db.delete(schema.cartItems).where(eq(schema.cartItems.id, id));
  }

  async clearCart(userId: string): Promise<void> {
    await db.delete(schema.cartItems).where(eq(schema.cartItems.userId, userId));
  }

  // Order operations
  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.id, id));
    return order;
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    return db.select().from(schema.orders).where(eq(schema.orders.userId, userId));
  }

  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db.insert(schema.orders).values(order).returning();
    return newOrder;
  }

  async updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updated] = await db
      .update(schema.orders)
      .set({ ...order, updatedAt: new Date() })
      .where(eq(schema.orders.id, id))
      .returning();
    return updated;
  }

  // Order Item operations
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(schema.orderItems).where(eq(schema.orderItems.orderId, orderId));
  }

  async createOrderItem(item: InsertOrderItem): Promise<OrderItem> {
    const [newItem] = await db.insert(schema.orderItems).values(item).returning();
    return newItem;
  }
}

export const storage = new DbStorage();
