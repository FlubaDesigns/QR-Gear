import type { Express } from "express";
import { storage } from "../storage";
import { fsGet, fsGetAll, fsQuery, fsInsert, fsUpdate, fsCount } from "../lib/firestore-crud";
import { isAuthenticated, isAdmin } from "../firebaseAuth";
import { escapeHtml } from "./route-helpers";
import { generateSitemap } from "../lib/sitemap";
import { insertPartnerStoreSchema, insertEmailTemplateSchema } from "@shared/schema";
import { uploadToFirebaseStorage, listFilesInFolder } from "../lib/firebase-storage-service";
import { z } from "zod";
import JSZip from "jszip";
import { normalizePlacements } from '../../shared/placements';
import crypto from "crypto";

export function registerMiscRoutes(app: Express): void {

  // ============ SITEMAP FOR SEO ============
  app.get('/sitemap.xml', async (req, res) => {
    try {
      const xml = await generateSitemap();
      res.set('Content-Type', 'application/xml');
      res.set('Cache-Control', 'public, max-age=3600');
      res.send(xml);
    } catch (error) {
      console.error('[Sitemap] Error generating sitemap:', error);
      res.status(500).send('Error generating sitemap');
    }
  });

  // ============ SERVER-RENDERED SHARE PAGE FOR SOCIAL SCRAPERS ============
  app.get('/p/:packetId', async (req, res, next) => {
    try {
      const { packetId } = req.params;
      
      const userAgent = req.headers['user-agent'] || '';
      const isCrawler = /facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|Slackbot|TelegramBot|WhatsApp/i.test(userAgent);
      
      if (!isCrawler) {
        return next();
      }
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const packetDoc = await firestoreDb.collection('memberPackets').doc(packetId).get();
      
      let title = 'QR Gear - Dynamic QR Experience';
      let description = 'Scan to discover personalized content';
      let ogImage = 'https://qrgear-c1ffd.web.app/og-default.png';
      const canonicalUrl = `https://qrgear-c1ffd.web.app/p/${packetId}`;
      
      if (packetDoc.exists) {
        const packet = packetDoc.data();
        
        if (packet) {
          if (packet.textLayers?.length > 0) {
            const titleLayer = packet.textLayers.find((l: any) => l.id === 'title' || l.id === 'header');
            if (titleLayer?.text) {
              title = titleLayer.text;
            }
          }
          
          if (packet.textLayers?.length > 0) {
            const descLayer = packet.textLayers.find((l: any) => l.id === 'description' || l.id === 'footer');
            if (descLayer?.text) {
              description = descLayer.text;
            }
          }
          
          ogImage = packet.shareCardUrl 
            || packet.compositeUrl 
            || packet.videoSource?.posterUrl 
            || packet.previewUrl
            || ogImage;
        }
      }
      
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  
  <!-- Open Graph Tags (Facebook, LinkedIn, Discord, etc.) -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${ogImage}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:site_name" content="QR Gear" />
  
  <!-- Twitter Card Tags -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${ogImage}" />
  
  <!-- Redirect humans to SPA after a brief moment -->
  <meta http-equiv="refresh" content="0;url=/app/p/${packetId}" />
  
  <style>
    body { font-family: system-ui, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #0f172a; color: #fff; }
    .loading { text-align: center; }
    .spinner { width: 40px; height: 40px; border: 3px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 16px; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="loading">
    <div class="spinner"></div>
    <p>Loading your QR experience...</p>
  </div>
</body>
</html>`;
      
      res.set('Content-Type', 'text/html');
      res.set('Cache-Control', 'public, max-age=300');
      res.send(html);
    } catch (error) {
      console.error('[SharePage] Error:', error);
      next();
    }
  });

  // ===== PRODUCTION STORE-PRODUCT-LINKS ROUTES =====

  app.get("/api/store-product-links", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const links = linksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      console.log(`[Store Links] Listed ${links.length} total links`);
      res.json({ success: true, links, count: links.length });
    } catch (error: any) {
      console.error("[Store Links] Error listing links:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/store-product-links", isAdmin, async (req: any, res) => {
    try {
      const { 
        storeId, storeName, channel, collection, packetId, templateId, graphicsId, 
        qrContent, productName, compositeUrl, qrOnlyUrl, pricing,
        enabledColors, enabledSizes, selectedGraphicSize, defaultColor,
        qrProductState, landingPageUrl, mockupUrl
      } = req.body;

      console.log("[Store Links] Creating link:", { storeId, channel, packetId, templateId, productName });

      if (!storeId || !channel) {
        return res.status(400).json({ error: "storeId and channel are required" });
      }
      
      if (!packetId && !templateId && !graphicsId) {
        return res.status(400).json({ error: "At least one of packetId, templateId, or graphicsId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("../lib/firebase-admin")).getFirebaseAdmin();
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const linkData = {
        storeId,
        storeName: storeName || "",
        channel,
        collection: collection || null,
        packetId: packetId || null,
        templateId: templateId || null,
        graphicsId: graphicsId || null,
        qrContent: qrContent || null,
        productName: productName || null,
        compositeUrl: compositeUrl || null,
        qrOnlyUrl: qrOnlyUrl || null,
        pricing: pricing || null,
        enabledColors: enabledColors || [],
        enabledSizes: enabledSizes || [],
        selectedGraphicSize: selectedGraphicSize || null,
        defaultColor: defaultColor || null,
        qrProductState: qrProductState || null,
        landingPageUrl: landingPageUrl || null,
        mockupUrl: mockupUrl || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const linkRef = await firestoreDb.collection("storeProductLinks").add(linkData);
      
      console.log(`[Store Links] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);

      res.json({
        success: true,
        linkId: linkRef.id,
        message: `Product linked to ${storeName || storeId} / ${channel}`,
      });
    } catch (error: any) {
      console.error("[Store Links] Error creating link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== PRODUCTION MOCKUP PRIORITY ROUTE =====

  app.post("/api/mockup/priority", isAdmin, async (req: any, res) => {
    try {
      const { 
        blueprintId, printProviderId, colorName, colorHex, 
        placement, artworkUrl, qrSize = "medium",
        fulfillmentProvider = "printify"
      } = req.body;

      if (!blueprintId || !colorName || !artworkUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, colorName, artworkUrl" 
        });
      }

      console.log(`[Priority Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);

      const { getMockupWithFallback } = await import("../lib/mockup-service");
      const storage = (await import("../storage")).storage;
      
      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId) || 99,
        colorName,
        colorHex,
        canonicalPlacementId: placement || "front",
        artworkUrl,
        artworkVariant: "black",
        qrSize: qrSize as 'small' | 'medium' | 'large',
        fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      }, storage);

      console.log(`[Priority Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);

      res.json({
        success: true,
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleMockupUrl,
        fromCache: result.fromCache,
        generatedAt: result.generatedAt,
      });
    } catch (error: any) {
      console.error("[Priority Mockup] Error:", error);
      res.json({
        success: false,
        error: error.message,
        mockupUrl: null,
        message: "Mockup generation in progress - check back shortly",
      });
    }
  });

  // ============ PUBLIC GALLERY API ============
  
  app.get("/api/gallery", async (req, res) => {
    try {
      const designs = await storage.getPublicGalleryDesigns();
      
      const enrichedDesigns = await Promise.all(
        designs.map(async (design) => {
          const product = design.productId 
            ? await storage.getProduct(design.productId)
            : null;
          return { ...design, product };
        })
      );
      
      res.json(enrichedDesigns);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SITEMAP FOR SEO (inline generation) ============
  
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const products = await storage.getAllProducts();
      const enabledProducts = products.filter(p => p.isEnabled);
      
      type SitemapPage = { loc: string; priority: string; changefreq: string; lastmod?: string };
      
      const staticPages: SitemapPage[] = [
        { loc: '/', priority: '1.0', changefreq: 'daily' },
        { loc: '/store', priority: '0.9', changefreq: 'daily' },
        { loc: '/build', priority: '0.9', changefreq: 'weekly' },
        { loc: '/gallery', priority: '0.8', changefreq: 'daily' },
        { loc: '/cart', priority: '0.5', changefreq: 'weekly' },
        { loc: '/privacy', priority: '0.4', changefreq: 'monthly' },
        { loc: '/terms', priority: '0.4', changefreq: 'monthly' },
        { loc: '/qr-basics', priority: '0.7', changefreq: 'monthly' },
        { loc: '/qr-plus', priority: '0.7', changefreq: 'monthly' },
        { loc: '/qr-canvas', priority: '0.7', changefreq: 'monthly' },
        { loc: '/qr-play', priority: '0.7', changefreq: 'monthly' },
        { loc: '/earn', priority: '0.6', changefreq: 'monthly' },
      ];
      
      const productPages: SitemapPage[] = enabledProducts.map(p => ({
        loc: `/store?product=${p.id}`,
        priority: '0.7',
        changefreq: 'weekly',
        lastmod: p.updatedAt?.toISOString().split('T')[0],
      }));
      
      const allPages: SitemapPage[] = [...staticPages, ...productPages];
      
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `  <url>
    <loc>${baseUrl}${page.loc}</loc>
    <priority>${page.priority}</priority>
    <changefreq>${page.changefreq}</changefreq>
    ${page.lastmod ? `<lastmod>${page.lastmod}</lastmod>` : ''}
  </url>`).join('\n')}
</urlset>`;
      
      res.set('Content-Type', 'application/xml');
      res.send(xml);
    } catch (error: any) {
      res.status(500).send('Error generating sitemap');
    }
  });

  // ============ HOSTING TIERS ENDPOINTS ============
  
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

  // Seed channel items for testing (admin only)
  app.post("/api/admin/channel-items/seed", isAdmin, async (req: any, res) => {
    try {
      const { channelId } = req.body;
      if (!channelId) {
        return res.status(400).json({ error: "channelId is required" });
      }
      
      const { upsertChannelItem, PLATFORM_STORE_ID } = await import("../lib/channelItemsService");
      
      const testItems = [
        {
          storeId: PLATFORM_STORE_ID,
          channelId,
          packetId: `test-packet-1-${Date.now()}`,
          title: "Welcome QR Card",
          description: "Custom welcome card with your brand",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fwelcome-card.png?alt=media",
          collectionId: "Official",
        },
        {
          storeId: PLATFORM_STORE_ID,
          channelId,
          packetId: `test-packet-2-${Date.now()}`,
          title: "Event Promo",
          description: "Promote your upcoming events",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fevent-promo.png?alt=media",
          collectionId: "Events",
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
      
      const { getChannelItem } = await import("../lib/channelItemsService");
      const { generateAndUploadSocialImages } = await import("../lib/social-image-generator");
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { generateShareCaption } = await import("../lib/channelItemsService");
      
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
      await fsDb.collection('channel_items').doc(itemId).update({
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

  // ============ QR TEMPLATES ENDPOINTS ============
  
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getActiveQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/templates", isAdmin, async (req, res) => {
    try {
      const templates = await storage.getQrTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/templates", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        thumbnailUrl: z.string().url(),
        fullImageUrl: z.string().url(),
        storageUrl: z.string().url(),
        priceUpcharge: z.string().optional().default("0"),
        isActive: z.boolean().optional().default(true),
        isFeatured: z.boolean().optional().default(false),
      });
      
      const validatedData = createSchema.parse(req.body);
      const template = await storage.createQrTemplate(validatedData);
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/templates/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updateSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        thumbnailUrl: z.string().url().optional(),
        fullImageUrl: z.string().url().optional(),
        storageUrl: z.string().url().optional(),
        priceUpcharge: z.string().optional(),
        isActive: z.boolean().optional(),
        isFeatured: z.boolean().optional(),
      });
      
      const validatedData = updateSchema.parse(req.body);
      const template = await storage.updateQrTemplate(id, validatedData);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/templates/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteQrTemplate(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/templates/full-save", isAdmin, async (req, res) => {
    try {
      const templatePricingSchema = z.object({
        baseProductCost: z.number(),
        placementCost: z.number(),
        textUpcharge: z.number(),
        hostingCost: z.number(),
        subtotal: z.number(),
        markupAmount: z.number(),
        customerPrice: z.number(),
        hostingTierCode: z.string(),
      }).nullable().optional();

      const fullSaveSchema = z.object({
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        category: z.string().nullable().optional(),
        productId: z.string(),
        blueprintId: z.number(),
        printProviderId: z.number(),
        fulfillmentProvider: z.string().optional().default('printify'),
        colors: z.array(z.object({
          name: z.string(),
          hex: z.string(),
        })),
        placements: z.array(z.string()).default(["front"]),
        placementMethods: z.record(z.string(), z.string()).optional(),
        qrSizes: z.array(z.enum(["small", "medium", "large"])).default(["small", "medium", "large"]),
        artworkUrl: z.string().optional().default(""),
        artworkVariant: z.enum(["black", "white"]).default("black"),
        thumbnailUrl: z.string().optional(),
        storeId: z.string().optional(),
        channelId: z.string().optional(),
        qrContent: z.string().optional(),
        pricing: templatePricingSchema,
      });

      const data = fullSaveSchema.parse(req.body);

      const customerPrice = data.pricing?.customerPrice?.toFixed(2) || "0";
      const template = await storage.createQrTemplate({
        name: data.name,
        description: data.description || null,
        category: data.category || null,
        thumbnailUrl: data.thumbnailUrl || data.artworkUrl,
        fullImageUrl: data.artworkUrl,
        storageUrl: data.artworkUrl,
        priceUpcharge: customerPrice,
        textStyle: data.pricing ? {
          pricing: data.pricing,
          hostingTierCode: data.pricing.hostingTierCode,
        } : null,
        isActive: true,
        isFeatured: false,
      });

      const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
      
      const frontBackPlacements = data.placements.filter(p => p === "front" || p === "back");
      const otherPlacements = data.placements.filter(p => p !== "front" && p !== "back");

      const allJobs: any[] = [];

      if (frontBackPlacements.length > 0) {
        const jobs = await mockupJobQueue.createBatchJobs({
          productId: data.productId,
          colors: data.colors,
          qrSizes: data.qrSizes,
          placements: frontBackPlacements,
          blueprintId: data.blueprintId,
          printProviderId: data.printProviderId,
          artworkUrl: data.artworkUrl,
          artworkVariant: data.artworkVariant,
          fulfillmentProvider: data.fulfillmentProvider,
          placementMethods: data.placementMethods,
        });
        allJobs.push(...jobs);
      }

      if (otherPlacements.length > 0) {
        const jobs = await mockupJobQueue.createBatchJobs({
          productId: data.productId,
          colors: data.colors,
          qrSizes: ["large"],
          placements: otherPlacements,
          blueprintId: data.blueprintId,
          printProviderId: data.printProviderId,
          artworkUrl: data.artworkUrl,
          artworkVariant: data.artworkVariant,
          fulfillmentProvider: data.fulfillmentProvider,
          placementMethods: data.placementMethods,
        });
        allJobs.push(...jobs);
      }

      console.log(`[Templates] Created template ${template.id} with ${allJobs.length} mockup jobs queued`);

      res.json({
        success: true,
        template,
        jobsQueued: allJobs.length,
        message: `Template created with ${allJobs.length} mockups queued for generation`,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("[Templates] Full save error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/queue/status", isAdmin, async (_req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const pendingSnapshot = await firestoreDb.collection("mockup_jobs").where("status", "==", "pending").get();
      const processingSnapshot = await firestoreDb.collection("mockup_jobs").where("status", "==", "processing").get();
      const completedSnapshot = await firestoreDb.collection("mockup_jobs").where("status", "==", "completed").limit(100).get();
      const failedSnapshot = await firestoreDb.collection("mockup_jobs").where("status", "==", "failed").limit(100).get();

      res.json({
        success: true,
        queue: {
          pending: pendingSnapshot.size,
          processing: processingSnapshot.size,
          completed: completedSnapshot.size,
          failed: failedSnapshot.size,
        },
        message: `Queue status: ${pendingSnapshot.size} pending, ${processingSnapshot.size} processing`,
      });
    } catch (error: any) {
      console.error("[Queue] Error getting status:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/templates/:templateId/mockups", isAdmin, async (req: any, res) => {
    try {
      const { templateId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const jobsSnapshot = await firestoreDb.collection("mockup_jobs")
        .where("templateId", "==", templateId)
        .get();

      const mockups = jobsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          status: data.status,
          color: data.color,
          size: data.size,
          placement: data.placement,
          mockupUrl: data.mockupUrl || null,
          error: data.error || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          completedAt: data.completedAt?.toDate?.()?.toISOString() || null,
        };
      });

      const completed = mockups.filter(m => m.status === "completed");
      const pending = mockups.filter(m => m.status === "pending");
      const processing = mockups.filter(m => m.status === "processing");
      const failed = mockups.filter(m => m.status === "failed");

      res.json({
        success: true,
        templateId,
        summary: {
          total: mockups.length,
          completed: completed.length,
          pending: pending.length,
          processing: processing.length,
          failed: failed.length,
        },
        mockups,
      });
    } catch (error: any) {
      console.error("[Mockups] Error getting mockups:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/queue/retry-failed", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb, getFirebaseAdmin } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = getFirebaseAdmin();

      const failedSnapshot = await firestoreDb.collection("mockup_jobs")
        .where("status", "==", "failed")
        .get();

      if (failedSnapshot.empty) {
        return res.json({ success: true, reset: 0, message: "No failed jobs to retry" });
      }

      let resetCount = 0;
      const batch = firestoreDb.batch();
      for (const doc of failedSnapshot.docs) {
        batch.update(doc.ref, {
          status: "pending",
          error: null,
          retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        resetCount++;
      }
      await batch.commit();

      console.log(`[Queue] Reset ${resetCount} failed jobs to pending`);
      res.json({ success: true, reset: resetCount, message: `Reset ${resetCount} failed jobs to pending` });
    } catch (error: any) {
      console.error("[Queue] Error retrying failed jobs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/queue/process", isAdmin, async (req: any, res) => {
    try {
      const { limit = 5 } = req.body;
      const processLimit = Math.min(limit, 20);

      const { getFirestoreDb, getFirebaseAdmin } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = getFirebaseAdmin();

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const processingSnapshot = await firestoreDb.collection("mockup_jobs")
        .where("status", "==", "processing")
        .limit(50)
        .get();
      
      let recoveredCount = 0;
      for (const doc of processingSnapshot.docs) {
        const data = doc.data();
        const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
        if (startedAt < fiveMinutesAgo) {
          await firestoreDb.collection("mockup_jobs").doc(doc.id).update({
            status: "pending",
            retryCount: admin.firestore.FieldValue.increment(1),
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[Queue] Recovered stale job ${doc.id}`);
          recoveredCount++;
        }
      }

      const pendingSnapshot = await firestoreDb.collection("mockup_jobs")
        .where("status", "==", "pending")
        .limit(processLimit)
        .get();

      if (pendingSnapshot.empty) {
        return res.json({
          success: true,
          processed: 0,
          recovered: recoveredCount,
          message: "No pending jobs in queue",
        });
      }

      console.log(`[Queue] Processing ${pendingSnapshot.size} mockup jobs`);

      const results: Array<{ jobId: string; status: string; error?: string }> = [];

      for (const jobDoc of pendingSnapshot.docs) {
        const job = jobDoc.data();
        const jobId = jobDoc.id;

        try {
          const claimed = await firestoreDb.runTransaction(async (transaction) => {
            const jobRef = firestoreDb.collection("mockup_jobs").doc(jobId);
            const freshDoc = await transaction.get(jobRef);
            
            if (!freshDoc.exists || freshDoc.data()?.status !== "pending") {
              return false;
            }
            
            transaction.update(jobRef, {
              status: "processing",
              startedAt: admin.firestore.FieldValue.serverTimestamp(),
              processorId: `dev-${Date.now()}`,
            });
            return true;
          });

          if (!claimed) {
            console.log(`[Queue] Job ${jobId} already claimed, skipping`);
            continue;
          }

          await new Promise(resolve => setTimeout(resolve, 2000));

          const templateDoc = await firestoreDb.collection("productTemplates").doc(job.templateId).get();
          if (!templateDoc.exists) {
            throw new Error(`Template ${job.templateId} not found`);
          }
          const template = templateDoc.data()!;

          const { generatePrintfulMockup } = await import("../lib/mockup-service");
          const mockupResult = await generatePrintfulMockup({
            productId: template.productId || job.templateId,
            blueprintId: template.blueprintId || 5,
            printProviderId: template.printProviderId || 39,
            colorName: job.colorName,
            artworkUrl: template.artworkUrl,
            artworkVariant: template.artworkVariant || "black",
            qrSize: job.qrSize || "large",
            fulfillmentProvider: template.fulfillmentProvider || job.fulfillmentProvider || "printify",
            placement: job.placement || "front",
            printMethod: job.printMethod,
          });

          if (mockupResult.error) {
            throw new Error(mockupResult.error);
          }

          const colorKey = job.colorName.replace(/\s+/g, "_").toLowerCase();
          const placementKey = job.placement || "front";
          const sizeKey = job.qrSize || "large";
          
          const mockupPath = `mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`;
          await firestoreDb.collection("productTemplates").doc(job.templateId).update({
            [mockupPath]: mockupResult.mockupUrl || null,
            [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: mockupResult.lifestyleUrl || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          await firestoreDb.collection("mockup_jobs").doc(jobId).update({
            status: "completed",
            mockupUrl: mockupResult.mockupUrl || null,
            lifestyleUrl: mockupResult.lifestyleUrl || null,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.push({ jobId, status: "completed" });
          console.log(`[Queue] Job ${jobId} completed: ${job.colorName} / ${job.placement} / ${job.qrSize}`);

        } catch (error: any) {
          console.error(`[Queue] Job ${jobId} failed:`, error.message);
          
          await firestoreDb.collection("mockup_jobs").doc(jobId).update({
            status: "failed",
            error: error.message,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.push({ jobId, status: "failed", error: error.message });
        }
      }

      const completed = results.filter(r => r.status === "completed").length;
      const failed = results.filter(r => r.status === "failed").length;

      res.json({
        success: true,
        processed: results.length,
        completed,
        failed,
        results,
        message: `Processed ${results.length} jobs: ${completed} completed, ${failed} failed`,
      });

    } catch (error: any) {
      console.error("[Queue] Error processing jobs:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/store-product-links", isAdmin, async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();

      const links = linksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
      }));

      console.log(`[Store Links TEST] Listed ${links.length} total links`);
      res.json({ success: true, links, count: links.length });
    } catch (error: any) {
      console.error("[Store Links TEST] Error listing links:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/store-product-links", isAdmin, async (req: any, res) => {
    try {
      const { 
        storeId, storeName, channel, collection, packetId, templateId, graphicsId, 
        qrContent, productName, compositeUrl, qrOnlyUrl, pricing,
        enabledColors, enabledSizes, selectedGraphicSize, defaultColor,
        qrProductState, landingPageUrl, mockupUrl
      } = req.body;

      console.log("[Store Links TEST] Creating link:", { storeId, channel, packetId, templateId, productName });

      if (!storeId || !channel) {
        return res.status(400).json({ error: "storeId and channel are required" });
      }
      
      if (!packetId && !templateId && !graphicsId) {
        return res.status(400).json({ error: "At least one of packetId, templateId, or graphicsId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("../lib/firebase-admin")).getFirebaseAdmin();
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const linkData = {
        storeId,
        storeName: storeName || "",
        channel,
        collection: collection || null,
        packetId: packetId || null,
        templateId: templateId || null,
        graphicsId: graphicsId || null,
        qrContent: qrContent || null,
        productName: productName || null,
        compositeUrl: compositeUrl || null,
        qrOnlyUrl: qrOnlyUrl || null,
        pricing: pricing || null,
        enabledColors: enabledColors || [],
        enabledSizes: enabledSizes || [],
        selectedGraphicSize: selectedGraphicSize || null,
        defaultColor: defaultColor || null,
        qrProductState: qrProductState || null,
        landingPageUrl: landingPageUrl || null,
        mockupUrl: mockupUrl || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const linkRef = await firestoreDb.collection("storeProductLinks").add(linkData);
      
      console.log(`[Store Links TEST] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);

      res.json({
        success: true,
        linkId: linkRef.id,
        message: `Product linked to ${storeName || storeId} / ${channel}`,
      });
    } catch (error: any) {
      console.error("[Store Links TEST] Error creating link:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/stores/:storeId/channels/:channelId/products", isAdmin, async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;

      if (!storeId || !channelId) {
        return res.status(400).json({ error: "storeId and channelId are required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const linksSnapshot = await firestoreDb.collection("storeProductLinks")
        .where("storeId", "==", storeId)
        .where("channel", "==", channelId)
        .get();

      const products = linksSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          linkId: doc.id,
          packetId: data.packetId || null,
          templateId: data.templateId || null,
          name: data.productName || "Untitled Product",
          imageUrl: data.compositeUrl || data.qrOnlyUrl || null,
          mockupUrl: data.mockupUrl || null,
          qrContent: data.qrContent || null,
          pricing: data.pricing || null,
          enabledColors: data.enabledColors || [],
          enabledSizes: data.enabledSizes || [],
          selectedGraphicSize: data.selectedGraphicSize || null,
          defaultColor: data.defaultColor || null,
          collection: data.collection || null,
          qrProductState: data.qrProductState || null,
          landingPageUrl: data.landingPageUrl || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
        };
      });

      console.log(`[Store Links TEST] Found ${products.length} products for ${storeId}/${channelId}`);

      res.json(products);
    } catch (error: any) {
      console.error("[Store Links TEST] Error getting products:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/store-product-links/:linkId", isAdmin, async (req: any, res) => {
    try {
      const { linkId } = req.params;
      const updates = req.body;

      if (!linkId) {
        return res.status(400).json({ error: "linkId is required" });
      }

      const { getFirestoreDb, FieldValue } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection("storeProductLinks").doc(linkId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Link not found" });
      }

      await docRef.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`[Store Links PATCH] Updated link ${linkId}:`, Object.keys(updates));

      res.json({
        success: true,
        linkId,
        message: "Link updated",
      });
    } catch (error: any) {
      console.error("[Store Links PATCH] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/store-product-links/:linkId", isAdmin, async (req: any, res) => {
    try {
      const { linkId } = req.params;

      if (!linkId) {
        return res.status(400).json({ error: "linkId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection("storeProductLinks").doc(linkId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Link not found" });
      }

      await docRef.delete();
      
      console.log(`[Store Links DELETE] Deleted link ${linkId}`);

      res.json({
        success: true,
        linkId,
        message: "Link deleted",
      });
    } catch (error: any) {
      console.error("[Store Links DELETE] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  
  app.get("/api/store/products", async (req, res) => {
    try {
      const products = await storage.getEnabledProducts();
      const safeProducts = products.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        imageUrl: p.imageUrl,
        manufacturer: p.manufacturer,
        madeInUSA: p.madeInUSA,
        availablePlacements: p.availablePlacements,
        availableColors: p.availableColors,
      }));
      res.json(safeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // =====================================
  // ADMIN PARTNER STORE ENDPOINTS
  // =====================================

  app.get("/api/admin/partner-stores", isAdmin, async (req: any, res) => {
    try {
      const stores = await storage.getPartnerStores();
      res.json(stores);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      const store = await storage.getPartnerStore(req.params.id);
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partner-stores", isAdmin, async (req: any, res) => {
    try {
      const dataWithApiKey = {
        ...req.body,
        apiKey: req.body.apiKey || `qrg_${crypto.randomUUID().replace(/-/g, '')}`,
      };
      
      const validated = insertPartnerStoreSchema.parse(dataWithApiKey);
      
      const existingStores = await storage.getPartnerStores();
      const normalizedName = validated.name?.toLowerCase().trim();
      const isDuplicate = existingStores.some(
        (s) => s.name?.toLowerCase().trim() === normalizedName && s.isInternal === validated.isInternal
      );
      if (isDuplicate) {
        return res.status(409).json({ 
          error: `A ${validated.isInternal ? 'internal' : 'partner'} store with the name "${validated.name}" already exists` 
        });
      }
      
      const store = await storage.createPartnerStore(validated);
      res.json(store);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        console.error("[Partner Store Validation Error]", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Validation error", details: error.errors });
      }
      console.error("[Partner Store Create Error]", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      const store = await storage.updatePartnerStore(req.params.id, req.body);
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/partner-stores/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deletePartnerStore(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/partner-stores/:id/regenerate-key", isAdmin, async (req: any, res) => {
    try {
      const newApiKey = `qrg_${crypto.randomUUID().replace(/-/g, '')}`;
      const store = await storage.updatePartnerStore(req.params.id, { apiKey: newApiKey });
      if (!store) return res.status(404).json({ error: "Partner store not found" });
      res.json({ apiKey: newApiKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/partner-stores/:id/products", isAdmin, async (req: any, res) => {
    try {
      const storeProducts = await storage.getPartnerStoreProducts(req.params.id);
      res.json(storeProducts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================
  // Email Templates Admin Routes
  // ============================================

  app.get("/api/admin/email-templates", isAdmin, async (req: any, res) => {
    try {
      const templates = await storage.getEmailTemplates();
      res.json(templates);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      const template = await storage.getEmailTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/email-templates", isAdmin, async (req: any, res) => {
    try {
      const parsed = insertEmailTemplateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const template = await storage.createEmailTemplate(parsed.data);
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      const parsed = insertEmailTemplateSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Validation failed", details: parsed.error.errors });
      }
      const template = await storage.updateEmailTemplate(req.params.id, parsed.data);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/email-templates/:id", isAdmin, async (req: any, res) => {
    try {
      await storage.deleteEmailTemplate(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/email-logs", isAdmin, async (req: any, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const logs = await storage.getEmailLogs(limit);
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ BACKGROUND ASSETS ============
  
  app.get("/api/admin/background-assets", isAdmin, async (req: any, res) => {
    try {
      const typeFilter = (req.query.type as string) || 'source';
      const validTypes = ['source', 'cropped', 'background', 'template', 'design'];
      
      if (!validTypes.includes(typeFilter)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }
      
      const assets = await fsQuery('library_assets', [['isActive', '==', true], ['assetType', '==', typeFilter]]);
      assets.sort((a: any, b: any) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      
      const assetsWithProxy = assets.map(asset => {
        const filename = (asset.storageUrl || '').split('/').pop() || '';
        return {
          ...asset,
          proxyUrl: `/api/library-files/${encodeURIComponent(filename)}`,
          publicUrl: `/api/library-files/${encodeURIComponent(filename)}`
        };
      });
      
      res.json(assetsWithProxy);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/background-assets", isAdmin, async (req: any, res) => {
    try {
      const { name, assetType, imageData, mimeType, sourceAssetId, cropData, tags } = req.body;
      
      if (!name || !assetType || !imageData) {
        return res.status(400).json({ error: "Missing required fields: name, assetType, imageData" });
      }
      
      if (assetType !== 'source' && assetType !== 'cropped') {
        return res.status(400).json({ error: "assetType must be 'source' or 'cropped'" });
      }
      
      const buffer = Buffer.from(imageData, 'base64');
      const isZip = mimeType === 'application/zip' || mimeType === 'application/x-zip-compressed';
      
      if (isZip) {
        console.log(`[BackgroundAssets] Processing ZIP file: ${name}`);
        
        const zipFileName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const zipUploadResult = await uploadToFirebaseStorage(
          buffer,
          zipFileName,
          mimeType,
          'library/backgrounds/zip'
        );
        console.log(`[BackgroundAssets] Saved ZIP to: ${zipUploadResult.storageUrl}`);
        
        const zip = await JSZip.loadAsync(buffer);
        const extractedAssets: any[] = [];
        const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
        
        for (const [filename, zipEntry] of Object.entries(zip.files)) {
          if (zipEntry.dir) continue;
          const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
          if (!imageExtensions.includes(ext)) continue;
          
          if (filename.startsWith('__') || filename.includes('/.')) continue;
          
          try {
            const imageBuffer = await zipEntry.async('nodebuffer');
            const imageName = filename.split('/').pop() || filename;
            const sanitizedName = imageName.replace(/[^a-zA-Z0-9.-]/g, '_');
            const uniqueName = `${Date.now()}-${sanitizedName}`;
            
            const mimeMap: Record<string, string> = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg',
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp',
            };
            const imageMimeType = mimeMap[ext] || 'image/png';
            
            const uploadResult = await uploadToFirebaseStorage(
              imageBuffer,
              uniqueName,
              imageMimeType,
              'library/backgrounds/raw'
            );
            
            const displayName = sanitizedName.replace(/\.[^/.]+$/, '');
            const zipActualFilename = (uploadResult.storageUrl || '').split('/').pop() || uniqueName;
            const proxyUrl = `/api/library-files/${encodeURIComponent(zipActualFilename)}`;
            
            const asset = await fsInsert('library_assets', {
              ownerType: 'admin',
              assetType: assetType,
              mediaType: 'image',
              name: displayName,
              fileName: zipActualFilename,
              originalName: imageName,
              mimeType: imageMimeType,
              sizeBytes: imageBuffer.length,
              storageUrl: uploadResult.storageUrl,
              publicUrl: proxyUrl,
              isActive: true,
            });
            
            extractedAssets.push({ ...asset, proxyUrl });
            
            console.log(`[BackgroundAssets] Extracted: ${imageName} -> ${uploadResult.storageUrl}`);
          } catch (extractError) {
            console.error(`[BackgroundAssets] Failed to extract ${filename}:`, extractError);
          }
        }
        
        console.log(`[BackgroundAssets] ZIP extraction complete: ${extractedAssets.length} images`);
        return res.json({
          zipStoragePath: zipUploadResult.storageUrl,
          extractedCount: extractedAssets.length,
          assets: extractedAssets,
        });
      }
      
      const folderPath = assetType === 'source' ? 'library/backgrounds/raw' : 'library/backgrounds/cropped';
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        name,
        mimeType || 'image/png',
        folderPath
      );
      
      const actualFilename = (uploadResult.storageUrl || '').split('/').pop() || '';
      const proxyUrl = `/api/library-files/${encodeURIComponent(actualFilename)}`;
      
      const asset = await fsInsert('library_assets', {
        ownerType: 'admin',
        assetType: assetType,
        mediaType: 'image',
        name,
        fileName: actualFilename,
        originalName: name,
        mimeType: mimeType || 'image/png',
        sizeBytes: buffer.length,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        isActive: true,
        ...(sourceAssetId ? { sourceAssetId } : {}),
      });
      
      if (assetType === 'cropped' && sourceAssetId) {
        try {
          await fsUpdate('library_assets', sourceAssetId, { assetType: 'background' });
          console.log(`[BackgroundAssets] Source ${sourceAssetId} moved to background after crop`);
        } catch (moveErr: any) {
          console.error(`[BackgroundAssets] Failed to move source to background:`, moveErr.message);
        }
      }
      
      res.json({ ...asset, proxyUrl: asset.publicUrl });
    } catch (error: any) {
      console.error("Error uploading background asset:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      const { name, isActive } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const updated = await fsUpdate('library_assets', req.params.id, updateData);
      
      res.json({ ...updated, proxyUrl: updated.publicUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      await fsUpdate('library_assets', req.params.id, { isActive: false });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/background-assets/migrate", isAdmin, async (req: any, res) => {
    try {
      const { migrateFilesToCanonicalFolder } = await import("../lib/firebase-storage-service");
      const result = await migrateFilesToCanonicalFolder();
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/background-assets/sync", isAdmin, async (req: any, res) => {
    try {
      const folder = 'library/backgrounds/raw';
      
      console.log(`[LibraryAssets] Syncing assets from: ${folder}`);
      
      const storageFiles = await listFilesInFolder(folder);
      console.log(`[LibraryAssets] Found ${storageFiles.length} files`);
      
      const existingAssets = await fsQuery('library_assets', [['isActive', '==', true], ['assetType', '==', 'background']]);
      const existingPaths = new Set(existingAssets.map((a: any) => a.storageUrl));
      
      const newFiles = storageFiles.filter(f => !existingPaths.has(f.fullPath));
      console.log(`[LibraryAssets] ${newFiles.length} files need database records`);
      
      const createdAssets: any[] = [];
      for (const file of newFiles) {
        if (!file.contentType.startsWith('image/')) continue;
        
        try {
          const displayName = file.name.replace(/\.[^/.]+$/, '');
          const proxyUrl = `/api/library-files/${encodeURIComponent(file.name)}`;
          
          const asset = await fsInsert('library_assets', {
            ownerType: 'admin',
            assetType: 'background',
            mediaType: 'image',
            name: displayName,
            fileName: file.name,
            originalName: file.name,
            mimeType: file.contentType,
            sizeBytes: file.size,
            storageUrl: file.fullPath,
            publicUrl: proxyUrl,
            isActive: true,
          });
          
          createdAssets.push({ ...asset, proxyUrl: asset.publicUrl });
          console.log(`[LibraryAssets] Created record for: ${file.name}`);
        } catch (err) {
          console.error(`[LibraryAssets] Failed to create record for ${file.name}:`, err);
        }
      }
      
      res.json({
        scanned: storageFiles.length,
        existing: existingAssets.length,
        created: createdAssets.length,
        assets: createdAssets,
      });
    } catch (error: any) {
      console.error("Error syncing library assets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ===== FONT MANAGEMENT =====

  const DEFAULT_FONTS = [
    "Arial", "Helvetica", "Times New Roman", "Georgia", "Verdana",
    "Courier New", "Impact", "Comic Sans MS", "Trebuchet MS", "Palatino Linotype",
  ];

  app.get("/api/fonts", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const doc = await fsDb.collection('settings').doc('fonts').get();
      if (doc.exists) {
        const data = doc.data();
        res.json({ fonts: data?.fonts || DEFAULT_FONTS });
      } else {
        res.json({ fonts: DEFAULT_FONTS });
      }
    } catch (error: any) {
      console.error('[Fonts] GET error:', error);
      res.json({ fonts: DEFAULT_FONTS });
    }
  });

  app.put("/api/admin/fonts", isAdmin, async (req: any, res) => {
    try {
      const { fonts } = req.body;
      if (!Array.isArray(fonts)) return res.status(400).json({ error: 'fonts must be an array' });
      const cleanFonts = fonts.filter((f: any) => typeof f === 'string' && f.trim()).map((f: string) => f.trim());
      if (cleanFonts.length === 0) return res.status(400).json({ error: 'At least one font is required' });
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('settings').doc('fonts').set({ fonts: cleanFonts, updatedAt: new Date().toISOString() });
      res.json({ success: true, fonts: cleanFonts });
    } catch (error: any) {
      console.error('[Fonts] PUT error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PROVIDER COUNTS ============
  app.get("/api/admin/provider-counts", isAdmin, async (req: any, res) => {
    try {
      console.log('[TestCatalog] GET provider counts');
      
      const printifyCount = await fsCount('printify_print_providers');
      const printfulCount = await fsCount('printful_products');
      
      const counts = {
        printify: printifyCount,
        printful: printfulCount,
      };
      
      console.log(`[TestCatalog] Provider counts:`, counts);
      res.json(counts);
    } catch (error: any) {
      console.error('[TestCatalog] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: SYNC TO FIRESTORE ============
  app.post("/api/admin/sync-blueprints-to-firestore", isAdmin, async (req: any, res) => {
    try {
      console.log('[Sync] Starting blueprint sync to Firestore...');
      const FirestoreAdapter = (await import("../lib/firestore-adapter")).FirestoreAdapter;
      
      const allBlueprints = await fsGetAll('printify_blueprints');
      console.log(`[Sync] Found ${allBlueprints.length} blueprints to sync`);
      
      const firestoreAdapter = new FirestoreAdapter();
      let synced = 0;
      let errors = 0;
      
      for (const blueprint of allBlueprints) {
        try {
          await firestoreAdapter.upsertPrintifyBlueprint({
            id: blueprint.id,
            title: blueprint.title,
            description: blueprint.description,
            brand: blueprint.brand,
            model: blueprint.model,
            images: blueprint.images,
            primaryImageUrl: blueprint.primaryImageUrl,
            category: blueprint.category,
          });
          synced++;
        } catch (e: any) {
          console.error(`[Sync] Error syncing blueprint ${blueprint.id}:`, e.message);
          errors++;
        }
      }
      
      console.log(`[Sync] Complete: ${synced} blueprints synced, ${errors} errors`);
      res.json({ success: true, synced, errors, total: allBlueprints.length });
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/sync-providers-to-firestore", isAdmin, async (req: any, res) => {
    try {
      console.log('[Sync] Starting provider sync to Firestore...');
      const FirestoreAdapter = (await import("../lib/firestore-adapter")).FirestoreAdapter;
      
      const allProviders = await fsGetAll('printify_print_providers');
      console.log(`[Sync] Found ${allProviders.length} providers to sync`);
      
      const firestoreAdapter = new FirestoreAdapter();
      let synced = 0;
      let errors = 0;
      
      for (const provider of allProviders) {
        try {
          await firestoreAdapter.upsertPrintifyPrintProvider({
            ...provider,
            availableColors: provider.availableColors as any,
          });
          synced++;
        } catch (e: any) {
          console.error(`[Sync] Error syncing ${provider.blueprintId}/${provider.providerId}:`, e.message);
          errors++;
        }
      }
      
      console.log(`[Sync] Complete: ${synced} synced, ${errors} errors`);
      res.json({ success: true, synced, errors, total: allProviders.length });
    } catch (error: any) {
      console.error('[Sync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PRODUCT CONFIGS ============
  app.get("/api/admin/product-configs", isAdmin, async (req: any, res) => {
    try {
      console.log('[TestProductConfigs] GET real product configs');
      
      const allProducts = await storage.getAllProducts();
      
      const enrichedProducts = await Promise.all(
        allProducts.filter(p => p.isEnabled).map(async (product) => {
          const assignments = await storage.getProductCategoryAssignments(product.id);
          
          let cachedMinCost: number | null = null;
          let cachedMaxCost: number | null = null;
          let providerColors: Array<{name: string; hex: string}> | null = null;
          let providerSizes: string[] | null = null;
          if (product.blueprintId && product.printProviderId) {
            const provider = await storage.getPrintifyPrintProvider(
              product.blueprintId,
              product.printProviderId
            );
            if (provider?.minCost) {
              cachedMinCost = Number(provider.minCost) / 100;
              cachedMaxCost = provider.maxCost ? Number(provider.maxCost) / 100 : cachedMinCost;
            }
            if (provider?.availableColors && Array.isArray(provider.availableColors)) {
              providerColors = provider.availableColors as Array<{name: string; hex: string}>;
            }
            if (provider?.availableSizes && Array.isArray(provider.availableSizes)) {
              providerSizes = provider.availableSizes as string[];
            }
          }
          
          const meta = product.metadata as Record<string, unknown> | null;
          const savedEnabledSizes = meta?.enabledSizes as string[] | undefined;
          const savedEnabledColors = meta?.enabledColors as string[] | undefined;
          const defaultColor = meta?.defaultColor as string | undefined;
          
          const finalColors = providerColors || (product.availableColors as Array<{name: string; hex: string}>) || [];
          const finalSizes = providerSizes || (product.availableSizes as string[]) || [];
          
          const mockupsByColor = (product as any).mockupsByColor as Record<string, { front?: string; lifestyle?: string }> | undefined;
          
          return {
            id: product.id,
            name: product.name,
            imageUrl: product.imageUrl,
            sizes: finalSizes,
            colors: finalColors,
            enabledSizes: savedEnabledSizes || finalSizes,
            enabledColors: savedEnabledColors || finalColors.map(c => c.name),
            defaultColor: defaultColor || (finalColors.length > 0 ? finalColors[0].name : null),
            mockupsByColor: mockupsByColor || {},
            categoryIds: assignments.map((a) => a.categoryId),
            cachedMinCost,
            cachedMaxCost,
            blueprintId: product.blueprintId,
            printProviderId: product.printProviderId,
          };
        })
      );
      
      console.log(`[TestProductConfigs] Returning ${enrichedProducts.length} enriched products`);
      res.json(enrichedProducts);
    } catch (error: any) {
      console.error('[TestProductConfigs] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/admin/products/:id/options", isAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { enabledSizes, enabledColors, defaultColor } = req.body;
      
      console.log(`[TestProductOptions] PATCH ${id}:`, { enabledSizes, enabledColors, defaultColor });
      
      const currentProduct = await storage.getProduct(id);
      if (!currentProduct) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      const existingMetadata = (currentProduct.metadata as Record<string, unknown>) || {};
      const newMetadata = {
        ...existingMetadata,
        enabledSizes,
        enabledColors,
        defaultColor,
      };
      
      const product = await storage.updateProduct(id, { metadata: newMetadata });
      res.json(product);
    } catch (error: any) {
      console.error('[TestProductOptions] PATCH error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/products/:id/sync-printify", isAdmin, async (req: any, res) => {
    try {
      const product = await storage.getProduct(req.params.id);
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }
      
      if (!product.blueprintId || !product.printProviderId) {
        return res.status(400).json({ error: "Product missing Printify blueprint or provider IDs" });
      }
      
      console.log(`[TestProductSync] Syncing product ${product.id}`);
      
      const { syncProductPlacements, syncProductVariants } = await import("../lib/printify");
      
      const { placements, mockupImageUrl } = await syncProductPlacements(
        product.blueprintId,
        product.printProviderId
      );
      
      const { colors, sizes, variants } = await syncProductVariants(
        product.blueprintId,
        product.printProviderId
      );
      
      for (const variant of variants) {
        await storage.upsertProductVariant({
          productId: product.id,
          printifyVariantId: variant.id,
          title: variant.title,
          size: variant.options?.size || null,
          color: variant.options?.color || null,
          colorHex: variant.options?.color ? colors.find(c => c.name === variant.options?.color)?.hex || null : null,
          price: String((variant.price || 0) / 100),
          isEnabled: true,
          isInStock: variant.is_available ?? true,
        });
      }
      
      const updatedProduct = await storage.updateProduct(product.id, {
        availablePlacements: normalizePlacements('printify', placements.map(p => p.position)),
        availableColors: colors,
        availableSizes: sizes,
        imageUrl: mockupImageUrl || product.imageUrl,
        metadata: {
          ...(product.metadata as object || {}),
          placementDetails: placements,
          lastSyncedAt: new Date().toISOString(),
        },
      });
      
      res.json({
        success: true,
        product: updatedProduct,
        syncedData: { placements, colors, sizes, mockupImageUrl, variantsCount: variants.length },
      });
    } catch (error: any) {
      console.error('[TestProductSync] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PRIORITY MOCKUP ============
  app.post("/api/admin/mockup/priority", isAdmin, async (req: any, res) => {
    try {
      const { 
        blueprintId, printProviderId, colorName, colorHex, 
        placement, artworkUrl, qrSize = "medium",
        fulfillmentProvider = "printify"
      } = req.body;

      if (!blueprintId || !colorName || !artworkUrl) {
        return res.status(400).json({ 
          error: "Missing required fields: blueprintId, colorName, artworkUrl" 
        });
      }

      console.log(`[Priority Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);

      const { getMockupWithFallback } = await import("../lib/mockup-service");
      const { storage: storageInstance } = await import("../storage");
      
      const result = await getMockupWithFallback({
        blueprintId: parseInt(blueprintId),
        printProviderId: parseInt(printProviderId) || 99,
        colorName,
        colorHex,
        canonicalPlacementId: placement || "front",
        artworkUrl,
        artworkVariant: "black",
        qrSize: qrSize as 'small' | 'medium' | 'large',
        fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      }, storageInstance);

      console.log(`[Priority Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);

      res.json({
        success: true,
        mockupUrl: result.mockupUrl,
        lifestyleMockupUrl: result.lifestyleMockupUrl,
        fromCache: result.fromCache,
        generatedAt: result.generatedAt,
      });
    } catch (error: any) {
      console.error("[Priority Mockup] Error:", error);
      res.json({
        success: false,
        error: error.message,
        mockupUrl: null,
        message: "Mockup generation in progress - check back shortly",
      });
    }
  });

  // ============ TEST: CONTENT UPLOAD ============
  app.post("/api/admin/content/upload", isAdmin, async (req: any, res) => {
    try {
      const { mode, userId, packetId, base64Data, mimeType, fileName } = req.body;

      if (!mode || !userId || !packetId || !base64Data) {
        return res.status(400).json({ 
          error: "mode, userId, packetId, and base64Data are required" 
        });
      }

      const validModes = ['canvas', 'play', 'dynamics', 'basics'];
      if (!validModes.includes(mode)) {
        return res.status(400).json({ 
          error: `Invalid mode. Must be one of: ${validModes.join(', ')}` 
        });
      }

      const { uploadCanvasComposite, uploadContent } = await import("../lib/content-upload-service");
      
      let result;
      
      if (mode === 'canvas' || mode === 'basics') {
        result = await uploadCanvasComposite(base64Data, userId, packetId, fileName);
      } else {
        const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
        const actualMimeType = base64Match?.[1] || mimeType || 'application/octet-stream';
        const actualBase64 = base64Match?.[2] || base64Data;
        
        console.log(`[Content Upload] Processing ${mode} upload: base64 length=${base64Data?.length || 0}, extracted length=${actualBase64?.length || 0}, mimeType=${actualMimeType}`);
        
        if (!actualBase64 || actualBase64.length === 0) {
          return res.status(400).json({ error: 'No file data received - base64 content is empty' });
        }
        
        const buffer = Buffer.from(actualBase64, 'base64');
        console.log(`[Content Upload] Decoded buffer size: ${buffer.length} bytes`);
        
        if (buffer.length === 0) {
          return res.status(400).json({ error: 'File data is empty after decoding' });
        }
        
        result = await uploadContent(
          buffer, 
          mode as any, 
          userId, 
          packetId, 
          actualMimeType, 
          fileName || 'upload'
        );
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const updateData: Record<string, any> = {
        updatedAt: new Date(),
      };
      
      if (mode === 'canvas' || mode === 'basics') {
        updateData.compositeUrl = result.publicUrl;
      } else if (mode === 'play') {
        updateData.playMediaUrl = result.publicUrl;
        updateData.playMediaType = result.mimeType;
      } else if (mode === 'dynamics') {
        updateData.dynamicsMediaUrl = result.publicUrl;
        updateData.dynamicsMediaType = result.mimeType;
      }
      
      await firestoreDb.collection("productPackets").doc(packetId).update(updateData);

      console.log(`[Content Upload] Uploaded ${mode} content for packet ${packetId}`);

      res.json({
        success: true,
        ...result,
        message: `${mode} content uploaded successfully`,
      });
    } catch (error: any) {
      console.error("[Content Upload] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
}
