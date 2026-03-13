import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, decimal, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { products } from "./schema-products";

export const partnerStores = pgTable("partner_stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  businessPageUrlPattern: text("business_page_url_pattern"),
  apiKey: text("api_key").notNull(),
  allowedOrigins: text("allowed_origins").array(),
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }).default("0"),
  availableSegments: text("available_segments").array(),
  isInternal: boolean("is_internal").default(false),
  annualMemberPerk: jsonb("annual_member_perk"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const partnerStoreProducts = pgTable("partner_store_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerStoreId: varchar("partner_store_id").notNull().references(() => partnerStores.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  customPrice: decimal("custom_price", { precision: 10, scale: 2 }),
  customName: text("custom_name"),
  kcPlacements: text("kc_placements").array(),
  kcBusinessSlug: text("kc_business_slug"),
  enabledSizes: text("enabled_sizes").array(),
  enabledColors: text("enabled_colors").array(),
  defaultColor: text("default_color"),
  mockupsByColor: jsonb("mockups_by_color"),
  sortOrder: integer("sort_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
});

export const masterProducts = pgTable("master_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sku: text("sku").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  productType: text("product_type").notNull(),
  currentDesignVersionId: varchar("current_design_version_id"),
  pricingProfileId: varchar("pricing_profile_id"),
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }),
  retailPrice: decimal("retail_price", { precision: 10, scale: 2 }),
  status: text("status").default("draft"),
  channels: jsonb("channels"),
  tags: text("tags").array(),
  bundleParentId: varchar("bundle_parent_id"),
  bundleDiscount: decimal("bundle_discount", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const productDesignVersions = pgTable("product_design_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterProductId: varchar("master_product_id").notNull().references(() => masterProducts.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull().default(1),
  headerText: text("header_text"),
  headerStyle: jsonb("header_style"),
  footerText: text("footer_text"),
  footerStyle: jsonb("footer_style"),
  qrUrl: text("qr_url").notNull(),
  renderedPngUrl: text("rendered_png_url"),
  renderedSvgUrl: text("rendered_svg_url"),
  qrCodeUrl: text("qr_code_url"),
  placementImages: jsonb("placement_images"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const channelConfigs = pgTable("channel_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  channelType: text("channel_type").notNull().unique(),
  displayName: text("display_name").notNull(),
  isEnabled: boolean("is_enabled").default(false),
  apiKeySecretName: text("api_key_secret_name"),
  apiSecretSecretName: text("api_secret_secret_name"),
  shopId: text("shop_id"),
  rateLimit: integer("rate_limit").default(60),
  rateLimitWindow: integer("rate_limit_window").default(60),
  webhookSecret: text("webhook_secret"),
  webhookUrl: text("webhook_url"),
  lastHealthCheck: timestamp("last_health_check"),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const channelPublishStates = pgTable("channel_publish_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterProductId: varchar("master_product_id").notNull().references(() => masterProducts.id, { onDelete: "cascade" }),
  channelType: text("channel_type").notNull(),
  externalProductId: text("external_product_id"),
  externalListingId: text("external_listing_id"),
  externalVariantIds: jsonb("external_variant_ids"),
  status: text("status").default("unpublished"),
  lastPublishedAt: timestamp("last_published_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  lastError: text("last_error"),
  publishedDesignVersionId: varchar("published_design_version_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productChannelUnique: unique().on(table.masterProductId, table.channelType),
}));

export const providerQuotes = pgTable("provider_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterProductId: varchar("master_product_id").notNull().references(() => masterProducts.id, { onDelete: "cascade" }),
  providerType: text("provider_type").notNull(),
  productionCost: decimal("production_cost", { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
  estimatedDays: integer("estimated_days"),
  isAvailable: boolean("is_available").default(true),
  quotedAt: timestamp("quoted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

export const pricingProfiles = pgTable("pricing_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  markupType: text("markup_type").notNull().default("percentage"),
  markupPercent: decimal("markup_percent", { precision: 5, scale: 2 }),
  markupFixed: decimal("markup_fixed", { precision: 10, scale: 2 }),
  minMarginPercent: decimal("min_margin_percent", { precision: 5, scale: 2 }).default("40"),
  channelAdjustments: jsonb("channel_adjustments"),
  autoRepriceEnabled: boolean("auto_reprice_enabled").default(false),
  autoRepriceMinMargin: decimal("auto_reprice_min_margin", { precision: 5, scale: 2 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const ordersUnified = pgTable("orders_unified", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sourceChannel: text("source_channel").notNull(),
  externalOrderId: text("external_order_id"),
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  shippingAddress: jsonb("shipping_address"),
  items: jsonb("items").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingTotal: decimal("shipping_total", { precision: 10, scale: 2 }),
  taxTotal: decimal("tax_total", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  routedProvider: text("routed_provider"),
  providerOrderId: text("provider_order_id"),
  status: text("status").default("pending"),
  statusHistory: jsonb("status_history"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  productionCost: decimal("production_cost", { precision: 10, scale: 2 }),
  profit: decimal("profit", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const qrScanEvents = pgTable("qr_scan_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterProductId: varchar("master_product_id").references(() => masterProducts.id),
  customDesignId: varchar("custom_design_id"),
  qrUrl: text("qr_url"),
  scanDate: timestamp("scan_date").defaultNow().notNull(),
  scanCount: integer("scan_count").default(1),
  country: text("country"),
  region: text("region"),
  deviceType: text("device_type"),
  userAgent: text("user_agent"),
});

export const providerHealthLog = pgTable("provider_health_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerType: text("provider_type").notNull(),
  checkTime: timestamp("check_time").defaultNow().notNull(),
  isHealthy: boolean("is_healthy").default(true),
  responseTimeMs: integer("response_time_ms"),
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  uptimePercent24h: decimal("uptime_percent_24h", { precision: 5, scale: 2 }),
  avgResponseTime24h: integer("avg_response_time_24h"),
});

export const repricingRules = pgTable("repricing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0),
  conditions: jsonb("conditions").default({}).$type<{
    marginBelow?: number;
    marginAbove?: number;
    channel?: string;
    productCategory?: string;
    costIncreasePercent?: number;
    competitorPriceBelow?: number;
  }>(),
  actionType: text("action_type").notNull(),
  actionParams: jsonb("action_params").default({}).$type<{
    targetMarginPercent?: number;
    adjustPercent?: number;
    minPrice?: number;
    maxPrice?: number;
    roundTo?: number;
  }>(),
  appliesTo: text("applies_to").default("all"),
  appliesToIds: text("applies_to_ids").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const repricingHistory = pgTable("repricing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").references(() => repricingRules.id),
  masterProductId: varchar("master_product_id").references(() => masterProducts.id),
  channel: text("channel"),
  previousPrice: decimal("previous_price", { precision: 10, scale: 2 }).notNull(),
  newPrice: decimal("new_price", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  previousMargin: decimal("previous_margin", { precision: 5, scale: 2 }),
  newMargin: decimal("new_margin", { precision: 5, scale: 2 }),
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  wasAutomatic: boolean("was_automatic").default(true),
});

export const insertPartnerStoreSchema = createInsertSchema(partnerStores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertPartnerStoreProductSchema = createInsertSchema(partnerStoreProducts).omit({
  id: true,
});
export const insertMasterProductSchema = createInsertSchema(masterProducts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertProductDesignVersionSchema = createInsertSchema(productDesignVersions).omit({
  id: true,
  createdAt: true,
});
export const insertChannelConfigSchema = createInsertSchema(channelConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertChannelPublishStateSchema = createInsertSchema(channelPublishStates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertProviderQuoteSchema = createInsertSchema(providerQuotes).omit({
  id: true,
});
export const insertPricingProfileSchema = createInsertSchema(pricingProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertOrderUnifiedSchema = createInsertSchema(ordersUnified).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertQrScanEventSchema = createInsertSchema(qrScanEvents).omit({
  id: true,
});
export const insertProviderHealthLogSchema = createInsertSchema(providerHealthLog).omit({
  id: true,
});
export const insertRepricingRuleSchema = createInsertSchema(repricingRules).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertRepricingHistorySchema = createInsertSchema(repricingHistory).omit({
  id: true,
  appliedAt: true,
});

export type PartnerStore = typeof partnerStores.$inferSelect;
export type InsertPartnerStore = z.infer<typeof insertPartnerStoreSchema>;
export type PartnerStoreProduct = typeof partnerStoreProducts.$inferSelect;
export type InsertPartnerStoreProduct = z.infer<typeof insertPartnerStoreProductSchema>;
export type MasterProduct = typeof masterProducts.$inferSelect;
export type InsertMasterProduct = z.infer<typeof insertMasterProductSchema>;
export type ProductDesignVersion = typeof productDesignVersions.$inferSelect;
export type InsertProductDesignVersion = z.infer<typeof insertProductDesignVersionSchema>;
export type ChannelConfig = typeof channelConfigs.$inferSelect;
export type InsertChannelConfig = z.infer<typeof insertChannelConfigSchema>;
export type ChannelPublishState = typeof channelPublishStates.$inferSelect;
export type InsertChannelPublishState = z.infer<typeof insertChannelPublishStateSchema>;
export type ProviderQuote = typeof providerQuotes.$inferSelect;
export type InsertProviderQuote = z.infer<typeof insertProviderQuoteSchema>;
export type PricingProfile = typeof pricingProfiles.$inferSelect;
export type InsertPricingProfile = z.infer<typeof insertPricingProfileSchema>;
export type OrderUnified = typeof ordersUnified.$inferSelect;
export type InsertOrderUnified = z.infer<typeof insertOrderUnifiedSchema>;
export type QrScanEvent = typeof qrScanEvents.$inferSelect;
export type InsertQrScanEvent = z.infer<typeof insertQrScanEventSchema>;
export type ProviderHealthLog = typeof providerHealthLog.$inferSelect;
export type InsertProviderHealthLog = z.infer<typeof insertProviderHealthLogSchema>;
export type RepricingRule = typeof repricingRules.$inferSelect;
export type InsertRepricingRule = z.infer<typeof insertRepricingRuleSchema>;
export type RepricingHistoryEntry = typeof repricingHistory.$inferSelect;
export type InsertRepricingHistoryEntry = z.infer<typeof insertRepricingHistorySchema>;
