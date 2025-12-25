import {
  BaseMarketplaceAdapter,
  MarketplaceListingInput,
  MarketplaceListingResult,
  HealthCheckResult,
  WebhookPayload,
} from "../base";
import crypto from "crypto";

interface AmazonConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  sellerId: string;
  marketplaceId: string;
  awsAccessKeyId: string;
  awsSecretKey: string;
  region: string;
}

interface AmazonTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

interface AmazonListingSubmission {
  productType: string;
  requirements: string;
  attributes: Record<string, unknown>;
}

interface AmazonListingResponse {
  sku: string;
  status: string;
  submissionId: string;
  issues?: Array<{
    code: string;
    message: string;
    severity: string;
  }>;
}

const AMAZON_ENDPOINTS = {
  na: "https://sellingpartnerapi-na.amazon.com",
  eu: "https://sellingpartnerapi-eu.amazon.com",
  fe: "https://sellingpartnerapi-fe.amazon.com",
};

const MARKETPLACE_IDS: Record<string, string> = {
  US: "ATVPDKIKX0DER",
  CA: "A2EUQ1WTGCTBG2",
  MX: "A1AM78C64UM0Y8",
  UK: "A1F83G8C2ARO7P",
  DE: "A1PA6795UKMFR9",
  FR: "A13V1IB3VIYBER",
  IT: "APJ6JRA9NG5V4",
  ES: "A1RKKUPIHCS9HS",
  JP: "A1VC38T7YXB528",
  AU: "A39IBJ37TRP1C6",
};

export class AmazonAdapter extends BaseMarketplaceAdapter {
  readonly marketplaceType = "amazon" as const;
  readonly displayName = "Amazon";

  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private skuToAsinCache: Map<string, string> = new Map();

  private getConfig(): AmazonConfig {
    return {
      clientId: process.env.AMAZON_SP_CLIENT_ID || "",
      clientSecret: process.env.AMAZON_SP_CLIENT_SECRET || "",
      refreshToken: process.env.AMAZON_SP_REFRESH_TOKEN || "",
      sellerId: process.env.AMAZON_SELLER_ID || "",
      marketplaceId: process.env.AMAZON_MARKETPLACE_ID || MARKETPLACE_IDS.US,
      awsAccessKeyId: process.env.AMAZON_AWS_ACCESS_KEY_ID || "",
      awsSecretKey: process.env.AMAZON_AWS_SECRET_KEY || "",
      region: process.env.AMAZON_REGION || "us-east-1",
    };
  }

  private getEndpoint(): string {
    const config = this.getConfig();
    if (config.region.startsWith("eu")) return AMAZON_ENDPOINTS.eu;
    if (config.region.startsWith("ap") || config.region === "fe-south-1") return AMAZON_ENDPOINTS.fe;
    return AMAZON_ENDPOINTS.na;
  }

  private async refreshAccessToken(): Promise<string> {
    const config = this.getConfig();
    
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch("https://api.amazon.com/auth/o2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: config.refreshToken,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Amazon OAuth token refresh failed: ${errorText}`);
    }

    const tokenData = (await response.json()) as AmazonTokenResponse;
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = Date.now() + (tokenData.expires_in - 60) * 1000;

    return this.accessToken;
  }

  private getAmzDate(): string {
    return new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  }

  private getDateStamp(): string {
    return new Date().toISOString().slice(0, 10).replace(/-/g, "");
  }

  private hmacSha256(key: string | Buffer, data: string): Buffer {
    return crypto.createHmac("sha256", key).update(data).digest();
  }

  private sha256(data: string): string {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  private getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = this.hmacSha256("AWS4" + key, dateStamp);
    const kRegion = this.hmacSha256(kDate, region);
    const kService = this.hmacSha256(kRegion, service);
    return this.hmacSha256(kService, "aws4_request");
  }

  private async signRequest(
    method: string,
    path: string,
    host: string,
    queryParams: Record<string, string> = {},
    body: string = ""
  ): Promise<Record<string, string>> {
    const config = this.getConfig();
    const accessToken = await this.refreshAccessToken();
    
    const amzDate = this.getAmzDate();
    const dateStamp = this.getDateStamp();
    const service = "execute-api";

    const queryString = Object.keys(queryParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join("&");

    const payloadHash = this.sha256(body);

    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-access-token:${accessToken}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;

    const signedHeaders = "host;x-amz-access-token;x-amz-content-sha256;x-amz-date";

    const canonicalRequest =
      method + "\n" +
      path + "\n" +
      queryString + "\n" +
      canonicalHeaders + "\n" +
      signedHeaders + "\n" +
      payloadHash;

    const algorithm = "AWS4-HMAC-SHA256";
    const credentialScope = `${dateStamp}/${config.region}/${service}/aws4_request`;
    const stringToSign =
      algorithm + "\n" +
      amzDate + "\n" +
      credentialScope + "\n" +
      this.sha256(canonicalRequest);

    const signingKey = this.getSignatureKey(config.awsSecretKey, dateStamp, config.region, service);
    const signature = this.hmacSha256(signingKey, stringToSign).toString("hex");

    const authorizationHeader =
      `${algorithm} Credential=${config.awsAccessKeyId}/${credentialScope}, ` +
      `SignedHeaders=${signedHeaders}, Signature=${signature}`;

    return {
      "x-amz-access-token": accessToken,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      "Authorization": authorizationHeader,
      "Content-Type": "application/json",
    };
  }

  private async apiRequest<T>(
    method: string,
    path: string,
    queryParams: Record<string, string> = {},
    body?: object
  ): Promise<T> {
    const endpoint = this.getEndpoint();
    const endpointUrl = new URL(endpoint);
    const host = endpointUrl.host;
    const bodyStr = body ? JSON.stringify(body) : "";
    const headers = await this.signRequest(method, path, host, queryParams, bodyStr);

    const queryString = Object.keys(queryParams)
      .sort()
      .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
      .join("&");

    const url = `${endpoint}${path}${queryString ? "?" + queryString : ""}`;

    const response = await fetch(url, {
      method,
      headers,
      body: body ? bodyStr : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Amazon SP-API error ${response.status}: ${errorText}`);
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  private generateSku(masterProductId: string): string {
    return `QG-${masterProductId.substring(0, 12).toUpperCase()}`;
  }

  async createListing(input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    try {
      const config = this.getConfig();
      
      if (!config.clientId || !config.refreshToken) {
        return {
          success: false,
          error: "Amazon SP-API credentials not configured. Required: AMAZON_SP_CLIENT_ID, AMAZON_SP_CLIENT_SECRET, AMAZON_SP_REFRESH_TOKEN, AMAZON_SELLER_ID, AMAZON_AWS_ACCESS_KEY_ID, AMAZON_AWS_SECRET_KEY",
        };
      }

      const { masterProduct, designVersion, title, description, images, retailPrice, variants } = input;
      const sku = this.generateSku(masterProduct.id);

      const listingData: AmazonListingSubmission = {
        productType: "SHIRT",
        requirements: "LISTING",
        attributes: {
          condition_type: [{ value: "new_new" }],
          item_name: [{ value: title.substring(0, 500), language_tag: "en_US" }],
          product_description: [{ value: description.substring(0, 2000), language_tag: "en_US" }],
          brand: [{ value: "QR Gear", language_tag: "en_US" }],
          bullet_point: [
            { value: "Premium quality print-on-demand apparel", language_tag: "en_US" },
            { value: "Featuring custom QR code design", language_tag: "en_US" },
            { value: "Made in USA", language_tag: "en_US" },
          ],
          main_product_image_locator: images.length > 0 
            ? [{ media_location: images[0] }] 
            : undefined,
          other_product_image_locator_1: images.length > 1 
            ? [{ media_location: images[1] }] 
            : undefined,
          other_product_image_locator_2: images.length > 2 
            ? [{ media_location: images[2] }] 
            : undefined,
          purchasable_offer: [{
            currency: "USD",
            our_price: [{
              schedule: [{
                value_with_tax: retailPrice,
              }],
            }],
          }],
          fulfillment_availability: [{
            fulfillment_channel_code: "DEFAULT",
            quantity: 999,
          }],
        },
      };

      const response = await this.apiRequest<AmazonListingResponse>(
        "PUT",
        `/listings/2021-08-01/items/${config.sellerId}/${encodeURIComponent(sku)}`,
        { marketplaceIds: config.marketplaceId },
        listingData
      );

      if (response.issues && response.issues.some((i) => i.severity === "ERROR")) {
        const errors = response.issues
          .filter((i) => i.severity === "ERROR")
          .map((i) => i.message)
          .join("; ");
        return {
          success: false,
          error: `Amazon listing rejected: ${errors}`,
        };
      }

      this.skuToAsinCache.set(sku, response.submissionId || sku);

      return {
        success: true,
        externalListingId: sku,
        externalUrl: `https://sellercentral.amazon.com/skucentral?mSku=${encodeURIComponent(sku)}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[AmazonAdapter] createListing error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async updateListing(externalListingId: string, input: MarketplaceListingInput): Promise<MarketplaceListingResult> {
    try {
      const config = this.getConfig();
      const { title, description, images, retailPrice } = input;

      const patchData = {
        productType: "SHIRT",
        patches: [
          {
            op: "replace",
            path: "/attributes/item_name",
            value: [{ value: title.substring(0, 500), language_tag: "en_US" }],
          },
          {
            op: "replace",
            path: "/attributes/product_description",
            value: [{ value: description.substring(0, 2000), language_tag: "en_US" }],
          },
          {
            op: "replace",
            path: "/attributes/purchasable_offer",
            value: [{
              currency: "USD",
              our_price: [{
                schedule: [{
                  value_with_tax: retailPrice,
                }],
              }],
            }],
          },
        ],
      };

      if (images.length > 0) {
        patchData.patches.push({
          op: "replace",
          path: "/attributes/main_product_image_locator",
          value: [{ media_location: images[0] }] as any,
        });
      }

      await this.apiRequest<AmazonListingResponse>(
        "PATCH",
        `/listings/2021-08-01/items/${config.sellerId}/${encodeURIComponent(externalListingId)}`,
        { marketplaceIds: config.marketplaceId },
        patchData
      );

      return {
        success: true,
        externalListingId,
        externalUrl: `https://sellercentral.amazon.com/skucentral?mSku=${encodeURIComponent(externalListingId)}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[AmazonAdapter] updateListing error:", errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  async deleteListing(externalListingId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const config = this.getConfig();

      await this.apiRequest<void>(
        "DELETE",
        `/listings/2021-08-01/items/${config.sellerId}/${encodeURIComponent(externalListingId)}`,
        { marketplaceIds: config.marketplaceId }
      );

      this.skuToAsinCache.delete(externalListingId);

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[AmazonAdapter] deleteListing error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async syncInventory(externalListingId: string, inStock: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const config = this.getConfig();

      const patchData = {
        productType: "SHIRT",
        patches: [
          {
            op: "replace",
            path: "/attributes/fulfillment_availability",
            value: [{
              fulfillment_channel_code: "DEFAULT",
              quantity: inStock ? 999 : 0,
            }],
          },
        ],
      };

      await this.apiRequest<void>(
        "PATCH",
        `/listings/2021-08-01/items/${config.sellerId}/${encodeURIComponent(externalListingId)}`,
        { marketplaceIds: config.marketplaceId },
        patchData
      );

      return { success: true };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("[AmazonAdapter] syncInventory error:", errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    try {
      const config = this.getConfig();

      if (!config.clientId || !config.refreshToken) {
        return {
          isHealthy: false,
          responseTimeMs: Date.now() - startTime,
          error: "Amazon SP-API credentials not configured",
        };
      }

      await this.refreshAccessToken();

      await this.apiRequest<{ seller: { sellerId: string } }>(
        "GET",
        "/sellers/v1/marketplaceParticipations",
        {}
      );

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
    try {
      const rawData = payload as {
        NotificationType?: string;
        Payload?: {
          AmazonOrderId?: string;
          OrderStatus?: string;
          SellerSKU?: string;
        };
      };

      if (!rawData.NotificationType || !rawData.Payload) {
        return null;
      }

      const notificationType = rawData.NotificationType;

      if (notificationType === "ORDER_CHANGE") {
        const orderStatus = rawData.Payload.OrderStatus;
        let eventType = "order:created";

        switch (orderStatus) {
          case "Shipped":
            eventType = "order:shipped";
            break;
          case "Canceled":
          case "Cancelled":
            eventType = "order:cancelled";
            break;
          case "Delivered":
            eventType = "order:delivered";
            break;
          case "Pending":
          case "Unshipped":
            eventType = "order:created";
            break;
        }

        return {
          type: eventType,
          data: {
            orderId: rawData.Payload.AmazonOrderId || "",
            externalOrderId: rawData.Payload.AmazonOrderId || "",
            rawPayload: rawData,
          },
          timestamp: new Date(),
        };
      }

      if (notificationType === "LISTINGS_ITEM_STATUS_CHANGE") {
        return {
          type: "product:updated",
          data: {
            sku: rawData.Payload.SellerSKU || "",
            rawPayload: rawData,
          },
          timestamp: new Date(),
        };
      }

      return null;
    } catch {
      console.error("[AmazonAdapter] parseWebhook error");
      return null;
    }
  }
}
