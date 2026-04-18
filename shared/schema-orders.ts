import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, decimal, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users, hostedImages } from "./schema-users";
import { products, qrDesigns, dynamicContentSets } from "./schema-products";
import { masterProducts } from "./schema-stores";

export const giftBackgrounds = pgTable("gift_backgrounds", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  thumbnailUrl: text("thumbnail_url").notNull(),
  fullImageUrl: text("full_image_url").notNull(),
  storageUrl: text("storage_url").notNull(),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const hostingTiers = pgTable("hosting_tiers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  durationDays: integer("duration_days").notNull(),
  isIncluded: boolean("is_included").default(false),
  priceUpcharge: decimal("price_upcharge", { precision: 10, scale: 2 }).default("0"),
  videoPriceUpcharge: decimal("video_price_upcharge", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  discountType: text("discount_type").notNull(),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  currency: text("currency").default("usd"),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }),
  maxRedemptions: integer("max_redemptions"),
  redemptionCount: integer("redemption_count").default(0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  stripeCouponId: text("stripe_coupon_id"),
  stripePromotionCodeId: text("stripe_promotion_code_id"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customGifts = pgTable("custom_gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  slug: text("slug").notNull().unique(),
  backgroundSource: text("background_source").notNull(),
  backgroundId: varchar("background_id").references(() => giftBackgrounds.id),
  uploadedImageId: varchar("uploaded_image_id").references(() => hostedImages.id),
  compositeImageUrl: text("composite_image_url"),
  overlayConfig: jsonb("overlay_config"),
  textAboveQr: text("text_above_qr"),
  textBelowQr: text("text_below_qr"),
  qrTextContent: text("qr_text_content"),
  hostingTierId: varchar("hosting_tier_id").references(() => hostingTiers.id),
  disclaimerAccepted: boolean("disclaimer_accepted").default(false),
  disclaimerAcceptedAt: timestamp("disclaimer_accepted_at"),
  pricingSnapshot: jsonb("pricing_snapshot"),
  views: integer("views").default(0),
  status: text("status").default("active"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const hostingReminders = pgTable("hosting_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customGiftId: varchar("custom_gift_id").notNull().references(() => customGifts.id),
  userId: varchar("user_id").references(() => users.id),
  reminderType: text("reminder_type").notNull(),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  emailAddress: text("email_address"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dynamicPages = pgTable("dynamic_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  activeAssetId: varchar("active_asset_id"),
  hostingTierId: varchar("hosting_tier_id").references(() => hostingTiers.id),
  views: integer("views").default(0),
  status: text("status").default("active"),
  expiresAt: timestamp("expires_at"),
  renewalReminderSent: boolean("renewal_reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dynamicPageAssets = pgTable("dynamic_page_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => dynamicPages.id),
  hostedImageId: varchar("hosted_image_id").notNull().references(() => hostedImages.id),
  title: text("title"),
  isActive: boolean("is_active").default(false),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cartItems = pgTable("cart_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  designId: varchar("design_id").references(() => qrDesigns.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  customization: jsonb("customization").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentId: text("stripe_payment_id"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  printifyOrderId: text("printify_order_id"),
  shippingAddress: jsonb("shipping_address"),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
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

export const pricingRules = pgTable("pricing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  scope: text("scope").notNull(),
  scopeValue: text("scope_value"),
  markupType: text("markup_type").notNull(),
  markupValue: decimal("markup_value", { precision: 10, scale: 2 }).notNull(),
  qrProductionCost: decimal("qr_production_cost", { precision: 10, scale: 2 }).default("0"),
  priority: integer("priority").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const adminSettings = pgTable("admin_settings", {
  id: varchar("id").primaryKey().default("default"),
  globalMarkupPercent: decimal("global_markup_percent", { precision: 5, scale: 2 }).default("25"),
  globalMarkupFixed: decimal("global_markup_fixed", { precision: 10, scale: 2 }).default("0"),
  globalQrProductionCost: decimal("global_qr_production_cost", { precision: 10, scale: 2 }).default("2"),
  additionalPlacementCost: decimal("additional_placement_cost", { precision: 10, scale: 2 }).default("4"),
  textAboveUpcharge: decimal("text_above_upcharge", { precision: 10, scale: 2 }).default("2"),
  textBelowUpcharge: decimal("text_below_upcharge", { precision: 10, scale: 2 }).default("2"),
  imageHostingUpcharge: decimal("image_hosting_upcharge", { precision: 10, scale: 2 }).default("5"),
  dynamicQrUpcharge: decimal("dynamic_qr_upcharge", { precision: 10, scale: 2 }).default("25"),
  showPricesBeforeCustomization: boolean("show_prices_before_customization").default(false),
  defaultFulfillmentProvider: text("default_fulfillment_provider").default("printful"),
  defaultMockupProvider: text("default_mockup_provider").default("printful"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productBundles = pgTable("product_bundles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  bundleType: text("bundle_type").notNull().default("fixed"),
  displayImage: text("display_image"),
  displayOrder: integer("display_order").default(0),
  pricingType: text("pricing_type").notNull().default("discount_percent"),
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  fixedPrice: decimal("fixed_price", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  minItems: integer("min_items"),
  maxItems: integer("max_items"),
  isActive: boolean("is_active").default(true),
  displayLocations: text("display_locations").array().default(sql`ARRAY['cart']::text[]`),
  triggerProductIds: text("trigger_product_ids").array(),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const bundleItems = pgTable("bundle_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bundleId: varchar("bundle_id").notNull().references(() => productBundles.id, { onDelete: "cascade" }),
  masterProductId: varchar("master_product_id").references(() => masterProducts.id),
  productId: integer("product_id"),
  displayOrder: integer("display_order").default(0),
  quantity: integer("quantity").default(1),
  isRequired: boolean("is_required").default(false),
  itemDiscountPercent: decimal("item_discount_percent", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const giftPackages = pgTable("gift_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  giftType: text("gift_type").notNull().default("product"),
  masterProductId: varchar("master_product_id").references(() => masterProducts.id),
  dynamicsTier: text("dynamics_tier"),
  dynamicsMonths: integer("dynamics_months"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  allowColorChoice: boolean("allow_color_choice").default(true),
  allowSizeChoice: boolean("allow_size_choice").default(true),
  allowQrCustomization: boolean("allow_qr_customization").default(true),
  includePersonalMessage: boolean("include_personal_message").default(true),
  redemptionValidDays: integer("redemption_valid_days").default(365),
  displayImage: text("display_image"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const giftCodes = pgTable("gift_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: varchar("code", { length: 32 }).notNull().unique(),
  giftPackageId: varchar("gift_package_id").notNull().references(() => giftPackages.id),
  buyerUserId: varchar("buyer_user_id").references(() => users.id),
  buyerEmail: text("buyer_email"),
  buyerName: text("buyer_name"),
  personalMessage: text("personal_message"),
  orderId: varchar("order_id"),
  stripePaymentId: text("stripe_payment_id"),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  status: text("status").notNull().default("active"),
  lastEmailedTo: text("last_emailed_to"),
  lastEmailedAt: timestamp("last_emailed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const giftRedemptions = pgTable("gift_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  giftCodeId: varchar("gift_code_id").notNull().references(() => giftCodes.id),
  recipientUserId: varchar("recipient_user_id").references(() => users.id),
  recipientEmail: text("recipient_email"),
  recipientName: text("recipient_name"),
  selectedColor: text("selected_color"),
  selectedSize: text("selected_size"),
  qrContent: text("qr_content"),
  qrStyle: jsonb("qr_style"),
  shippingAddress: jsonb("shipping_address"),
  dynamicsSubscriptionId: varchar("dynamics_subscription_id"),
  dynamicsContentSetId: varchar("dynamics_content_set_id").references(() => dynamicContentSets.id),
  fulfillmentOrderId: varchar("fulfillment_order_id"),
  fulfillmentProvider: text("fulfillment_provider"),
  fulfillmentStatus: text("fulfillment_status").default("pending"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
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
export const insertGiftBackgroundSchema = createInsertSchema(giftBackgrounds).omit({
  id: true,
  createdAt: true,
});
export const insertHostingTierSchema = createInsertSchema(hostingTiers).omit({
  id: true,
});
export const insertCouponSchema = createInsertSchema(coupons).omit({
  id: true,
  redemptionCount: true,
  createdAt: true,
  updatedAt: true,
});
export const insertCustomGiftSchema = createInsertSchema(customGifts).omit({
  id: true,
  views: true,
  createdAt: true,
  updatedAt: true,
});
export const insertHostingReminderSchema = createInsertSchema(hostingReminders).omit({
  id: true,
  createdAt: true,
});
export const insertDynamicPageSchema = createInsertSchema(dynamicPages).omit({
  id: true,
  views: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDynamicPageAssetSchema = createInsertSchema(dynamicPageAssets).omit({
  id: true,
  createdAt: true,
});
export const insertPricingRuleSchema = createInsertSchema(pricingRules).omit({
  id: true,
  createdAt: true,
});
export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({
  updatedAt: true,
});
export const insertProductBundleSchema = createInsertSchema(productBundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBundleItemSchema = createInsertSchema(bundleItems).omit({
  id: true,
  createdAt: true,
});
export const insertGiftPackageSchema = createInsertSchema(giftPackages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertGiftCodeSchema = createInsertSchema(giftCodes).omit({
  id: true,
  createdAt: true,
});
export const insertGiftRedemptionSchema = createInsertSchema(giftRedemptions).omit({
  id: true,
});

export type CartItem = typeof cartItems.$inferSelect;
export type InsertCartItem = z.infer<typeof insertCartItemSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type GiftBackground = typeof giftBackgrounds.$inferSelect;
export type InsertGiftBackground = z.infer<typeof insertGiftBackgroundSchema>;
export type HostingTier = typeof hostingTiers.$inferSelect;
export type InsertHostingTier = z.infer<typeof insertHostingTierSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type CustomGift = typeof customGifts.$inferSelect;
export type InsertCustomGift = z.infer<typeof insertCustomGiftSchema>;
export type HostingReminder = typeof hostingReminders.$inferSelect;
export type InsertHostingReminder = z.infer<typeof insertHostingReminderSchema>;
export type DynamicPage = typeof dynamicPages.$inferSelect;
export type InsertDynamicPage = z.infer<typeof insertDynamicPageSchema>;
export type DynamicPageAsset = typeof dynamicPageAssets.$inferSelect;
export type InsertDynamicPageAsset = z.infer<typeof insertDynamicPageAssetSchema>;
export type PricingRule = typeof pricingRules.$inferSelect;
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;
export type AdminSettings = typeof adminSettings.$inferSelect;
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;
export type ProductBundle = typeof productBundles.$inferSelect;
export type InsertProductBundle = z.infer<typeof insertProductBundleSchema>;
export type BundleItem = typeof bundleItems.$inferSelect;
export type InsertBundleItem = z.infer<typeof insertBundleItemSchema>;
export type GiftPackage = typeof giftPackages.$inferSelect;
export type InsertGiftPackage = z.infer<typeof insertGiftPackageSchema>;
export type GiftCode = typeof giftCodes.$inferSelect;
export type InsertGiftCode = z.infer<typeof insertGiftCodeSchema>;
export type GiftRedemption = typeof giftRedemptions.$inferSelect;
export type InsertGiftRedemption = z.infer<typeof insertGiftRedemptionSchema>;
