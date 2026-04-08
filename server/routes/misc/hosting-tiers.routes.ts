import type { Express } from "express";
import { storage } from "../../storage";
import { isAdmin } from "../../firebaseAuth";
import { z } from "zod";
import { CHANNEL_ITEMS_COLLECTION } from "../../lib/constants";

export function registerHostingTiersRoutes(app: Express): void {

  app.get("/api/hosting-tiers", async (req, res) => {
    try {
      const tiers = await storage.getHostingTiers();
      res.json(tiers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/hosting-tiers/seed", isAdmin, async (req, res) => {
    try {
      const existingTiers = await storage.getHostingTiers();
      if (existingTiers.length > 0) {
        return res.json({ message: "Hosting tiers already exist", tiers: existingTiers });
      }

      const defaultTiers = [
        { code: "1_year", name: "1 Year", description: "Standard hosting", durationDays: 365, isIncluded: false, priceUpcharge: "5", sortOrder: 1 },
        { code: "2_year", name: "2 Years", description: "Save with 2-year commitment", durationDays: 730, isIncluded: false, priceUpcharge: "8", sortOrder: 2 },
        { code: "3_year", name: "3 Years", description: "Best value - 3-year hosting", durationDays: 1095, isIncluded: false, priceUpcharge: "10", sortOrder: 3 },
      ];

      const createdTiers = [];
      for (const tier of defaultTiers) {
        const created = await storage.createHostingTier(tier);
        createdTiers.push(created);
      }

      res.json({ message: "Default hosting tiers created", tiers: createdTiers });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/channel-items/seed", isAdmin, async (req: any, res) => {
    try {
      const { channelId } = req.body;
      if (!channelId) {
        return res.status(400).json({ error: "channelId is required" });
      }
      
      const { upsertChannelItem, PLATFORM_STORE_ID } = await import("../../lib/channelItemsService");
      
      const testItems = [
        {
          storeId: PLATFORM_STORE_ID,
          channelId,
          packetId: `test-packet-1-${Date.now()}`,
          title: "Welcome QR Card",
          description: "Custom welcome card with your brand",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fwelcome-card.png?alt=media",
          collectionId: "official-collection",
        },
        {
          storeId: PLATFORM_STORE_ID,
          channelId,
          packetId: `test-packet-2-${Date.now()}`,
          title: "Event Promo",
          description: "Promote your upcoming events",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fevent-promo.png?alt=media",
          collectionId: "events-collection",
        },
        {
          storeId: PLATFORM_STORE_ID,
          channelId,
          packetId: `test-packet-3-${Date.now()}`,
          title: "Contact Card",
          description: "Digital contact card with QR code",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fcontact-card.png?alt=media",
        },
      ];
      
      const created = [];
      for (const item of testItems) {
        const result = await upsertChannelItem(item);
        created.push(result);
      }
      
      console.log(`[ChannelItems] Seeded ${created.length} items for channel ${channelId}`);
      res.json({ ok: true, message: `Seeded ${created.length} items`, items: created });
    } catch (error: any) {
      console.error("[ChannelItems] Seed error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/channel-items/:itemId/regenerate-assets", isAdmin, async (req: any, res) => {
    try {
      const { itemId } = req.params;
      
      const { getChannelItem } = await import("../../lib/channelItemsService");
      const { generateAndUploadSocialImages } = await import("../../lib/social-image-generator");
      const { getFirestoreDb } = await import("../../lib/firebase-admin");
      const { generateShareCaption } = await import("../../lib/channelItemsService");
      
      const item = await getChannelItem(itemId);
      if (!item) {
        return res.status(404).json({ error: "Item not found" });
      }
      
      const baseUrl = process.env.VITE_BASE_URL || 'https://qrgear-c1ffd.web.app';
      const fullShareUrl = item.shareUrl.startsWith('http') ? item.shareUrl : `${baseUrl}${item.shareUrl}`;
      
      const socialImages = await generateAndUploadSocialImages({
        title: item.title,
        description: item.description,
        previewImageUrl: item.previewImageUrl,
        packetId: item.packetId,
        shareUrl: fullShareUrl,
      });
      
      const shareCaption = generateShareCaption(item.title, item.description, fullShareUrl);
      
      const fsDb = getFirestoreDb();
      await fsDb.collection(CHANNEL_ITEMS_COLLECTION).doc(itemId).update({
        shareImageSquareUrl: socialImages.squareUrl || null,
        shareImageLinkUrl: socialImages.linkPreviewUrl || null,
        shareCaption,
        updatedAt: new Date(),
      });
      
      console.log(`[ChannelItems] Regenerated social assets for item ${itemId}`);
      res.json({ 
        ok: true, 
        shareImageSquareUrl: socialImages.squareUrl,
        shareImageLinkUrl: socialImages.linkPreviewUrl,
        shareCaption,
      });
    } catch (error: any) {
      console.error("[ChannelItems] Regenerate assets error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/hosting-tiers/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        durationDays: z.number().optional(),
        priceUpcharge: z.string().optional(),
        isIncluded: z.boolean().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const updated = await storage.updateHostingTier(id, validatedData);
      
      if (!updated) {
        return res.status(404).json({ error: "Hosting tier not found" });
      }
      
      res.json(updated);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/hosting-tiers", isAdmin, async (req, res) => {
    try {
      const tiers = await storage.getHostingTiers();
      res.json(tiers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/hosting-tiers", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        durationDays: z.number().min(1),
        priceUpcharge: z.string().optional().default("0"),
        isIncluded: z.boolean().optional().default(false),
        isActive: z.boolean().optional().default(true),
        sortOrder: z.number().optional().default(0),
      });
      const validated = createSchema.parse(req.body);
      const tier = await storage.createHostingTier(validated);
      res.json(tier);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/hosting-tiers/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteHostingTier(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
