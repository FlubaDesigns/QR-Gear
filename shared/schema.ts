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
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Social media URLs for sharing
  socialFacebook: varchar("social_facebook"),
  socialInstagram: varchar("social_instagram"),
  socialTwitter: varchar("social_twitter"),
  socialLinkedin: varchar("social_linkedin"),
  socialTiktok: varchar("social_tiktok"),
  socialYoutube: varchar("social_youtube"),
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
  defaultColor: text("default_color"),
  metadata: jsonb("metadata"),
  isEnabled: boolean("is_enabled").default(false),
  markupPercent: decimal("markup_percent", { precision: 5, scale: 2 }).default("0"),
  markupFixed: decimal("markup_fixed", { precision: 10, scale: 2 }).default("0"),
  qrProductionCost: decimal("qr_production_cost", { precision: 10, scale: 2 }).default("0"),
  customerPrice: decimal("customer_price", { precision: 10, scale: 2 }),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  mockupsByColor: jsonb("mockups_by_color"), // { 'White': { front: 'url' }, 'Black': {...} }
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

// Product variant media - color-specific mockup images from Printify (admin-only)
export const productVariantMedia = pgTable("product_variant_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  color: text("color").notNull(), // Color name (e.g., "White", "Black")
  colorHex: text("color_hex"), // Color hex code
  mockupUrl: text("mockup_url").notNull(), // Base mockup image from Printify
  overlayUrl: text("overlay_url"), // Mockup with QR overlay (generated on-demand)
  isPrimary: boolean("is_primary").default(false), // If true, use this as main product image
  mediaStatus: text("media_status").default("pending"), // 'pending', 'success', 'failed', 'rate_limited'
  printifyMockupId: text("printify_mockup_id"), // Track Printify's mockup ID for deduplication
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  productColorUnique: unique().on(table.productId, table.color),
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
// ID format: slugified project name (e.g., "hello-world-qr")
export const customDesigns = pgTable("custom_designs", {
  id: varchar("id").primaryKey(), // Slugified project name, no auto-generate
  projectName: text("project_name").notNull(), // User-defined display name (e.g., "Hello World QR")
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
  // 'external-url' = QR links directly to any external URL (no landing page, keeps header/footer)
  templateVariant: text("template_variant").default("url"), // 'plain-text', 'url', 'dynamics', 'external-url'
  // For external-url variant: the custom URL the QR code points to
  externalUrl: text("external_url"),
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
  // Template organization - for library templates
  templateName: text("template_name"), // Custom display name (e.g., "Beach Scene 01")
  templateCategory: text("template_category"), // Main category (e.g., "Seasonal", "Events", "Evergreen")
  templateSubcategory: text("template_subcategory"), // Subcategory (e.g., "Summer", "Valentine's Day")
  // For user/partner templates - their private sandbox
  ownerUserId: varchar("owner_user_id").references(() => users.id),
  campaignName: text("campaign_name"), // User's campaign/project folder (e.g., "12 Days of Deals")
  // Printify integration for realistic mockups
  blueprintId: integer("blueprint_id"), // Printify blueprint ID (e.g., 5 for t-shirt)
  printProviderId: integer("print_provider_id"), // Printify print provider ID
  printifyProductId: text("printify_product_id"), // Created Printify product ID for orders
  printReadyArtUrl: text("print_ready_art_url"), // URL to uploaded print-ready artwork (QR + text)
  selectedColors: text("selected_colors").array(), // Colors admin chose for mockups ['White', 'Black', 'Navy']
  defaultColor: text("default_color"), // Color to display first (e.g., 'Navy')
  mockupsByColor: jsonb("mockups_by_color"), // { 'White': { front: 'url', angles: ['url1','url2'] }, 'Black': {...} }
  selectedVariantIds: jsonb("selected_variant_ids"), // { 'White-M': 12345, 'Black-L': 12346 } for order fulfillment
  publishStatus: text("publish_status").default("draft"), // 'draft', 'pending', 'processing', 'complete', 'failed'
  publishError: text("publish_error"), // Error message if publish failed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertCustomDesignSchema = createInsertSchema(customDesigns).omit({ createdAt: true, updatedAt: true });
export type InsertCustomDesign = z.infer<typeof insertCustomDesignSchema>;
export type CustomDesign = typeof customDesigns.$inferSelect;

// Template categories for organizing library templates (admin can add new ones)
// Supports hierarchical structure: Category > Subcategory
export const templateCategories = pgTable("template_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(), // "Seasonal", "Summer", "Valentine's Day"
  parentId: varchar("parent_id"), // null = top-level category, otherwise = subcategory
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTemplateCategorySchema = createInsertSchema(templateCategories).omit({ id: true, createdAt: true });
export type InsertTemplateCategory = z.infer<typeof insertTemplateCategorySchema>;
export type TemplateCategory = typeof templateCategories.$inferSelect;

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
  defaultColor: text("default_color"), // Which color to display by default
  mockupsByColor: jsonb("mockups_by_color"), // { "Black": { front: "url", back: "url" }, ... }
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
  videoPriceUpcharge: decimal("video_price_upcharge", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
});

// Email Templates - customizable email content for various triggers
export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  trigger: text("trigger").notNull().unique(), // 'order_confirmation', 'order_shipped', etc.
  name: text("name").notNull(), // Human-readable name
  subject: text("subject").notNull(), // Email subject line
  htmlContent: text("html_content").notNull(), // HTML email body
  textContent: text("text_content"), // Plain text fallback
  isEnabled: boolean("is_enabled").default(true),
  description: text("description"), // Admin description of when this sends
  variables: text("variables").array(), // Available merge tags like ['customerName', 'orderNumber']
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

// Email log - track all sent emails
export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").references(() => emailTemplates.id),
  trigger: text("trigger").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  status: text("status").notNull(), // 'sent', 'failed', 'bounced'
  resendId: text("resend_id"), // Resend message ID for tracking
  orderId: varchar("order_id"), // Related order if applicable
  userId: varchar("user_id").references(() => users.id),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type EmailLog = typeof emailLogs.$inferSelect;

// Coupons / Discount codes - synced with Stripe promotion codes
export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  code: text("code").notNull().unique(), // Customer-facing code like "SUMMER20"
  name: text("name").notNull(), // Internal name for admin
  discountType: text("discount_type").notNull(), // 'percent' or 'fixed'
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(), // Percentage (e.g., 20) or dollar amount (e.g., 5.00)
  currency: text("currency").default("usd"), // For fixed amount discounts
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }), // Minimum order value required
  maxRedemptions: integer("max_redemptions"), // Total times this coupon can be used (null = unlimited)
  redemptionCount: integer("redemption_count").default(0), // How many times it's been used
  validFrom: timestamp("valid_from"), // Start date (null = immediately valid)
  validUntil: timestamp("valid_until"), // End date (null = no expiration)
  stripeCouponId: text("stripe_coupon_id"), // Stripe coupon ID
  stripePromotionCodeId: text("stripe_promotion_code_id"), // Stripe promotion code ID
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
// Supports: admin backgrounds, user personal libraries, hierarchical category organization
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
  // Hierarchical category organization (shares templateCategories table)
  libraryCategoryId: varchar("library_category_id").references(() => templateCategories.id), // top-level category
  librarySubcategoryId: varchar("library_subcategory_id").references(() => templateCategories.id), // subcategory
  // Legacy fields kept for migration - prefer category hierarchy
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

// ============================================
// MULTI-PROVIDER POD + MARKETPLACE ORCHESTRATION
// ============================================

// Master Products - Provider-agnostic product model (single source of truth)
export const masterProducts = pgTable("master_products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Unified SKU: QRG-{type}-{designId}-{seq}
  sku: text("sku").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  // Product type for routing (apparel, drinkware, accessories, etc.)
  productType: text("product_type").notNull(),
  // Link to the current design version
  currentDesignVersionId: varchar("current_design_version_id"),
  // Link to pricing profile for markup rules
  pricingProfileId: varchar("pricing_profile_id"),
  // Base production cost (from cheapest provider)
  baseCost: decimal("base_cost", { precision: 10, scale: 2 }),
  // Retail price (calculated from pricing profile)
  retailPrice: decimal("retail_price", { precision: 10, scale: 2 }),
  // Product status
  status: text("status").default("draft"), // 'draft', 'active', 'paused', 'archived'
  // Channel toggles (which platforms to publish to)
  channels: jsonb("channels"), // { printify: true, printful: false, etsy: true, ... }
  // Tags for filtering
  tags: text("tags").array(),
  // Bundle info (for cross-sell)
  bundleParentId: varchar("bundle_parent_id"),
  bundleDiscount: decimal("bundle_discount", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Design Versions - Immutable snapshots of artwork for versioning
export const productDesignVersions = pgTable("product_design_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterProductId: varchar("master_product_id").notNull().references(() => masterProducts.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull().default(1),
  // Design inputs (what was used to generate the artwork)
  headerText: text("header_text"),
  headerStyle: jsonb("header_style"), // { fontFamily, fontSize, color, warpPreset, letterSpacing, stroke }
  footerText: text("footer_text"),
  footerStyle: jsonb("footer_style"),
  qrUrl: text("qr_url").notNull(),
  // Rendered assets (output files)
  renderedPngUrl: text("rendered_png_url"), // 4500x5400 transparent PNG
  renderedSvgUrl: text("rendered_svg_url"), // Source SVG
  qrCodeUrl: text("qr_code_url"), // QR code image
  // Placement-specific renders
  placementImages: jsonb("placement_images"), // { front: url, back: url, sleeve: url }
  // Metadata
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Channel Configs - API credentials and settings for each provider/marketplace
export const channelConfigs = pgTable("channel_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Channel identifier: printify, printful, apliiq, etsy, ebay, amazon
  channelType: text("channel_type").notNull().unique(),
  displayName: text("display_name").notNull(),
  // Whether this channel is enabled globally
  isEnabled: boolean("is_enabled").default(false),
  // API credentials (stored encrypted via secrets, reference only here)
  apiKeySecretName: text("api_key_secret_name"), // e.g., "PRINTIFY_API_KEY"
  apiSecretSecretName: text("api_secret_secret_name"),
  shopId: text("shop_id"), // For Printify/Printful shop ID
  // Rate limiting
  rateLimit: integer("rate_limit").default(60), // requests per minute
  rateLimitWindow: integer("rate_limit_window").default(60), // seconds
  // Webhook config
  webhookSecret: text("webhook_secret"),
  webhookUrl: text("webhook_url"),
  // Health monitoring
  lastHealthCheck: timestamp("last_health_check"),
  // Channel-specific settings
  settings: jsonb("settings"), // { defaultShippingProfile, returnPolicy, etc. }
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Channel Publish States - Per-product, per-channel publishing status
export const channelPublishStates = pgTable("channel_publish_states", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterProductId: varchar("master_product_id").notNull().references(() => masterProducts.id, { onDelete: "cascade" }),
  channelType: text("channel_type").notNull(), // printify, etsy, etc.
  // External IDs from the platform
  externalProductId: text("external_product_id"),
  externalListingId: text("external_listing_id"),
  externalVariantIds: jsonb("external_variant_ids"), // { "S/White": "ext123", ... }
  // Publishing status
  status: text("status").default("unpublished"), // 'unpublished', 'pending', 'published', 'failed', 'paused'
  lastPublishedAt: timestamp("last_published_at"),
  lastSyncedAt: timestamp("last_synced_at"),
  lastError: text("last_error"),
  // Version tracking (which design version is published)
  publishedDesignVersionId: varchar("published_design_version_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  productChannelUnique: unique().on(table.masterProductId, table.channelType),
}));

// Provider Quotes - Cost and ETA snapshots from print providers
export const providerQuotes = pgTable("provider_quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  masterProductId: varchar("master_product_id").notNull().references(() => masterProducts.id, { onDelete: "cascade" }),
  providerType: text("provider_type").notNull(), // printify, printful, apliiq
  // Cost breakdown
  productionCost: decimal("production_cost", { precision: 10, scale: 2 }).notNull(),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }),
  // Estimated delivery
  estimatedDays: integer("estimated_days"),
  // Availability
  isAvailable: boolean("is_available").default(true),
  // When this quote was fetched
  quotedAt: timestamp("quoted_at").defaultNow().notNull(),
  // Expiry (quotes become stale)
  expiresAt: timestamp("expires_at"),
});

// Pricing Profiles - Markup rules for calculating retail prices
export const pricingProfiles = pgTable("pricing_profiles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  // Markup strategy
  markupType: text("markup_type").notNull().default("percentage"), // 'percentage', 'fixed', 'tiered'
  markupPercent: decimal("markup_percent", { precision: 5, scale: 2 }),
  markupFixed: decimal("markup_fixed", { precision: 10, scale: 2 }),
  // Minimum margin protection
  minMarginPercent: decimal("min_margin_percent", { precision: 5, scale: 2 }).default("40"),
  // Per-channel adjustments
  channelAdjustments: jsonb("channel_adjustments"), // { etsy: { addPercent: 5 }, ebay: { addFixed: 2 } }
  // Auto-repricing rules
  autoRepriceEnabled: boolean("auto_reprice_enabled").default(false),
  autoRepriceMinMargin: decimal("auto_reprice_min_margin", { precision: 5, scale: 2 }),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Unified Orders - All orders from all channels in one place
export const ordersUnified = pgTable("orders_unified", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Source channel
  sourceChannel: text("source_channel").notNull(), // 'direct', 'etsy', 'ebay', 'amazon'
  externalOrderId: text("external_order_id"),
  // Customer info
  customerEmail: text("customer_email"),
  customerName: text("customer_name"),
  shippingAddress: jsonb("shipping_address"),
  // Order details
  items: jsonb("items").notNull(), // [{ masterProductId, variantSku, quantity, price }]
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingTotal: decimal("shipping_total", { precision: 10, scale: 2 }),
  taxTotal: decimal("tax_total", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  // Fulfillment routing
  routedProvider: text("routed_provider"), // printify, printful, apliiq
  providerOrderId: text("provider_order_id"),
  // Status timeline
  status: text("status").default("pending"), // 'pending', 'routed', 'in_production', 'shipped', 'delivered', 'cancelled'
  statusHistory: jsonb("status_history"), // [{ status, timestamp, note }]
  // Tracking
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
  // Profit tracking
  productionCost: decimal("production_cost", { precision: 10, scale: 2 }),
  profit: decimal("profit", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// QR Scan Events - Analytics for QR code scans
export const qrScanEvents = pgTable("qr_scan_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // What was scanned
  masterProductId: varchar("master_product_id").references(() => masterProducts.id),
  customDesignId: varchar("custom_design_id"),
  qrUrl: text("qr_url"),
  // Scan metadata
  scanDate: timestamp("scan_date").defaultNow().notNull(),
  // Aggregation (daily rollup)
  scanCount: integer("scan_count").default(1),
  // Location (optional, from IP geolocation)
  country: text("country"),
  region: text("region"),
  // Device info
  deviceType: text("device_type"), // 'mobile', 'tablet', 'desktop'
  userAgent: text("user_agent"),
});

// Provider Health Log - Uptime and reliability metrics
export const providerHealthLog = pgTable("provider_health_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  providerType: text("provider_type").notNull(), // printify, printful, apliiq
  // Health check result
  checkTime: timestamp("check_time").defaultNow().notNull(),
  isHealthy: boolean("is_healthy").default(true),
  responseTimeMs: integer("response_time_ms"),
  // Error details
  errorMessage: text("error_message"),
  errorCode: text("error_code"),
  // Aggregated metrics (updated periodically)
  uptimePercent24h: decimal("uptime_percent_24h", { precision: 5, scale: 2 }),
  avgResponseTime24h: integer("avg_response_time_24h"),
});

// Auto-Repricing Rules - Dynamic pricing based on conditions
export const repricingRules = pgTable("repricing_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  priority: integer("priority").default(0), // Higher = evaluated first
  // Conditions (JSON structure for flexibility)
  // e.g., { "marginBelow": 20, "channel": "amazon" }
  conditions: jsonb("conditions").default({}).$type<{
    marginBelow?: number; // Margin percentage threshold
    marginAbove?: number;
    channel?: string; // Specific channel
    productCategory?: string;
    costIncreasePercent?: number; // Trigger on cost increases
    competitorPriceBelow?: number; // Competitive pricing
  }>(),
  // Action to take
  actionType: text("action_type").notNull(), // 'adjust_margin', 'match_target', 'increase_percent', 'decrease_percent'
  // Action parameters
  actionParams: jsonb("action_params").default({}).$type<{
    targetMarginPercent?: number; // For 'adjust_margin' - set price to achieve this margin
    adjustPercent?: number; // For 'increase_percent' / 'decrease_percent'
    minPrice?: number; // Floor price
    maxPrice?: number; // Ceiling price
    roundTo?: number; // Round to nearest (e.g., 0.99)
  }>(),
  // Scope - which products/channels this applies to
  appliesTo: text("applies_to").default("all"), // 'all', 'category', 'product', 'channel'
  appliesToIds: text("applies_to_ids").array(), // Specific IDs if not 'all'
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Repricing History - Audit log of price changes
export const repricingHistory = pgTable("repricing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ruleId: varchar("rule_id").references(() => repricingRules.id),
  masterProductId: varchar("master_product_id").references(() => masterProducts.id),
  channel: text("channel"),
  // Price change details
  previousPrice: decimal("previous_price", { precision: 10, scale: 2 }).notNull(),
  newPrice: decimal("new_price", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(), // Human-readable explanation
  // Margin details
  previousMargin: decimal("previous_margin", { precision: 5, scale: 2 }),
  newMargin: decimal("new_margin", { precision: 5, scale: 2 }),
  // Metadata
  appliedAt: timestamp("applied_at").defaultNow().notNull(),
  wasAutomatic: boolean("was_automatic").default(true),
});

// Cross-Sell Bundles - Product bundles for upselling and discounts
export const productBundles = pgTable("product_bundles", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  // Bundle type: 'fixed' (set items), 'pick' (choose N from list)
  bundleType: text("bundle_type").notNull().default("fixed"),
  // Display settings
  displayImage: text("display_image"),
  displayOrder: integer("display_order").default(0),
  // Pricing strategy
  pricingType: text("pricing_type").notNull().default("discount_percent"),
  // For 'discount_percent': percentage off sum of items
  // For 'fixed_price': exact bundle price
  // For 'discount_amount': flat discount off sum
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }),
  fixedPrice: decimal("fixed_price", { precision: 10, scale: 2 }),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }),
  // For 'pick' bundles: min/max items customer must select
  minItems: integer("min_items"),
  maxItems: integer("max_items"),
  // Visibility and status
  isActive: boolean("is_active").default(true),
  // Where this bundle is shown: 'cart', 'product_page', 'checkout', 'all'
  displayLocations: text("display_locations").array().default(sql`ARRAY['cart']::text[]`),
  // Optional: only show for specific products (JSON array of product IDs)
  triggerProductIds: text("trigger_product_ids").array(),
  // Scheduling
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  // Timestamps
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Bundle Items - Products included in each bundle
export const bundleItems = pgTable("bundle_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bundleId: varchar("bundle_id").notNull().references(() => productBundles.id, { onDelete: "cascade" }),
  // Can reference either a master product or a legacy product
  masterProductId: varchar("master_product_id").references(() => masterProducts.id),
  productId: integer("product_id"),
  // Display order within the bundle
  displayOrder: integer("display_order").default(0),
  // Quantity of this item in the bundle
  quantity: integer("quantity").default(1),
  // For 'pick' bundles: is this item required or optional?
  isRequired: boolean("is_required").default(false),
  // Item-specific discount override (optional)
  itemDiscountPercent: decimal("item_discount_percent", { precision: 5, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ============================================================
// GIFT MODE TABLES
// Enables gift purchases with redeemable codes
// ============================================================

// Gift Packages - Define what's included in a gift purchase
export const giftPackages = pgTable("gift_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  // What type of gift: 'product' (physical item), 'dynamics' (QR Dynamics subscription)
  giftType: text("gift_type").notNull().default("product"),
  // For product gifts: which master product
  masterProductId: varchar("master_product_id").references(() => masterProducts.id),
  // For dynamics gifts: subscription tier level
  dynamicsTier: text("dynamics_tier"),
  dynamicsMonths: integer("dynamics_months"),
  // Pricing
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  // Customization options available to recipient
  allowColorChoice: boolean("allow_color_choice").default(true),
  allowSizeChoice: boolean("allow_size_choice").default(true),
  allowQrCustomization: boolean("allow_qr_customization").default(true),
  // Optional personal message from buyer
  includePersonalMessage: boolean("include_personal_message").default(true),
  // Validity period for redemption (days after purchase)
  redemptionValidDays: integer("redemption_valid_days").default(365),
  // Display
  displayImage: text("display_image"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Gift Codes - Generated when a gift is purchased
export const giftCodes = pgTable("gift_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Unique redeemable code (e.g., "GIFT-A1B2-C3D4-E5F6")
  code: varchar("code", { length: 32 }).notNull().unique(),
  giftPackageId: varchar("gift_package_id").notNull().references(() => giftPackages.id),
  // Buyer info
  buyerUserId: varchar("buyer_user_id").references(() => users.id),
  buyerEmail: text("buyer_email"),
  buyerName: text("buyer_name"),
  // Personal message from buyer to recipient
  personalMessage: text("personal_message"),
  // Purchase tracking
  orderId: varchar("order_id"),
  stripePaymentId: text("stripe_payment_id"),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
  // Expiration
  expiresAt: timestamp("expires_at").notNull(),
  // Status: 'active', 'redeemed', 'expired', 'cancelled'
  status: text("status").notNull().default("active"),
  // When was this code last sent to recipient
  lastEmailedTo: text("last_emailed_to"),
  lastEmailedAt: timestamp("last_emailed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Gift Redemptions - Records when/how a gift code was redeemed
export const giftRedemptions = pgTable("gift_redemptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  giftCodeId: varchar("gift_code_id").notNull().references(() => giftCodes.id),
  // Recipient info
  recipientUserId: varchar("recipient_user_id").references(() => users.id),
  recipientEmail: text("recipient_email"),
  recipientName: text("recipient_name"),
  // Customizations selected by recipient
  selectedColor: text("selected_color"),
  selectedSize: text("selected_size"),
  qrContent: text("qr_content"),
  qrStyle: jsonb("qr_style"),
  shippingAddress: jsonb("shipping_address"),
  // For dynamics gifts: activated subscription
  dynamicsSubscriptionId: varchar("dynamics_subscription_id"),
  dynamicsContentSetId: varchar("dynamics_content_set_id").references(() => dynamicContentSets.id),
  // Fulfillment tracking
  fulfillmentOrderId: varchar("fulfillment_order_id"),
  fulfillmentProvider: text("fulfillment_provider"),
  fulfillmentStatus: text("fulfillment_status").default("pending"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  // Timestamps
  redeemedAt: timestamp("redeemed_at").defaultNow().notNull(),
  fulfilledAt: timestamp("fulfilled_at"),
  shippedAt: timestamp("shipped_at"),
  deliveredAt: timestamp("delivered_at"),
});

// Insert schemas for orchestration tables
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
export const insertProductBundleSchema = createInsertSchema(productBundles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBundleItemSchema = createInsertSchema(bundleItems).omit({
  id: true,
  createdAt: true,
});

// Insert schemas for Gift Mode tables
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

export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;

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

// Orchestration Types
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

export type ProductBundle = typeof productBundles.$inferSelect;
export type InsertProductBundle = z.infer<typeof insertProductBundleSchema>;

export type BundleItem = typeof bundleItems.$inferSelect;
export type InsertBundleItem = z.infer<typeof insertBundleItemSchema>;

// Gift Mode Types
export type GiftPackage = typeof giftPackages.$inferSelect;
export type InsertGiftPackage = z.infer<typeof insertGiftPackageSchema>;

export type GiftCode = typeof giftCodes.$inferSelect;
export type InsertGiftCode = z.infer<typeof insertGiftCodeSchema>;

export type GiftRedemption = typeof giftRedemptions.$inferSelect;
export type InsertGiftRedemption = z.infer<typeof insertGiftRedemptionSchema>;
