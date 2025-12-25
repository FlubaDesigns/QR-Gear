import type { MasterProduct, ProductDesignVersion, OrderUnified } from "@shared/schema";

export interface ProductVariantInput {
  size: string;
  color: string;
  colorHex?: string;
  sku: string;
  price: number;
}

export interface PublishProductInput {
  masterProduct: MasterProduct;
  designVersion: ProductDesignVersion;
  variants: ProductVariantInput[];
  retailPrice: number;
}

export interface PublishProductResult {
  success: boolean;
  externalProductId?: string;
  externalListingId?: string;
  externalVariantIds?: Record<string, string>;
  error?: string;
}

export interface ProviderQuoteResult {
  productionCost: number;
  shippingCost?: number;
  estimatedDays?: number;
  isAvailable: boolean;
}

export interface SubmitOrderInput {
  order: OrderUnified;
  masterProduct: MasterProduct;
  designVersion: ProductDesignVersion;
  variant: ProductVariantInput;
  quantity: number;
  shippingAddress: {
    name: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    phone?: string;
  };
}

export interface SubmitOrderResult {
  success: boolean;
  providerOrderId?: string;
  estimatedDelivery?: Date;
  error?: string;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  responseTimeMs: number;
  error?: string;
  errorCode?: string;
}

export interface WebhookPayload {
  type: string;
  data: unknown;
  timestamp: Date;
}

export abstract class BasePrintProviderAdapter {
  abstract readonly providerType: "printify" | "printful" | "apliiq";
  abstract readonly displayName: string;

  abstract publishProduct(input: PublishProductInput): Promise<PublishProductResult>;
  abstract updateProduct(externalProductId: string, input: PublishProductInput): Promise<PublishProductResult>;
  abstract unpublishProduct(externalProductId: string): Promise<{ success: boolean; error?: string }>;
  abstract getQuote(masterProduct: MasterProduct, variant: ProductVariantInput): Promise<ProviderQuoteResult>;
  abstract submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult>;
  abstract getOrderStatus(providerOrderId: string): Promise<{ status: string; trackingNumber?: string; trackingUrl?: string }>;
  abstract healthCheck(): Promise<HealthCheckResult>;
  abstract parseWebhook(payload: unknown): WebhookPayload | null;
}

export interface MarketplaceListingInput {
  masterProduct: MasterProduct;
  designVersion: ProductDesignVersion;
  variants: ProductVariantInput[];
  retailPrice: number;
  title: string;
  description: string;
  tags: string[];
  images: string[];
}

export interface MarketplaceListingResult {
  success: boolean;
  externalListingId?: string;
  externalUrl?: string;
  error?: string;
}

export abstract class BaseMarketplaceAdapter {
  abstract readonly marketplaceType: "etsy" | "ebay" | "amazon";
  abstract readonly displayName: string;

  abstract createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult>;
  abstract updateListing(externalListingId: string, input: MarketplaceListingInput): Promise<MarketplaceListingResult>;
  abstract deleteListing(externalListingId: string): Promise<{ success: boolean; error?: string }>;
  abstract syncInventory(externalListingId: string, inStock: boolean): Promise<{ success: boolean; error?: string }>;
  abstract healthCheck(): Promise<HealthCheckResult>;
  abstract parseWebhook(payload: unknown): WebhookPayload | null;
}

export type PrintProviderType = "printify" | "printful" | "apliiq";
export type MarketplaceType = "etsy" | "ebay" | "amazon";
export type ChannelType = PrintProviderType | MarketplaceType;
