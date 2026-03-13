import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, decimal, timestamp, integer, boolean, unique, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { products } from "./schema-products";

export const canonicalPlacements = pgTable("canonical_placements", {
  id: varchar("id").primaryKey(),
  label: text("label").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  previewX: decimal("preview_x", { precision: 5, scale: 3 }).default("0.5"),
  previewY: decimal("preview_y", { precision: 5, scale: 3 }).default("0.4"),
  previewScale: decimal("preview_scale", { precision: 5, scale: 3 }).default("0.3"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const podProviders = pgTable("pod_providers", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  websiteUrl: text("website_url"),
  apiBaseUrl: text("api_base_url"),
  supportsWhiteLabel: boolean("supports_white_label").default(false),
  supportsRush: boolean("supports_rush").default(false),
  averageShipDays: integer("average_ship_days"),
  isActive: boolean("is_active").default(true),
  healthStatus: text("health_status").default("unknown"),
  lastHealthCheck: timestamp("last_health_check"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const providerPlacementMappings = pgTable("provider_placement_mappings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  podProviderId: varchar("pod_provider_id").notNull().references(() => podProviders.id),
  canonicalPlacementId: varchar("canonical_placement_id").notNull().references(() => canonicalPlacements.id),
  providerPlacementKey: text("provider_placement_key").notNull(),
  overrideX: decimal("override_x", { precision: 5, scale: 3 }),
  overrideY: decimal("override_y", { precision: 5, scale: 3 }),
  overrideScale: decimal("override_scale", { precision: 5, scale: 3 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("provider_placement_unique").on(table.podProviderId, table.providerPlacementKey),
]);

export const productPlacementAvailability = pgTable("product_placement_availability", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull().references(() => products.id),
  canonicalPlacementId: varchar("canonical_placement_id").notNull().references(() => canonicalPlacements.id),
  artworkBlackUrl: text("artwork_black_url"),
  artworkWhiteUrl: text("artwork_white_url"),
  isPrimary: boolean("is_primary").default(false),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("product_placement_unique").on(table.productId, table.canonicalPlacementId),
]);

export const mockupCache = pgTable("mockup_cache", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").references(() => products.id),
  blueprintId: integer("blueprint_id"),
  printProviderId: integer("print_provider_id"),
  colorName: text("color_name").notNull(),
  colorHex: text("color_hex"),
  canonicalPlacementId: varchar("canonical_placement_id").references(() => canonicalPlacements.id),
  qrSize: text("qr_size").notNull().default("medium"),
  artworkUrl: text("artwork_url"),
  artworkVariant: text("artwork_variant").default("black"),
  mockupUrl: text("mockup_url").notNull(),
  mockupUrlHq: text("mockup_url_hq"),
  lifestyleMockupUrl: text("lifestyle_mockup_url"),
  podProviderId: varchar("pod_provider_id").references(() => podProviders.id),
  providerMockupId: text("provider_mockup_id"),
  status: text("status").default("active"),
  generatedAt: timestamp("generated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  unique("mockup_cache_unique_v2").on(
    table.blueprintId, 
    table.printProviderId, 
    table.colorName, 
    table.canonicalPlacementId, 
    table.artworkVariant,
    table.qrSize
  ),
]);

export const printifyPrintfulMapping = pgTable("printify_printful_mapping", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  printifyBlueprintId: integer("printify_blueprint_id").notNull(),
  printifyPrintProviderId: integer("printify_print_provider_id"),
  printifyBrand: text("printify_brand"),
  printifyModel: text("printify_model"),
  printfulProductId: integer("printful_product_id").notNull(),
  printfulBrand: text("printful_brand"),
  printfulModel: text("printful_model"),
  placementMapping: jsonb("placement_mapping"),
  colorMapping: jsonb("color_mapping"),
  isActive: boolean("is_active").default(true),
  matchConfidence: text("match_confidence").default("auto"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  unique("printify_printful_unique").on(table.printifyBlueprintId, table.printifyPrintProviderId),
]);

export const printfulProducts = pgTable("printful_products", {
  id: integer("id").primaryKey(),
  type: text("type").notNull(),
  typeName: text("type_name").notNull(),
  brand: text("brand"),
  model: text("model"),
  title: text("title").notNull(),
  image: text("image"),
  variantCount: integer("variant_count").default(0),
  currency: text("currency").default("USD"),
  minPrice: decimal("min_price", { precision: 10, scale: 2 }),
  maxPrice: decimal("max_price", { precision: 10, scale: 2 }),
  printfileWidth: integer("printfile_width"),
  printfileHeight: integer("printfile_height"),
  printfileDpi: integer("printfile_dpi"),
  description: text("description"),
  avgFulfillmentTime: integer("avg_fulfillment_time"),
  originCountry: text("origin_country"),
  isDiscontinued: boolean("is_discontinued").default(false),
  availablePlacements: text("available_placements").array(),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const printfulVariants = pgTable("printful_variants", {
  id: integer("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => printfulProducts.id),
  name: text("name").notNull(),
  size: text("size"),
  color: text("color"),
  colorCode: text("color_code"),
  colorCode2: text("color_code2"),
  image: text("image"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  inStock: boolean("in_stock").default(true),
  availabilityStatus: text("availability_status"),
  lastSyncedAt: timestamp("last_synced_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("printful_variants_product_idx").on(table.productId),
  index("printful_variants_color_idx").on(table.color),
]);

export const mockupJobs = pgTable("mockup_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  productId: varchar("product_id").notNull(),
  colorName: text("color_name").notNull(),
  qrSize: text("qr_size").notNull().default("medium"),
  placement: text("placement").notNull().default("front"),
  jobData: jsonb("job_data").notNull(),
  status: text("status").notNull().default("pending"),
  priority: integer("priority").default(10),
  attempts: integer("attempts").default(0),
  maxAttempts: integer("max_attempts").default(5),
  priorityUpdatedAt: timestamp("priority_updated_at"),
  priorityOwner: varchar("priority_owner"),
  priorityExpiresAt: timestamp("priority_expires_at"),
  resultData: jsonb("result_data"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  nextRetryAt: timestamp("next_retry_at"),
}, (table) => [
  index("mockup_jobs_status_idx").on(table.status),
  index("mockup_jobs_product_idx").on(table.productId),
  index("mockup_jobs_next_retry_idx").on(table.nextRetryAt),
  index("mockup_jobs_priority_idx").on(table.priority, table.priorityUpdatedAt),
  index("mockup_jobs_lookup_idx").on(table.productId, table.colorName, table.qrSize, table.placement),
]);

export const insertCanonicalPlacementSchema = createInsertSchema(canonicalPlacements).omit({ createdAt: true });
export const insertPodProviderSchema = createInsertSchema(podProviders).omit({ createdAt: true, updatedAt: true });
export const insertProviderPlacementMappingSchema = createInsertSchema(providerPlacementMappings).omit({ id: true, createdAt: true });
export const insertProductPlacementAvailabilitySchema = createInsertSchema(productPlacementAvailability).omit({ id: true, createdAt: true });
export const insertMockupCacheSchema = createInsertSchema(mockupCache).omit({ id: true, createdAt: true });
export const insertPrintifyPrintfulMappingSchema = createInsertSchema(printifyPrintfulMapping).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPrintfulProductSchema = createInsertSchema(printfulProducts).omit({ createdAt: true });
export const insertPrintfulVariantSchema = createInsertSchema(printfulVariants).omit({ createdAt: true });
export const insertMockupJobSchema = createInsertSchema(mockupJobs).omit({ id: true, createdAt: true });

export type CanonicalPlacement = typeof canonicalPlacements.$inferSelect;
export type InsertCanonicalPlacement = z.infer<typeof insertCanonicalPlacementSchema>;
export type PodProvider = typeof podProviders.$inferSelect;
export type InsertPodProvider = z.infer<typeof insertPodProviderSchema>;
export type ProviderPlacementMapping = typeof providerPlacementMappings.$inferSelect;
export type InsertProviderPlacementMapping = z.infer<typeof insertProviderPlacementMappingSchema>;
export type ProductPlacementAvailability = typeof productPlacementAvailability.$inferSelect;
export type InsertProductPlacementAvailability = z.infer<typeof insertProductPlacementAvailabilitySchema>;
export type MockupCache = typeof mockupCache.$inferSelect;
export type InsertMockupCache = z.infer<typeof insertMockupCacheSchema>;
export type PrintifyPrintfulMapping = typeof printifyPrintfulMapping.$inferSelect;
export type InsertPrintifyPrintfulMapping = z.infer<typeof insertPrintifyPrintfulMappingSchema>;
export type PrintfulProduct = typeof printfulProducts.$inferSelect;
export type InsertPrintfulProduct = z.infer<typeof insertPrintfulProductSchema>;
export type PrintfulVariant = typeof printfulVariants.$inferSelect;
export type InsertPrintfulVariant = z.infer<typeof insertPrintfulVariantSchema>;
export type MockupJob = typeof mockupJobs.$inferSelect;
export type InsertMockupJob = z.infer<typeof insertMockupJobSchema>;
