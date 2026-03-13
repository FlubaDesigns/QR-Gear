import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, decimal, timestamp, integer, boolean, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema-users";

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

export const productCategoryAssignments = pgTable("product_category_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  categoryId: varchar("category_id").notNull().references(() => productCategories.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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

export const productVariantMedia = pgTable("product_variant_media", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  color: text("color").notNull(),
  colorHex: text("color_hex"),
  mockupUrl: text("mockup_url").notNull(),
  overlayUrl: text("overlay_url"),
  isPrimary: boolean("is_primary").default(false),
  mediaStatus: text("media_status").default("pending"),
  printifyMockupId: text("printify_mockup_id"),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  productColorUnique: unique().on(table.productId, table.color),
}));

export const qrTemplates = pgTable("qr_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category"),
  thumbnailUrl: text("thumbnail_url").notNull(),
  fullImageUrl: text("full_image_url").notNull(),
  storageUrl: text("storage_url").notNull(),
  qrPlacement: jsonb("qr_placement"),
  availableSizes: text("available_sizes").array(),
  defaultTextAbove: text("default_text_above"),
  defaultTextBelow: text("default_text_below"),
  textStyle: jsonb("text_style"),
  priceUpcharge: decimal("price_upcharge", { precision: 10, scale: 2 }).default("0"),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const templateCategories = pgTable("template_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  parentId: varchar("parent_id"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const libraryAssets = pgTable("library_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id),
  ownerType: text("owner_type").notNull(),
  assetType: text("asset_type").notNull(),
  mediaType: text("media_type").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  fileName: text("file_name").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageUrl: text("storage_url").notNull(),
  publicUrl: text("public_url").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  duration: integer("duration"),
  sourceAssetId: varchar("source_asset_id"),
  width: integer("width"),
  height: integer("height"),
  cropData: jsonb("crop_data"),
  libraryCategoryId: varchar("library_category_id").references(() => templateCategories.id),
  librarySubcategoryId: varchar("library_subcategory_id").references(() => templateCategories.id),
  category: text("category"),
  season: text("season"),
  event: text("event"),
  tags: text("tags").array(),
  visibleStoreSlugs: text("visible_store_slugs").array(),
  visibleSegments: jsonb("visible_segments"),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  sortOrder: integer("sort_order").default(0),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const customDesigns = pgTable("custom_designs", {
  id: varchar("id").primaryKey(),
  projectName: text("project_name").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  productImage: text("product_image"),
  placements: text("placements").array().notNull(),
  placementConfigs: jsonb("placement_configs"),
  placementImages: jsonb("placement_images"),
  backgroundImageUrl: text("background_image_url"),
  backgroundAssetId: varchar("background_asset_id").references(() => libraryAssets.id),
  topText: jsonb("top_text"),
  bottomText: jsonb("bottom_text"),
  textUpcharge: decimal("text_upcharge", { precision: 10, scale: 2 }).default("2.00"),
  landingOverlay: jsonb("landing_overlay"),
  templateVariant: text("template_variant").default("url"),
  externalUrl: text("external_url"),
  dynamicContentSetId: varchar("dynamic_content_set_id"),
  storeType: text("store_type"),
  storeName: text("store_name"),
  segment: text("segment"),
  isFeatured: boolean("is_featured").default(false),
  isSeasonalPromo: boolean("is_seasonal_promo").default(false),
  qrCodeUrl: text("qr_code_url"),
  printifyCompositeUrl: text("printify_composite_url"),
  savedToLibrary: boolean("saved_to_library").default(false),
  savedToStore: boolean("saved_to_store").default(false),
  visibility: text("visibility").default("private"),
  templateName: text("template_name"),
  templateCategory: text("template_category"),
  templateSubcategory: text("template_subcategory"),
  ownerUserId: varchar("owner_user_id").references(() => users.id),
  campaignName: text("campaign_name"),
  blueprintId: integer("blueprint_id"),
  printProviderId: integer("print_provider_id"),
  printifyProductId: text("printify_product_id"),
  printReadyArtUrl: text("print_ready_art_url"),
  selectedColors: text("selected_colors").array(),
  defaultColor: text("default_color"),
  mockupsByColor: jsonb("mockups_by_color"),
  graphicsConfig: jsonb("graphics_config"),
  selectedVariantIds: jsonb("selected_variant_ids"),
  publishStatus: text("publish_status").default("draft"),
  publishError: text("publish_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type GraphicPlacement = 'front' | 'back' | 'left_sleeve' | 'right_sleeve' | 'pocket';
export type QRSize = 'small' | 'medium' | 'large';

export interface GraphicConfig {
  id: string;
  imageUrl: string;
  placement: GraphicPlacement;
  qrSize: QRSize;
  artworkVariant?: 'black' | 'white';
}

export const graphicSets = pgTable("graphic_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  categoryId: varchar("category_id").references(() => templateCategories.id),
  subcategoryId: varchar("subcategory_id").references(() => templateCategories.id),
  fullGraphicUrl: text("full_graphic_url"),
  qrOnlyUrl: text("qr_only_url"),
  destinationUrl: text("destination_url"),
  storagePath: text("storage_path"),
  tags: text("tags").array(),
  isActive: boolean("is_active").default(true),
  isFeatured: boolean("is_featured").default(false),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const qrDesigns = pgTable("qr_designs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  qrType: text("qr_type").notNull(),
  qrContent: text("qr_content").notNull(),
  qrStyle: jsonb("qr_style").notNull(),
  productId: text("product_id"),
  placement: text("placement").notNull(),
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

export const browsingHistory = pgTable("browsing_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  productId: varchar("product_id").notNull().references(() => products.id),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});

export const dynamicContentSets = pgTable("dynamic_content_sets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  scheduleType: text("schedule_type").notNull().default("daily"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  loopBehavior: text("loop_behavior").default("stop"),
  totalSlots: integer("total_slots").default(0),
  userId: varchar("user_id").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const dynamicContentSlots = pgTable("dynamic_content_slots", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  contentSetId: varchar("content_set_id").notNull().references(() => dynamicContentSets.id, { onDelete: "cascade" }),
  slotNumber: integer("slot_number").notNull(),
  title: text("title"),
  description: text("description"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  linkUrl: text("link_url"),
  linkText: text("link_text"),
  textColor: text("text_color").default("#ffffff"),
  overlayPosition: text("overlay_position").default("bottom"),
  fontFamily: text("font_family").default("Inter"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const printifyBlueprints = pgTable("printify_blueprints", {
  id: integer("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  brand: text("brand"),
  model: text("model"),
  images: text("images").array(),
  primaryImageUrl: text("primary_image_url"),
  category: text("category"),
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
  minCost: integer("min_cost"),
  maxCost: integer("max_cost"),
  availableColors: jsonb("available_colors"),
  availableSizes: text("available_sizes").array(),
  placeholderProductId: text("placeholder_product_id"),
  costsFetchedAt: timestamp("costs_fetched_at"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
});

export const printifyCatalogSync = pgTable("printify_catalog_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  syncType: text("sync_type").notNull(),
  status: text("status").notNull(),
  blueprintsCount: integer("blueprints_count").default(0),
  providersCount: integer("providers_count").default(0),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const printifyCostSync = pgTable("printify_cost_sync", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  status: text("status").notNull(),
  totalProviders: integer("total_providers").default(0),
  processedCount: integer("processed_count").default(0),
  successCount: integer("success_count").default(0),
  failedCount: integer("failed_count").default(0),
  skippedCount: integer("skipped_count").default(0),
  lastProcessedProviderId: text("last_processed_provider_id"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const insertCustomDesignSchema = createInsertSchema(customDesigns).omit({ createdAt: true, updatedAt: true });
export const insertTemplateCategorySchema = createInsertSchema(templateCategories).omit({ id: true, createdAt: true });
export const insertGraphicSetSchema = createInsertSchema(graphicSets).omit({ id: true, usageCount: true, createdAt: true, updatedAt: true });
export const insertProductSchema = createInsertSchema(products).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertQrDesignSchema = createInsertSchema(qrDesigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBrowsingHistorySchema = createInsertSchema(browsingHistory).omit({
  id: true,
  viewedAt: true,
});
export const insertProductVariantSchema = createInsertSchema(productVariants).omit({
  id: true,
});
export const insertQrTemplateSchema = createInsertSchema(qrTemplates).omit({
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
export const insertDynamicContentSetSchema = createInsertSchema(dynamicContentSets).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertDynamicContentSlotSchema = createInsertSchema(dynamicContentSlots).omit({
  id: true,
  createdAt: true,
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

export type InsertCustomDesign = z.infer<typeof insertCustomDesignSchema>;
export type CustomDesign = typeof customDesigns.$inferSelect;
export type InsertTemplateCategory = z.infer<typeof insertTemplateCategorySchema>;
export type TemplateCategory = typeof templateCategories.$inferSelect;
export type InsertGraphicSet = z.infer<typeof insertGraphicSetSchema>;
export type GraphicSet = typeof graphicSets.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type QrDesign = typeof qrDesigns.$inferSelect;
export type InsertQrDesign = z.infer<typeof insertQrDesignSchema>;
export type BrowsingHistory = typeof browsingHistory.$inferSelect;
export type InsertBrowsingHistory = z.infer<typeof insertBrowsingHistorySchema>;
export type ProductVariant = typeof productVariants.$inferSelect;
export type InsertProductVariant = z.infer<typeof insertProductVariantSchema>;
export type QrTemplate = typeof qrTemplates.$inferSelect;
export type InsertQrTemplate = z.infer<typeof insertQrTemplateSchema>;
export type LibraryAsset = typeof libraryAssets.$inferSelect;
export type InsertLibraryAsset = z.infer<typeof insertLibraryAssetSchema>;
export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type ProductCategoryAssignment = typeof productCategoryAssignments.$inferSelect;
export type InsertProductCategoryAssignment = z.infer<typeof insertProductCategoryAssignmentSchema>;
export type DynamicContentSet = typeof dynamicContentSets.$inferSelect;
export type InsertDynamicContentSet = z.infer<typeof insertDynamicContentSetSchema>;
export type DynamicContentSlot = typeof dynamicContentSlots.$inferSelect;
export type InsertDynamicContentSlot = z.infer<typeof insertDynamicContentSlotSchema>;
export type PrintifyBlueprint = typeof printifyBlueprints.$inferSelect;
export type InsertPrintifyBlueprint = z.infer<typeof insertPrintifyBlueprintSchema>;
export type PrintifyPrintProvider = typeof printifyPrintProviders.$inferSelect;
export type InsertPrintifyPrintProvider = z.infer<typeof insertPrintifyPrintProviderSchema>;
export type PrintifyCatalogSync = typeof printifyCatalogSync.$inferSelect;
export type InsertPrintifyCatalogSync = z.infer<typeof insertPrintifyCatalogSyncSchema>;
export type PrintifyCostSync = typeof printifyCostSync.$inferSelect;
export type InsertPrintifyCostSync = z.infer<typeof insertPrintifyCostSyncSchema>;
