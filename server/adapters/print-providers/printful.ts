import {
  BasePrintProviderAdapter,
  PublishProductInput,
  PublishProductResult,
  ProductVariantInput,
  ProviderQuoteResult,
  SubmitOrderInput,
  SubmitOrderResult,
  HealthCheckResult,
  WebhookPayload,
} from "../base";
import type { MasterProduct } from "@shared/schema";

const PRINTFUL_API_BASE = "https://api.printful.com";

interface PrintfulSyncVariant {
  id: number;
  external_id?: string;
  sync_product_id: number;
  name: string;
  synced: boolean;
  variant_id: number;
  retail_price: string;
  currency: string;
  product: {
    variant_id: number;
    product_id: number;
    image: string;
    name: string;
  };
  files: PrintfulFile[];
}

interface PrintfulFile {
  id?: number;
  type: string;
  url?: string;
  filename?: string;
  status?: string;
}

interface PrintfulSyncProduct {
  id: number;
  external_id?: string;
  name: string;
  variants: number;
  synced: number;
  thumbnail_url?: string;
}

interface PrintfulOrderResult {
  id: number;
  external_id?: string;
  status: string;
  created: number;
  shipping: string;
  shipping_service_name: string;
  shipments?: PrintfulShipment[];
}

interface PrintfulShipment {
  id: number;
  carrier: string;
  service: string;
  tracking_number?: string;
  tracking_url?: string;
  created: number;
  ship_date?: string;
  shipped_at?: number;
  reshipment: boolean;
}

interface PrintfulCatalogVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code: string;
  price: string;
  in_stock: boolean;
}

export class PrintfulAdapter extends BasePrintProviderAdapter {
  readonly providerType = "printful" as const;
  readonly displayName = "Printful";

  private getApiKey(): string {
    const key = process.env.PRINTFUL_API_KEY;
    if (!key) throw new Error("PRINTFUL_API_KEY not configured");
    return key;
  }

  private async apiRequest<T = unknown>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(`${PRINTFUL_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.result || errorJson.error?.message || errorText;
      } catch {
        errorMessage = errorText;
      }
      throw new Error(`Printful API error: ${response.status} - ${errorMessage}`);
    }

    const data = await response.json();
    return data.result as T;
  }

  private mapVariantToPrintfulVariantId(variant: ProductVariantInput, productId: number): number {
    return productId;
  }

  async publishProduct(input: PublishProductInput): Promise<PublishProductResult> {
    try {
      const { masterProduct, designVersion, variants, retailPrice } = input;

      const renderedImageUrl = designVersion.renderedPngUrl;
      if (!renderedImageUrl) {
        return { success: false, error: "No rendered image URL available for design" };
      }

      const syncVariants = variants.map((v, index) => ({
        variant_id: this.mapVariantToPrintfulVariantId(v, 4012 + index),
        retail_price: retailPrice.toFixed(2),
        files: [
          {
            type: "front",
            url: renderedImageUrl,
          },
        ],
        options: [] as { id: string; value: string }[],
      }));

      const productData = {
        sync_product: {
          name: masterProduct.title,
          thumbnail: renderedImageUrl,
        },
        sync_variants: syncVariants,
      };

      const result = await this.apiRequest<PrintfulSyncProduct>("/store/products", {
        method: "POST",
        body: JSON.stringify(productData),
      });

      return {
        success: true,
        externalProductId: String(result.id),
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[PrintfulAdapter] publishProduct error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateProduct(externalProductId: string, input: PublishProductInput): Promise<PublishProductResult> {
    try {
      const { masterProduct, designVersion } = input;

      const renderedImageUrl = designVersion.renderedPngUrl;

      const updateData = {
        sync_product: {
          name: masterProduct.title,
          thumbnail: renderedImageUrl || undefined,
        },
      };

      await this.apiRequest(`/store/products/${externalProductId}`, {
        method: "PUT",
        body: JSON.stringify(updateData),
      });

      return {
        success: true,
        externalProductId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[PrintfulAdapter] updateProduct error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async unpublishProduct(externalProductId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.apiRequest(`/store/products/${externalProductId}`, {
        method: "DELETE",
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[PrintfulAdapter] unpublishProduct error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async getQuote(masterProduct: MasterProduct, variant: ProductVariantInput): Promise<ProviderQuoteResult> {
    try {
      const productCostEstimate = 15.50;
      const shippingEstimate = 4.99;
      
      return {
        productionCost: productCostEstimate,
        shippingCost: shippingEstimate,
        estimatedDays: 5,
        isAvailable: true,
      };
    } catch (error: unknown) {
      console.error("[PrintfulAdapter] getQuote error:", error);
      return {
        productionCost: 0,
        isAvailable: false,
      };
    }
  }

  async getCatalogProduct(productId: number): Promise<PrintfulCatalogVariant[] | null> {
    try {
      const result = await this.apiRequest<{ variants: PrintfulCatalogVariant[] }>(`/products/${productId}`);
      return result.variants;
    } catch (error) {
      console.error("[PrintfulAdapter] getCatalogProduct error:", error);
      return null;
    }
  }

  async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    try {
      const { order, designVersion, variant, quantity, shippingAddress } = input;

      const renderedImageUrl = designVersion.renderedPngUrl;
      if (!renderedImageUrl) {
        return { success: false, error: "No rendered image URL available for design" };
      }

      const nameParts = shippingAddress.name.trim().split(/\s+/);
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || firstName;

      const orderData = {
        external_id: String(order.id),
        recipient: {
          name: shippingAddress.name,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || undefined,
          city: shippingAddress.city,
          state_code: shippingAddress.state,
          country_code: shippingAddress.country,
          zip: shippingAddress.zip,
          phone: shippingAddress.phone || undefined,
          email: order.customerEmail || undefined,
        },
        items: [
          {
            variant_id: 4012,
            quantity,
            files: [
              {
                type: "front",
                url: renderedImageUrl,
              },
            ],
          },
        ],
        retail_costs: {
          retail_price: variant.price.toFixed(2),
          currency: "USD",
        },
      };

      const result = await this.apiRequest<PrintfulOrderResult>("/orders", {
        method: "POST",
        body: JSON.stringify(orderData),
      });

      return {
        success: true,
        providerOrderId: String(result.id),
        estimatedDelivery: result.shipments?.[0]?.ship_date 
          ? new Date(result.shipments[0].ship_date)
          : undefined,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[PrintfulAdapter] submitOrder error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getOrderStatus(providerOrderId: string): Promise<{ 
    status: string; 
    trackingNumber?: string; 
    trackingUrl?: string 
  }> {
    try {
      const order = await this.apiRequest<PrintfulOrderResult>(`/orders/${providerOrderId}`);

      const latestShipment = order.shipments?.[order.shipments.length - 1];

      return {
        status: this.mapPrintfulStatus(order.status),
        trackingNumber: latestShipment?.tracking_number,
        trackingUrl: latestShipment?.tracking_url,
      };
    } catch (error) {
      console.error("[PrintfulAdapter] getOrderStatus error:", error);
      return { status: "unknown" };
    }
  }

  private mapPrintfulStatus(printfulStatus: string): string {
    const statusMap: Record<string, string> = {
      draft: "pending",
      pending: "pending",
      failed: "failed",
      canceled: "cancelled",
      inprocess: "processing",
      onhold: "on_hold",
      partial: "partially_shipped",
      fulfilled: "shipped",
    };
    return statusMap[printfulStatus.toLowerCase()] || printfulStatus;
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await this.apiRequest("/store");
      return {
        isHealthy: true,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      let errorCode: string | undefined;
      
      if (errorMessage.includes("401")) {
        errorCode = "AUTH_ERROR";
      } else if (errorMessage.includes("429")) {
        errorCode = "RATE_LIMITED";
      } else if (errorMessage.includes("500") || errorMessage.includes("502") || errorMessage.includes("503")) {
        errorCode = "SERVER_ERROR";
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
    const data = p.data;

    if (!type) return null;

    return {
      type,
      data,
      timestamp: new Date(),
    };
  }

  async getShippingRates(recipient: {
    address1: string;
    city: string;
    state_code: string;
    country_code: string;
    zip: string;
  }, items: Array<{ variant_id: number; quantity: number }>): Promise<Array<{
    id: string;
    name: string;
    rate: string;
    currency: string;
    minDeliveryDays: number;
    maxDeliveryDays: number;
  }> | null> {
    try {
      const result = await this.apiRequest<Array<{
        id: string;
        name: string;
        rate: string;
        currency: string;
        minDeliveryDays: number;
        maxDeliveryDays: number;
      }>>("/shipping/rates", {
        method: "POST",
        body: JSON.stringify({ recipient, items }),
      });
      return result;
    } catch (error) {
      console.error("[PrintfulAdapter] getShippingRates error:", error);
      return null;
    }
  }
}
