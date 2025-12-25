import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, decimal, timestamp, integer, boolean, index, unique } from "drizzle-orm/pg-core";
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
  showInGallery: boolean("show_in_gallery").default(false),
  galleryTitle: text("gallery_title"),
  galleryDescription: text("gallery_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey(),
  printifyId: text("printify_id").unique(),
  blueprintId: integer("blueprint_id"),
  printProviderId: integer("print_provider_id"),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  productLine: text("product_line").default("all"), // 'text', 'template', 'custom', 'all'
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  imageUrl: text("image_url"),
  manufacturer: text("manufacturer"),
  madeInUSA: boolean("made_in_usa").default(false),
  defaultPlacement: text("default_placement").default("front-chest"),
  availablePlacements: text("available_placements").array(),
  availableColors: jsonb("available_colors"),
  availableSizes: text("available_sizes").array(),
  metadata: jsonb("metadata"),
  isEnabled: boolean("is_enabled").default(false),
  markupPercent: decimal("markup_percent", { precision: 5, scale: 2 }).default("0"),
  markupFixed: decimal("markup_fixed", { precision: 10, scale: 2 }).default("0"),
  qrProductionCost: decimal("qr_production_cost", { precision: 10, scale: 2 }).default("0"),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Product categories for filtering (seasons, holidays, birthdays, etc.)
export const productCategories = pgTable("product_categories_lookup", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  taxonomyType: text("taxonomy_type").notNull(), // 'season', 'holiday', 'occasion', 'other'
  icon: text("icon"), // lucide icon name
  parentId: varchar("parent_id"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Many-to-many: products can belong to multiple categories
export const productCategoryAssignments = pgTable("product_category_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  categoryId: varchar("category_id").notNull().references(() => productCategories.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Product variants from Printify (size, color combinations)
export const productVariants = pgTable("product_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  printifyVariantId: integer("printify_variant_id").notNull(),
  title: text("title").notNull(), // e.g., "S / White"
  size: text("size"),
  color: text("color"),
  colorHex: text("color_hex"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  isEnabled: boolean("is_enabled").default(true),
  isInStock: boolean("is_in_stock").default(true),
}, (table) => ({
  productVariantUnique: unique().on(table.productId, table.printifyVariantId),
}));

// Pre-designed QR templates (curated backgrounds like "John 3:16")
export const qrTemplates = pgTable("qr_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"), // 'religious', 'business', 'sports', etc.
  thumbnailUrl: text("thumbnail_url").notNull(),
  fullImageUrl: text("full_image_url").notNull(),
  storageUrl: text("storage_url").notNull(),
  qrPlacement: jsonb("qr_placement"), // {x, y, width, height} as percentages
  availableSizes: text("available_sizes").array(), // ['small', 'medium', 'large']
  defaultTextAbove: text("default_text_above"),
  defaultTextBelow: text("default_text_below"),
  textStyle: jsonb("text_style"), // {font, color, size}
  priceUpcharge: decimal("price_upcharge", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Custom designs created by admin (QR codes linking to /customs/[id])
// ID format: storename-segment-producttype-date (e.g., "mystore-homepage-hat-dec2024")
export const customDesigns = pgTable("custom_designs", {
  id: varchar("id").primaryKey(), // Custom slug, no auto-generate
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  productImage: text("product_image"),
  placements: text("placements").array().notNull(),
  placementConfigs: jsonb("placement_configs"), // {placementId: 'full' | 'qr-only'}
  placementImages: jsonb("placement_images"), // {placementId: 'imageUrl'}
  backgroundImageUrl: text("background_image_url"),
  backgroundAssetId: varchar("background_asset_id").references(() => libraryAssets.id), // link to library asset
  topText: jsonb("top_text"), // {text, fontFamily, fontSize} - for PHYSICAL PRINT
  bottomText: jsonb("bottom_text"), // {text, fontFamily, fontSize} - for PHYSICAL PRINT
  textUpcharge: decimal("text_upcharge", { precision: 10, scale: 2 }).default("2.00"),
  // Landing page overlay - displayed when QR is scanned (not printed)
  // Format: { enabled, title, description, position: 'top'|'bottom', fontFamily, color }
  landingOverlay: jsonb("landing_overlay"),
  // QR Type variants: determines what the QR code contains and how landing page behaves
  // 'plain-text' = QR contains actual text (offline readable, up to ~2000 chars)
  // 'url' = QR links to hosted landing page with static content (image/text)
  // 'dynamics' = QR links to landing page showing cycling content based on schedule
  templateVariant: text("template_variant").default("url"), // 'plain-text', 'url', 'dynamics'
  // For dynamics variant: links to content set for cycling content
  dynamicContentSetId: varchar("dynamic_content_set_id"),
  storeType: text("store_type"), // 'Internal' or 'External'
  storeName: text("store_name"),
  segment: text("segment"),
  isFeatured: boolean("is_featured").default(false),
  isSeasonalPromo: boolean("is_seasonal_promo").default(false),
  qrCodeUrl: text("qr_code_url"),
  printifyCompositeUrl: text("printify_composite_url"),
  savedToLibrary: boolean("saved_to_library").default(false),
  savedToStore: boolean("saved_to_store").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomDesignSchema = createInsertSchema(customDesigns).omit({ createdAt: true, updatedAt: true });
export type InsertCustomDesign = z.infer<typeof insertCustomDesignSchema>;
export type CustomDesign = typeof customDesigns.$inferSelect;

// Partner stores for embeddable widgets (Kingdom Connects, etc.)
export const partnerStores = pgTable("partner_stores", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: text("slug").notNull().unique(), // 'kingdom-connects'
  name: text("name").notNull(),
  description: text("description"),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  businessPageUrlPattern: text("business_page_url_pattern"), // e.g. "https://kingdomconnects.org/business/{slug}.htm"
  apiKey: text("api_key").notNull(), // for JWT token generation
  allowedOrigins: text("allowed_origins").array(), // CORS origins
  primaryColor: text("primary_color"),
  accentColor: text("accent_color"),
  commissionPercent: decimal("commission_percent", { precision: 5, scale: 2 }).default("0"),
  // Store segments this partner can access
  availableSegments: text("available_segments").array(), // ['Religious', 'Business', etc.]
  // Whether this is an internal store (our site) vs external (partner sites)
  isInternal: boolean("is_internal").default(false),
  // Annual member perks - JSON config for free items
  // Format: { enabled: boolean, products: ['T-Shirt', 'Hat'], maxItems: 2 }
  annualMemberPerk: jsonb("annual_member_perk"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Products enabled for each partner store
// KC Placements array: ['homepage', 'dashboard', 'static_page'] - can appear in multiple places
export const partnerStoreProducts = pgTable("partner_store_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  partnerStoreId: varchar("partner_store_id").notNull().references(() => partnerStores.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  customPrice: decimal("custom_price", { precision: 10, scale: 2 }),
  customName: text("custom_name"),
  kcPlacements: text("kc_placements").array(), // ['homepage', 'dashboard', 'static_page'] - can be multiple
  kcBusinessSlug: text("kc_business_slug"), // Optional: Links to specific KC business page (usable with any placement)
  enabledSizes: text("enabled_sizes").array(), // Which sizes are enabled for this store's product
  enabledColors: text("enabled_colors").array(), // Which colors are enabled for this store's product
  sortOrder: integer("sort_order").default(0),
  isEnabled: boolean("is_enabled").default(true),
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
  textAboveUpcharge: decimal("text_above_upcharge", { precision: 10, scale: 2 }).default("2"),
  textBelowUpcharge: decimal("text_below_upcharge", { precision: 10, scale: 2 }).default("2"),
  imageHostingUpcharge: decimal("image_hosting_upcharge", { precision: 10, scale: 2 }).default("5"),
  dynamicQrUpcharge: decimal("dynamic_qr_upcharge", { precision: 10, scale: 2 }).default("25"),
  showPricesBeforeCustomization: boolean("show_prices_before_customization").default(false),
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
  status: text("status").notNull(), // 'pending', 'paid', 'processing', 'shipped', 'delivered'
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  stripePaymentId: text("stripe_payment_id"),
  stripeSessionId: text("stripe_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  printifyOrderId: text("printify_order_id"),
  shippingAddress: jsonb("shipping_address"),
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
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
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

// Hosting reminder events (for email notifications)
export const hostingReminders = pgTable("hosting_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  customGiftId: varchar("custom_gift_id").notNull().references(() => customGifts.id),
  userId: varchar("user_id").references(() => users.id),
  reminderType: text("reminder_type").notNull(), // '30_days', '7_days', 'expired'
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  emailAddress: text("email_address"),
  status: text("status").default("pending"), // 'pending', 'sent', 'failed'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Dynamic QR Pages - user-controlled landing pages where image can change anytime
export const dynamicPages = pgTable("dynamic_pages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  slug: text("slug").notNull().unique(), // UUID-based for non-enumerable URLs
  title: text("title").notNull(),
  description: text("description"),
  activeAssetId: varchar("active_asset_id"), // references dynamicPageAssets.id (added after table creation)
  hostingTierId: varchar("hosting_tier_id").references(() => hostingTiers.id),
  views: integer("views").default(0),
  status: text("status").default("active"), // 'active', 'paused', 'expired'
  expiresAt: timestamp("expires_at"),
  renewalReminderSent: boolean("renewal_reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Dynamic Page Assets - history of all images uploaded for a dynamic page
export const dynamicPageAssets = pgTable("dynamic_page_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  pageId: varchar("page_id").notNull().references(() => dynamicPages.id),
  hostedImageId: varchar("hosted_image_id").notNull().references(() => hostedImages.id),
  title: text("title"),
  isActive: boolean("is_active").default(false), // only one asset active at a time per page
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Library Assets - unified storage for backgrounds (images/videos) with ownership tracking
// Supports: admin backgrounds, user personal libraries, seasonal/event categorization
export const libraryAssets = pgTable("library_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id), // null = admin asset
  ownerType: text("owner_type").notNull(), // 'admin' or 'user'
  assetType: text("asset_type").notNull(), // 'background' or 'design'
  mediaType: text("media_type").notNull(), // 'image' or 'video'
  name: text("name").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageUrl: text("storage_url").notNull(), // path in object storage
  publicUrl: text("public_url").notNull(), // serving URL
  thumbnailUrl: text("thumbnail_url"), // for videos, generated thumbnail
  duration: integer("duration"), // for videos, duration in seconds
  category: text("category"), // 'general', 'seasonal', 'events', etc.
  season: text("season"), // 'christmas', 'easter', 'summer', etc.
  event: text("event"), // 'birthday', 'wedding', 'graduation', etc.
  tags: text("tags").array(), // additional searchable tags
  visibleStoreSlugs: text("visible_store_slugs").array(), // which stores can see this asset (null = all)
  visibleSegments: jsonb("visible_segments"), // segments per store, e.g., {"kingdom-connects": ["Religious", "Business"]}
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  usageCount: integer("usage_count").default(0), // track how often this is used
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
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

export const insertPricingRuleSchema = createInsertSchema(pricingRules).omit({
  id: true,
  createdAt: true,
});

export const insertAdminSettingsSchema = createInsertSchema(adminSettings).omit({
  updatedAt: true,
});

export const insertGiftBackgroundSchema = createInsertSchema(giftBackgrounds).omit({
  id: true,
  createdAt: true,
});

export const insertHostingTierSchema = createInsertSchema(hostingTiers).omit({
  id: true,
});

export const insertCustomGiftSchema = createInsertSchema(customGifts).omit({
  id: true,
  views: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductVariantSchema = createInsertSchema(productVariants).omit({
  id: true,
});

export const insertQrTemplateSchema = createInsertSchema(qrTemplates).omit({
  id: true,
  createdAt: true,
});

export const insertPartnerStoreSchema = createInsertSchema(partnerStores).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPartnerStoreProductSchema = createInsertSchema(partnerStoreProducts).omit({
  id: true,
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

export const insertLibraryAssetSchema = createInsertSchema(libraryAssets).omit({
  id: true,
  usageCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertProductCategorySchema = createInsertSchema(productCategories).omit({
  id: true,
  createdAt: true,
});

export const insertProductCategoryAssignmentSchema = createInsertSchema(productCategoryAssignments).omit({
  id: true,
  createdAt: true,
});

// Printify Catalog Cache Tables
export const printifyBlueprints = pgTable("printify_blueprints", {
  id: integer("id").primaryKey(), // Printify blueprint ID
  title: text("title").notNull(),
  description: text("description"),
  brand: text("brand"),
  model: text("model"),
  images: text("images").array(), // Array of image URLs
  primaryImageUrl: text("primary_image_url"),
  category: text("category"), // Derived category (t-shirts, hats, mugs, etc.)
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const printifyPrintProviders = pgTable("printify_print_providers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blueprintId: integer("blueprint_id").notNull().references(() => printifyBlueprints.id),
  providerId: integer("provider_id").notNull(),
  title: text("title").notNull(),
  country: text("country"),
  isUSA: boolean("is_usa").default(false),
  minCost: integer("min_cost"), // Minimum production cost in cents across variants
  maxCost: integer("max_cost"), // Maximum production cost in cents across variants
  availableColors: jsonb("available_colors"), // Array of {name: string, hex?: string}
  availableSizes: text("available_sizes").array(), // Array of size strings
  placeholderProductId: text("placeholder_product_id"), // Printify product ID used to fetch costs
  costsFetchedAt: timestamp("costs_fetched_at"), // When costs were last retrieved
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
});

export const printifyCatalogSync = pgTable("printify_catalog_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncType: text("sync_type").notNull(), // 'full' or 'incremental'
  status: text("status").notNull(), // 'running', 'completed', 'failed'
  blueprintsCount: integer("blueprints_count").default(0),
  providersCount: integer("providers_count").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const printifyCostSync = pgTable("printify_cost_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull(), // 'running', 'completed', 'failed', 'paused'
  totalProviders: integer("total_providers").default(0),
  processedCount: integer("processed_count").default(0),
  successCount: integer("success_count").default(0),
  failedCount: integer("failed_count").default(0),
  skippedCount: integer("skipped_count").default(0), // Already had costs
  lastProcessedProviderId: text("last_processed_provider_id"), // For resume capability
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertPrintifyBlueprintSchema = createInsertSchema(printifyBlueprints);
export const insertPrintifyPrintProviderSchema = createInsertSchema(printifyPrintProviders).omit({
  id: true,
});
export const insertPrintifyCatalogSyncSchema = createInsertSchema(printifyCatalogSync).omit({
  id: true,
});
export const insertPrintifyCostSyncSchema = createInsertSchema(printifyCostSync).omit({
  id: true,
});

// QR Dynamics™ - Cycling Content System
// A content set defines a schedule for cycling through multiple slots
// Use cases: "12 Days of Christmas", "30 Days of Verses", weekly menus
export const dynamicContentSets = pgTable("dynamic_content_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "12 Days of Christmas"
  description: text("description"),
  // Schedule type determines how content cycles
  // 'hourly' = new slot every hour, 'daily' = new slot every day
  // 'weekly' = new slot every week, 'monthly' = new slot every month
  scheduleType: text("schedule_type").notNull().default("daily"), // 'hourly', 'daily', 'weekly', 'monthly'
  // Start date/time for the first slot (slot 1 shows at this time)
  startDate: timestamp("start_date").notNull(),
  // Optional end date - after this, shows last slot or loops
  endDate: timestamp("end_date"),
  // Loop behavior: when all slots are exhausted
  // 'stop' = show last slot forever, 'loop' = restart from slot 1
  loopBehavior: text("loop_behavior").default("stop"), // 'stop', 'loop'
  // Total number of slots expected (for display purposes)
  totalSlots: integer("total_slots").default(0),
  // Owner info (for future user-created sets)
  userId: varchar("user_id").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Individual content slots within a set
// Each slot contains the content to display at a specific position in the cycle
export const dynamicContentSlots = pgTable("dynamic_content_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentSetId: varchar("content_set_id").notNull().references(() => dynamicContentSets.id, { onDelete: "cascade" }),
  // Position in the sequence (1-indexed: slot 1, slot 2, etc.)
  slotNumber: integer("slot_number").notNull(),
  // Content for this slot (similar to landing page overlay)
  title: text("title"),
  description: text("description"),
  // Background image for this slot
  imageUrl: text("image_url"),
  // Optional video URL
  videoUrl: text("video_url"),
  // Optional link (button or tap destination)
  linkUrl: text("link_url"),
  linkText: text("link_text"), // "Learn More", "Shop Now", etc.
  // Styling options
  textColor: text("text_color").default("#ffffff"),
  overlayPosition: text("overlay_position").default("bottom"), // 'top', 'center', 'bottom'
  fontFamily: text("font_family").default("Inter"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDynamicContentSetSchema = createInsertSchema(dynamicContentSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDynamicContentSlotSchema = createInsertSchema(dynamicContentSlots).omit({
  id: true,
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

export type PricingRule = typeof pricingRules.$inferSelect;
export type InsertPricingRule = z.infer<typeof insertPricingRuleSchema>;

export type AdminSettings = typeof adminSettings.$inferSelect;
export type InsertAdminSettings = z.infer<typeof insertAdminSettingsSchema>;

export type GiftBackground = typeof giftBackgrounds.$inferSelect;
export type InsertGiftBackground = z.infer<typeof insertGiftBackgroundSchema>;

export type HostingTier = typeof hostingTiers.$inferSelect;
export type InsertHostingTier = z.infer<typeof insertHostingTierSchema>;

export type CustomGift = typeof customGifts.$inferSelect;
export type InsertCustomGift = z.infer<typeof insertCustomGiftSchema>;

export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;

export type QrTemplate = typeof qrTemplates.$inferSelect;
export type InsertQrTemplate = z.infer<typeof insertQrTemplateSchema>;

export type PartnerStore = typeof partnerStores.$inferSelect;
export type InsertPartnerStore = z.infer<typeof insertPartnerStoreSchema>;

export type PartnerStoreProduct = typeof partnerStoreProducts.$inferSelect;
export type InsertPartnerStoreProduct = z.infer<typeof insertPartnerStoreProductSchema>;

export type HostingReminder = typeof hostingReminders.$inferSelect;
export type InsertHostingReminder = z.infer<typeof insertHostingReminderSchema>;

export type DynamicPage = typeof dynamicPages.$inferSelect;
export type InsertDynamicPage = z.infer<typeof insertDynamicPageSchema>;

export type DynamicPageAsset = typeof dynamicPageAssets.$inferSelect;
export type InsertDynamicPageAsset = z.infer<typeof insertDynamicPageAssetSchema>;

export type LibraryAsset = typeof libraryAssets.$inferSelect;
export type InsertLibraryAsset = z.infer<typeof insertLibraryAssetSchema>;

export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;

export type ProductCategoryAssignment = typeof productCategoryAssignments.$inferSelect;
export type InsertProductCategoryAssignment = z.infer<typeof insertProductCategoryAssignmentSchema>;

export type UpsertUser = typeof users.$inferInsert;

export type PrintifyBlueprint = typeof printifyBlueprints.$inferSelect;
export type InsertPrintifyBlueprint = z.infer<typeof insertPrintifyBlueprintSchema>;

export type PrintifyPrintProvider = typeof printifyPrintProviders.$inferSelect;
export type InsertPrintifyPrintProvider = z.infer<typeof insertPrintifyPrintProviderSchema>;

export type PrintifyCatalogSync = typeof printifyCatalogSync.$inferSelect;
export type InsertPrintifyCatalogSync = z.infer<typeof insertPrintifyCatalogSyncSchema>;

export type PrintifyCostSync = typeof printifyCostSync.$inferSelect;
export type InsertPrintifyCostSync = z.infer<typeof insertPrintifyCostSyncSchema>;

export type DynamicContentSet = typeof dynamicContentSets.$inferSelect;
export type InsertDynamicContentSet = z.infer<typeof insertDynamicContentSetSchema>;

export type DynamicContentSlot = typeof dynamicContentSlots.$inferSelect;
export type InsertDynamicContentSlot = z.infer<typeof insertDynamicContentSlotSchema>;
