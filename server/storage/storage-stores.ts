import type {
  PartnerStore,
  InsertPartnerStore,
  PartnerStoreProduct,
  InsertPartnerStoreProduct,
  Product,
} from "@shared/schema";

export const storeMethods = {
  async getPartnerStores(this: any): Promise<PartnerStore[]> {
    return Array.from(this.partnerStores.values()) as PartnerStore[];
  },

  async getPartnerStore(this: any, id: string): Promise<PartnerStore | undefined> {
    return this.partnerStores.get(id);
  },

  async getPartnerStoreBySlug(this: any, slug: string): Promise<PartnerStore | undefined> {
    return (Array.from(this.partnerStores.values()) as PartnerStore[]).find((s) => s.slug === slug);
  },

  async createPartnerStore(this: any, store: InsertPartnerStore): Promise<PartnerStore> {
    const id = `ps_${Date.now()}`;
    const newStore: PartnerStore = {
      ...store,
      id,
      description: store.description ?? null,
      logoUrl: store.logoUrl ?? null,
      websiteUrl: store.websiteUrl ?? null,
      businessPageUrlPattern: store.businessPageUrlPattern ?? null,
      allowedOrigins: store.allowedOrigins ?? null,
      primaryColor: store.primaryColor ?? null,
      accentColor: store.accentColor ?? null,
      availableSegments: store.availableSegments ?? null,
      annualMemberPerk: store.annualMemberPerk ?? null,
      commissionPercent: store.commissionPercent ?? "0",
      isActive: store.isActive ?? true,
      isInternal: store.isInternal ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.partnerStores.set(id, newStore);
    return newStore;
  },

  async updatePartnerStore(this: any, id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined> {
    const existing = this.partnerStores.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...store, updatedAt: new Date() };
    this.partnerStores.set(id, updated);
    return updated;
  },

  async deletePartnerStore(this: any, id: string): Promise<void> {
    (Array.from(this.partnerStoreProducts.entries()) as [string, PartnerStoreProduct][]).forEach(([productId, product]) => {
      if (product.partnerStoreId === id) this.partnerStoreProducts.delete(productId);
    });
    this.partnerStores.delete(id);
  },

  async getPartnerStoreProducts(this: any, partnerStoreId: string): Promise<PartnerStoreProduct[]> {
    return (Array.from(this.partnerStoreProducts.values()) as PartnerStoreProduct[]).filter((p) => p.partnerStoreId === partnerStoreId);
  },

  async getPartnerStoreProduct(this: any, partnerStoreId: string, productId: string): Promise<PartnerStoreProduct | undefined> {
    return (Array.from(this.partnerStoreProducts.values()) as PartnerStoreProduct[]).find(
      (p: PartnerStoreProduct) => p.partnerStoreId === partnerStoreId && p.productId === productId
    );
  },

  async getProductsForStore(this: any, storeSlug: string, segment?: string): Promise<Product[]> {
    const slugLower = storeSlug.toLowerCase();
    const store = (Array.from(this.partnerStores.values()) as PartnerStore[]).find(
      (s: PartnerStore) => s.slug === storeSlug ||
           s.slug.toLowerCase().startsWith(slugLower) ||
           s.name.toLowerCase() === slugLower ||
           s.name.toLowerCase().includes(slugLower)
    );
    if (!store) return [];

    const storeProductLinks = (Array.from(this.partnerStoreProducts.values()) as PartnerStoreProduct[])
      .filter((sp: PartnerStoreProduct) => sp.partnerStoreId === store.id && (sp.isEnabled ?? true));

    let products = storeProductLinks
      .map((sp: PartnerStoreProduct) => this.products.get(sp.productId))
      .filter((p: Product | undefined): p is Product => p !== undefined && (p.isEnabled === true));

    if (segment) {
      products = products.filter((p: Product) => {
        const category = p.category?.toLowerCase() || "";
        return category.includes(`/${segment.toLowerCase()}`);
      });
    }

    return products;
  },

  async addPartnerStoreProduct(this: any, product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct> {
    const id = `psp_${Date.now()}`;
    const newProduct: PartnerStoreProduct = {
      ...product,
      id,
      customPrice: product.customPrice ?? null,
      customName: product.customName ?? null,
      kcPlacements: product.kcPlacements ?? null,
      kcBusinessSlug: product.kcBusinessSlug ?? null,
      enabledSizes: product.enabledSizes ?? null,
      enabledColors: product.enabledColors ?? null,
      defaultColor: product.defaultColor ?? null,
      mockupsByColor: product.mockupsByColor ?? null,
      sortOrder: product.sortOrder ?? 0,
      isEnabled: product.isEnabled ?? true,
    };
    this.partnerStoreProducts.set(id, newProduct);
    return newProduct;
  },

  async updatePartnerStoreProduct(this: any, id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    const existing = this.partnerStoreProducts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...product };
    this.partnerStoreProducts.set(id, updated);
    return updated;
  },

  async updatePartnerStoreProductByIds(this: any, partnerStoreId: string, productId: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
    const existing = await this.getPartnerStoreProduct(partnerStoreId, productId);
    if (!existing) return undefined;
    const updated = { ...existing, ...product };
    this.partnerStoreProducts.set(existing.id, updated);
    return updated;
  },

  async removePartnerStoreProduct(this: any, id: string): Promise<void> {
    this.partnerStoreProducts.delete(id);
  },

  async syncPartnerStoreProducts(this: any, partnerStoreId: string, productIds: string[]): Promise<void> {
    const existingProducts = (Array.from(this.partnerStoreProducts.values()) as PartnerStoreProduct[])
      .filter((p: PartnerStoreProduct) => p.partnerStoreId === partnerStoreId);

    const existingConfigs = new Map<string, PartnerStoreProduct>();
    existingProducts.forEach((p: PartnerStoreProduct) => existingConfigs.set(p.productId, p));

    (Array.from(this.partnerStoreProducts.entries()) as [string, PartnerStoreProduct][]).forEach(([id, product]) => {
      if (product.partnerStoreId === partnerStoreId) this.partnerStoreProducts.delete(id);
    });

    for (let i = 0; i < productIds.length; i++) {
      const productId = productIds[i];
      const existingConfig = existingConfigs.get(productId);

      if (existingConfig) {
        await this.addPartnerStoreProduct({
          partnerStoreId,
          productId,
          sortOrder: i,
          enabledSizes: existingConfig.enabledSizes,
          enabledColors: existingConfig.enabledColors,
          kcPlacements: existingConfig.kcPlacements,
          kcBusinessSlug: existingConfig.kcBusinessSlug,
          customPrice: existingConfig.customPrice,
          customName: existingConfig.customName,
          isEnabled: existingConfig.isEnabled,
        });
      } else {
        const sourceProduct = this.products.get(productId);
        const availableSizes = Array.isArray(sourceProduct?.availableSizes)
          ? sourceProduct.availableSizes as string[]
          : null;
        const availableColors = Array.isArray(sourceProduct?.availableColors)
          ? (sourceProduct.availableColors as Array<{name: string; hex: string}>).map((c: {name: string; hex: string}) => c.name)
          : null;

        await this.addPartnerStoreProduct({
          partnerStoreId,
          productId,
          sortOrder: i,
          enabledSizes: availableSizes,
          enabledColors: availableColors,
        });
      }
    }
  },
};
