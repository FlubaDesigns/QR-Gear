import {readHostingTiers,changeHostingTier} from '../../../functions/src/services/hosting-tiers';
import {getFirestoreDb} from '../../lib/firebase-admin';
import type { Express } from "express";
import { storage } from "../../storage";
import { isAdmin } from "../../firebaseAuth";
import { z } from "zod";
import { CHANNEL_ITEMS_COLLECTION } from "../../lib/constants";

export function registerHostingTiersRoutes(app: Express): void {

  app.get('/api/hosting-tiers',async(_req,res)=>{try{res.json(await readHostingTiers(getFirestoreDb()));}catch(e:any){res.status(500).json({error:e.message});}});
  app.post('/api/admin/hosting-tiers/seed',isAdmin,(_req,res)=>{res.status(409).json({error:'Use the saved hosting tiers in Admin Pricing.'});});
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

  app.get('/api/admin/hosting-tiers',isAdmin,async(_req,res)=>{try{res.json(await readHostingTiers(getFirestoreDb()));}catch(e:any){res.status(500).json({error:e.message});}});
  for(const method of ['post','put','delete'] as const)app[method](method==='post'?'/api/admin/hosting-tiers':'/api/admin/hosting-tiers/:id',isAdmin,async(req,res)=>{
    try{res.json(await changeHostingTier(getFirestoreDb(),method.toUpperCase(),req.params.id,req.body));}catch(e:any){res.status(e.status||400).json({error:e.message});}
  });
}
