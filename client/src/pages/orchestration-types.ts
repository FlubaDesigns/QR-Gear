import type { MasterProduct } from "@shared/schema";

export type ProductType = "hat" | "shirt" | "mug" | "bag" | "other";
export type ProductStatus = "draft" | "active" | "paused" | "archived";

export interface ProviderHealthStatus {
  providerType: string;
  displayName: string;
  isHealthy: boolean;
  responseTimeMs: number;
  lastCheck: string;
  errorMessage?: string;
  errorCode?: string;
  stats24h: {
    uptimePercent: number;
    avgResponseTime: number;
    totalChecks: number;
  };
}

export interface HealthDashboard {
  providers: ProviderHealthStatus[];
  summary: {
    totalProviders: number;
    healthyProviders: number;
    unhealthyProviders: number;
    overallHealth: "healthy" | "degraded" | "critical";
  };
}

export interface ProviderScore {
  providerId: number;
  providerName: string;
  blueprintId: number;
  costCents: number | null;
  isUSA: boolean;
  isHealthy: boolean;
  healthScore: number;
  responseTimeMs: number | null;
  combinedScore: number;
  reason: string;
}

export interface RoutingResult {
  success: boolean;
  selectedProvider: ProviderScore | null;
  alternativeProviders: ProviderScore[];
  reason: string;
  timestamp: string;
}

export interface RoutingStats {
  totalRoutings: number;
  byProvider: Record<string, number>;
  avgSelectedCost: number;
  routingTimestamp: string;
}

export interface ProfitBreakdown {
  grossRevenue: number;
  productionCost: number;
  shippingCost: number;
  platformFees: number;
  paymentProcessingFees: number;
  netProfit: number;
  marginPercent: number;
}

export interface ChannelProfitSummary {
  channel: string;
  channelType: "direct" | "marketplace" | "print_provider";
  orderCount: number;
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  averageMargin: number;
  averageOrderValue: number;
}

export interface ProductProfitAnalysis {
  masterProductId: string;
  productName: string;
  sku: string;
  totalSold: number;
  totalRevenue: number;
  averageCost: number;
  averagePrice: number;
  marginPercent: number;
  profitPerUnit: number;
  recommendedPrice?: number;
  priceHealth: "excellent" | "good" | "marginal" | "loss";
}

export interface ProfitAlert {
  type: "warning" | "critical";
  message: string;
  productId?: string;
  channel?: string;
}

export interface ProfitDashboard {
  totalRevenue: number;
  totalCosts: number;
  totalProfit: number;
  overallMargin: number;
  channelSummaries: ChannelProfitSummary[];
  topProducts: ProductProfitAnalysis[];
  marginDistribution: {
    excellent: number;
    good: number;
    marginal: number;
    loss: number;
  };
  alerts: ProfitAlert[];
}

export interface RepricingStats {
  totalRules: number;
  activeRules: number;
  lastRunTime: string | null;
  productsAdjusted24h: number;
  avgPriceChange: number;
}

export interface QrAnalyticsSummary {
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  scansThisMonth: number;
  uniqueProducts: number;
  topCountries: Array<{ country: string; scans: number }>;
  topDevices: Array<{ deviceType: string; scans: number }>;
}

export interface ProductScanAnalytics {
  productId: string;
  productName: string;
  totalScans: number;
  scansToday: number;
  scansThisWeek: number;
  lastScanned: string | null;
}

export interface ScanTrend {
  date: string;
  scans: number;
}

export interface ProductBundle {
  id: string;
  name: string;
  description: string | null;
  bundleType: string;
  displayImage: string | null;
  displayOrder: number | null;
  pricingType: string;
  discountPercent: string | null;
  fixedPrice: string | null;
  discountAmount: string | null;
  minItems: number | null;
  maxItems: number | null;
  isActive: boolean | null;
  displayLocations: string[] | null;
  triggerProductIds: string[] | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  updatedAt: string;
  items?: BundleItem[];
}

export interface BundleItem {
  id: string;
  bundleId: string;
  masterProductId: string | null;
  productId: number | null;
  displayOrder: number | null;
  quantity: number | null;
  isRequired: boolean | null;
  itemDiscountPercent: string | null;
}

export interface BulkPublishJob {
  jobId: string;
  status: "pending" | "running" | "completed" | "failed";
  totalItems: number;
  completedItems: number;
  successCount: number;
  failureCount: number;
  results: {
    productId: string;
    productTitle: string;
    channelType: string;
    success: boolean;
    listingId?: string;
    error?: string;
  }[];
  startedAt: string;
  completedAt?: string;
}
