import {
  BaseMarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  HealthCheckResult,
  WebhookPayload,
} from "../base";

export class EtsyAdapter extends BaseMarketplaceAdapter {
  readonly marketplaceType = "etsy" as const;
  readonly displayName = "Etsy";

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    return { success: false, error: "Etsy adapter not yet implemented" };
  }

  async updateListing(externalListingId: string, input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    return { success: false, error: "Etsy adapter not yet implemented" };
  }

  async deleteListing(externalListingId: string): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "Etsy adapter not yet implemented" };
  }

  async syncInventory(externalListingId: string, inStock: boolean): Promise<{ success: boolean; error?: string }> {
    return { success: false, error: "Etsy adapter not yet implemented" };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    return { isHealthy: false, responseTimeMs: 0, error: "Not implemented" };
  }

  parseWebhook(payload: unknown): WebhookPayload | null {
    return null;
  }
}
