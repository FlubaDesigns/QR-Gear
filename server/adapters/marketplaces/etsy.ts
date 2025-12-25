import {
  BaseMarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  HealthCheckResult,
  WebhookPayload,
} from "../base";

const ETSY_API_BASE = "https://api.etsy.com/v3/application";

interface EtsyListing {
  listing_id: number;
  shop_id: number;
  title: string;
  description: string;
  state: "active" | "draft" | "removed" | "expired" | "inactive";
  price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  quantity: number;
  url: string;
  views?: number;
  num_favorers?: number;
}

interface EtsyShop {
  shop_id: number;
  shop_name: string;
  user_id: number;
  title: string;
  currency_code: string;
  url: string;
  is_vacation: boolean;
  listing_active_count: number;
}

interface EtsyUploadImageResult {
  listing_image_id: number;
  listing_id: number;
  rank: number;
  url_75x75?: string;
  url_170x135?: string;
  url_570xN?: string;
  url_fullxfull?: string;
}

export class EtsyAdapter extends BaseMarketplaceAdapter {
  readonly marketplaceType = "etsy" as const;
  readonly displayName = "Etsy";

  private getApiKeyString(): string {
    const keystring = process.env.ETSY_API_KEYSTRING;
    if (!keystring) throw new Error("ETSY_API_KEYSTRING not configured");
    return keystring;
  }

  private getSharedSecret(): string {
    const secret = process.env.ETSY_SHARED_SECRET;
    if (!secret) throw new Error("ETSY_SHARED_SECRET not configured");
    return secret;
  }

  private getAccessToken(): string {
    const token = process.env.ETSY_ACCESS_TOKEN;
    if (!token) throw new Error("ETSY_ACCESS_TOKEN not configured");
    return token;
  }

  private getShopId(): string {
    const shopId = process.env.ETSY_SHOP_ID;
    if (!shopId) throw new Error("ETSY_SHOP_ID not configured");
    return shopId;
  }

  private async apiRequest<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${ETSY_API_BASE}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "x-api-key": `${this.getApiKeyString()}:${this.getSharedSecret()}`,
        "Authorization": `Bearer ${this.getAccessToken()}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorJson.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(`Etsy API error: ${response.status} - ${errorMessage}`);
    }

    return response.json() as Promise<T>;
  }

  private async uploadImageFromUrl(listingId: number, imageUrl: string, rank: number = 1): Promise<EtsyUploadImageResult | null> {
    try {
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image from ${imageUrl}`);
      }
      
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBlob = new Blob([imageBuffer], { type: 'image/png' });

      const formData = new FormData();
      formData.append('image', imageBlob, 'design.png');
      formData.append('rank', String(rank));
      formData.append('overwrite', 'true');

      const shopId = this.getShopId();
      
      const response = await fetch(`${ETSY_API_BASE}/shops/${shopId}/listings/${listingId}/images`, {
        method: 'POST',
        headers: {
          "x-api-key": `${this.getApiKeyString()}:${this.getSharedSecret()}`,
          "Authorization": `Bearer ${this.getAccessToken()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`[EtsyAdapter] Image upload failed: ${error}`);
        return null;
      }

      return response.json() as Promise<EtsyUploadImageResult>;
    } catch (error) {
      console.error(`[EtsyAdapter] uploadImageFromUrl error:`, error);
      return null;
    }
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    try {
      const { masterProduct, designVersion, retailPrice, title, description, tags, images } = input;
      const shopId = this.getShopId();

      const priceInCents = Math.round(retailPrice * 100);

      const formData = new URLSearchParams();
      formData.append("quantity", "999");
      formData.append("title", title.substring(0, 140));
      formData.append("description", description);
      formData.append("price", String(priceInCents / 100));
      formData.append("who_made", "i_did");
      formData.append("when_made", "made_to_order");
      formData.append("taxonomy_id", "482");
      formData.append("is_supply", "false");
      formData.append("should_auto_renew", "true");

      if (tags && tags.length > 0) {
        const tagString = tags.slice(0, 13).join(",");
        formData.append("tags", tagString);
      }

      const listing = await this.apiRequest<EtsyListing>(`/shops/${shopId}/listings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        body: formData.toString(),
      });

      const allImages = [...(images || [])];
      if (designVersion.renderedPngUrl && !allImages.includes(designVersion.renderedPngUrl)) {
        allImages.unshift(designVersion.renderedPngUrl);
      }

      for (let i = 0; i < allImages.length && i < 10; i++) {
        await this.uploadImageFromUrl(listing.listing_id, allImages[i], i + 1);
      }

      if (allImages.length > 0) {
        await this.apiRequest(`/shops/${shopId}/listings/${listing.listing_id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
          },
          body: new URLSearchParams({ state: "active" }).toString(),
        });
      }

      return {
        success: true,
        externalListingId: String(listing.listing_id),
        externalUrl: `https://www.etsy.com/listing/${listing.listing_id}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[EtsyAdapter] createListing error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateListing(externalListingId: string, input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    try {
      const { retailPrice, title, description, tags } = input;
      const shopId = this.getShopId();

      const formData = new URLSearchParams();
      formData.append("title", title.substring(0, 140));
      formData.append("description", description);
      formData.append("price", String(retailPrice));

      if (tags && tags.length > 0) {
        formData.append("tags", tags.slice(0, 13).join(","));
      }

      await this.apiRequest(`/shops/${shopId}/listings/${externalListingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        body: formData.toString(),
      });

      return {
        success: true,
        externalListingId,
        externalUrl: `https://www.etsy.com/listing/${externalListingId}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[EtsyAdapter] updateListing error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async deleteListing(externalListingId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const shopId = this.getShopId();

      await this.apiRequest(`/shops/${shopId}/listings/${externalListingId}`, {
        method: "DELETE",
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[EtsyAdapter] deleteListing error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async syncInventory(externalListingId: string, inStock: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const shopId = this.getShopId();

      const formData = new URLSearchParams();
      formData.append("quantity", inStock ? "999" : "0");
      formData.append("state", inStock ? "active" : "inactive");

      await this.apiRequest(`/shops/${shopId}/listings/${externalListingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        },
        body: formData.toString(),
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[EtsyAdapter] syncInventory error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async getListing(externalListingId: string): Promise<EtsyListing | null> {
    try {
      const listing = await this.apiRequest<EtsyListing>(`/listings/${externalListingId}`);
      return listing;
    } catch (error) {
      console.error("[EtsyAdapter] getListing error:", error);
      return null;
    }
  }

  async getShopInfo(): Promise<EtsyShop | null> {
    try {
      const shopId = this.getShopId();
      const shop = await this.apiRequest<EtsyShop>(`/shops/${shopId}`);
      return shop;
    } catch (error) {
      console.error("[EtsyAdapter] getShopInfo error:", error);
      return null;
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const shopId = this.getShopId();
      await this.apiRequest(`/shops/${shopId}`);
      
      return {
        isHealthy: true,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      let errorCode: string | undefined;
      
      if (errorMessage.includes("401") || errorMessage.includes("403")) {
        errorCode = "AUTH_ERROR";
      } else if (errorMessage.includes("429")) {
        errorCode = "RATE_LIMITED";
      } else if (errorMessage.includes("500") || errorMessage.includes("502") || errorMessage.includes("503")) {
        errorCode = "SERVER_ERROR";
      } else if (errorMessage.includes("not configured")) {
        errorCode = "NOT_CONFIGURED";
      }

      return {
        isHealthy: false,
        responseTimeMs: Date.now() - startTime,
        error: errorMessage,
        errorCode,
      };
    }
  }

  parseWebhook(payload: unknown): WebhookPayload | null {
    if (!payload || typeof payload !== "object") return null;
    
    const p = payload as Record<string, unknown>;
    const type = p.type as string;

    if (!type) return null;

    return {
      type,
      data: p,
      timestamp: new Date(),
    };
  }
}
