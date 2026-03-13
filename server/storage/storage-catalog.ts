import type {
  PrintifyBlueprint,
  InsertPrintifyBlueprint,
  PrintifyPrintProvider,
  InsertPrintifyPrintProvider,
  PrintifyCatalogSync,
  InsertPrintifyCatalogSync,
  PrintifyCostSync,
  InsertPrintifyCostSync,
  MasterProduct,
  InsertMasterProduct,
  ProductDesignVersion,
  InsertProductDesignVersion,
  ChannelConfig,
  InsertChannelConfig,
  ChannelPublishState,
  InsertChannelPublishState,
  Product,
} from "@shared/schema";

export const catalogMethods = {
  async getPrintifyBlueprints(this: any): Promise<PrintifyBlueprint[]> {
    return Array.from(this.printifyBlueprints.values());
  },

  async getPrintifyBlueprint(this: any, id: number): Promise<PrintifyBlueprint | undefined> {
    return this.printifyBlueprints.get(id);
  },

  async upsertPrintifyBlueprint(this: any, blueprint: InsertPrintifyBlueprint): Promise<PrintifyBlueprint> {
    const existing = this.printifyBlueprints.get(blueprint.id);
    const result: PrintifyBlueprint = {
      ...blueprint,
      description: blueprint.description ?? null,
      brand: blueprint.brand ?? null,
      model: blueprint.model ?? null,
      images: blueprint.images ?? null,
      primaryImageUrl: blueprint.primaryImageUrl ?? null,
      category: blueprint.category ?? null,
      lastSyncedAt: new Date(),
      createdAt: existing?.createdAt || new Date(),
    };
    this.printifyBlueprints.set(blueprint.id, result);
    return result;
  },

  async deletePrintifyBlueprint(this: any, id: number): Promise<void> {
    this.printifyBlueprints.delete(id);
  },

  async clearPrintifyBlueprints(this: any): Promise<void> {
    this.printifyBlueprints.clear();
  },

  async getAllPrintifyProviders(this: any): Promise<PrintifyPrintProvider[]> {
    return Array.from(this.printifyPrintProviders.values());
  },

  async getPrintifyPrintProviders(this: any, blueprintId: number): Promise<PrintifyPrintProvider[]> {
    return (Array.from(this.printifyPrintProviders.values()) as PrintifyPrintProvider[])
      .filter((p) => p.blueprintId === blueprintId);
  },

  async getPrintifyPrintProvider(this: any, blueprintId: number, providerId: number): Promise<PrintifyPrintProvider | undefined> {
    const id = `pp_${blueprintId}_${providerId}`;
    return this.printifyPrintProviders.get(id);
  },

  async upsertPrintifyPrintProvider(this: any, provider: InsertPrintifyPrintProvider): Promise<PrintifyPrintProvider> {
    const id = `pp_${provider.blueprintId}_${provider.providerId}`;
    const result: PrintifyPrintProvider = {
      ...provider,
      id,
      country: provider.country ?? null,
      isUSA: provider.isUSA ?? false,
      minCost: null,
      maxCost: null,
      availableColors: null,
      availableSizes: null,
      placeholderProductId: null,
      costsFetchedAt: null,
      lastSyncedAt: new Date(),
    };
    this.printifyPrintProviders.set(id, result);
    return result;
  },

  async updatePrintifyProviderCosts(this: any, blueprintId: number, providerId: number, costs: { minCost: number; maxCost: number; placeholderProductId?: string; availableColors?: any[]; availableSizes?: string[] }): Promise<PrintifyPrintProvider | undefined> {
    const id = `pp_${blueprintId}_${providerId}`;
    const existing = this.printifyPrintProviders.get(id);
    if (!existing) return undefined;
    const updated: any = {
      ...existing,
      minCost: costs.minCost,
      maxCost: costs.maxCost,
      placeholderProductId: costs.placeholderProductId ?? null,
      costsFetchedAt: new Date(),
    };
    if (costs.availableColors !== undefined) {
      updated.availableColors = costs.availableColors;
    }
    if (costs.availableSizes !== undefined) {
      updated.availableSizes = costs.availableSizes;
    }
    this.printifyPrintProviders.set(id, updated);
    return updated;
  },

  async updateProductPricesByProvider(this: any, blueprintId: number, providerId: number, basePrice: string): Promise<number> {
    let count = 0;
    this.products.forEach((product: Product, id: string) => {
      if (product.blueprintId === blueprintId && product.printProviderId === providerId) {
        this.products.set(id, { ...product, basePrice, updatedAt: new Date() });
        count++;
      }
    });
    return count;
  },

  async deletePrintifyPrintProvidersByBlueprint(this: any, blueprintId: number): Promise<void> {
    (Array.from(this.printifyPrintProviders.entries()) as [string, PrintifyPrintProvider][]).forEach(([id, p]) => {
      if (p.blueprintId === blueprintId) this.printifyPrintProviders.delete(id);
    });
  },

  async clearPrintifyPrintProviders(this: any): Promise<void> {
    this.printifyPrintProviders.clear();
  },

  async createCatalogSync(this: any, sync: InsertPrintifyCatalogSync): Promise<PrintifyCatalogSync> {
    const result: PrintifyCatalogSync = {
      ...sync,
      id: `sync_${Date.now()}`,
      blueprintsCount: sync.blueprintsCount ?? 0,
      providersCount: sync.providersCount ?? 0,
      errorMessage: sync.errorMessage ?? null,
      startedAt: sync.startedAt ?? new Date(),
      completedAt: sync.completedAt ?? null,
    };
    this.catalogSyncs.unshift(result);
    return result;
  },

  async updateCatalogSync(this: any, id: string, sync: Partial<InsertPrintifyCatalogSync>): Promise<PrintifyCatalogSync | undefined> {
    const index = this.catalogSyncs.findIndex((s: PrintifyCatalogSync) => s.id === id);
    if (index === -1) return undefined;
    this.catalogSyncs[index] = { ...this.catalogSyncs[index], ...sync };
    return this.catalogSyncs[index];
  },

  async getLatestCatalogSync(this: any): Promise<PrintifyCatalogSync | undefined> {
    return this.catalogSyncs[0];
  },

  async getCatalogSyncHistory(this: any): Promise<PrintifyCatalogSync[]> {
    return this.catalogSyncs.slice(0, 20);
  },

  async createCostSync(this: any, sync: InsertPrintifyCostSync): Promise<PrintifyCostSync> {
    const result: PrintifyCostSync = {
      ...sync,
      id: `cost_sync_${Date.now()}`,
      totalProviders: sync.totalProviders ?? 0,
      processedCount: sync.processedCount ?? 0,
      successCount: sync.successCount ?? 0,
      failedCount: sync.failedCount ?? 0,
      skippedCount: sync.skippedCount ?? 0,
      lastProcessedProviderId: sync.lastProcessedProviderId ?? null,
      errorMessage: sync.errorMessage ?? null,
      startedAt: sync.startedAt ?? new Date(),
      completedAt: sync.completedAt ?? null,
    };
    this.costSyncs.unshift(result);
    return result;
  },

  async updateCostSync(this: any, id: string, sync: Partial<InsertPrintifyCostSync>): Promise<PrintifyCostSync | undefined> {
    const index = this.costSyncs.findIndex((s: PrintifyCostSync) => s.id === id);
    if (index === -1) return undefined;
    this.costSyncs[index] = { ...this.costSyncs[index], ...sync };
    return this.costSyncs[index];
  },

  async getLatestCostSync(this: any): Promise<PrintifyCostSync | undefined> {
    return this.costSyncs[0];
  },

  async getActiveCostSync(this: any): Promise<PrintifyCostSync | undefined> {
    return this.costSyncs.find((s: PrintifyCostSync) => s.status === 'running');
  },

  async getCostSyncHistory(this: any): Promise<PrintifyCostSync[]> {
    return this.costSyncs.slice(0, 20);
  },

  async getProviderCostStats(this: any): Promise<{ total: number; withCosts: number; stale: number }> {
    const providers = Array.from(this.printifyPrintProviders.values()) as PrintifyPrintProvider[];
    const now = Date.now();
    const staleThreshold = 24 * 60 * 60 * 1000;

    let withCosts = 0;
    let stale = 0;

    for (const p of providers) {
      if (p.minCost && p.minCost > 0) {
        withCosts++;
        if (p.costsFetchedAt && now - new Date(p.costsFetchedAt).getTime() > staleThreshold) {
          stale++;
        }
      }
    }

    return { total: providers.length, withCosts, stale };
  },

  async getAllMasterProducts(this: any): Promise<MasterProduct[]> {
    return Array.from(this.orchestrationMasterProducts.values());
  },

  async getMasterProduct(this: any, id: string): Promise<MasterProduct | undefined> {
    return this.orchestrationMasterProducts.get(id);
  },

  async createMasterProduct(this: any, product: InsertMasterProduct): Promise<MasterProduct> {
    const id = crypto.randomUUID();
    const newProduct: MasterProduct = {
      id,
      sku: product.sku,
      title: product.title,
      description: product.description ?? null,
      productType: product.productType,
      currentDesignVersionId: null,
      pricingProfileId: null,
      baseCost: null,
      retailPrice: null,
      status: product.status ?? "draft",
      channels: null,
      tags: product.tags ?? [],
      bundleParentId: null,
      bundleDiscount: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orchestrationMasterProducts.set(id, newProduct);
    return newProduct;
  },

  async updateMasterProduct(this: any, id: string, product: Partial<InsertMasterProduct>): Promise<MasterProduct | undefined> {
    const existing = this.orchestrationMasterProducts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...product, updatedAt: new Date() };
    this.orchestrationMasterProducts.set(id, updated);
    return updated;
  },

  async deleteMasterProduct(this: any, id: string): Promise<void> {
    this.orchestrationMasterProducts.delete(id);
  },

  async getDesignVersions(this: any, masterProductId: string): Promise<ProductDesignVersion[]> {
    return (Array.from(this.orchestrationDesignVersions.values()) as ProductDesignVersion[]).filter((v) => v.masterProductId === masterProductId);
  },

  async getActiveDesignVersion(this: any, masterProductId: string): Promise<ProductDesignVersion | undefined> {
    return (Array.from(this.orchestrationDesignVersions.values()) as ProductDesignVersion[]).find((v) => v.masterProductId === masterProductId && v.isActive);
  },

  async createDesignVersion(this: any, version: InsertProductDesignVersion): Promise<ProductDesignVersion> {
    const id = crypto.randomUUID();
    const newVersion: ProductDesignVersion = {
      id,
      masterProductId: version.masterProductId,
      versionNumber: version.versionNumber ?? 1,
      headerText: version.headerText ?? null,
      headerStyle: version.headerStyle ?? null,
      footerText: version.footerText ?? null,
      footerStyle: version.footerStyle ?? null,
      qrUrl: version.qrUrl,
      renderedPngUrl: version.renderedPngUrl ?? null,
      renderedSvgUrl: version.renderedSvgUrl ?? null,
      qrCodeUrl: null,
      placementImages: null,
      isActive: version.isActive ?? true,
      createdAt: new Date(),
    };
    this.orchestrationDesignVersions.set(id, newVersion);
    return newVersion;
  },

  async updateDesignVersion(this: any, id: string, version: Partial<InsertProductDesignVersion>): Promise<ProductDesignVersion | undefined> {
    const existing = this.orchestrationDesignVersions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...version };
    this.orchestrationDesignVersions.set(id, updated);
    return updated;
  },

  async getAllChannelConfigs(this: any): Promise<ChannelConfig[]> {
    return Array.from(this.orchestrationChannelConfigs.values());
  },

  async getChannelConfig(this: any, channelType: string): Promise<ChannelConfig | undefined> {
    return this.orchestrationChannelConfigs.get(channelType);
  },

  async createChannelConfig(this: any, config: InsertChannelConfig): Promise<ChannelConfig> {
    const id = crypto.randomUUID();
    const newConfig: ChannelConfig = {
      id,
      channelType: config.channelType,
      displayName: config.displayName,
      isEnabled: config.isEnabled ?? false,
      apiKeySecretName: config.apiKeySecretName ?? null,
      apiSecretSecretName: null,
      shopId: config.shopId ?? null,
      rateLimit: 60,
      rateLimitWindow: 60,
      webhookSecret: null,
      webhookUrl: null,
      lastHealthCheck: null,
      settings: config.settings ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.orchestrationChannelConfigs.set(config.channelType, newConfig);
    return newConfig;
  },

  async updateChannelConfig(this: any, channelType: string, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined> {
    const existing = this.orchestrationChannelConfigs.get(channelType);
    if (!existing) return undefined;
    const updated = { ...existing, ...config };
    this.orchestrationChannelConfigs.set(channelType, updated);
    return updated;
  },

  async getPublishStates(this: any, masterProductId: string): Promise<ChannelPublishState[]> {
    return (Array.from(this.orchestrationPublishStates.values()) as ChannelPublishState[]).filter((s) => s.masterProductId === masterProductId);
  },

  async getPublishState(this: any, masterProductId: string, channelType: string): Promise<ChannelPublishState | undefined> {
    return this.orchestrationPublishStates.get(`${masterProductId}-${channelType}`);
  },

  async upsertPublishState(this: any, state: InsertChannelPublishState): Promise<ChannelPublishState> {
    const key = `${state.masterProductId}-${state.channelType}`;
    const existing = this.orchestrationPublishStates.get(key);
    const newState: ChannelPublishState = {
      id: existing?.id ?? crypto.randomUUID(),
      masterProductId: state.masterProductId,
      publishedDesignVersionId: state.publishedDesignVersionId ?? null,
      channelType: state.channelType,
      externalProductId: state.externalProductId ?? null,
      externalListingId: null,
      externalVariantIds: null,
      status: state.status ?? "pending",
      lastPublishedAt: null,
      lastSyncedAt: new Date(),
      lastError: state.lastError ?? null,
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    this.orchestrationPublishStates.set(key, newState);
    return newState;
  },
};
