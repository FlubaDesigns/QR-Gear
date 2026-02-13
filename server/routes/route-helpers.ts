import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import Stripe from "stripe";

export const widgetCorsMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  
  const envAllowedOrigins = (process.env.ALLOWED_WIDGET_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean);
  
  let partnerAllowedOrigins: string[] = [];
  try {
    const stores = await storage.getPartnerStores();
    for (const store of stores) {
      if (store.allowedOrigins && Array.isArray(store.allowedOrigins)) {
        partnerAllowedOrigins.push(...store.allowedOrigins);
      }
    }
  } catch (e) {
  }
  
  const allAllowedOrigins = Array.from(new Set([...envAllowedOrigins, ...partnerAllowedOrigins]));
  
  if (origin && allAllowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
  
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  
  next();
};

export type ProviderStatus = "healthy" | "degraded" | "down" | "not_configured";

export interface ProviderHealthResult {
  providers: {
    name: string;
    status: ProviderStatus;
    configured: boolean;
  }[];
  stripe: ProviderStatus;
  lastCheck: string;
  printify?: ProviderStatus;
}

export async function checkProviderHealth(): Promise<ProviderHealthResult> {
  const providers: { name: string; status: ProviderStatus; configured: boolean }[] = [];
  
  const printifyKey = process.env.PRINTIFY_API_KEY;
  if (printifyKey) {
    try {
      const response = await fetch("https://api.printify.com/v1/shops.json", {
        headers: { Authorization: `Bearer ${printifyKey}` },
        signal: AbortSignal.timeout(5000),
      });
      providers.push({
        name: "Printify",
        status: response.ok ? "healthy" : "degraded",
        configured: true,
      });
    } catch (e) {
      providers.push({ name: "Printify", status: "down", configured: true });
    }
  }

  const printfulKey = process.env.PRINTFUL_API_KEY;
  if (printfulKey) {
    try {
      const response = await fetch("https://api.printful.com/stores", {
        headers: { Authorization: `Bearer ${printfulKey}` },
        signal: AbortSignal.timeout(5000),
      });
      providers.push({
        name: "Printful",
        status: response.ok ? "healthy" : "degraded",
        configured: true,
      });
    } catch (e) {
      providers.push({ name: "Printful", status: "down", configured: true });
    }
  }

  const apliiqKey = process.env.APLIIQ_API_KEY;
  if (apliiqKey) {
    providers.push({ name: "Apliiq", status: "healthy", configured: true });
  }

  if (providers.length === 0) {
    providers.push({ name: "No POD providers", status: "not_configured", configured: false });
  }

  let stripeStatus: ProviderStatus = "not_configured";
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (stripeKey) {
    try {
      const stripe = new Stripe(stripeKey);
      await stripe.balance.retrieve();
      stripeStatus = "healthy";
    } catch (e) {
      stripeStatus = "down";
    }
  }

  const primaryProvider = providers.find(p => p.configured) || providers[0];
  return {
    providers,
    stripe: stripeStatus,
    lastCheck: new Date().toISOString(),
    printify: primaryProvider?.name === "Printify" ? primaryProvider.status : 
              (printifyKey ? "down" : "not_configured"),
  };
}

export async function autoSyncVariantsFromLocalCatalog(
  productId: string,
  blueprintId: number | null,
  printProviderId: number | null,
  basePrice: string,
  existingMetadata?: Record<string, any>
): Promise<{ variantsSeeded: number; syncWarning: string | null; colors?: any[]; sizes?: string[] }> {
  let variantsSeeded = 0;
  let syncWarning: string | null = null;
  
  if (!blueprintId || !printProviderId) {
    return { variantsSeeded: 0, syncWarning: "Missing blueprintId or printProviderId" };
  }
  
  try {
    const localProvider = await storage.getPrintifyPrintProvider(blueprintId, printProviderId);
    
    if (localProvider && localProvider.availableColors && localProvider.availableSizes) {
      const colors = localProvider.availableColors as Array<{ name: string; hex?: string }>;
      const sizes = localProvider.availableSizes as string[];
      
      let variantIdCounter = 1;
      for (const color of colors) {
        for (const size of sizes) {
          await storage.upsertProductVariant({
            productId,
            printifyVariantId: variantIdCounter++,
            title: `${size} / ${color.name}`,
            size: size,
            color: color.name,
            colorHex: color.hex || null,
            price: basePrice,
            isEnabled: true,
            isInStock: true,
          });
          variantsSeeded++;
        }
      }
      
      const mergedMetadata = {
        ...(existingMetadata || {}),
        autoSyncedFromLocalCatalog: true,
        syncedAt: new Date().toISOString(),
        variantIdsArePlaceholders: true,
      };
      
      await storage.updateProduct(productId, {
        availableColors: colors,
        availableSizes: sizes,
        metadata: mergedMetadata,
      });
      
      console.log(`[Auto-Sync] Seeded ${variantsSeeded} variants for ${productId} from local catalog`);
      return { variantsSeeded, syncWarning, colors, sizes };
    } else {
      syncWarning = "Local catalog data not available. Run catalog sync first.";
      console.log(`[Auto-Sync] No local data for blueprint ${blueprintId}/provider ${printProviderId}`);
    }
  } catch (syncError: any) {
    syncWarning = `Auto-sync failed: ${syncError.message}`;
    console.error(`[Auto-Sync] Error:`, syncError);
  }
  
  return { variantsSeeded, syncWarning };
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
