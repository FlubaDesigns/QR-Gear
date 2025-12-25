import type { BasePrintProviderAdapter, BaseMarketplaceAdapter, PrintProviderType, MarketplaceType } from "./base";

class AdapterRegistry {
  private printProviders: Map<PrintProviderType, BasePrintProviderAdapter> = new Map();
  private marketplaces: Map<MarketplaceType, BaseMarketplaceAdapter> = new Map();

  registerPrintProvider(adapter: BasePrintProviderAdapter): void {
    this.printProviders.set(adapter.providerType, adapter);
    console.log(`[AdapterRegistry] Registered print provider: ${adapter.displayName}`);
  }

  registerMarketplace(adapter: BaseMarketplaceAdapter): void {
    this.marketplaces.set(adapter.marketplaceType, adapter);
    console.log(`[AdapterRegistry] Registered marketplace: ${adapter.displayName}`);
  }

  getPrintProvider(type: PrintProviderType): BasePrintProviderAdapter | undefined {
    return this.printProviders.get(type);
  }

  getMarketplace(type: MarketplaceType): BaseMarketplaceAdapter | undefined {
    return this.marketplaces.get(type);
  }

  getAllPrintProviders(): BasePrintProviderAdapter[] {
    return Array.from(this.printProviders.values());
  }

  getAllMarketplaces(): BaseMarketplaceAdapter[] {
    return Array.from(this.marketplaces.values());
  }

  getEnabledPrintProviders(): PrintProviderType[] {
    return Array.from(this.printProviders.keys());
  }

  getEnabledMarketplaces(): MarketplaceType[] {
    return Array.from(this.marketplaces.keys());
  }
}

export const adapterRegistry = new AdapterRegistry();

export async function initializeAdapters(): Promise<void> {
  console.log("[AdapterRegistry] Initializing adapters...");
  
  try {
    const { PrintifyAdapter } = await import("./print-providers/printify");
    adapterRegistry.registerPrintProvider(new PrintifyAdapter());
  } catch (e) {
    console.log("[AdapterRegistry] Printify adapter not yet implemented");
  }

  try {
    const { PrintfulAdapter } = await import("./print-providers/printful");
    adapterRegistry.registerPrintProvider(new PrintfulAdapter());
  } catch (e) {
    console.log("[AdapterRegistry] Printful adapter not yet implemented");
  }

  try {
    const { ApliiqAdapter } = await import("./print-providers/apliiq");
    adapterRegistry.registerPrintProvider(new ApliiqAdapter());
  } catch (e) {
    console.log("[AdapterRegistry] Apliiq adapter not yet implemented");
  }

  try {
    const { EtsyAdapter } = await import("./marketplaces/etsy");
    adapterRegistry.registerMarketplace(new EtsyAdapter());
  } catch (e) {
    console.log("[AdapterRegistry] Etsy adapter not yet implemented");
  }

  try {
    const { EbayAdapter } = await import("./marketplaces/ebay");
    adapterRegistry.registerMarketplace(new EbayAdapter());
  } catch (e) {
    console.log("[AdapterRegistry] eBay adapter not yet implemented");
  }

  try {
    const { AmazonAdapter } = await import("./marketplaces/amazon");
    adapterRegistry.registerMarketplace(new AmazonAdapter());
  } catch (e) {
    console.log("[AdapterRegistry] Amazon adapter not yet implemented");
  }

  console.log(`[AdapterRegistry] Initialized ${adapterRegistry.getEnabledPrintProviders().length} print providers, ${adapterRegistry.getEnabledMarketplaces().length} marketplaces`);
}

export * from "./base";
