import { syncCatalogMarkup } from '../../functions/src/services/catalog-instance-update';
import { pricingSettingsSchema } from '../../shared/schema-orders';
import type { Express } from "express";
import { storage } from "../storage";
import { isAdmin } from "../firebaseAuth";

export function registerPricingRoutes(app: Express): void {

  // ============ PRICING QUOTE ENDPOINT ============
  
  app.post("/api/pricing/quote", async (req, res) => {
    try {
      const { 
        productId, 
        productLine = "text",
        hasTextAbove, 
        hasTextBelow, 
        templateId,
        hostingTierCode = "1_year",
      } = req.body;
      
      const product = await storage.getProduct(productId);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const settings = await storage.getAdminSettings();
      
      const basePrice = parseFloat(product.basePrice);
      const markupPercent = parseFloat(product.markupPercent || "0") || parseFloat(settings?.globalMarkupPercent || "25");
      const markupFixed = parseFloat(product.markupFixed || "0") || parseFloat(settings?.globalMarkupFixed || "0");
      const qrCost = parseFloat(product.qrProductionCost || "0") || parseFloat(settings?.globalQrProductionCost || "2");
      
      let price = basePrice + qrCost;
      price = price * (1 + markupPercent / 100) + markupFixed;
      
      const breakdown: Record<string, number> = {
        base: basePrice,
        qrProduction: qrCost,
        markup: (basePrice + qrCost) * (markupPercent / 100) + markupFixed,
        textAboveUpcharge: 0,
        textBelowUpcharge: 0,
        templateUpcharge: 0,
        hostingUpcharge: 0,
        dynamicUpcharge: 0,
      };

      if (hasTextAbove && productLine !== "dynamic") {
        const upcharge = parseFloat(settings?.textAboveUpcharge || "2");
        price += upcharge;
        breakdown.textAboveUpcharge = upcharge;
      }
      if (hasTextBelow && productLine !== "dynamic") {
        const upcharge = parseFloat(settings?.textBelowUpcharge || "2");
        price += upcharge;
        breakdown.textBelowUpcharge = upcharge;
      }

      if (productLine === "template" && templateId) {
        const template = await storage.getQrTemplate(templateId);
        if (template) {
          const upcharge = parseFloat(template.priceUpcharge || "0");
          price += upcharge;
          breakdown.templateUpcharge = upcharge;
        }
      }

      if (productLine === "dynamic") {
        const dynamicUpcharge = parseFloat((settings as any)?.dynamicQrUpcharge || "25");
        price += dynamicUpcharge;
        breakdown.dynamicUpcharge = dynamicUpcharge;
      }

      if ((productLine === "template" || productLine === "custom" || productLine === "dynamic") && hostingTierCode !== "1_year") {
        const tier = await storage.getHostingTierByCode(hostingTierCode);
        if (tier && !tier.isIncluded) {
          const upcharge = parseFloat(tier.priceUpcharge || "0");
          price += upcharge;
          breakdown.hostingUpcharge = upcharge;
        }
      }
      
      res.json({
        productLine,
        basePrice,
        finalPrice: Math.round(price * 100) / 100,
        breakdown,
        hostingTier: hostingTierCode,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const readPricing = async (_req: any, res: any) => {
    try {
      const { getFirestoreDb } = await import('../lib/firebase-admin');
      const saved = await getFirestoreDb().collection('testSettings').doc('pricing').get();
      if (_req.path.includes('/admin/')) { res.setHeader('Cache-Control', 'no-store'); res.json(saved.data() || {}); return; }
    const parsed = pricingSettingsSchema.safeParse(saved.data());
      if (!parsed.success) return res.status(409).json({ error: 'Saved pricing is incomplete or invalid. Review Admin Pricing configuration.' });
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ...saved.data(), ...parsed.data });
    } catch (error: any) { res.status(503).json({ error: error.message }); }
  };
  app.get('/api/pricing-settings', readPricing);
  app.get('/api/admin/pricing-settings', isAdmin, readPricing);
  app.post(['/api/admin/pricing-settings', '/api/pricing-settings'], isAdmin, async (req: any, res) => {
    const parsed = pricingSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') });
    try {
      const { getFirestoreDb, getFirebaseAdmin } = await import('../lib/firebase-admin');
      await getFirestoreDb().collection('testSettings').doc('pricing').set({ ...parsed.data, updatedAt: getFirebaseAdmin().firestore.FieldValue.serverTimestamp() }, { mergeFields: [...Object.keys(parsed.data), 'updatedAt'] });
      res.json({ success: true, settings: parsed.data, message: 'Pricing settings saved' });
    } catch (error: any) { res.status(503).json({ error: error.message }); }
  });

  app.post(['/api/admin/pricing-settings/sync', '/api/pricing-settings/sync'], isAdmin, async (req: any, res) => {
    if (req.body?.previewToken !== undefined && (typeof req.body.previewToken !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.previewToken))) {
      return res.status(400).json({ error: 'A valid markup preview is required.' });
    }
    try {
      const { getFirestoreDb, getFirebaseAdmin } = await import('../lib/firebase-admin');
      res.json(await syncCatalogMarkup(getFirestoreDb(), getFirebaseAdmin().firestore.FieldValue.serverTimestamp(), req.user.uid, req.body?.previewToken));
    } catch (error: any) { res.status(error.status || 503).json({ error: error.message }); }
  });
}
