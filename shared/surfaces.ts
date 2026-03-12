import type {
  MarketplacePlatform,
  SurfaceStatus,
  ListingStatus,
  SyncJobStatus,
  SyncJobAction,
  SyncLogLevel,
} from '../functions/src/constants';

export interface Surface {
  id: string;
  masterProductId: string;
  title: string;
  description: string;
  tags: string[];
  images: string[];
  retailPrice: number;
  compareAtPrice?: number;
  sku: string;
  enabledPlatforms: MarketplacePlatform[];
  status: SurfaceStatus;
  readinessErrors: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SurfaceVariant {
  id: string;
  surfaceId: string;
  size: string;
  color: string;
  colorHex?: string;
  sku: string;
  priceOverride?: number;
  enabled: boolean;
  inventoryQuantity: number;
  createdAt: string;
  updatedAt: string;
}

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

export interface SurfaceReadinessResult {
  ready: boolean;
  errors: string[];
}

export function checkSurfaceReadiness(
  surface: Partial<Surface>,
  variants: SurfaceVariant[],
): SurfaceReadinessResult {
  const errors: string[] = [];

  if (!surface.title || surface.title.trim().length === 0) {
    errors.push('Title is required');
  }
  if (!surface.description || surface.description.trim().length === 0) {
    errors.push('Description is required');
  }
  if (!surface.images || surface.images.length === 0) {
    errors.push('At least one image is required');
  }
  if (surface.retailPrice == null || surface.retailPrice <= 0) {
    errors.push('Retail price must be greater than zero');
  }
  if (!surface.sku || surface.sku.trim().length === 0) {
    errors.push('SKU is required');
  }

  const enabledVariants = variants.filter((v) => v.enabled);
  if (enabledVariants.length === 0) {
    errors.push('At least one enabled variant is required');
  }

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

  if (!surface.enabledPlatforms || surface.enabledPlatforms.length === 0) {
    errors.push('At least one marketplace platform must be enabled');
  }

  return { ready: errors.length === 0, errors };
}

export type InsertSurface = Omit<Surface, 'id' | 'createdAt' | 'updatedAt' | 'readinessErrors' | 'status'>;
export type InsertSurfaceVariant = Omit<SurfaceVariant, 'id' | 'createdAt' | 'updatedAt'>;
export type InsertMarketplaceAccount = Omit<MarketplaceAccount, 'id' | 'createdAt' | 'updatedAt' | 'apiKeyConfigured' | 'healthStatus' | 'healthError' | 'lastHealthCheck'>;
export type InsertMarketplaceListing = Omit<MarketplaceListing, 'id' | 'createdAt' | 'updatedAt' | 'externalListingId' | 'externalUrl' | 'lastSyncAt' | 'lastSyncJobId' | 'errorMessage'>;
export type InsertMarketplaceSyncJob = Omit<MarketplaceSyncJob, 'id' | 'createdAt' | 'updatedAt' | 'attempts' | 'lastAttemptAt' | 'completedAt' | 'errorMessage' | 'result'>;
