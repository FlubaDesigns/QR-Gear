import type { Express } from "express";
import { storage } from "../storage";
import { fsQuery } from "../lib/firestore-crud";
import { isAdmin } from "../firebaseAuth";

function generateGiftCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GIFT";
  for (let i = 0; i < 3; i++) {
    code += "-";
    for (let j = 0; j < 4; j++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  return code;
}

export function registerGiftRoutes(app: Express): void {

  app.get("/api/gifts/packages", async (req: any, res) => {
    try {
      const packages = await storage.getActiveGiftPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/gifts/packages/:id", async (req: any, res) => {
    try {
      const pkg = await storage.getGiftPackage(req.params.id);
      if (!pkg) return res.status(404).json({ error: "Gift package not found" });
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gifts/purchase", async (req: any, res) => {
    try {
      const { giftPackageId, buyerEmail, buyerName, personalMessage, recipientEmail } = req.body;
      
      const pkg = await storage.getGiftPackage(giftPackageId);
      if (!pkg) return res.status(404).json({ error: "Gift package not found" });
      if (!pkg.isActive) return res.status(400).json({ error: "Gift package is not available" });
      
      const buyerUserId = req.user?.claims?.sub || null;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (pkg.redemptionValidDays || 365));
      
      const giftCode = await storage.createGiftCode({
        code: generateGiftCode(),
        giftPackageId,
        buyerUserId,
        buyerEmail,
        buyerName,
        personalMessage: pkg.includePersonalMessage ? personalMessage : null,
        expiresAt,
        status: "active",
        lastEmailedTo: recipientEmail || null,
        lastEmailedAt: recipientEmail ? new Date() : null,
      });
      
      res.json({ 
        success: true,
        giftCode: giftCode.code,
        expiresAt: giftCode.expiresAt,
        packageName: pkg.name,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/gifts/redeem/:code", async (req: any, res) => {
    try {
      const giftCode = await storage.getGiftCodeByCode(req.params.code.toUpperCase());
      
      if (!giftCode) {
        return res.status(404).json({ error: "Gift code not found" });
      }
      
      if (giftCode.status === "redeemed") {
        return res.status(400).json({ error: "This gift has already been redeemed" });
      }
      
      if (giftCode.status === "expired" || new Date() > new Date(giftCode.expiresAt)) {
        return res.status(400).json({ error: "This gift code has expired" });
      }
      
      if (giftCode.status === "cancelled") {
        return res.status(400).json({ error: "This gift code has been cancelled" });
      }
      
      const pkg = await storage.getGiftPackage(giftCode.giftPackageId);
      if (!pkg) {
        return res.status(500).json({ error: "Gift package not found" });
      }
      
      let productDetails = null;
      if (pkg.masterProductId) {
        const product = await storage.getMasterProduct(pkg.masterProductId);
        if (product) {
          const designVersions = await storage.getDesignVersions(product.id);
          
          productDetails = {
            id: product.id,
            title: product.title,
            imageUrl: designVersions[0]?.renderedPngUrl || null,
            availableColors: [],
            availableSizes: [],
          };
        }
      }
      
      res.json({
        giftCodeId: giftCode.id,
        packageName: pkg.name,
        packageDescription: pkg.description,
        giftType: pkg.giftType,
        personalMessage: giftCode.personalMessage,
        buyerName: giftCode.buyerName,
        expiresAt: giftCode.expiresAt,
        allowColorChoice: pkg.allowColorChoice,
        allowSizeChoice: pkg.allowSizeChoice,
        allowQrCustomization: pkg.allowQrCustomization,
        product: productDetails,
        dynamicsTier: pkg.dynamicsTier,
        dynamicsMonths: pkg.dynamicsMonths,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/gifts/redeem/:code", async (req: any, res) => {
    try {
      const giftCode = await storage.getGiftCodeByCode(req.params.code.toUpperCase());
      
      if (!giftCode) {
        return res.status(404).json({ error: "Gift code not found" });
      }
      
      if (giftCode.status !== "active") {
        return res.status(400).json({ error: `Gift code is ${giftCode.status}` });
      }
      
      if (new Date() > new Date(giftCode.expiresAt)) {
        await storage.updateGiftCode(giftCode.id, { status: "expired" });
        return res.status(400).json({ error: "This gift code has expired" });
      }
      
      const { recipientEmail, recipientName, selectedColor, selectedSize, qrContent, qrStyle, shippingAddress } = req.body;
      
      const recipientUserId = req.user?.claims?.sub || null;
      
      const redemption = await storage.createGiftRedemption({
        giftCodeId: giftCode.id,
        recipientUserId,
        recipientEmail,
        recipientName,
        selectedColor,
        selectedSize,
        qrContent,
        qrStyle,
        shippingAddress,
        fulfillmentStatus: "pending",
      });
      
      await storage.updateGiftCode(giftCode.id, { status: "redeemed" });
      
      res.json({
        success: true,
        redemptionId: redemption.id,
        message: "Gift redeemed successfully! Your order is being processed.",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/gifts/packages", isAdmin, async (req: any, res) => {
    try {
      const packages = await storage.getAllGiftPackages();
      res.json(packages);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/gifts/packages", isAdmin, async (req: any, res) => {
    try {
      const pkg = await storage.createGiftPackage(req.body);
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/gifts/packages/:id", isAdmin, async (req: any, res) => {
    try {
      const pkg = await storage.updateGiftPackage(req.params.id, req.body);
      if (!pkg) return res.status(404).json({ error: "Gift package not found" });
      res.json(pkg);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/gifts/packages/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteGiftPackage(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/gifts/codes", isAdmin, async (req: any, res) => {
    try {
      const codes = await fsQuery('gift_codes', [], 'createdAt', 'desc', 100);
      res.json(codes);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/gifts/redemptions", isAdmin, async (req: any, res) => {
    try {
      const redemptions = await fsQuery('gift_redemptions', [], 'redeemedAt', 'desc', 100);
      res.json(redemptions);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/gifts/redemptions/:id", isAdmin, async (req: any, res) => {
    try {
      const redemption = await storage.updateGiftRedemption(req.params.id, req.body);
      if (!redemption) return res.status(404).json({ error: "Redemption not found" });
      res.json(redemption);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
