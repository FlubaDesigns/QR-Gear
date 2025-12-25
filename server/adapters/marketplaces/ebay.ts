import {
  BaseMarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  HealthCheckResult,
  WebhookPayload,
} from "../base";

const EBAY_API_BASE = "https://api.ebay.com";
const INVENTORY_API = `${EBAY_API_BASE}/sell/inventory/v1`;

interface EbayInventoryItem {
  sku: string;
  locale?: string;
  product: {
    title: string;
    description: string;
    aspects?: Record<string, string[]>;
    imageUrls: string[];
    upc?: string[];
  };
  condition: "NEW" | "LIKE_NEW" | "USED_EXCELLENT" | "USED_VERY_GOOD" | "USED_GOOD" | "USED_ACCEPTABLE" | "FOR_PARTS_OR_NOT_WORKING";
  conditionDescription?: string;
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
}

interface EbayOffer {
  offerId: string;
  sku: string;
  marketplaceId: string;
  format: "FIXED_PRICE" | "AUCTION";
  listingDescription: string;
  availableQuantity?: number;
  quantityLimitPerBuyer?: number;
  pricingSummary: {
    price: {
      value: string;
      currency: string;
    };
  };
  listingPolicies: {
    fulfillmentPolicyId: string;
    paymentPolicyId: string;
    returnPolicyId: string;
  };
  categoryId: string;
  merchantLocationKey?: string;
  status?: string;
  listing?: {
    listingId: string;
  };
}

interface EbayPublishResponse {
  listingId: string;
  warnings?: Array<{
    category: string;
    message: string;
  }>;
}

interface EbayOfferResponse {
  offerId: string;
  warnings?: Array<{
    category: string;
    message: string;
  }>;
}

interface EbayOffersResponse {
  offers: EbayOffer[];
  total: number;
  size: number;
  offset: number;
}

interface EbayError {
  errors?: Array<{
    errorId: number;
    domain: string;
    category: string;
    message: string;
    longMessage?: string;
  }>;
}

export class EbayAdapter extends BaseMarketplaceAdapter {
  readonly marketplaceType = "ebay" as const;
  readonly displayName = "eBay";

  private listingToOfferCache = new Map<string, { offerId: string; sku: string }>();
  private skuToInventoryCache = new Map<string, EbayInventoryItem>();

  private getAccessToken(): string {
    const token = process.env.EBAY_ACCESS_TOKEN;
    if (!token) throw new Error("EBAY_ACCESS_TOKEN not configured");
    return token;
  }

  private getPaymentPolicyId(): string {
    const policyId = process.env.EBAY_PAYMENT_POLICY_ID;
    if (!policyId) throw new Error("EBAY_PAYMENT_POLICY_ID not configured");
    return policyId;
  }

  private getReturnPolicyId(): string {
    const policyId = process.env.EBAY_RETURN_POLICY_ID;
    if (!policyId) throw new Error("EBAY_RETURN_POLICY_ID not configured");
    return policyId;
  }

  private getFulfillmentPolicyId(): string {
    const policyId = process.env.EBAY_FULFILLMENT_POLICY_ID;
    if (!policyId) throw new Error("EBAY_FULFILLMENT_POLICY_ID not configured");
    return policyId;
  }

  private getMerchantLocationKey(): string | undefined {
    return process.env.EBAY_MERCHANT_LOCATION_KEY;
  }

  private getMarketplaceId(): string {
    return process.env.EBAY_MARKETPLACE_ID || "EBAY_US";
  }

  private getCategoryId(): string {
    return process.env.EBAY_DEFAULT_CATEGORY_ID || "1059";
  }

  private async apiRequest<T = unknown>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = endpoint.startsWith("http") ? endpoint : `${INVENTORY_API}${endpoint}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.getAccessToken()}`,
        "Content-Type": "application/json",
        "Content-Language": "en-US",
        "Accept": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText) as EbayError;
        if (errorJson.errors && errorJson.errors.length > 0) {
          errorMessage = errorJson.errors.map(e => e.message).join("; ");
        } else {
          errorMessage = errorText;
        }
      } catch {
        errorMessage = errorText;
      }
      throw new Error(`eBay API error: ${response.status} - ${errorMessage}`);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    return JSON.parse(text) as T;
  }

  private generateSku(masterProductId: string): string {
    return `QRGEAR-${masterProductId.substring(0, 8).toUpperCase()}`;
  }

  private async createOrReplaceInventoryItem(
    sku: string,
    input: MarketplaceListingInput
  ): Promise<EbayInventoryItem> {
    const { masterProduct, designVersion, title, description, images } = input;

    const allImages: string[] = [];
    if (designVersion.renderedPngUrl) {
      allImages.push(designVersion.renderedPngUrl);
    }
    if (images) {
      allImages.push(...images.filter(img => !allImages.includes(img)));
    }

    const inventoryItem: EbayInventoryItem = {
      sku,
      product: {
        title: title.substring(0, 80),
        description: description.substring(0, 4000),
        aspects: {
          "Brand": ["QR Gear"],
          "Type": ["Apparel"],
        },
        imageUrls: allImages.slice(0, 12),
      },
      condition: "NEW",
      availability: {
        shipToLocationAvailability: {
          quantity: 999,
        },
      },
    };

    await this.apiRequest(`/inventory_item/${encodeURIComponent(sku)}`, {
      method: "PUT",
      body: JSON.stringify(inventoryItem),
    });

    this.skuToInventoryCache.set(sku, inventoryItem);

    return inventoryItem;
  }

  private async createOffer(
    sku: string,
    input: MarketplaceListingInput
  ): Promise<string> {
    const { retailPrice, description } = input;

    const offerData = {
      sku,
      marketplaceId: this.getMarketplaceId(),
      format: "FIXED_PRICE",
      listingDescription: description.substring(0, 4000),
      categoryId: this.getCategoryId(),
      listingPolicies: {
        paymentPolicyId: this.getPaymentPolicyId(),
        returnPolicyId: this.getReturnPolicyId(),
        fulfillmentPolicyId: this.getFulfillmentPolicyId(),
      },
      pricingSummary: {
        price: {
          value: retailPrice.toFixed(2),
          currency: "USD",
        },
      },
      quantityLimitPerBuyer: 10,
      ...(this.getMerchantLocationKey() && { merchantLocationKey: this.getMerchantLocationKey() }),
    };

    const response = await this.apiRequest<EbayOfferResponse>("/offer", {
      method: "POST",
      body: JSON.stringify(offerData),
    });

    return response.offerId;
  }

  private async publishOffer(offerId: string): Promise<string> {
    const response = await this.apiRequest<EbayPublishResponse>(`/offer/${offerId}/publish`, {
      method: "POST",
      body: JSON.stringify({}),
    });

    return response.listingId;
  }

  private async getOfferByListingId(listingId: string): Promise<{ offerId: string; sku: string } | null> {
    const cached = this.listingToOfferCache.get(listingId);
    if (cached) {
      return cached;
    }

    try {
      let offset = 0;
      const limit = 100;
      
      while (true) {
        const response = await this.apiRequest<EbayOffersResponse>(
          `/offer?marketplace_id=${this.getMarketplaceId()}&limit=${limit}&offset=${offset}`
        );
        
        if (!response.offers || response.offers.length === 0) {
          break;
        }

        for (const offer of response.offers) {
          if (offer.listing?.listingId) {
            this.listingToOfferCache.set(offer.listing.listingId, {
              offerId: offer.offerId,
              sku: offer.sku,
            });
          }
          
          if (offer.listing?.listingId === listingId) {
            return { offerId: offer.offerId, sku: offer.sku };
          }
        }

        if (response.offers.length < limit) {
          break;
        }
        
        offset += limit;
        
        if (offset > 10000) {
          console.warn("[EbayAdapter] getOfferByListingId: exceeded max offset, stopping scan");
          break;
        }
      }
      
      return null;
    } catch (error) {
      console.error("[EbayAdapter] getOfferByListingId error:", error);
      return null;
    }
  }

  private async getOfferBySku(sku: string): Promise<EbayOffer | null> {
    try {
      const response = await this.apiRequest<EbayOffersResponse>(`/offer?sku=${encodeURIComponent(sku)}`);
      if (response.offers && response.offers.length > 0) {
        return response.offers[0];
      }
      return null;
    } catch (error) {
      console.error("[EbayAdapter] getOfferBySku error:", error);
      return null;
    }
  }

  private async getInventoryItem(sku: string): Promise<EbayInventoryItem | null> {
    try {
      const item = await this.apiRequest<EbayInventoryItem>(`/inventory_item/${encodeURIComponent(sku)}`);
      this.skuToInventoryCache.set(sku, item);
      return item;
    } catch (error) {
      console.error("[EbayAdapter] getInventoryItem error:", error);
      return null;
    }
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    try {
      const sku = this.generateSku(input.masterProduct.id);

      await this.createOrReplaceInventoryItem(sku, input);

      const offerId = await this.createOffer(sku, input);

      const listingId = await this.publishOffer(offerId);

      this.listingToOfferCache.set(listingId, { offerId, sku });

      return {
        success: true,
        externalListingId: listingId,
        externalUrl: `https://www.ebay.com/itm/${listingId}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[EbayAdapter] createListing error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateListing(externalListingId: string, input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    try {
      const offerInfo = await this.getOfferByListingId(externalListingId);
      if (!offerInfo) {
        return {
          success: false,
          error: `Offer not found for listing ${externalListingId}. eBay API requires paginated scan to resolve listing→offer mapping.`,
        };
      }

      await this.createOrReplaceInventoryItem(offerInfo.sku, input);

      const { retailPrice, description } = input;

      const updateData = {
        sku: offerInfo.sku,
        marketplaceId: this.getMarketplaceId(),
        format: "FIXED_PRICE",
        listingDescription: description.substring(0, 4000),
        categoryId: this.getCategoryId(),
        listingPolicies: {
          paymentPolicyId: this.getPaymentPolicyId(),
          returnPolicyId: this.getReturnPolicyId(),
          fulfillmentPolicyId: this.getFulfillmentPolicyId(),
        },
        pricingSummary: {
          price: {
            value: retailPrice.toFixed(2),
            currency: "USD",
          },
        },
        quantityLimitPerBuyer: 10,
        ...(this.getMerchantLocationKey() && { merchantLocationKey: this.getMerchantLocationKey() }),
      };

      await this.apiRequest(`/offer/${offerInfo.offerId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
      });

      return {
        success: true,
        externalListingId,
        externalUrl: `https://www.ebay.com/itm/${externalListingId}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[EbayAdapter] updateListing error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async deleteListing(externalListingId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const offerInfo = await this.getOfferByListingId(externalListingId);
      if (!offerInfo) {
        this.listingToOfferCache.delete(externalListingId);
        return { success: true };
      }

      try {
        await this.apiRequest(`/offer/${offerInfo.offerId}/withdraw`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      } catch (withdrawError) {
        console.warn("[EbayAdapter] Withdraw failed, attempting delete:", withdrawError);
      }

      try {
        await this.apiRequest(`/offer/${offerInfo.offerId}`, {
          method: "DELETE",
        });
      } catch (deleteOfferError) {
        console.warn("[EbayAdapter] Delete offer failed:", deleteOfferError);
      }

      try {
        await this.apiRequest(`/inventory_item/${encodeURIComponent(offerInfo.sku)}`, {
          method: "DELETE",
        });
      } catch (deleteItemError) {
        console.warn("[EbayAdapter] Delete inventory item failed:", deleteItemError);
      }

      this.listingToOfferCache.delete(externalListingId);
      this.skuToInventoryCache.delete(offerInfo.sku);

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[EbayAdapter] deleteListing error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async syncInventory(externalListingId: string, inStock: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const offerInfo = await this.getOfferByListingId(externalListingId);
      if (!offerInfo) {
        return { success: false, error: `Offer not found for listing ${externalListingId}. eBay API requires paginated scan to resolve listing→offer mapping.` };
      }

      let existingItem: EbayInventoryItem | null | undefined = this.skuToInventoryCache.get(offerInfo.sku);
      if (!existingItem) {
        existingItem = await this.getInventoryItem(offerInfo.sku);
      }

      if (!existingItem) {
        return { success: false, error: `Inventory item not found for SKU ${offerInfo.sku}` };
      }

      const updatedItem: EbayInventoryItem = {
        ...existingItem,
        availability: {
          shipToLocationAvailability: {
            quantity: inStock ? 999 : 0,
          },
        },
      };

      await this.apiRequest(`/inventory_item/${encodeURIComponent(offerInfo.sku)}`, {
        method: "PUT",
        body: JSON.stringify(updatedItem),
      });

      this.skuToInventoryCache.set(offerInfo.sku, updatedItem);

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[EbayAdapter] syncInventory error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await this.apiRequest("/location?limit=1");
      
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
    const metadata = p.metadata as Record<string, unknown> | undefined;
    const notification = p.notification as Record<string, unknown> | undefined;

    if (!metadata || !notification) return null;

    const topic = metadata.topic as string;
    if (!topic) return null;

    let type: string;
    switch (topic) {
      case "MARKETPLACE.ITEM.LISTED":
        type = "item.listed";
        break;
      case "MARKETPLACE.ITEM.ENDED":
        type = "item.ended";
        break;
      case "MARKETPLACE.ITEM.SOLD":
        type = "item.sold";
        break;
      case "MARKETPLACE.ORDER.CREATED":
        type = "order.created";
        break;
      case "MARKETPLACE.ORDER.SHIPPED":
        type = "order.shipped";
        break;
      default:
        type = topic;
    }

    return {
      type,
      data: notification.data || notification,
      timestamp: new Date(metadata.eventDate as string || Date.now()),
    };
  }

  async getOffer(offerId: string): Promise<EbayOffer | null> {
    try {
      const offer = await this.apiRequest<EbayOffer>(`/offer/${offerId}`);
      return offer;
    } catch (error) {
      console.error("[EbayAdapter] getOffer error:", error);
      return null;
    }
  }
}
