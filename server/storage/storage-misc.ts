import type {
  QrDesign,
  InsertQrDesign,
  HostedImage,
  InsertHostedImage,
  HostingReminder,
  InsertHostingReminder,
  AdminSettings,
  InsertAdminSettings,
  HostingTier,
  InsertHostingTier,
  QrTemplate,
  InsertQrTemplate,
  DynamicPage,
  InsertDynamicPage,
  DynamicPageAsset,
  InsertDynamicPageAsset,
  ProviderHealthLog,
  InsertProviderHealthLog,
  GiftPackage,
  InsertGiftPackage,
  GiftCode,
  InsertGiftCode,
  GiftRedemption,
  InsertGiftRedemption,
  EmailTemplate,
  InsertEmailTemplate,
  EmailLog,
} from "@shared/schema";

export const miscMethods = {
  async getQrDesign(this: any, id: string): Promise<QrDesign | undefined> {
    return this.qrDesigns.get(id);
  },

  async getQrDesignsByUser(this: any, userId: string): Promise<QrDesign[]> {
    return (Array.from(this.qrDesigns.values()) as QrDesign[]).filter((d) => d.userId === userId);
  },

  async createQrDesign(this: any, design: InsertQrDesign): Promise<QrDesign> {
    const id = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newDesign: QrDesign = {
      ...design,
      id,
      productId: design.productId ?? null,
      productColor: design.productColor ?? null,
      manufacturer: design.manufacturer ?? null,
      madeInUSA: design.madeInUSA ?? null,
      previewUrl: design.previewUrl ?? null,
      showInGallery: design.showInGallery ?? false,
      galleryTitle: design.galleryTitle ?? null,
      galleryDescription: design.galleryDescription ?? null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.qrDesigns.set(id, newDesign);
    return newDesign;
  },

  async getPublicGalleryDesigns(this: any): Promise<QrDesign[]> {
    return (Array.from(this.qrDesigns.values()) as QrDesign[]).filter((d) => d.showInGallery === true);
  },

  async updateQrDesign(this: any, id: string, design: Partial<InsertQrDesign>): Promise<QrDesign | undefined> {
    const existing = this.qrDesigns.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...design, updatedAt: new Date() };
    this.qrDesigns.set(id, updated);
    return updated;
  },

  async deleteQrDesign(this: any, id: string): Promise<void> {
    this.qrDesigns.delete(id);
  },

  async getHostedImage(this: any, id: string): Promise<HostedImage | undefined> {
    return this.hostedImages.get(id);
  },

  async getHostedImagesByUser(this: any, userId: string): Promise<HostedImage[]> {
    return (Array.from(this.hostedImages.values()) as HostedImage[]).filter((img) => img.userId === userId);
  },

  async getAllHostedImages(this: any): Promise<HostedImage[]> {
    return Array.from(this.hostedImages.values()) as HostedImage[];
  },

  async createHostedImage(this: any, image: InsertHostedImage): Promise<HostedImage> {
    const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newImage: HostedImage = {
      ...image,
      id,
      userId: image.userId ?? null,
      title: image.title ?? null,
      description: image.description ?? null,
      businessName: image.businessName ?? null,
      businessLogo: image.businessLogo ?? null,
      views: 0,
      isActive: image.isActive ?? true,
      expiresAt: image.expiresAt ?? null,
      createdAt: new Date(),
    };
    this.hostedImages.set(id, newImage);
    return newImage;
  },

  async updateHostedImage(this: any, id: string, image: Partial<InsertHostedImage>): Promise<HostedImage | undefined> {
    const existing = this.hostedImages.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...image };
    this.hostedImages.set(id, updated);
    return updated;
  },

  async incrementImageViews(this: any, id: string): Promise<void> {
    const image = this.hostedImages.get(id);
    if (image) {
      this.hostedImages.set(id, { ...image, views: (image.views || 0) + 1 });
    }
  },

  async deleteHostedImage(this: any, id: string): Promise<void> {
    this.hostedImages.delete(id);
  },

  async getHostingReminderByImageAndDays(this: any, imageId: string, daysRemaining: number): Promise<HostingReminder | undefined> {
    const reminderType = `${daysRemaining}_day`;
    return (Array.from(this.hostingReminders.values()) as HostingReminder[]).find(
      (r: HostingReminder) => r.customGiftId === imageId && r.reminderType === reminderType
    );
  },

  async createHostingReminder(this: any, reminder: InsertHostingReminder): Promise<HostingReminder> {
    const id = `reminder_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newReminder: HostingReminder = {
      ...reminder,
      id,
      userId: reminder.userId ?? null,
      sentAt: reminder.sentAt ?? null,
      emailAddress: reminder.emailAddress ?? null,
      status: reminder.status ?? "pending",
      createdAt: new Date(),
    };
    this.hostingReminders.set(id, newReminder);
    return newReminder;
  },

  async getAdminSettings(this: any): Promise<AdminSettings | undefined> {
    return this.adminSettings;
  },

  async upsertAdminSettings(this: any, settings: InsertAdminSettings): Promise<AdminSettings> {
    const newSettings: AdminSettings = {
      id: "default",
      globalMarkupPercent: settings.globalMarkupPercent ?? "25",
      globalMarkupFixed: settings.globalMarkupFixed ?? "0",
      globalQrProductionCost: settings.globalQrProductionCost ?? "2",
      textAboveUpcharge: settings.textAboveUpcharge ?? "2",
      textBelowUpcharge: settings.textBelowUpcharge ?? "2",
      imageHostingUpcharge: settings.imageHostingUpcharge ?? "5",
      dynamicQrUpcharge: settings.dynamicQrUpcharge ?? "25",
      showPricesBeforeCustomization: settings.showPricesBeforeCustomization ?? false,
      additionalPlacementCost: (settings as any).additionalPlacementCost ?? null,
      defaultFulfillmentProvider: (settings as any).defaultFulfillmentProvider ?? null,
      defaultMockupProvider: (settings as any).defaultMockupProvider ?? null,
      updatedAt: new Date(),
    };
    this.adminSettings = newSettings;
    return newSettings;
  },

  async getHostingTiers(this: any): Promise<HostingTier[]> {
    return Array.from(this.hostingTiers.values()) as HostingTier[];
  },

  async getHostingTier(this: any, id: string): Promise<HostingTier | undefined> {
    return this.hostingTiers.get(id);
  },

  async getHostingTierByCode(this: any, code: string): Promise<HostingTier | undefined> {
    return (Array.from(this.hostingTiers.values()) as HostingTier[]).find((t) => t.code === code);
  },

  async createHostingTier(this: any, tier: InsertHostingTier): Promise<HostingTier> {
    const id = `tier_${Date.now()}`;
    const newTier: HostingTier = {
      ...tier,
      id,
      description: tier.description ?? null,
      isIncluded: tier.isIncluded ?? false,
      priceUpcharge: tier.priceUpcharge ?? "0",
      isActive: tier.isActive ?? true,
      sortOrder: tier.sortOrder ?? 0,
      videoPriceUpcharge: tier.videoPriceUpcharge ?? null,
    };
    this.hostingTiers.set(id, newTier);
    return newTier;
  },

  async updateHostingTier(this: any, id: string, tier: Partial<InsertHostingTier>): Promise<HostingTier | undefined> {
    const existing = this.hostingTiers.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...tier };
    this.hostingTiers.set(id, updated);
    return updated;
  },

  async deleteHostingTier(this: any, id: string): Promise<void> {
    this.hostingTiers.delete(id);
  },

  async getQrTemplates(this: any): Promise<QrTemplate[]> {
    return Array.from(this.qrTemplates.values()) as QrTemplate[];
  },

  async getActiveQrTemplates(this: any): Promise<QrTemplate[]> {
    return (Array.from(this.qrTemplates.values()) as QrTemplate[]).filter((t) => t.isActive);
  },

  async getQrTemplate(this: any, id: string): Promise<QrTemplate | undefined> {
    return this.qrTemplates.get(id);
  },

  async createQrTemplate(this: any, template: InsertQrTemplate): Promise<QrTemplate> {
    const id = `template_${Date.now()}`;
    const newTemplate: QrTemplate = {
      ...template,
      id,
      description: template.description ?? null,
      category: template.category ?? null,
      qrPlacement: template.qrPlacement ?? null,
      availableSizes: template.availableSizes ?? null,
      defaultTextAbove: template.defaultTextAbove ?? null,
      defaultTextBelow: template.defaultTextBelow ?? null,
      textStyle: template.textStyle ?? null,
      priceUpcharge: template.priceUpcharge ?? "0",
      isActive: template.isActive ?? true,
      isFeatured: template.isFeatured ?? false,
      sortOrder: template.sortOrder ?? 0,
      createdAt: new Date(),
    };
    this.qrTemplates.set(id, newTemplate);
    return newTemplate;
  },

  async updateQrTemplate(this: any, id: string, template: Partial<InsertQrTemplate>): Promise<QrTemplate | undefined> {
    const existing = this.qrTemplates.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...template };
    this.qrTemplates.set(id, updated);
    return updated;
  },

  async deleteQrTemplate(this: any, id: string): Promise<void> {
    this.qrTemplates.delete(id);
  },

  async getDynamicPage(this: any, id: string): Promise<DynamicPage | undefined> {
    return this.dynamicPages.get(id);
  },

  async getDynamicPageBySlug(this: any, slug: string): Promise<DynamicPage | undefined> {
    return (Array.from(this.dynamicPages.values()) as DynamicPage[]).find((p) => p.slug === slug);
  },

  async getDynamicPagesByUser(this: any, userId: string): Promise<DynamicPage[]> {
    return (Array.from(this.dynamicPages.values()) as DynamicPage[]).filter((p) => p.userId === userId);
  },

  async createDynamicPage(this: any, page: InsertDynamicPage): Promise<DynamicPage> {
    const id = `dp_${Date.now()}`;
    const newPage: DynamicPage = {
      ...page,
      id,
      description: page.description ?? null,
      activeAssetId: page.activeAssetId ?? null,
      hostingTierId: page.hostingTierId ?? null,
      views: 0,
      status: page.status ?? "active",
      expiresAt: page.expiresAt ?? null,
      renewalReminderSent: page.renewalReminderSent ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.dynamicPages.set(id, newPage);
    return newPage;
  },

  async updateDynamicPage(this: any, id: string, page: Partial<InsertDynamicPage>): Promise<DynamicPage | undefined> {
    const existing = this.dynamicPages.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...page, updatedAt: new Date() };
    this.dynamicPages.set(id, updated);
    return updated;
  },

  async deleteDynamicPage(this: any, id: string): Promise<void> {
    (Array.from(this.dynamicPageAssets.entries()) as [string, DynamicPageAsset][]).forEach(([assetId, asset]) => {
      if (asset.pageId === id) this.dynamicPageAssets.delete(assetId);
    });
    this.dynamicPages.delete(id);
  },

  async incrementDynamicPageViews(this: any, id: string): Promise<void> {
    const page = this.dynamicPages.get(id);
    if (page) {
      page.views = (page.views || 0) + 1;
      this.dynamicPages.set(id, page);
    }
  },

  async getDynamicPageAsset(this: any, id: string): Promise<DynamicPageAsset | undefined> {
    return this.dynamicPageAssets.get(id);
  },

  async getDynamicPageAssets(this: any, pageId: string): Promise<DynamicPageAsset[]> {
    return (Array.from(this.dynamicPageAssets.values()) as DynamicPageAsset[]).filter((a) => a.pageId === pageId);
  },

  async createDynamicPageAsset(this: any, asset: InsertDynamicPageAsset): Promise<DynamicPageAsset> {
    const id = `dpa_${Date.now()}`;
    const newAsset: DynamicPageAsset = {
      ...asset,
      id,
      title: asset.title ?? null,
      isActive: asset.isActive ?? false,
      activatedAt: asset.activatedAt ?? null,
      createdAt: new Date(),
    };
    this.dynamicPageAssets.set(id, newAsset);
    return newAsset;
  },

  async updateDynamicPageAsset(this: any, id: string, asset: Partial<InsertDynamicPageAsset>): Promise<DynamicPageAsset | undefined> {
    const existing = this.dynamicPageAssets.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...asset };
    this.dynamicPageAssets.set(id, updated);
    return updated;
  },

  async deleteDynamicPageAsset(this: any, id: string): Promise<void> {
    this.dynamicPageAssets.delete(id);
  },

  async setActiveAsset(this: any, pageId: string, assetId: string): Promise<void> {
    (Array.from(this.dynamicPageAssets.entries()) as [string, DynamicPageAsset][]).forEach(([id, asset]) => {
      if (asset.pageId === pageId) {
        this.dynamicPageAssets.set(id, { ...asset, isActive: false, activatedAt: null });
      }
    });
    const asset = this.dynamicPageAssets.get(assetId);
    if (asset) {
      this.dynamicPageAssets.set(assetId, { ...asset, isActive: true, activatedAt: new Date() });
    }
    const page = this.dynamicPages.get(pageId);
    if (page) {
      this.dynamicPages.set(pageId, { ...page, activeAssetId: assetId, updatedAt: new Date() });
    }
  },

  async getAllPrintfulProducts(this: any): Promise<any[]> {
    return [];
  },

  async getAllPrintfulVariants(this: any): Promise<any[]> {
    return [];
  },

  async logProviderHealth(this: any, log: InsertProviderHealthLog): Promise<ProviderHealthLog> {
    const newLog: ProviderHealthLog = {
      id: crypto.randomUUID(),
      providerType: log.providerType,
      checkTime: new Date(),
      isHealthy: log.isHealthy ?? true,
      responseTimeMs: log.responseTimeMs ?? null,
      errorMessage: log.errorMessage ?? null,
      errorCode: log.errorCode ?? null,
      uptimePercent24h: null,
      avgResponseTime24h: null,
    };
    this.providerHealthLogs.push(newLog);
    if (this.providerHealthLogs.length > 1000) {
      this.providerHealthLogs = this.providerHealthLogs.slice(-1000);
    }
    return newLog;
  },

  async getProviderHealthLogs(this: any, limit: number = 100): Promise<ProviderHealthLog[]> {
    return this.providerHealthLogs
      .sort((a: ProviderHealthLog, b: ProviderHealthLog) => (b.checkTime?.getTime() || 0) - (a.checkTime?.getTime() || 0))
      .slice(0, limit);
  },

  async getProviderHealthLogsByType(this: any, providerType: string, limit: number = 100): Promise<ProviderHealthLog[]> {
    return this.providerHealthLogs
      .filter((l: ProviderHealthLog) => l.providerType === providerType)
      .sort((a: ProviderHealthLog, b: ProviderHealthLog) => (b.checkTime?.getTime() || 0) - (a.checkTime?.getTime() || 0))
      .slice(0, limit);
  },

  async getLatestProviderHealth(this: any, providerType: string): Promise<ProviderHealthLog | undefined> {
    const logs = await this.getProviderHealthLogsByType(providerType, 1);
    return logs[0];
  },

  async getAllLatestProviderHealth(this: any): Promise<ProviderHealthLog[]> {
    const providerTypes = ['printify', 'printful', 'apliiq'];
    const results: ProviderHealthLog[] = [];
    for (const type of providerTypes) {
      const latest = await this.getLatestProviderHealth(type);
      if (latest) results.push(latest);
    }
    return results;
  },

  async getProviderHealthStats(this: any, providerType: string, hours: number = 24): Promise<{ uptimePercent: number; avgResponseTime: number; totalChecks: number }> {
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    const logs = this.providerHealthLogs.filter((l: ProviderHealthLog) =>
      l.providerType === providerType &&
      (l.checkTime?.getTime() || 0) > cutoff
    );

    if (logs.length === 0) {
      return { uptimePercent: 0, avgResponseTime: 0, totalChecks: 0 };
    }

    const healthyCount = logs.filter((l: ProviderHealthLog) => l.isHealthy).length;
    const totalResponseTime = logs.reduce((sum: number, l: ProviderHealthLog) => sum + (l.responseTimeMs || 0), 0);

    return {
      uptimePercent: Math.round((healthyCount / logs.length) * 100 * 100) / 100,
      avgResponseTime: Math.round(totalResponseTime / logs.length),
      totalChecks: logs.length,
    };
  },

  async getAllGiftPackages(this: any): Promise<GiftPackage[]> {
    return Array.from(this.giftPackages.values()) as GiftPackage[];
  },

  async getActiveGiftPackages(this: any): Promise<GiftPackage[]> {
    return (Array.from(this.giftPackages.values()) as GiftPackage[]).filter((p) => p.isActive);
  },

  async getGiftPackage(this: any, id: string): Promise<GiftPackage | undefined> {
    return this.giftPackages.get(id);
  },

  async createGiftPackage(this: any, pkg: InsertGiftPackage): Promise<GiftPackage> {
    const newPkg: GiftPackage = {
      id: crypto.randomUUID(),
      name: pkg.name,
      description: pkg.description ?? null,
      giftType: pkg.giftType ?? "product",
      masterProductId: pkg.masterProductId ?? null,
      dynamicsTier: pkg.dynamicsTier ?? null,
      dynamicsMonths: pkg.dynamicsMonths ?? null,
      price: pkg.price,
      allowColorChoice: pkg.allowColorChoice ?? true,
      allowSizeChoice: pkg.allowSizeChoice ?? true,
      allowQrCustomization: pkg.allowQrCustomization ?? true,
      includePersonalMessage: pkg.includePersonalMessage ?? true,
      redemptionValidDays: pkg.redemptionValidDays ?? 365,
      displayImage: pkg.displayImage ?? null,
      isActive: pkg.isActive ?? true,
      sortOrder: pkg.sortOrder ?? 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.giftPackages.set(newPkg.id, newPkg);
    return newPkg;
  },

  async updateGiftPackage(this: any, id: string, pkg: Partial<InsertGiftPackage>): Promise<GiftPackage | undefined> {
    const existing = this.giftPackages.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...pkg, updatedAt: new Date() };
    this.giftPackages.set(id, updated);
    return updated;
  },

  async deleteGiftPackage(this: any, id: string): Promise<void> {
    this.giftPackages.delete(id);
  },

  async getGiftCode(this: any, id: string): Promise<GiftCode | undefined> {
    return this.giftCodes.get(id);
  },

  async getGiftCodeByCode(this: any, code: string): Promise<GiftCode | undefined> {
    return (Array.from(this.giftCodes.values()) as GiftCode[]).find((c) => c.code === code);
  },

  async getGiftCodesByBuyer(this: any, buyerUserId: string): Promise<GiftCode[]> {
    return (Array.from(this.giftCodes.values()) as GiftCode[]).filter((c) => c.buyerUserId === buyerUserId);
  },

  async createGiftCode(this: any, code: InsertGiftCode): Promise<GiftCode> {
    const newCode: GiftCode = {
      id: crypto.randomUUID(),
      code: code.code,
      giftPackageId: code.giftPackageId,
      buyerUserId: code.buyerUserId ?? null,
      buyerEmail: code.buyerEmail ?? null,
      buyerName: code.buyerName ?? null,
      personalMessage: code.personalMessage ?? null,
      orderId: code.orderId ?? null,
      stripePaymentId: code.stripePaymentId ?? null,
      purchasedAt: new Date(),
      expiresAt: code.expiresAt,
      status: code.status ?? "active",
      lastEmailedTo: code.lastEmailedTo ?? null,
      lastEmailedAt: code.lastEmailedAt ?? null,
      createdAt: new Date(),
    };
    this.giftCodes.set(newCode.id, newCode);
    return newCode;
  },

  async updateGiftCode(this: any, id: string, code: Partial<InsertGiftCode>): Promise<GiftCode | undefined> {
    const existing = this.giftCodes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...code };
    this.giftCodes.set(id, updated);
    return updated;
  },

  async getGiftRedemption(this: any, id: string): Promise<GiftRedemption | undefined> {
    return this.giftRedemptions.get(id);
  },

  async getGiftRedemptionByCode(this: any, giftCodeId: string): Promise<GiftRedemption | undefined> {
    return (Array.from(this.giftRedemptions.values()) as GiftRedemption[]).find((r) => r.giftCodeId === giftCodeId);
  },

  async getGiftRedemptionsByRecipient(this: any, recipientEmail: string): Promise<GiftRedemption[]> {
    return (Array.from(this.giftRedemptions.values()) as GiftRedemption[]).filter((r) => r.recipientEmail === recipientEmail);
  },

  async createGiftRedemption(this: any, redemption: InsertGiftRedemption): Promise<GiftRedemption> {
    const newRedemption: GiftRedemption = {
      id: crypto.randomUUID(),
      giftCodeId: redemption.giftCodeId,
      recipientUserId: redemption.recipientUserId ?? null,
      recipientEmail: redemption.recipientEmail ?? null,
      recipientName: redemption.recipientName ?? null,
      selectedColor: redemption.selectedColor ?? null,
      selectedSize: redemption.selectedSize ?? null,
      qrContent: redemption.qrContent ?? null,
      qrStyle: redemption.qrStyle ?? null,
      shippingAddress: redemption.shippingAddress ?? null,
      dynamicsSubscriptionId: redemption.dynamicsSubscriptionId ?? null,
      dynamicsContentSetId: redemption.dynamicsContentSetId ?? null,
      fulfillmentOrderId: redemption.fulfillmentOrderId ?? null,
      fulfillmentProvider: redemption.fulfillmentProvider ?? null,
      fulfillmentStatus: redemption.fulfillmentStatus ?? "pending",
      trackingNumber: redemption.trackingNumber ?? null,
      trackingUrl: redemption.trackingUrl ?? null,
      redeemedAt: new Date(),
      fulfilledAt: redemption.fulfilledAt ?? null,
      shippedAt: redemption.shippedAt ?? null,
      deliveredAt: redemption.deliveredAt ?? null,
    };
    this.giftRedemptions.set(newRedemption.id, newRedemption);
    return newRedemption;
  },

  async updateGiftRedemption(this: any, id: string, redemption: Partial<InsertGiftRedemption>): Promise<GiftRedemption | undefined> {
    const existing = this.giftRedemptions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...redemption };
    this.giftRedemptions.set(id, updated);
    return updated;
  },

  async getEmailTemplates(this: any): Promise<EmailTemplate[]> {
    return Array.from(this.emailTemplates.values());
  },

  async getEmailTemplate(this: any, id: string): Promise<EmailTemplate | undefined> {
    return this.emailTemplates.get(id);
  },

  async getEmailTemplateByTrigger(this: any, trigger: string): Promise<EmailTemplate | undefined> {
    return (Array.from(this.emailTemplates.values()) as EmailTemplate[]).find((t) => t.trigger === trigger);
  },

  async createEmailTemplate(this: any, template: InsertEmailTemplate): Promise<EmailTemplate> {
    const newTemplate: EmailTemplate = {
      id: crypto.randomUUID(),
      trigger: template.trigger,
      name: template.name,
      subject: template.subject,
      htmlContent: template.htmlContent,
      textContent: template.textContent ?? null,
      isEnabled: template.isEnabled ?? true,
      description: template.description ?? null,
      variables: template.variables ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.emailTemplates.set(newTemplate.id, newTemplate);
    return newTemplate;
  },

  async updateEmailTemplate(this: any, id: string, template: Partial<InsertEmailTemplate>): Promise<EmailTemplate | undefined> {
    const existing = this.emailTemplates.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...template, updatedAt: new Date() };
    this.emailTemplates.set(id, updated);
    return updated;
  },

  async deleteEmailTemplate(this: any, id: string): Promise<void> {
    this.emailTemplates.delete(id);
  },

  async getEmailLogs(this: any, limit: number = 100): Promise<EmailLog[]> {
    return this.emailLogs.slice(0, limit);
  },

  async logEmail(this: any, log: Omit<EmailLog, 'id' | 'sentAt'>): Promise<EmailLog> {
    const newLog: EmailLog = {
      ...log,
      id: crypto.randomUUID(),
      sentAt: new Date(),
    };
    this.emailLogs.unshift(newLog);
    return newLog;
  },
};
