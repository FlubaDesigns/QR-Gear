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

  // ============ PRICING SETTINGS (public) ============
  app.get("/api/pricing-settings", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection("testSettings").doc("pricing").get();
      
      const defaultSizeUpcharges: Record<string, number> = {
        'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12
      };
      
      const defaultBrandLabelPricing = {
        printifyInside: 0.55,
        printifyOutside: 0.55,
        printfulInside: 0.99,
        printfulOutside: 2.49,
      };

      if (!doc.exists) {
        return res.json({
          markupPercent: 25,
          markupFixed: 0,
          additionalPlacementCost: 4,
          textLineUpcharge: 2,
          memberProfitShare: 0.25,
          sizeUpcharges: defaultSizeUpcharges,
          hostingTiers: [
            { code: "1_year", name: "1 Year", price: 5 },
            { code: "2_year", name: "2 Years", price: 8 },
            { code: "3_year", name: "3 Years", price: 10 },
          ],
          brandLabelPricing: defaultBrandLabelPricing,
        });
      }
      
      const data = doc.data();
      res.json({
        ...data,
        memberProfitShare: data?.memberProfitShare ?? 0.25,
        sizeUpcharges: data?.sizeUpcharges ?? defaultSizeUpcharges,
        brandLabelPricing: data?.brandLabelPricing ?? defaultBrandLabelPricing,
        preferredLabelPosition: data?.preferredLabelPosition ?? 'outside',
      });
    } catch (error: any) {
      console.error("[Pricing Settings] Error getting settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pricing-settings", isAdmin, async (req: any, res) => {
    try {
      const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing, preferredLabelPosition } = req.body;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("../lib/firebase-admin")).getFirebaseAdmin();
      
      const defaultSizeUpcharges: Record<string, number> = {
        'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12
      };

      const defaultBrandLabelPricing = {
        printifyInside: 0.55,
        printifyOutside: 0.55,
        printfulInside: 0.99,
        printfulOutside: 2.49,
      };
      
      const settings = {
        markupPercent: parseFloat(markupPercent) || 25,
        markupFixed: parseFloat(markupFixed) || 0,
        additionalPlacementCost: parseFloat(additionalPlacementCost) || 4,
        textLineUpcharge: parseFloat(textLineUpcharge) || 2,
        memberProfitShare: parseFloat(memberProfitShare) || 0.25,
        sizeUpcharges: sizeUpcharges || defaultSizeUpcharges,
        hostingTiers: hostingTiers || [
          { code: "1_year", name: "1 Year", price: 5 },
          { code: "2_year", name: "2 Years", price: 8 },
          { code: "3_year", name: "3 Years", price: 10 },
        ],
        brandLabelPricing: brandLabelPricing || defaultBrandLabelPricing,
        preferredLabelPosition: preferredLabelPosition || 'outside',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await firestoreDb.collection("testSettings").doc("pricing").set(settings, { merge: true });
      
      console.log("[Pricing Settings] Saved settings:", settings);
      
      res.json({
        success: true,
        settings,
        message: "Pricing settings saved",
      });
    } catch (error: any) {
      console.error("[Pricing Settings] Error saving settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pricing-settings/sync", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const pricingDoc = await firestoreDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
      const textLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;
      
      console.log(`[PricingSync] Starting sync with: ${markupPercent}% markup, ${memberProfitShare * 100}% member share`);
      
      const storesSnapshot = await firestoreDb.collection("storeAllowedProducts").get();
      let totalUpdated = 0;
      
      for (const storeDoc of storesSnapshot.docs) {
        const storeData = storeDoc.data();
        const products = storeData?.products || [];
        let updated = false;
        
        for (const product of products) {
          if (product.pricing) {
            const baseCost = product.pricing.baseProductCost || 0;
            const placementCost = product.pricing.placementCost || 0;
            const textUpcharge = product.pricing.textUpcharge || 0;
            const hostingCost = product.pricing.hostingCost || 0;
            
            const subtotal = baseCost + placementCost + textUpcharge + hostingCost;
            const markupAmount = subtotal * (markupPercent / 100) + markupFixed;
            const customerPrice = subtotal + markupAmount;
            
            product.pricing.markupPercent = markupPercent;
            product.pricing.markupFixed = markupFixed;
            product.pricing.markupAmount = markupAmount;
            product.pricing.customerPrice = customerPrice;
            
            updated = true;
            totalUpdated++;
          }
        }
        
        if (updated) {
          await firestoreDb.collection("storeAllowedProducts").doc(storeDoc.id).update({ products });
        }
      }
      
      res.json({ success: true, message: `Synced pricing to ${totalUpdated} products` });
    } catch (error: any) {
      console.error("[PricingSync] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PRICING SETTINGS (test endpoints) ============
  app.get("/api/admin/pricing-settings", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection("testSettings").doc("pricing").get();
      
      const defaultSizeUpcharges: Record<string, number> = {
        'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12
      };
      
      const defaultBrandLabelPricing = {
        printifyInside: 0.55,
        printifyOutside: 0.55,
        printfulInside: 0.99,
        printfulOutside: 2.49,
      };

      if (!doc.exists) {
        return res.json({
          markupPercent: 25,
          markupFixed: 0,
          additionalPlacementCost: 4,
          textLineUpcharge: 2,
          memberProfitShare: 0.25,
          sizeUpcharges: defaultSizeUpcharges,
          hostingTiers: [
            { code: "1_year", name: "1 Year", price: 5 },
            { code: "2_year", name: "2 Years", price: 8 },
            { code: "3_year", name: "3 Years", price: 10 },
          ],
          brandLabelPricing: defaultBrandLabelPricing,
        });
      }
      
      const data = doc.data();
      res.json({
        ...data,
        memberProfitShare: data?.memberProfitShare ?? 0.25,
        sizeUpcharges: data?.sizeUpcharges ?? defaultSizeUpcharges,
        brandLabelPricing: data?.brandLabelPricing ?? defaultBrandLabelPricing,
        preferredLabelPosition: data?.preferredLabelPosition ?? 'outside',
      });
    } catch (error: any) {
      console.error("[Pricing Settings TEST] Error getting settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/pricing-settings", isAdmin, async (req: any, res) => {
    try {
      const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing, preferredLabelPosition } = req.body;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("../lib/firebase-admin")).getFirebaseAdmin();
      
      const defaultSizeUpcharges: Record<string, number> = {
        'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12
      };

      const defaultBrandLabelPricing = {
        printifyInside: 0.55,
        printifyOutside: 0.55,
        printfulInside: 0.99,
        printfulOutside: 2.49,
      };
      
      const settings = {
        markupPercent: parseFloat(markupPercent) || 25,
        markupFixed: parseFloat(markupFixed) || 0,
        additionalPlacementCost: parseFloat(additionalPlacementCost) || 4,
        textLineUpcharge: parseFloat(textLineUpcharge) || 2,
        memberProfitShare: parseFloat(memberProfitShare) || 0.25,
        sizeUpcharges: sizeUpcharges || defaultSizeUpcharges,
        hostingTiers: hostingTiers || [
          { code: "1_year", name: "1 Year", price: 5 },
          { code: "2_year", name: "2 Years", price: 8 },
          { code: "3_year", name: "3 Years", price: 10 },
        ],
        brandLabelPricing: brandLabelPricing || defaultBrandLabelPricing,
        preferredLabelPosition: preferredLabelPosition || 'outside',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await firestoreDb.collection("testSettings").doc("pricing").set(settings, { merge: true });
      
      console.log("[Pricing Settings TEST] Saved settings:", settings);
      
      res.json({
        success: true,
        settings,
        message: "Pricing settings saved",
      });
    } catch (error: any) {
      console.error("[Pricing Settings TEST] Error saving settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/pricing-settings/sync", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const pricingDoc = await firestoreDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
      const textLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;
      
      console.log(`[PricingSync] Starting sync with: ${markupPercent}% markup, ${memberProfitShare * 100}% member share`);
      
      const storesSnapshot = await firestoreDb.collection("storeAllowedProducts").get();
      
      let storesUpdated = 0;
      let productsUpdated = 0;
      
      for (const storeDoc of storesSnapshot.docs) {
        const storeData = storeDoc.data();
        const storeId = storeDoc.id;
        
        if (!storeData.products || !Array.isArray(storeData.products)) {
          continue;
        }
        
        const updatedProducts = storeData.products.map((p: any) => {
          if (p.baseCost === undefined || p.baseCost === null) {
            return p;
          }
          
          const baseCost = parseFloat(p.baseCost) || 0;
          const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
          const profit = retailPrice - baseCost;
          const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
          
          return {
            ...p,
            retailPrice,
            profit,
            memberEarnings,
            pricingUsed: {
              markupPercent,
              markupFixed,
              additionalPlacementCost,
              textLineUpcharge,
              memberProfitShare,
            },
            pricingSyncedAt: new Date().toISOString(),
          };
        });
        
        await firestoreDb.collection("storeAllowedProducts").doc(storeId).update({
          products: updatedProducts,
          updatedAt: new Date().toISOString(),
        });
        
        storesUpdated++;
        productsUpdated += updatedProducts.length;
      }
      
      console.log(`[PricingSync] Updated ${productsUpdated} products across ${storesUpdated} stores`);
      
      res.json({
        success: true,
        storesUpdated,
        productsUpdated,
        pricingUsed: { markupPercent, markupFixed, memberProfitShare, additionalPlacementCost, textLineUpcharge },
        message: `Synced pricing to ${productsUpdated} products across ${storesUpdated} stores`,
      });
    } catch (error: any) {
      console.error("[PricingSync] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

}
