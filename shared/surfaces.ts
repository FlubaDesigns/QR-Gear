import type {
  MarketplacePlatform,
  SurfaceStatus,
  ListingStatus,
  SyncJobStatus,
  SyncJobAction,
  SyncLogLevel,
  BuilderHostStatus,
  BuilderProfileStatus,
  BuilderPlacementStatus,
  EmbedMode,
  BuilderSessionStatus,
  BuilderDraftStatus,
  PricingPolicyStatus,
  RevenueSplitStatus,
  BaseCostMode,
  MarginType,
  AffiliateBasis,
  RoundingMode,
  PayoutStatus,
} from '../functions/src/constants';

// ============ SURFACE (canonical outward-facing sellable object) ============
// Surface is the single source of truth for all outbound channels:
//   - Marketplace listings (Etsy/eBay/Amazon) reference surfaceId via MarketplaceListing
//   - External-sites / embedded builders reference surfaceId via BuilderProfile + BuilderPlacement
// Both pipelines read product data (title, images, price, variants) from the same Surface document.

export interface Surface {
  id: string;
  storeId?: string;
  channelId?: string;
  collectionId?: string;
  productId?: string;
  artifactId?: string;
  mosaicId?: string;
  masterProductId: string;
  title: string;
  subtitle?: string;
  description: string;
  bulletPoints?: string[];
  tags: string[];
  keywords?: string[];
  images: string[];
  mockupImages?: string[];
  retailPrice: number;
  compareAtPrice?: number;
  currency?: string;
  sku: string;
  defaultSkuPrefix?: string;
  enabledPlatforms: MarketplacePlatform[];
  supportsEmbedStore?: boolean;
  supportsEmbedProduct?: boolean;
  supportsEmbedBuilder?: boolean;
  supportsEtsy?: boolean;
  supportsEbay?: boolean;
  supportsAmazon?: boolean;
  status: SurfaceStatus;
  readinessScore?: number;
  readinessErrors: string[];
  isActive?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurfaceVariant {
  id: string;
  surfaceId: string;
  productVariantId?: string;
  size: string;
  color: string;
  colorHex?: string;
  sku: string;
  titleSuffix?: string;
  option1Name?: string;
  option1Value?: string;
  option2Name?: string;
  option2Value?: string;
  option3Name?: string;
  option3Value?: string;
  priceOverride?: number;
  availability?: string;
  enabled: boolean;
  inventoryQuantity: number;
  marketplaceOverrides?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ============ MARKETPLACE (publishing pipeline) ============

export interface MarketplaceAccount {
  id: string;
  platform: MarketplacePlatform;
  accountName: string;
  shopId: string;
  shopName: string;
  isActive: boolean;
  feePercent: number;
  apiKeyConfigured: boolean;
  lastHealthCheck?: string;
  healthStatus?: 'healthy' | 'unhealthy' | 'unknown';
  healthError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceListing {
  id: string;
  surfaceId: string;
  accountId: string;
  platform: MarketplacePlatform;
  externalListingId?: string;
  externalUrl?: string;
  status: ListingStatus;
  title: string;
  price: number;
  lastSyncAt?: string;
  lastSyncJobId?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceSyncJob {
  id: string;
  listingId: string;
  surfaceId: string;
  accountId: string;
  platform: MarketplacePlatform;
  action: SyncJobAction;
  status: SyncJobStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  completedAt?: string;
  errorMessage?: string;
  result?: {
    externalListingId?: string;
    externalUrl?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceSyncLog {
  id: string;
  jobId: string;
  listingId: string;
  accountId: string;
  platform: MarketplacePlatform;
  level: SyncLogLevel;
  message: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// ============ BUILDER HOST (external website owner / affiliate / partner) ============

export interface BuilderHost {
  id: string;
  name: string;
  ownerUserId?: string;
  storeId?: string;
  defaultBuilderProfileId?: string;
  defaultPricingPolicyId?: string;
  defaultRevenueSplitId?: string;
  allowedDomains: string[];
  contactEmail?: string;
  contactName?: string;
  notes?: string;
  status: BuilderHostStatus;
  createdAt: string;
  updatedAt: string;
}

// ============ BUILDER PROFILE (embedded experience ruleset) ============

export interface BuilderPermissionScope {
  allowHeaderText: boolean;
  allowHeaderImage: boolean;
  allowFooterText: boolean;
  allowFooterImage: boolean;
  allowCenterGraphic: boolean;
  allowQrModeSwitch: boolean;
  allowUpload: boolean;
  allowAssetLibrary: boolean;
  allowProductChange: boolean;
  allowVariantChange: boolean;
  allowSaveDraft: boolean;
  allowBuyNow: boolean;
}

export interface BuilderProfile {
  id: string;
  name: string;
  storeId?: string;
  surfaceId?: string;
  allowedProductIds: string[];
  allowedVariantIds: string[];
  permissions: BuilderPermissionScope;
  defaultTheme?: string;
  maxUploads?: number;
  status: BuilderProfileStatus;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_BUILDER_PERMISSIONS: BuilderPermissionScope = {
  allowHeaderText: true,
  allowHeaderImage: false,
  allowFooterText: true,
  allowFooterImage: false,
  allowCenterGraphic: true,
  allowQrModeSwitch: false,
  allowUpload: false,
  allowAssetLibrary: true,
  allowProductChange: false,
  allowVariantChange: true,
  allowSaveDraft: false,
  allowBuyNow: true,
};

// ============ BUILDER PLACEMENT (specific embedded instance) ============

export interface BuilderPlacement {
  id: string;
  builderHostId: string;
  builderProfileId?: string;
  surfaceId?: string;
  placementName: string;
  slug: string;
  domainHint?: string;
  campaignId?: string;
  pricingPolicyId?: string;
  revenueSplitId?: string;
  embedMode: EmbedMode;
  status: BuilderPlacementStatus;
  createdAt: string;
  updatedAt: string;
}

// ============ BUILDER SESSION (runtime session) ============

export interface BuilderSession {
  id: string;
  builderPlacementId: string;
  builderProfileId?: string;
  builderHostId: string;
  affiliateUserId?: string;
  surfaceId?: string;
  visitorId?: string;
  anonToken?: string;
  status: BuilderSessionStatus;
  currentSelections?: Record<string, unknown>;
  previewState?: Record<string, unknown>;
  startedAt: string;
  lastSeenAt: string;
  expiresAt?: string;
}

// ============ BUILDER DRAFT (saved in-progress config) ============

export interface BuilderDraft {
  id: string;
  builderSessionId?: string;
  builderPlacementId: string;
  builderProfileId?: string;
  builderHostId: string;
  affiliateUserId?: string;
  surfaceId?: string;
  draftPayload: Record<string, unknown>;
  status: BuilderDraftStatus;
  createdAt: string;
  updatedAt: string;
}

// ============ PRICING POLICY (canonical external pricing logic) ============

export interface PricingPolicy {
  id: string;
  name: string;
  storeId?: string;
  surfaceId?: string;
  currency: string;
  baseCostMode: BaseCostMode;
  baseRetailPrice?: number;
  platformMarginType: MarginType;
  platformMarginValue: number;
  affiliateBasis: AffiliateBasis;
  affiliatePercent: number;
  campaignMarkupType?: MarginType;
  campaignMarkupValue?: number;
  minPrice?: number;
  maxPrice?: number;
  roundingMode: RoundingMode;
  status: PricingPolicyStatus;
  createdAt: string;
  updatedAt: string;
}

// ============ REVENUE SPLIT (profit distribution) ============

export interface RevenueSplit {
  id: string;
  name: string;
  storeId?: string;
  affiliateSharePercent: number;
  platformSharePercent: number;
  notes?: string;
  status: RevenueSplitStatus;
  createdAt: string;
  updatedAt: string;
}

// ============ ATTRIBUTION CONTEXT (runtime attribution) ============

export interface AttributionContext {
  builderHostId?: string;
  builderPlacementId?: string;
  affiliateUserId?: string;
  builderProfileId?: string;
  surfaceId?: string;
  storeId?: string;
  campaignId?: string;
  referralCode?: string;
}

// ============ PRICING SNAPSHOT (durable pricing at order time) ============

export interface PricingSnapshot {
  baseSalePrice: number;
  displaySalePrice: number;
  productCost: number;
  providerCost: number;
  platformFeeAmount: number;
  shippingCostBurden: number;
  discountBurden: number;
  grossProfitAmount: number;
  affiliateUserId?: string;
  builderHostId?: string;
  builderPlacementId?: string;
  affiliatePercent: number;
  affiliateBasis: AffiliateBasis;
  affiliateAmount: number;
  netPlatformProfitAmount: number;
  currency: string;
  pricingPolicyId?: string;
  revenueSplitId?: string;
  pricingSnapshotVersion: string;
  createdAt: string;
}

// ============ EXTERNAL CART CONTEXT ============

export interface ExternalCartContext {
  attribution: AttributionContext;
  pricingSnapshot: PricingSnapshot;
  surfaceId: string;
  variantId?: string;
  quantity: number;
}

// ============ EMBEDDED ORDER ATTRIBUTION (immutable order-time record) ============

export interface EmbeddedOrderAttribution {
  id: string;
  orderId: string;
  orderItemId?: string;
  builderHostId?: string;
  builderPlacementId?: string;
  builderProfileId?: string;
  affiliateUserId?: string;
  surfaceId?: string;
  pricingPolicyId?: string;
  revenueSplitId?: string;
  baseSalePrice: number;
  displaySalePrice: number;
  productCost: number;
  providerCost: number;
  platformFeeAmount: number;
  shippingCostBurden: number;
  discountBurden: number;
  grossProfitAmount: number;
  affiliatePercent: number;
  affiliateBasis: AffiliateBasis;
  affiliateAmount: number;
  netPlatformProfitAmount: number;
  currency: string;
  snapshot?: Record<string, unknown>;
  createdAt: string;
}

// ============ AFFILIATE PAYOUT LEDGER ============

export interface AffiliatePayoutLedgerEntry {
  id: string;
  affiliateUserId: string;
  builderHostId?: string;
  builderPlacementId?: string;
  orderId: string;
  orderItemId?: string;
  affiliateAmount: number;
  currency: string;
  status: PayoutStatus;
  periodKey?: string;
  createdAt: string;
  paidAt?: string;
}

// ============ READINESS CHECKER ============

export interface SurfaceReadinessResult {
  ready: boolean;
  errors: string[];
  score?: number;
}

export function checkSurfaceReadiness(
  surface: Partial<Surface>,
  variants: SurfaceVariant[],
): SurfaceReadinessResult {
  const errors: string[] = [];
  let score = 0;
  const totalChecks = 7;

  if (!surface.title || surface.title.trim().length === 0) {
    errors.push('Title is required');
  } else { score++; }

  if (!surface.description || surface.description.trim().length === 0) {
    errors.push('Description is required');
  } else { score++; }

  if (!surface.images || surface.images.length === 0) {
    errors.push('At least one image is required');
  } else { score++; }

  if (surface.retailPrice == null || surface.retailPrice <= 0) {
    errors.push('Retail price must be greater than zero');
  } else { score++; }

  if (!surface.sku || surface.sku.trim().length === 0) {
    errors.push('SKU is required');
  } else { score++; }

  const enabledVariants = variants.filter((v) => v.enabled);
  if (enabledVariants.length === 0) {
    errors.push('At least one enabled variant is required');
  } else { score++; }

  const variantSkus = enabledVariants.map((v) => v.sku).filter(Boolean);
  const uniqueSkus = new Set(variantSkus);
  if (variantSkus.length !== uniqueSkus.size) {
    errors.push('All variant SKUs must be unique');
  }
  for (const v of enabledVariants) {
    if (!v.sku || v.sku.trim().length === 0) {
      errors.push(`Variant ${v.size}/${v.color} is missing a SKU`);
    }
  }

  const hasAnyPlatform = (surface.enabledPlatforms && surface.enabledPlatforms.length > 0)
    || surface.supportsEmbedStore || surface.supportsEmbedProduct || surface.supportsEmbedBuilder
    || surface.supportsEtsy || surface.supportsEbay || surface.supportsAmazon;

  if (!hasAnyPlatform) {
    errors.push('At least one selling channel must be enabled (marketplace or embed)');
  } else { score++; }

  const readinessScore = Math.round((score / totalChecks) * 100);

  return { ready: errors.length === 0, errors, score: readinessScore };
}

// ============ PRICING ENGINE ============

export interface PricingInput {
  salePrice: number;
  productCost: number;
  providerCost?: number;
  platformFeeAmount?: number;
  shippingCostBurden?: number;
  discountBurden?: number;
  affiliatePercent?: number;
  currency?: string;
}

export function computePricingSnapshot(input: PricingInput): PricingSnapshot {
  const salePrice = input.salePrice;
  const productCost = input.productCost;
  const providerCost = input.providerCost || 0;
  const platformFeeAmount = input.platformFeeAmount || 0;
  const shippingCostBurden = input.shippingCostBurden || 0;
  const discountBurden = input.discountBurden || 0;
  const affiliatePercent = input.affiliatePercent || 25;

  const grossProfitAmount = salePrice - productCost - providerCost - platformFeeAmount - shippingCostBurden - discountBurden;
  const affiliateAmount = grossProfitAmount > 0 ? Math.round(grossProfitAmount * (affiliatePercent / 100) * 100) / 100 : 0;
  const netPlatformProfitAmount = grossProfitAmount - affiliateAmount;

  return {
    baseSalePrice: salePrice,
    displaySalePrice: salePrice,
    productCost,
    providerCost,
    platformFeeAmount,
    shippingCostBurden,
    discountBurden,
    grossProfitAmount: Math.round(grossProfitAmount * 100) / 100,
    affiliatePercent,
    affiliateBasis: 'gross_profit',
    affiliateAmount,
    netPlatformProfitAmount: Math.round(netPlatformProfitAmount * 100) / 100,
    currency: input.currency || 'USD',
    pricingSnapshotVersion: '1.0',
    createdAt: new Date().toISOString(),
  };
}

// ============ INSERT TYPES ============

export type InsertSurface = Omit<Surface, 'id' | 'createdAt' | 'updatedAt' | 'readinessErrors' | 'status'>;
export type InsertSurfaceVariant = Omit<SurfaceVariant, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertMarketplaceAccount = Omit<MarketplaceAccount, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyConfigured' | 'healthStatus' | 'healthError' | 'lastHealthCheck'>;
export type InsertMarketplaceListing = Omit<MarketplaceListing, 'id' | 'createdAt' | 'updatedAt' | 'externalListingId' | 'externalUrl' | 'lastSyncAt' | 'lastSyncJobId' | 'errorMessage'>;
export type InsertMarketplaceSyncJob = Omit<MarketplaceSyncJob, 'id' | 'createdAt' | 'updatedAt' | 'attempts' | 'lastAttemptAt' | 'completedAt' | 'errorMessage' | 'result'>;
export type InsertBuilderHost = Omit<BuilderHost, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertBuilderProfile = Omit<BuilderProfile, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertBuilderPlacement = Omit<BuilderPlacement, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertPricingPolicy = Omit<PricingPolicy, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertRevenueSplit = Omit<RevenueSplit, 'id' | 'createdAt' | 'updatedAt'>;
