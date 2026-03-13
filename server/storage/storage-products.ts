import type {
  Product,
  InsertProduct,
  ProductCategory,
  InsertProductCategory,
  ProductCategoryAssignment,
  InsertProductCategoryAssignment,
  ProductVariant,
  InsertProductVariant,
  CustomDesign,
  InsertCustomDesign,
  LibraryAsset,
  InsertLibraryAsset,
  TemplateCategory,
  InsertTemplateCategory,
  GraphicSet,
  InsertGraphicSet,
} from "@shared/schema";

export const productMethods = {
  async getProduct(this: any, id: string): Promise<Product | undefined> {
    return this.products.get(id);
  },

  async getAllProducts(this: any): Promise<Product[]> {
    return Array.from(this.products.values()) as Product[];
  },

  async createProduct(this: any, product: InsertProduct): Promise<Product> {
    const id = product.id || `prod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const base: Record<string, any> = { ...product };
    for (const key of Object.keys(base)) {
      if (base[key] === undefined) base[key] = null;
    }
    const newProduct: Product = {
      ...base,
      id,
      isEnabled: product.isEnabled ?? false,
      markupPercent: product.markupPercent ?? "0",
      markupFixed: product.markupFixed ?? "0",
      qrProductionCost: product.qrProductionCost ?? "0",
      sortOrder: product.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Product;
    this.products.set(id, newProduct);
    return newProduct;
  },

  async updateProduct(this: any, id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...product, updatedAt: new Date() };
    this.products.set(id, updated);
    return updated;
  },

  async deleteProduct(this: any, id: string): Promise<void> {
    (Array.from(this.productCategoryAssignments.entries()) as [string, ProductCategoryAssignment][]).forEach(([assignmentId, assignment]) => {
      if (assignment.productId === id) this.productCategoryAssignments.delete(assignmentId);
    });
    this.products.delete(id);
  },

  async getEnabledProducts(this: any): Promise<Product[]> {
    return (Array.from(this.products.values()) as Product[]).filter((p) => p.isEnabled);
  },

  async toggleProductEnabled(this: any, id: string, enabled: boolean): Promise<Product | undefined> {
    const existing = this.products.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, isEnabled: enabled, updatedAt: new Date() };
    this.products.set(id, updated);
    return updated;
  },

  async getProducts(this: any): Promise<Product[]> {
    return Array.from(this.products.values()) as Product[];
  },

  async getProductCategories(this: any): Promise<ProductCategory[]> {
    return (Array.from(this.productCategories.values()) as ProductCategory[]).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async getAllProductCategories(this: any): Promise<ProductCategory[]> {
    return (Array.from(this.productCategories.values()) as ProductCategory[]).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async getActiveProductCategories(this: any): Promise<ProductCategory[]> {
    return (Array.from(this.productCategories.values()) as ProductCategory[]).filter((c) => c.isActive).sort((a: ProductCategory, b: ProductCategory) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async getProductCategoriesByTaxonomy(this: any, taxonomyType: string): Promise<ProductCategory[]> {
    return (Array.from(this.productCategories.values()) as ProductCategory[]).filter((c) => c.taxonomyType === taxonomyType).sort((a: ProductCategory, b: ProductCategory) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async getProductCategory(this: any, id: string): Promise<ProductCategory | undefined> {
    return this.productCategories.get(id);
  },

  async createProductCategory(this: any, category: InsertProductCategory): Promise<ProductCategory> {
    const id = `cat_${Date.now()}`;
    const newCategory: ProductCategory = {
      ...category,
      id,
      description: category.description ?? null,
      icon: category.icon ?? null,
      parentId: category.parentId ?? null,
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
      createdAt: new Date(),
    };
    this.productCategories.set(id, newCategory);
    return newCategory;
  },

  async updateProductCategory(this: any, id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> {
    const existing = this.productCategories.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...category };
    this.productCategories.set(id, updated);
    return updated;
  },

  async deleteProductCategory(this: any, id: string): Promise<void> {
    (Array.from(this.productCategoryAssignments.entries()) as [string, ProductCategoryAssignment][]).forEach(([assignmentId, assignment]) => {
      if (assignment.categoryId === id) this.productCategoryAssignments.delete(assignmentId);
    });
    this.productCategories.delete(id);
  },

  async getProductCategoryAssignments(this: any, productId: string): Promise<ProductCategoryAssignment[]> {
    return (Array.from(this.productCategoryAssignments.values()) as ProductCategoryAssignment[]).filter((a) => a.productId === productId);
  },

  async getProductsByCategory(this: any, categoryId: string): Promise<Product[]> {
    const assignments = (Array.from(this.productCategoryAssignments.values()) as ProductCategoryAssignment[]).filter((a) => a.categoryId === categoryId);
    const productIds = assignments.map((a: ProductCategoryAssignment) => a.productId);
    return (Array.from(this.products.values()) as Product[]).filter((p) => productIds.includes(p.id));
  },

  async assignProductToCategory(this: any, assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment> {
    const id = `pca_${Date.now()}`;
    const newAssignment: ProductCategoryAssignment = {
      ...assignment,
      id,
      createdAt: new Date(),
    };
    this.productCategoryAssignments.set(id, newAssignment);
    return newAssignment;
  },

  async removeProductFromCategory(this: any, productId: string, categoryId: string): Promise<void> {
    for (const [id, assignment] of Array.from(this.productCategoryAssignments.entries()) as [string, ProductCategoryAssignment][]) {
      if (assignment.productId === productId && assignment.categoryId === categoryId) {
        this.productCategoryAssignments.delete(id);
        break;
      }
    }
  },

  async syncProductCategories(this: any, productId: string, categoryIds: string[]): Promise<void> {
    (Array.from(this.productCategoryAssignments.entries()) as [string, ProductCategoryAssignment][]).forEach(([id, assignment]) => {
      if (assignment.productId === productId) {
        this.productCategoryAssignments.delete(id);
      }
    });
    for (const categoryId of categoryIds) {
      await this.assignProductToCategory({ productId, categoryId });
    }
  },

  async getProductVariants(this: any, productId: string): Promise<ProductVariant[]> {
    return (Array.from(this.productVariants.values()) as ProductVariant[]).filter((v) => v.productId === productId);
  },

  async upsertProductVariant(this: any, variant: InsertProductVariant): Promise<ProductVariant> {
    const id = `pv_${Date.now()}`;
    const newVariant: ProductVariant = {
      ...variant,
      id,
      size: variant.size ?? null,
      color: variant.color ?? null,
      colorHex: variant.colorHex ?? null,
      isEnabled: variant.isEnabled ?? true,
      isInStock: variant.isInStock ?? true,
    };
    this.productVariants.set(id, newVariant);
    return newVariant;
  },

  async toggleVariantEnabled(this: any, id: string, enabled: boolean): Promise<ProductVariant | undefined> {
    const existing = this.productVariants.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, isEnabled: enabled };
    this.productVariants.set(id, updated);
    return updated;
  },

  async getCustomDesign(this: any, id: string): Promise<CustomDesign | undefined> {
    return this.customDesigns.get(id);
  },

  async getCustomDesigns(this: any): Promise<CustomDesign[]> {
    return (Array.from(this.customDesigns.values()) as CustomDesign[])
      .sort((a: CustomDesign, b: CustomDesign) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getCustomDesignsForLibrary(this: any): Promise<CustomDesign[]> {
    return (Array.from(this.customDesigns.values()) as CustomDesign[])
      .filter((d: CustomDesign) => d.savedToLibrary)
      .sort((a: CustomDesign, b: CustomDesign) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getCustomDesignsByStoreSegment(this: any, storeType: string, storeName: string, segment?: string): Promise<CustomDesign[]> {
    return (Array.from(this.customDesigns.values()) as CustomDesign[])
      .filter((d: CustomDesign) => {
        if (!d.savedToStore) return false;
        if (d.storeType?.toLowerCase() !== storeType.toLowerCase()) return false;
        if (d.storeName?.toLowerCase() !== storeName.toLowerCase()) return false;
        if (segment && d.segment?.toLowerCase() !== segment.toLowerCase()) return false;
        return true;
      })
      .sort((a: CustomDesign, b: CustomDesign) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async createCustomDesign(this: any, design: InsertCustomDesign): Promise<CustomDesign> {
    const id = design.id || `custom_${Date.now()}`;
    const designBase: Record<string, any> = { ...design };
    for (const key of Object.keys(designBase)) {
      if (designBase[key] === undefined) designBase[key] = null;
    }
    const newDesign: CustomDesign = {
      ...designBase,
      id,
      textUpcharge: design.textUpcharge ?? "2.00",
      isFeatured: design.isFeatured ?? false,
      isSeasonalPromo: design.isSeasonalPromo ?? false,
      savedToLibrary: design.savedToLibrary ?? false,
      savedToStore: design.savedToStore ?? false,
      placementConfigs: design.placementConfigs ?? {},
      createdAt: new Date(),
      updatedAt: new Date(),
    } as CustomDesign;
    this.customDesigns.set(newDesign.id, newDesign);
    return newDesign;
  },

  async updateCustomDesign(this: any, id: string, design: Partial<InsertCustomDesign>): Promise<CustomDesign | undefined> {
    const existing = this.customDesigns.get(id);
    if (!existing) return undefined;
    const updated: CustomDesign = {
      ...existing,
      ...design,
      updatedAt: new Date(),
    };
    this.customDesigns.set(id, updated);
    return updated;
  },

  async deleteCustomDesign(this: any, id: string): Promise<void> {
    this.customDesigns.delete(id);
  },

  async getTemplateCategories(this: any): Promise<TemplateCategory[]> {
    return (Array.from(this.templateCategories.values()) as TemplateCategory[])
      .filter((c: TemplateCategory) => c.isActive)
      .sort((a: TemplateCategory, b: TemplateCategory) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async getTemplateCategoriesByParent(this: any, parentId: string | null): Promise<TemplateCategory[]> {
    return (Array.from(this.templateCategories.values()) as TemplateCategory[])
      .filter((c: TemplateCategory) => c.isActive && c.parentId === parentId)
      .sort((a: TemplateCategory, b: TemplateCategory) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async createTemplateCategory(this: any, category: InsertTemplateCategory): Promise<TemplateCategory> {
    const id = crypto.randomUUID();
    const newCategory: TemplateCategory = {
      id,
      name: category.name,
      parentId: category.parentId ?? null,
      sortOrder: category.sortOrder ?? 0,
      isActive: category.isActive ?? true,
      createdAt: new Date(),
    };
    this.templateCategories.set(id, newCategory);
    return newCategory;
  },

  async updateTemplateCategory(this: any, id: string, category: Partial<InsertTemplateCategory>): Promise<TemplateCategory | undefined> {
    const existing = this.templateCategories.get(id);
    if (!existing) return undefined;
    const updated: TemplateCategory = { ...existing, ...category };
    this.templateCategories.set(id, updated);
    return updated;
  },

  async deleteTemplateCategory(this: any, id: string): Promise<void> {
    const existing = this.templateCategories.get(id);
    if (existing) {
      this.templateCategories.set(id, { ...existing, isActive: false });
    }
  },

  async getGraphicSets(this: any): Promise<GraphicSet[]> {
    return (Array.from(this.graphicSets.values()) as GraphicSet[])
      .filter((g) => g.isActive)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async getGraphicSet(this: any, id: string): Promise<GraphicSet | undefined> {
    return this.graphicSets.get(id);
  },

  async getGraphicSetsByCategory(this: any, categoryId: string): Promise<GraphicSet[]> {
    return (Array.from(this.graphicSets.values()) as GraphicSet[])
      .filter((g) => g.isActive && g.categoryId === categoryId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async createGraphicSet(this: any, graphicSet: InsertGraphicSet): Promise<GraphicSet> {
    const id = crypto.randomUUID();
    const newGraphicSet: GraphicSet = {
      id,
      name: graphicSet.name,
      description: graphicSet.description ?? null,
      categoryId: graphicSet.categoryId ?? null,
      subcategoryId: graphicSet.subcategoryId ?? null,
      fullGraphicUrl: graphicSet.fullGraphicUrl ?? null,
      qrOnlyUrl: graphicSet.qrOnlyUrl ?? null,
      destinationUrl: graphicSet.destinationUrl ?? null,
      storagePath: graphicSet.storagePath ?? null,
      tags: graphicSet.tags ?? null,
      isActive: graphicSet.isActive ?? true,
      isFeatured: graphicSet.isFeatured ?? false,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.graphicSets.set(id, newGraphicSet);
    return newGraphicSet;
  },

  async updateGraphicSet(this: any, id: string, graphicSet: Partial<InsertGraphicSet>): Promise<GraphicSet | undefined> {
    const existing = this.graphicSets.get(id);
    if (!existing) return undefined;
    const updated: GraphicSet = { ...existing, ...graphicSet, updatedAt: new Date() };
    this.graphicSets.set(id, updated);
    return updated;
  },

  async deleteGraphicSet(this: any, id: string): Promise<void> {
    const existing = this.graphicSets.get(id);
    if (existing) {
      this.graphicSets.set(id, { ...existing, isActive: false });
    }
  },

  async incrementGraphicSetUsage(this: any, id: string): Promise<void> {
    const existing = this.graphicSets.get(id);
    if (existing) {
      this.graphicSets.set(id, { ...existing, usageCount: (existing.usageCount || 0) + 1 });
    }
  },

  async getLibraryAsset(this: any, id: string): Promise<LibraryAsset | undefined> {
    return this.libraryAssets.get(id);
  },

  async getLibraryAssetByUrl(this: any, url: string): Promise<LibraryAsset | undefined> {
    return (Array.from(this.libraryAssets.values()) as LibraryAsset[]).find((a) => a.publicUrl === url || a.storageUrl === url);
  },

  async getLibraryAssets(this: any, filters?: { ownerType?: string; assetType?: string; mediaType?: string; userId?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
    let assets = (Array.from(this.libraryAssets.values()) as LibraryAsset[]).filter((a) => a.isActive);
    if (filters?.ownerType) assets = assets.filter((a: LibraryAsset) => a.ownerType === filters.ownerType);
    if (filters?.assetType) assets = assets.filter((a: LibraryAsset) => a.assetType === filters.assetType);
    if (filters?.mediaType) assets = assets.filter((a: LibraryAsset) => a.mediaType === filters.mediaType);
    if (filters?.userId) assets = assets.filter((a: LibraryAsset) => a.userId === filters.userId);
    if (filters?.category) assets = assets.filter((a: LibraryAsset) => a.category === filters.category);
    if (filters?.season) assets = assets.filter((a: LibraryAsset) => a.season === filters.season);
    if (filters?.event) assets = assets.filter((a: LibraryAsset) => a.event === filters.event);
    return assets.sort((a: LibraryAsset, b: LibraryAsset) => (a.sortOrder || 0) - (b.sortOrder || 0));
  },

  async getAdminLibraryAssets(this: any, filters?: { assetType?: string; mediaType?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
    return this.getLibraryAssets({ ...filters, ownerType: 'admin' });
  },

  async getUserLibraryAssets(this: any, userId: string, filters?: { assetType?: string; mediaType?: string }): Promise<LibraryAsset[]> {
    return this.getLibraryAssets({ ...filters, ownerType: 'user', userId });
  },

  async createLibraryAsset(this: any, asset: InsertLibraryAsset): Promise<LibraryAsset> {
    const id = crypto.randomUUID();
    const assetBase: Record<string, any> = { ...asset };
    for (const key of Object.keys(assetBase)) {
      if (assetBase[key] === undefined) assetBase[key] = null;
    }
    const newAsset: LibraryAsset = {
      ...assetBase,
      id,
      isActive: asset.isActive ?? true,
      isFeatured: asset.isFeatured ?? false,
      sortOrder: asset.sortOrder ?? 0,
      usageCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as LibraryAsset;
    this.libraryAssets.set(id, newAsset);
    return newAsset;
  },

  async updateLibraryAsset(this: any, id: string, asset: Partial<InsertLibraryAsset>): Promise<LibraryAsset | undefined> {
    const existing = this.libraryAssets.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...asset, updatedAt: new Date() };
    this.libraryAssets.set(id, updated);
    return updated;
  },

  async deleteLibraryAsset(this: any, id: string): Promise<void> {
    this.libraryAssets.delete(id);
  },

  async incrementLibraryAssetUsage(this: any, id: string): Promise<void> {
    const asset = this.libraryAssets.get(id);
    if (asset) {
      asset.usageCount = (asset.usageCount || 0) + 1;
      this.libraryAssets.set(id, asset);
    }
  },
};
