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

const PRINTIFY_API_BASE = "https://api.printify.com/v1";

export class PrintifyAdapter extends BasePrintProviderAdapter {
  readonly providerType = "printify" as const;
  readonly displayName = "Printify";

  private getApiKey(): string {
    const key = process.env.PRINTIFY_API_KEY;
    if (!key) throw new Error("PRINTIFY_API_KEY not configured");
    return key;
  }

  private getShopId(): string {
    const shopId = process.env.PRINTIFY_SHOP_ID;
    if (!shopId) throw new Error("PRINTIFY_SHOP_ID not configured");
    return shopId;
  }

  private async apiRequest(endpoint: string, options: RequestInit = {}): Promise<unknown> {
    const response = await fetch(`${PRINTIFY_API_BASE}${endpoint}`, {
      ...options,
      headers: {
        "Authorization": `Bearer ${this.getApiKey()}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Printify API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async publishProduct(input: PublishProductInput): Promise<PublishProductResult> {
    try {
      const shopId = this.getShopId();
      const { masterProduct, designVersion, variants, retailPrice } = input;

      const printifyVariants = variants.map((v) => ({
        id: 1,
        price: Math.round(retailPrice * 100),
        is_enabled: true,
      }));

      const productData = {
        title: masterProduct.title,
        description: masterProduct.description || "",
        blueprint_id: 6,
        print_provider_id: 99,
        variants: printifyVariants,
        print_areas: [
          {
            variant_ids: printifyVariants.map((v) => v.id),
            placeholders: [
              {
                position: "front",
                images: [
                  {
                    id: designVersion.renderedPngUrl,
                    x: 0.5,
                    y: 0.5,
                    scale: 1,
                    angle: 0,
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await this.apiRequest(`/shops/${shopId}/products.json`, {
        method: "POST",
        body: JSON.stringify(productData),
      }) as { id: string };

      return {
        success: true,
        externalProductId: result.id,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateProduct(externalProductId: string, input: PublishProductInput): Promise<PublishProductResult> {
    try {
      const shopId = this.getShopId();

      await this.apiRequest(`/shops/${shopId}/products/${externalProductId}.json`, {
        method: "PUT",
        body: JSON.stringify({
          title: input.masterProduct.title,
          description: input.masterProduct.description || "",
        }),
      });

      return {
        success: true,
        externalProductId,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async unpublishProduct(externalProductId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const shopId = this.getShopId();

      await this.apiRequest(`/shops/${shopId}/products/${externalProductId}.json`, {
        method: "DELETE",
      });

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  async getQuote(masterProduct: MasterProduct, variant: ProductVariantInput): Promise<ProviderQuoteResult> {
    return {
      productionCost: 15.00,
      shippingCost: 5.00,
      estimatedDays: 7,
      isAvailable: true,
    };
  }

  async submitOrder(input: SubmitOrderInput): Promise<SubmitOrderResult> {
    try {
      const shopId = this.getShopId();
      const { order, masterProduct, designVersion, variant, quantity, shippingAddress } = input;

      const orderData = {
        external_id: order.id,
        line_items: [
          {
            product_id: masterProduct.id,
            variant_id: 1,
            quantity,
          },
        ],
        shipping_method: 1,
        address_to: {
          first_name: shippingAddress.name.split(" ")[0],
          last_name: shippingAddress.name.split(" ").slice(1).join(" ") || "",
          email: order.customerEmail || "",
          phone: shippingAddress.phone || "",
          country: shippingAddress.country,
          region: shippingAddress.state,
          address1: shippingAddress.address1,
          address2: shippingAddress.address2 || "",
          city: shippingAddress.city,
          zip: shippingAddress.zip,
        },
      };

      const result = await this.apiRequest(`/shops/${shopId}/orders.json`, {
        method: "POST",
        body: JSON.stringify(orderData),
      }) as { id: string };

      return {
        success: true,
        providerOrderId: result.id,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async getOrderStatus(providerOrderId: string): Promise<{ status: string; trackingNumber?: string; trackingUrl?: string }> {
    try {
      const shopId = this.getShopId();

      const order = await this.apiRequest(`/shops/${shopId}/orders/${providerOrderId}.json`) as {
        status: string;
        shipments?: Array<{
          tracking_number?: string;
          tracking_url?: string;
        }>;
      };

      return {
        status: order.status,
        trackingNumber: order.shipments?.[0]?.tracking_number,
        trackingUrl: order.shipments?.[0]?.tracking_url,
      };
    } catch (error) {
      return { status: "unknown" };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      await this.apiRequest("/shops.json");
      return {
        isHealthy: true,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return {
        isHealthy: false,
        responseTimeMs: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  parseWebhook(payload: unknown): WebhookPayload | null {
    if (!payload || typeof payload !== "object") return null;
    const p = payload as Record<string, unknown>;

    return {
      type: String(p.type || "unknown"),
      data: p.data,
      timestamp: new Date(),
    };
  }
}
