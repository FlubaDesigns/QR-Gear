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
  HostingReminder,
  InsertHostingReminder,
  BrowsingHistory,
  InsertBrowsingHistory,
  PricingRule,
  InsertPricingRule,
  AdminSettings,
  InsertAdminSettings,
  HostingTier,
  InsertHostingTier,
  Coupon,
  InsertCoupon,
  QrTemplate,
  InsertQrTemplate,
  DynamicPage,
  InsertDynamicPage,
  DynamicPageAsset,
  InsertDynamicPageAsset,
  ProductCategory,
  InsertProductCategory,
  ProductCategoryAssignment,
  InsertProductCategoryAssignment,
  PartnerStore,
  InsertPartnerStore,
  PartnerStoreProduct,
  InsertPartnerStoreProduct,
  ProductVariant,
  InsertProductVariant,
  PrintifyBlueprint,
  InsertPrintifyBlueprint,
  PrintifyPrintProvider,
  InsertPrintifyPrintProvider,
  PrintifyCatalogSync,
  InsertPrintifyCatalogSync,
  PrintifyCostSync,
  InsertPrintifyCostSync,
  CustomDesign,
  InsertCustomDesign,
  LibraryAsset,
  InsertLibraryAsset,
  MasterProduct,
  InsertMasterProduct,
  ProductDesignVersion,
  InsertProductDesignVersion,
  ChannelConfig,
  InsertChannelConfig,
  ChannelPublishState,
  InsertChannelPublishState,
  ProviderHealthLog,
  InsertProviderHealthLog,
  GiftPackage,
  InsertGiftPackage,
  GiftCode,
  InsertGiftCode,
  GiftRedemption,
  InsertGiftRedemption,
  TemplateCategory,
  InsertTemplateCategory,
  GraphicSet,
  InsertGraphicSet,
  OrderUnified,
  InsertOrderUnified,
  EmailTemplate,
  InsertEmailTemplate,
  EmailLog,
} from "@shared/schema";

import { userMethods } from "./storage/storage-users";
import { productMethods } from "./storage/storage-products";
import { orderMethods } from "./storage/storage-orders";
import { storeMethods } from "./storage/storage-stores";
import { catalogMethods } from "./storage/storage-catalog";
import { miscMethods } from "./storage/storage-misc";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;

  getBrowsingHistory(userId: string): Promise<BrowsingHistory[]>;
  addBrowsingHistory(entry: InsertBrowsingHistory): Promise<BrowsingHistory>;
  clearBrowsingHistory(userId: string): Promise<void>;

  getQrDesign(id: string): Promise<QrDesign | undefined>;
  getQrDesignsByUser(userId: string): Promise<QrDesign[]>;
  getPublicGalleryDesigns(): Promise<QrDesign[]>;
  createQrDesign(design: InsertQrDesign): Promise<QrDesign>;
  updateQrDesign(id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined>;
  deleteQrDesign(id: string): Promise<void>;

  getProduct(id: string): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<void>;

  getCartItemsByUser(userId: string): Promise<CartItem[]>;
  addCartItem(item: InsertCartItem): Promise<CartItem>;
  updateCartItem(id: string, quantity: number): Promise<CartItem | undefined>;
  deleteCartItem(id: string): Promise<void>;
  clearCart(userId: string): Promise<void>;

  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  getOrdersByStatus(status: string): Promise<Order[]>;
  getOrderByStripeSession(sessionId: string): Promise<Order | undefined>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, order: Partial<InsertOrder>): Promise<Order | undefined>;

  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(item: InsertOrderItem): Promise<OrderItem>;

  getHostedImage(id: string): Promise<HostedImage | undefined>;
  getHostedImagesByUser(userId: string): Promise<HostedImage[]>;
  getAllHostedImages(): Promise<HostedImage[]>;
  createHostedImage(image: InsertHostedImage): Promise<HostedImage>;
  updateHostedImage(id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined>;
  incrementImageViews(id: string): Promise<void>;
  deleteHostedImage(id: string): Promise<void>;

  getHostingReminderByImageAndDays(imageId: string, daysRemaining: number): Promise<HostingReminder | undefined>;
  createHostingReminder(reminder: InsertHostingReminder): Promise<HostingReminder>;

  getAdminSettings(): Promise<AdminSettings | undefined>;
  upsertAdminSettings(settings: InsertAdminSettings): Promise<AdminSettings>;

  getPricingRules(): Promise<PricingRule[]>;
  getPricingRule(id: string): Promise<PricingRule | undefined>;
  createPricingRule(rule: InsertPricingRule): Promise<PricingRule>;
  updatePricingRule(id: string, rule: Partial<InsertPricingRule>): Promise<PricingRule | undefined>;
  deletePricingRule(id: string): Promise<void>;

  getEnabledProducts(): Promise<Product[]>;
  toggleProductEnabled(id: string, enabled: boolean): Promise<Product | undefined>;

  getHostingTiers(): Promise<HostingTier[]>;
  getHostingTier(id: string): Promise<HostingTier | undefined>;
  getHostingTierByCode(code: string): Promise<HostingTier | undefined>;
  createHostingTier(tier: InsertHostingTier): Promise<HostingTier>;
  updateHostingTier(id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined>;
  deleteHostingTier(id: string): Promise<void>;

  getCoupons(): Promise<Coupon[]>;
  getActiveCoupons(): Promise<Coupon[]>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, coupon: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<void>;
  incrementCouponRedemption(id: string): Promise<void>;

  getQrTemplates(): Promise<QrTemplate[]>;
  getActiveQrTemplates(): Promise<QrTemplate[]>;
  getQrTemplate(id: string): Promise<QrTemplate | undefined>;
  createQrTemplate(template: InsertQrTemplate): Promise<QrTemplate>;
  updateQrTemplate(id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined>;
  deleteQrTemplate(id: string): Promise<void>;

  getDynamicPage(id: string): Promise<DynamicPage | undefined>;
  getDynamicPageBySlug(slug: string): Promise<DynamicPage | undefined>;
  getDynamicPagesByUser(userId: string): Promise<DynamicPage[]>;
  createDynamicPage(page: InsertDynamicPage): Promise<DynamicPage>;
  updateDynamicPage(id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined>;
  deleteDynamicPage(id: string): Promise<void>;
  incrementDynamicPageViews(id: string): Promise<void>;

  getDynamicPageAsset(id: string): Promise<DynamicPageAsset | undefined>;
  getDynamicPageAssets(pageId: string): Promise<DynamicPageAsset[]>;
  createDynamicPageAsset(asset: InsertDynamicPageAsset): Promise<DynamicPageAsset>;
  updateDynamicPageAsset(id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined>;
  deleteDynamicPageAsset(id: string): Promise<void>;
  setActiveAsset(pageId: string, assetId: string): Promise<void>;

  getProductCategories(): Promise<ProductCategory[]>;
  getAllProductCategories(): Promise<ProductCategory[]>;
  getActiveProductCategories(): Promise<ProductCategory[]>;
  getProductCategoriesByTaxonomy(taxonomyType: string): Promise<ProductCategory[]>;
  getProductCategory(id: string): Promise<ProductCategory | undefined>;
  createProductCategory(category: InsertProductCategory): Promise<ProductCategory>;
  updateProductCategory(id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined>;
  deleteProductCategory(id: string): Promise<void>;

  getProductCategoryAssignments(productId: string): Promise<ProductCategoryAssignment[]>;
  getProductsByCategory(categoryId: string): Promise<Product[]>;
  assignProductToCategory(assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment>;
  removeProductFromCategory(productId: string, categoryId: string): Promise<void>;
  syncProductCategories(productId: string, categoryIds: string[]): Promise<void>;

  getPartnerStores(): Promise<PartnerStore[]>;
  getPartnerStore(id: string): Promise<PartnerStore | undefined>;
  getPartnerStoreBySlug(slug: string): Promise<PartnerStore | undefined>;
  createPartnerStore(store: InsertPartnerStore): Promise<PartnerStore>;
  updatePartnerStore(id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined>;
  deletePartnerStore(id: string): Promise<void>;

  getPartnerStoreProducts(partnerStoreId: string): Promise<PartnerStoreProduct[]>;
  getPartnerStoreProduct(partnerStoreId: string, productId: string): Promise<PartnerStoreProduct | undefined>;
  getProductsForStore(storeSlug: string, segment?: string): Promise<Product[]>;
  addPartnerStoreProduct(product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct>;
  updatePartnerStoreProduct(id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined>;
  updatePartnerStoreProductByIds(partnerStoreId: string, productId: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined>;
  removePartnerStoreProduct(id: string): Promise<void>;
  syncPartnerStoreProducts(partnerStoreId: string, productIds: string[]): Promise<void>;

  getProductVariants(productId: string): Promise<ProductVariant[]>;
  upsertProductVariant(variant: InsertProductVariant): Promise<ProductVariant>;
  toggleVariantEnabled(id: string, enabled: boolean): Promise<ProductVariant | undefined>;

  getPrintifyBlueprints(): Promise<PrintifyBlueprint[]>;
  getPrintifyBlueprint(id: number): Promise<PrintifyBlueprint | undefined>;
  upsertPrintifyBlueprint(blueprint: InsertPrintifyBlueprint): Promise<PrintifyBlueprint>;
  deletePrintifyBlueprint(id: number): Promise<void>;
  clearPrintifyBlueprints(): Promise<void>;
  
  getAllPrintifyProviders(): Promise<PrintifyPrintProvider[]>;
  getPrintifyPrintProviders(blueprintId: number): Promise<PrintifyPrintProvider[]>;
  getPrintifyPrintProvider(blueprintId: number, providerId: number): Promise<PrintifyPrintProvider | undefined>;
  upsertPrintifyPrintProvider(provider: InsertPrintifyPrintProvider): Promise<PrintifyPrintProvider>;
  updatePrintifyProviderCosts(blueprintId: number, providerId: number, costs: { minCost: number; maxCost: number; placeholderProductId?: string; availableColors?: any[]; availableSizes?: string[] }): Promise<PrintifyPrintProvider | undefined>;
  updateProductPricesByProvider(blueprintId: number, providerId: number, basePrice: string): Promise<number>;
  deletePrintifyPrintProvidersByBlueprint(blueprintId: number): Promise<void>;
  clearPrintifyPrintProviders(): Promise<void>;
  
  createCatalogSync(sync: InsertPrintifyCatalogSync): Promise<PrintifyCatalogSync>;
  updateCatalogSync(id: string, sync: Partial<InsertPrintifyCatalogSync>): Promise<PrintifyCatalogSync | undefined>;
  getLatestCatalogSync(): Promise<PrintifyCatalogSync | undefined>;
  getCatalogSyncHistory(): Promise<PrintifyCatalogSync[]>;

  createCostSync(sync: InsertPrintifyCostSync): Promise<PrintifyCostSync>;
  updateCostSync(id: string, sync: Partial<InsertPrintifyCostSync>): Promise<PrintifyCostSync | undefined>;
  getLatestCostSync(): Promise<PrintifyCostSync | undefined>;
  getActiveCostSync(): Promise<PrintifyCostSync | undefined>;
  getCostSyncHistory(): Promise<PrintifyCostSync[]>;
  getProviderCostStats(): Promise<{ total: number; withCosts: number; stale: number }>;

  getCustomDesign(id: string): Promise<CustomDesign | undefined>;
  getCustomDesigns(): Promise<CustomDesign[]>;
  getCustomDesignsForLibrary(): Promise<CustomDesign[]>;
  getCustomDesignsByStoreSegment(storeType: string, storeName: string, segment?: string): Promise<CustomDesign[]>;
  createCustomDesign(design: InsertCustomDesign): Promise<CustomDesign>;
  updateCustomDesign(id: string, design: Partial<InsertCustomDesign>): Promise<CustomDesign | undefined>;
  deleteCustomDesign(id: string): Promise<void>;

  getTemplateCategories(): Promise<TemplateCategory[]>;
  getTemplateCategoriesByParent(parentId: string | null): Promise<TemplateCategory[]>;
  createTemplateCategory(category: InsertTemplateCategory): Promise<TemplateCategory>;
  updateTemplateCategory(id: string, category: Partial<InsertTemplateCategory>): Promise<TemplateCategory | undefined>;
  deleteTemplateCategory(id: string): Promise<void>;

  getGraphicSets(): Promise<GraphicSet[]>;
  getGraphicSet(id: string): Promise<GraphicSet | undefined>;
  getGraphicSetsByCategory(categoryId: string): Promise<GraphicSet[]>;
  createGraphicSet(graphicSet: InsertGraphicSet): Promise<GraphicSet>;
  updateGraphicSet(id: string, graphicSet: Partial<InsertGraphicSet>): Promise<GraphicSet | undefined>;
  deleteGraphicSet(id: string): Promise<void>;
  incrementGraphicSetUsage(id: string): Promise<void>;

  getLibraryAsset(id: string): Promise<LibraryAsset | undefined>;
  getLibraryAssetByUrl(url: string): Promise<LibraryAsset | undefined>;
  getLibraryAssets(filters?: { ownerType?: string; assetType?: string; mediaType?: string; userId?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]>;
  getAdminLibraryAssets(filters?: { assetType?: string; mediaType?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]>;
  getUserLibraryAssets(userId: string, filters?: { assetType?: string; mediaType?: string }): Promise<LibraryAsset[]>;
  createLibraryAsset(asset: InsertLibraryAsset): Promise<LibraryAsset>;
  updateLibraryAsset(id: string, asset: Partial<InsertLibraryAsset>): Promise<LibraryAsset | undefined>;
  deleteLibraryAsset(id: string): Promise<void>;
  incrementLibraryAssetUsage(id: string): Promise<void>;

  getAllMasterProducts(): Promise<MasterProduct[]>;
  getMasterProduct(id: string): Promise<MasterProduct | undefined>;
  createMasterProduct(product: InsertMasterProduct): Promise<MasterProduct>;
  updateMasterProduct(id: string, product: Partial<InsertMasterProduct>): Promise<MasterProduct | undefined>;
  deleteMasterProduct(id: string): Promise<void>;

  getDesignVersions(masterProductId: string): Promise<ProductDesignVersion[]>;
  getActiveDesignVersion(masterProductId: string): Promise<ProductDesignVersion | undefined>;
  createDesignVersion(version: InsertProductDesignVersion): Promise<ProductDesignVersion>;
  updateDesignVersion(id: string, version: Partial<InsertProductDesignVersion>): Promise<ProductDesignVersion | undefined>;

  getAllChannelConfigs(): Promise<ChannelConfig[]>;
  getChannelConfig(channelType: string): Promise<ChannelConfig | undefined>;
  createChannelConfig(config: InsertChannelConfig): Promise<ChannelConfig>;
  updateChannelConfig(channelType: string, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined>;

  getPublishStates(masterProductId: string): Promise<ChannelPublishState[]>;
  getPublishState(masterProductId: string, channelType: string): Promise<ChannelPublishState | undefined>;
  upsertPublishState(state: InsertChannelPublishState): Promise<ChannelPublishState>;

  getUsers(): Promise<User[]>;
  getOrders(): Promise<OrderUnified[]>;
  getOrderUnified(id: string): Promise<OrderUnified | undefined>;
  createOrderUnified(order: InsertOrderUnified): Promise<OrderUnified>;
  updateOrderUnified(id: string, order: Partial<InsertOrderUnified>): Promise<OrderUnified | undefined>;
  getProducts(): Promise<Product[]>;

  getAllPrintfulProducts(): Promise<any[]>;
  getAllPrintfulVariants(): Promise<any[]>;

  logProviderHealth(log: InsertProviderHealthLog): Promise<ProviderHealthLog>;
  getProviderHealthLogs(limit?: number): Promise<ProviderHealthLog[]>;
  getProviderHealthLogsByType(providerType: string, limit?: number): Promise<ProviderHealthLog[]>;
  getLatestProviderHealth(providerType: string): Promise<ProviderHealthLog | undefined>;
  getAllLatestProviderHealth(): Promise<ProviderHealthLog[]>;
  getProviderHealthStats(providerType: string, hours?: number): Promise<{ uptimePercent: number; avgResponseTime: number; totalChecks: number }>;

  getAllGiftPackages(): Promise<GiftPackage[]>;
  getActiveGiftPackages(): Promise<GiftPackage[]>;
  getGiftPackage(id: string): Promise<GiftPackage | undefined>;
  createGiftPackage(pkg: InsertGiftPackage): Promise<GiftPackage>;
  updateGiftPackage(id: string, pkg: Partial<InsertGiftPackage>): Promise<GiftPackage | undefined>;
  deleteGiftPackage(id: string): Promise<void>;

  getGiftCode(id: string): Promise<GiftCode | undefined>;
  getGiftCodeByCode(code: string): Promise<GiftCode | undefined>;
  getGiftCodesByBuyer(buyerUserId: string): Promise<GiftCode[]>;
  createGiftCode(code: InsertGiftCode): Promise<GiftCode>;
  updateGiftCode(id: string, code: Partial<InsertGiftCode>): Promise<GiftCode | undefined>;

  getGiftRedemption(id: string): Promise<GiftRedemption | undefined>;
  getGiftRedemptionByCode(giftCodeId: string): Promise<GiftRedemption | undefined>;
  getGiftRedemptionsByRecipient(recipientEmail: string): Promise<GiftRedemption[]>;
  createGiftRedemption(redemption: InsertGiftRedemption): Promise<GiftRedemption>;
  updateGiftRedemption(id: string, redemption: Partial<InsertGiftRedemption>): Promise<GiftRedemption | undefined>;

  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplate(id: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateByTrigger(trigger: string): Promise<EmailTemplate | undefined>;
  createEmailTemplate(template: InsertEmailTemplate): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined>;
  deleteEmailTemplate(id: string): Promise<void>;

  getEmailLogs(limit?: number): Promise<EmailLog[]>;
  logEmail(log: Omit<EmailLog, 'id' | 'sentAt'>): Promise<EmailLog>;
}


class MemStorage {
  users = new Map<string, User>();
  qrDesigns = new Map<string, QrDesign>();
  products = new Map<string, Product>();
  cartItems = new Map<string, CartItem>();
  orders = new Map<string, Order>();
  orderItems = new Map<string, OrderItem>();
  ordersUnified = new Map<string, OrderUnified>();
  hostedImages = new Map<string, HostedImage>();
  browsingHistory = new Map<string, BrowsingHistory>();
  adminSettings: AdminSettings | undefined;
  pricingRules = new Map<string, PricingRule>();
  partnerStores = new Map<string, PartnerStore>();
  partnerStoreProducts = new Map<string, PartnerStoreProduct>();
  providerHealthLogs: ProviderHealthLog[] = [];
  hostingReminders = new Map<string, HostingReminder>();
  hostingTiers = new Map<string, HostingTier>();
  qrTemplates = new Map<string, QrTemplate>();
  dynamicPages = new Map<string, DynamicPage>();
  dynamicPageAssets = new Map<string, DynamicPageAsset>();
  productCategories = new Map<string, ProductCategory>();
  productCategoryAssignments = new Map<string, ProductCategoryAssignment>();
  productVariants = new Map<string, ProductVariant>();
  printifyBlueprints = new Map<number, PrintifyBlueprint>();
  printifyPrintProviders = new Map<string, PrintifyPrintProvider>();
  catalogSyncs: PrintifyCatalogSync[] = [];
  costSyncs: PrintifyCostSync[] = [];
  customDesigns = new Map<string, CustomDesign>();
  templateCategories = new Map<string, TemplateCategory>();
  graphicSets = new Map<string, GraphicSet>();
  libraryAssets = new Map<string, LibraryAsset>();
  orchestrationMasterProducts = new Map<string, MasterProduct>();
  orchestrationDesignVersions = new Map<string, ProductDesignVersion>();
  orchestrationChannelConfigs = new Map<string, ChannelConfig>();
  orchestrationPublishStates = new Map<string, ChannelPublishState>();
  giftPackages = new Map<string, GiftPackage>();
  giftCodes = new Map<string, GiftCode>();
  giftRedemptions = new Map<string, GiftRedemption>();
  couponsMap = new Map<string, Coupon>();
  emailTemplates = new Map<string, EmailTemplate>();
  emailLogs: EmailLog[] = [];
}

Object.assign(
  MemStorage.prototype,
  userMethods,
  productMethods,
  orderMethods,
  storeMethods,
  catalogMethods,
  miscMethods,
);

const baseStorage: IStorage = new MemStorage() as unknown as IStorage;

let wrappedStorage: IStorage | null = null;
let storageInitialized = false;
let initPromise: Promise<IStorage> | null = null;

export async function initializeWrappedStorage(): Promise<IStorage> {
  if (wrappedStorage && storageInitialized) {
    return wrappedStorage;
  }
  
  if (initPromise) {
    return initPromise;
  }
  
  initPromise = (async () => {
    const mode = process.env.STORAGE_MODE || 'firestore-only';
    console.log(`[Storage] Initializing with mode: ${mode}`);
    
    try {
      const { FirestoreAdapter } = await import('./lib/firestore-adapter');
      wrappedStorage = new FirestoreAdapter();
      console.log('[Storage] Firestore-only mode enabled');
    } catch (error) {
      console.error('[Storage] Failed to initialize firestore-only mode:', error);
      wrappedStorage = baseStorage;
    }
    
    storageInitialized = true;
    return wrappedStorage;
  })();
  
  return initPromise;
}

export function isStorageReady(): boolean {
  return storageInitialized;
}

export function getStorageMode(): string {
  return process.env.STORAGE_MODE || 'firestore-only';
}

export const storage: IStorage = new Proxy(baseStorage, {
  get(target, prop, receiver) {
    const actualStorage = wrappedStorage || target;
    const value = Reflect.get(actualStorage, prop, actualStorage);
    if (typeof value === 'function') {
      return value.bind(actualStorage);
    }
    return value;
  }
});
