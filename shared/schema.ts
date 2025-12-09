import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, decimal, timestamp, integer, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Browsing history for product recommendations
export const browsingHistory = pgTable("browsing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const qrDesigns = pgTable("qr_designs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  qrType: text("qr_type").notNull(), // 'text' or 'image'
  qrContent: text("qr_content").notNull(), // text content or image URL
  qrStyle: jsonb("qr_style").notNull(), // {color, backgroundColor, logoUrl}
  productId: text("product_id"), // Printify product ID
  placement: text("placement").notNull(), // 'front-chest', 'front-pocket', etc.
  productColor: text("product_color"),
  manufacturer: text("manufacturer"),
  madeInUSA: boolean("made_in_usa").default(false),
  previewUrl: text("preview_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey(),
  printifyId: text("printify_id").unique(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  manufacturer: text("manufacturer"),
  madeInUSA: boolean("made_in_usa").default(false),
  availablePlacements: text("available_placements").array(), // ['front-chest', 'back', etc.]
  availableColors: jsonb("available_colors"), // [{name: 'White', hex: '#FFFFFF'}]
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  designId: varchar("design_id").references(() => qrDesigns.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  customization: jsonb("customization").notNull(), // full design config
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull(), // 'pending', 'processing', 'shipped', 'delivered'
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentId: text("stripe_payment_id"),
  printifyOrderId: text("printify_order_id"),
  shippingAddress: jsonb("shipping_address").notNull(),
  trackingNumber: text("tracking_number"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").notNull().references(() => orders.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull(),
  customization: jsonb("customization").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  printifyItemId: text("printify_item_id"),
});

export const hostedImages = pgTable("hosted_images", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageUrl: text("storage_url").notNull(),
  publicUrl: text("public_url").notNull(),
  title: text("title"),
  description: text("description"),
  businessName: text("business_name"),
  businessLogo: text("business_logo"),
  views: integer("views").default(0),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertBrowsingHistorySchema = createInsertSchema(browsingHistory).omit({
  id: true,
  viewedAt: true,
});

export const insertQrDesignSchema = createInsertSchema(qrDesigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductSchema = createInsertSchema(products).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertCartItemSchema = createInsertSchema(cartItems).omit({
  id: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).omit({
  id: true,
});

export const insertHostedImageSchema = createInsertSchema(hostedImages).omit({
  id: true,
  views: true,
  createdAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type QrDesign = typeof qrDesigns.$inferSelect;
export type InsertQrDesign = z.infer<typeof insertQrDesignSchema>;

export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type HostedImage = typeof hostedImages.$inferSelect;
export type InsertHostedImage = z.infer<typeof insertHostedImageSchema>;

export type BrowsingHistory = typeof browsingHistory.$inferSelect;
export type InsertBrowsingHistory = z.infer<typeof insertBrowsingHistorySchema>;

export type UpsertUser = typeof users.$inferInsert;
