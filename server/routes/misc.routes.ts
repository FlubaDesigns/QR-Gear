import type { Express } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and } from "drizzle-orm";
import { isAuthenticated, isAdmin } from "../firebaseAuth";
import { escapeHtml } from "./route-helpers";
import { generateSitemap } from "../lib/sitemap";
import { insertQrDesignSchema, insertPartnerStoreSchema, insertEmailTemplateSchema } from "@shared/schema";
import { uploadImageFromBuffer } from "../lib/image-upload";
import { uploadToFirebaseStorage, listFilesInFolder } from "../lib/firebase-storage-service";
import { generatePrintifyComposite } from "../lib/composite-image-generator";
import { z } from "zod";
import QRCode from "qrcode";
import JSZip from "jszip";
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

  // ===== PRODUCTION PACKET ROUTES =====

  app.post("/api/packets", async (req: any, res) => {
    try {
      const { 
        qrOnlyUrl, 
        compositeUrl, 
        qrContent,
        headerText,
        footerText,
        pricing,
        productId,
        productName,
        productDescription,
        productImageUrl,
        blueprintId,
        printProviderId,
        manufacturer,
        madeInUSA,
        category,
        defaultColor,
        defaultColorHex,
        defaultPlacement,
        qrProductState,
        placements,
        availablePlacements,
        sizes,
        colors,
        basePrice,
        customerPrice,
        mockupsByColor,
        landingPageTitle,
        landingPageDescription,
        landingPageBackgroundUrl,
        landingPageSlug,
        headerStyle,
        footerStyle,
        roleType,
        storeId,
        storeName,
        channelId,
        channelName,
        fulfillmentProvider,
        playMediaUrl,
        playMediaType,
      } = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const firestoreDb = getFirestoreDb();
      
      const now = FieldValue.serverTimestamp();
      
      const packetData = {
        qrOnlyUrl: qrOnlyUrl || null,
        compositeUrl: compositeUrl || null,
        qrContent: qrContent || null,
        headerText: headerText || null,
        footerText: footerText || null,
        pricing: pricing || null,
        productId: productId || null,
        productName: productName || null,
        productDescription: productDescription || null,
        productImageUrl: productImageUrl || null,
        blueprintId: blueprintId || null,
        printProviderId: printProviderId || null,
        manufacturer: manufacturer || null,
        madeInUSA: madeInUSA || false,
        category: category || null,
        defaultColor: defaultColor || null,
        defaultColorHex: defaultColorHex || null,
        defaultPlacement: defaultPlacement || null,
        qrProductState: qrProductState || null,
        placements: placements || [],
        availablePlacements: availablePlacements || [],
        sizes: sizes || [],
        colors: colors || [],
        basePrice: basePrice || null,
        customerPrice: customerPrice || null,
        mockupsByColor: mockupsByColor || null,
        landingPageTitle: landingPageTitle || null,
        landingPageDescription: landingPageDescription || null,
        landingPageBackgroundUrl: landingPageBackgroundUrl || null,
        landingPageSlug: landingPageSlug || null,
        headerStyle: headerStyle || null,
        footerStyle: footerStyle || null,
        roleType: roleType || null,
        storeId: storeId || null,
        storeName: storeName || null,
        channelId: channelId || null,
        channelName: channelName || null,
        fulfillmentProvider: fulfillmentProvider || 'printify',
        playMediaUrl: playMediaUrl || null,
        playMediaType: playMediaType || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const packetRef = await firestoreDb.collection("productPackets").add(packetData);
      const packetId = packetRef.id;
      
      console.log(`[Packets] Created packet: ${packetId}`);

      let mockupJobsQueued = 0;
      if (blueprintId && printProviderId && colors && Array.isArray(colors) && colors.length > 0) {
        try {
          const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
          
          const artworkUrl = compositeUrl || qrOnlyUrl;
          if (artworkUrl) {
            const targetPlacements = (placements && placements.length > 0) ? placements : ["front"];
            const qrSizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
            
            const productIdForMockups = `packet_${packetId}`;
            
            console.log(`[Packets] Queueing mockups for ${colors.length} colors × ${targetPlacements.length} placements × ${qrSizes.length} sizes`);
            
            const jobs = await mockupJobQueue.createBatchJobs({
              productId: productIdForMockups,
              colors: colors.map((c: any) => ({ name: c.name || c, hex: c.hex || '#000000' })),
              qrSizes,
              placements: targetPlacements,
              blueprintId: parseInt(blueprintId),
              printProviderId: parseInt(printProviderId),
              artworkUrl,
              artworkVariant: "black",
            });
            
            mockupJobsQueued = jobs.length;
            console.log(`[Packets] Queued ${mockupJobsQueued} mockup jobs for packet ${packetId}`);
          } else {
            console.log(`[Packets] No artwork URL available yet, skipping mockup queue`);
          }
        } catch (err: any) {
          console.error(`[Packets] Failed to queue mockup jobs:`, err.message);
        }
      }

      res.json({
        success: true,
        packetId,
        mockupJobsQueued,
        message: `Product packet created${mockupJobsQueued > 0 ? ` with ${mockupJobsQueued} mockup jobs queued` : ''}`,
      });
    } catch (error: any) {
      console.error("[Packets] Error creating packet:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/packets", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("productPackets")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      
      const packets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        };
      });
      
      console.log(`[Packets] Retrieved ${packets.length} packets`);
      
      res.json({
        success: true,
        packets,
        count: packets.length,
      });
    } catch (error: any) {
      console.error("[Packets] Error getting packets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection("productPackets").doc(packetId).get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const data = doc.data();
      
      let linkedTemplateId = null;
      const templatesSnapshot = await firestoreDb.collection("productTemplates")
        .where("packetId", "==", packetId)
        .limit(1)
        .get();
      
      if (!templatesSnapshot.empty) {
        linkedTemplateId = templatesSnapshot.docs[0].id;
      }
      
      res.json({
        success: true,
        packet: {
          id: doc.id,
          ...data,
          templateId: linkedTemplateId,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        },
      });
    } catch (error: any) {
      console.error("[Packets] Error getting packet:", error);
      res.status(500).json({ error: error.message });
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

  app.post("/api/store-product-links", async (req: any, res) => {
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

  app.post("/api/mockup/priority", async (req: any, res) => {
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
        canonicalPlacementId: placement || "FRONT_CHEST",
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

  // ============ SAVED DESIGNS ENDPOINTS ============
  
  app.get("/api/designs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const designs = await storage.getQrDesignsByUser(userId);
      res.json(designs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(design);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/designs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validatedData = insertQrDesignSchema.parse({
        ...req.body,
        userId,
      });
      const design = await storage.createQrDesign(validatedData);
      res.status(201).json(design);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      const updated = await storage.updateQrDesign(req.params.id, req.body);
      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/designs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const design = await storage.getQrDesign(req.params.id);
      if (!design) {
        return res.status(404).json({ error: "Design not found" });
      }
      if (design.userId !== req.user.claims.sub) {
        return res.status(403).json({ error: "Access denied" });
      }
      await storage.deleteQrDesign(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      
      const { upsertChannelItem } = await import("../lib/channelItemsService");
      
      const testItems = [
        {
          channelId,
          packetId: `test-packet-1-${Date.now()}`,
          title: "Welcome QR Card",
          description: "Custom welcome card with your brand",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fwelcome-card.png?alt=media",
          collectionTag: "Official",
        },
        {
          channelId,
          packetId: `test-packet-2-${Date.now()}`,
          title: "Event Promo",
          description: "Promote your upcoming events",
          previewImageUrl: "https://firebasestorage.googleapis.com/v0/b/qrgear-c1ffd.firebasestorage.app/o/demo%2Fevent-promo.png?alt=media",
          collectionTag: "Events",
        },
        {
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
        colors: z.array(z.object({
          name: z.string(),
          hex: z.string(),
        })),
        placements: z.array(z.string()).default(["front"]),
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

  // ============ TEST ROUTES ============

  app.post("/api/test/graphics/save", async (req: any, res) => {
    try {
      const { name, description, category, qrOnlyUrl, compositeUrl, storeId, channelId, qrContent, pricing } = req.body;

      const baseMetadata: Record<string, any> = {};
      if (storeId) baseMetadata.storeId = storeId;
      if (channelId) baseMetadata.channelId = channelId;
      if (qrContent) baseMetadata.qrContent = qrContent;
      if (pricing) baseMetadata.pricing = pricing;

      let qrAsset = null;
      let compositeAsset = null;

      if (qrOnlyUrl) {
        qrAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - QR Only`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: qrOnlyUrl,
          storageUrl: qrOnlyUrl,
          thumbnailUrl: qrOnlyUrl,
          fileName: `qr-only-${Date.now()}.png`,
          originalName: `qr-only.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "qr-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isQrOnly: true },
        } as any);
      }

      if (compositeUrl) {
        compositeAsset = await storage.createLibraryAsset({
          name: `${name || 'Untitled'} - Composite`,
          assetType: "graphic",
          mediaType: "image",
          ownerType: "admin",
          publicUrl: compositeUrl,
          storageUrl: compositeUrl,
          thumbnailUrl: compositeUrl,
          fileName: `composite-${Date.now()}.png`,
          originalName: `composite.png`,
          mimeType: "image/png",
          sizeBytes: 0,
          category: category || "composite-graphics",
          isActive: true,
          metadata: { ...baseMetadata, isComposite: true },
        } as any);
      }

      const savedParts = [qrAsset ? 'QR' : null, compositeAsset ? 'Composite' : null].filter(Boolean).join(' + ');
      console.log(`[Graphics TEST] Saved: ${savedParts}`);

      res.json({
        success: true,
        qrAssetId: qrAsset?.id || null,
        compositeAssetId: compositeAsset?.id || null,
        message: `Graphics saved to library: ${savedParts}`,
      });
    } catch (error: any) {
      console.error("[Graphics TEST] Error saving graphics:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test/queue/status", async (_req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const pendingSnapshot = await firestoreDb.collection("mockupJobs").where("status", "==", "pending").get();
      const processingSnapshot = await firestoreDb.collection("mockupJobs").where("status", "==", "processing").get();
      const completedSnapshot = await firestoreDb.collection("mockupJobs").where("status", "==", "completed").limit(100).get();
      const failedSnapshot = await firestoreDb.collection("mockupJobs").where("status", "==", "failed").limit(100).get();

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

  app.get("/api/test/templates/:templateId/mockups", async (req: any, res) => {
    try {
      const { templateId } = req.params;
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();

      const jobsSnapshot = await firestoreDb.collection("mockupJobs")
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

  app.get("/api/test/templates", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("productTemplates")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      
      const templates = await Promise.all(snapshot.docs.map(async doc => {
        const data = doc.data();
        
        let packetData = null;
        if (data.packetId) {
          const packetDoc = await firestoreDb.collection("productPackets").doc(data.packetId).get();
          if (packetDoc.exists) {
            const pData = packetDoc.data();
            packetData = {
              productName: pData?.productName,
              compositeUrl: pData?.compositeUrl,
              qrOnlyUrl: pData?.qrOnlyUrl,
              qrContent: pData?.qrContent,
              qrProductState: pData?.qrProductState,
            };
          }
        }
        
        return {
          id: doc.id,
          ...data,
          packet: packetData,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        };
      }));
      
      console.log(`[Templates TEST] Retrieved ${templates.length} templates`);
      
      res.json({
        success: true,
        templates,
        count: templates.length,
      });
    } catch (error: any) {
      console.error("[Templates TEST] Error getting templates:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/templates", async (req: any, res) => {
    try {
      const { 
        packetId, name, productId, blueprintId, printProviderId,
        artworkUrl, thumbnailUrl, qrContent, pricing,
        selectedSize, enabledColors, enabledSizes, defaultColor, isActive
      } = req.body;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("../lib/firebase-admin")).getFirebaseAdmin();
      const now = admin.firestore.FieldValue.serverTimestamp();

      const templateData = {
        packetId,
        name: name || `Template - ${new Date().toLocaleDateString()}`,
        productId: productId || null,
        blueprintId: blueprintId || null,
        printProviderId: printProviderId || null,
        artworkUrl: artworkUrl || null,
        thumbnailUrl: thumbnailUrl || artworkUrl || null,
        qrContent: qrContent || null,
        pricing: pricing || null,
        selectedSize: selectedSize || "medium",
        enabledColors: enabledColors || [],
        enabledSizes: enabledSizes || [],
        defaultColor: defaultColor || null,
        isActive: isActive !== false,
        createdAt: now,
        updatedAt: now,
      };

      const templateRef = await firestoreDb.collection("productTemplates").add(templateData);
      
      console.log(`[Templates TEST] Created template ${templateRef.id} linked to packet ${packetId}`);

      res.json({
        success: true,
        templateId: templateRef.id,
        packetId,
        message: "Template created and linked to packet",
      });
    } catch (error: any) {
      console.error("[Templates TEST] Error creating template:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/queue/process", async (req: any, res) => {
    try {
      const { limit = 5 } = req.body;
      const processLimit = Math.min(limit, 20);

      const { getFirestoreDb, getFirebaseAdmin } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = getFirebaseAdmin();

      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const processingSnapshot = await firestoreDb.collection("mockupJobs")
        .where("status", "==", "processing")
        .limit(50)
        .get();
      
      let recoveredCount = 0;
      for (const doc of processingSnapshot.docs) {
        const data = doc.data();
        const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
        if (startedAt < fiveMinutesAgo) {
          await firestoreDb.collection("mockupJobs").doc(doc.id).update({
            status: "pending",
            retryCount: admin.firestore.FieldValue.increment(1),
            lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          console.log(`[Queue] Recovered stale job ${doc.id}`);
          recoveredCount++;
        }
      }

      const pendingSnapshot = await firestoreDb.collection("mockupJobs")
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
            const jobRef = firestoreDb.collection("mockupJobs").doc(jobId);
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

          await firestoreDb.collection("mockupJobs").doc(jobId).update({
            status: "completed",
            mockupUrl: mockupResult.mockupUrl || null,
            lifestyleUrl: mockupResult.lifestyleUrl || null,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          results.push({ jobId, status: "completed" });
          console.log(`[Queue] Job ${jobId} completed: ${job.colorName} / ${job.placement} / ${job.qrSize}`);

        } catch (error: any) {
          console.error(`[Queue] Job ${jobId} failed:`, error.message);
          
          await firestoreDb.collection("mockupJobs").doc(jobId).update({
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

  app.get("/api/test/store-product-links", async (req: any, res) => {
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

  app.post("/api/test/store-product-links", async (req: any, res) => {
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

  app.get("/api/test/stores/:storeId/channels/:channelId/products", async (req: any, res) => {
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

  app.patch("/api/test/store-product-links/:linkId", async (req: any, res) => {
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

  app.delete("/api/test/store-product-links/:linkId", async (req: any, res) => {
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

  // ============ CUSTOM DESIGNS ENDPOINTS ============
  
  app.get("/api/customs/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const design = await storage.getCustomDesign(id);
      if (!design) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      res.json(design);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/admin/custom-designs", isAdmin, async (req, res) => {
    try {
      const createSchema = z.object({
        projectName: z.string().min(1, "Project name is required").max(100),
        productId: z.number(),
        productName: z.string(),
        productImage: z.string().nullable().optional(),
        placements: z.array(z.string()).min(1),
        placementConfigs: z.record(z.string(), z.enum(["full", "qr-only"])).optional(),
        qrContentType: z.enum(["rich_media", "plain_text", "external_url"]).optional().default("rich_media"),
        plainTextQrContent: z.string().nullable().optional(),
        externalUrl: z.string().nullable().optional().refine(
          (val) => {
            if (!val) return true;
            const normalized = val.match(/^https?:\/\//) ? val : `https://${val}`;
            try {
              const url = new URL(normalized);
              return url.hostname.includes('.') && url.hostname.length > 3;
            } catch {
              return false;
            }
          },
          { message: "Please enter a valid URL (e.g., https://example.com or example.com)" }
        ),
        backgroundImage: z.string().nullable().optional(),
        topText: z.object({
          text: z.string(),
          fontFamily: z.string(),
          fontSize: z.string(),
          color: z.string().optional(),
          letterSpacing: z.number().optional(),
          warpPreset: z.string().optional(),
          strokeColor: z.string().optional(),
          strokeWidth: z.number().optional(),
        }).nullable().optional(),
        bottomText: z.object({
          text: z.string(),
          fontFamily: z.string(),
          fontSize: z.string(),
          color: z.string().optional(),
          letterSpacing: z.number().optional(),
          warpPreset: z.string().optional(),
          strokeColor: z.string().optional(),
          strokeWidth: z.number().optional(),
        }).nullable().optional(),
        landingOverlay: z.object({
          enabled: z.boolean(),
          title: z.string().optional(),
          description: z.string().optional(),
          position: z.enum(["top", "bottom"]),
          fontFamily: z.string(),
          color: z.string(),
        }).nullable().optional(),
        textUpcharge: z.number().optional().default(2.00),
        storeType: z.string().nullable().optional(),
        storeName: z.string().nullable().optional(),
        segment: z.string().nullable().optional(),
        isFeatured: z.boolean().optional().default(false),
        isSeasonalPromo: z.boolean().optional().default(false),
        saveTarget: z.enum(["library", "store", "both"]),
        basePrice: z.number().optional().default(0),
        markupPercent: z.number().optional().default(0),
        markupFixed: z.number().optional().default(0),
        hostingPrice: z.number().optional().default(0),
        madeInUSA: z.boolean().optional().default(false),
        printProviderId: z.number().nullable().optional(),
      });
      
      const validatedData = createSchema.parse(req.body);
      
      if (validatedData.qrContentType === "external_url") {
        if (!validatedData.externalUrl || validatedData.externalUrl.trim() === "") {
          return res.status(400).json({ 
            error: "External URL is required when using External URL QR mode" 
          });
        }
      }
      
      if (validatedData.qrContentType === "plain_text") {
        if (!validatedData.plainTextQrContent || validatedData.plainTextQrContent.trim() === "") {
          return res.status(400).json({ 
            error: "QR content is required when using Plain Text QR mode" 
          });
        }
      }
      
      const slugify = (str: string) => str?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '';
      
      let baseSlug = slugify(validatedData.projectName);
      
      if (!baseSlug) {
        const storePart = slugify(validatedData.storeName || 'custom');
        const segmentPart = slugify(validatedData.segment || 'general');
        const timestamp = Date.now().toString(36);
        baseSlug = `${storePart}-${segmentPart}-${timestamp}`;
      }
      
      let designId = baseSlug;
      let counter = 1;
      while (await storage.getCustomDesign(designId)) {
        designId = `${baseSlug}-${counter}`;
        counter++;
      }
      
      const baseUrl = process.env.REPLIT_DOMAINS 
        ? `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`
        : "http://localhost:5000";
      
      let backgroundAssetId: string | null = null;
      if (validatedData.backgroundImage && validatedData.saveTarget !== "store") {
        const existingAsset = await storage.getLibraryAssetByUrl(validatedData.backgroundImage);
        if (existingAsset) {
          backgroundAssetId = existingAsset.id;
          await storage.incrementLibraryAssetUsage(existingAsset.id);
          if (!existingAsset.isActive) {
            await storage.updateLibraryAsset(existingAsset.id, { isActive: true });
          }
        } else {
          const bgFilename = validatedData.backgroundImage.split('/').pop() || 'background.png';
          const newAsset = await storage.createLibraryAsset({
            name: `Background - ${validatedData.storeName || 'Custom'} ${validatedData.segment || ''}`.trim(),
            originalName: bgFilename,
            mimeType: 'image/png',
            fileName: bgFilename,
            sizeBytes: 0,
            storageUrl: validatedData.backgroundImage,
            publicUrl: validatedData.backgroundImage,
            ownerType: 'admin',
            assetType: 'background',
            mediaType: 'image',
            isActive: true,
            isFeatured: false,
            visibleStoreSlugs: validatedData.storeName ? [validatedData.storeName.toLowerCase().replace(/[^a-z0-9]+/g, '-')] : null,
            visibleSegments: validatedData.segment ? { segments: [validatedData.segment] } : null,
          });
          backgroundAssetId = newAsset.id;
        }
      }
      
      const finalPlacementConfigs = validatedData.placementConfigs || 
        Object.fromEntries(validatedData.placements.map(p => [p, "full"]));
      
      const templateVariant = validatedData.qrContentType === "plain_text" ? "plain-text" 
        : validatedData.qrContentType === "external_url" ? "external-url" 
        : "url";
      
      const designData = {
        id: designId,
        projectName: validatedData.projectName,
        productId: validatedData.productId,
        productName: validatedData.productName,
        productImage: validatedData.productImage || null,
        placements: validatedData.placements,
        placementConfigs: finalPlacementConfigs,
        backgroundImageUrl: validatedData.backgroundImage || null,
        backgroundAssetId: backgroundAssetId,
        topText: validatedData.topText || null,
        bottomText: validatedData.bottomText || null,
        landingOverlay: validatedData.landingOverlay || null,
        textUpcharge: String(validatedData.textUpcharge),
        storeType: validatedData.storeType || null,
        storeName: validatedData.storeName || null,
        segment: validatedData.segment || null,
        isFeatured: validatedData.isFeatured,
        isSeasonalPromo: validatedData.isSeasonalPromo,
        savedToLibrary: validatedData.saveTarget === "library" || validatedData.saveTarget === "both",
        savedToStore: validatedData.saveTarget === "store" || validatedData.saveTarget === "both",
        templateVariant,
        externalUrl: validatedData.externalUrl 
          ? (validatedData.externalUrl.match(/^https?:\/\//) 
             ? validatedData.externalUrl 
             : `https://${validatedData.externalUrl}`)
          : null,
      };
      
      const design = await storage.createCustomDesign(designData);
      
      let qrUrl: string;
      if (validatedData.qrContentType === "external_url" && validatedData.externalUrl) {
        const extUrl = validatedData.externalUrl;
        qrUrl = extUrl.match(/^https?:\/\//) ? extUrl : `https://${extUrl}`;
      } else if (validatedData.qrContentType === "plain_text" && validatedData.plainTextQrContent) {
        qrUrl = validatedData.plainTextQrContent;
      } else {
        qrUrl = `${baseUrl}/customs/${design.id}`;
      }
      
      const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
      
      const placementImages: Record<string, string> = {};
      let primaryCompositeUrl: string | null = null;
      
      const { renderDesignToPng, renderQrOnlyToPng } = await import("../lib/svg-renderer");
      
      const generateFullArtworkWithFallback = async (placementId: string, qrColor: 'black' | 'white' = 'black'): Promise<string | null> => {
        const textColor = qrColor === 'white' ? "#FFFFFF" : "#000000";
        
        const headerStyle = validatedData.topText ? {
          text: validatedData.topText.text,
          fontFamily: validatedData.topText.fontFamily || "Arial",
          fontSize: parseInt(validatedData.topText.fontSize) || 120,
          color: textColor,
          letterSpacing: (validatedData.topText as any).letterSpacing || 0,
          warpPreset: (validatedData.topText as any).warpPreset || "straight",
          strokeColor: (validatedData.topText as any).strokeColor,
          strokeWidth: (validatedData.topText as any).strokeWidth,
        } : undefined;
        
        const footerStyle = validatedData.bottomText ? {
          text: validatedData.bottomText.text,
          fontFamily: validatedData.bottomText.fontFamily || "Arial",
          fontSize: parseInt(validatedData.bottomText.fontSize) || 96,
          color: textColor,
          letterSpacing: (validatedData.bottomText as any).letterSpacing || 0,
          warpPreset: (validatedData.bottomText as any).warpPreset || "straight",
          strokeColor: (validatedData.bottomText as any).strokeColor,
          strokeWidth: (validatedData.bottomText as any).strokeWidth,
        } : undefined;
        
        try {
          const renderResult = await renderDesignToPng({
            templateType: 'shirt-front',
            header: headerStyle,
            footer: footerStyle,
            qrUrl,
            qrColor,
          });
          
          const colorSuffix = qrColor === 'white' ? '-white' : '';
          const fileName = `svg-composite-${design.id}-${placementId}${colorSuffix}-${Date.now()}.png`;
          const uploadResult = await uploadImageFromBuffer(
            renderResult.pngBuffer,
            fileName,
            'image/png'
          );
          console.log(`[Custom Design] Generated ${qrColor.toUpperCase()} full artwork for ${placementId}: ${uploadResult.publicUrl}`);
          return uploadResult.publicUrl;
        } catch (svgError: any) {
          console.error(`[Custom Design] SVG render failed for ${placementId}, falling back to canvas:`, svgError.message);
          
          const fallbackTopText = validatedData.topText ? {
            text: validatedData.topText.text,
            fontFamily: validatedData.topText.fontFamily || "Arial",
            fontSize: validatedData.topText.fontSize || "120",
            color: textColor,
            letterSpacing: (validatedData.topText as any).letterSpacing || 0,
            warpPreset: (validatedData.topText as any).warpPreset || "straight",
            strokeColor: (validatedData.topText as any).strokeColor,
            strokeWidth: (validatedData.topText as any).strokeWidth,
          } : null;
          
          const fallbackBottomText = validatedData.bottomText ? {
            text: validatedData.bottomText.text,
            fontFamily: validatedData.bottomText.fontFamily || "Arial",
            fontSize: validatedData.bottomText.fontSize || "96",
            color: textColor,
            letterSpacing: (validatedData.bottomText as any).letterSpacing || 0,
            warpPreset: (validatedData.bottomText as any).warpPreset || "straight",
            strokeColor: (validatedData.bottomText as any).strokeColor,
            strokeWidth: (validatedData.bottomText as any).strokeWidth,
          } : null;
          
          const canvasUrl = await generatePrintifyComposite(
            qrUrl,
            fallbackTopText,
            fallbackBottomText,
            4500,
            5400,
            qrColor
          );
          console.log(`[Custom Design] Generated ${qrColor.toUpperCase()} canvas fallback for ${placementId}: ${canvasUrl}`);
          return canvasUrl;
        }
      }
      
      for (const [placementId, mode] of Object.entries(finalPlacementConfigs)) {
        try {
          let imageUrl: string | null = null;
          let whiteImageUrl: string | null = null;
          
          if (mode === "qr-only") {
            const qrOnlyResult = await renderQrOnlyToPng({ qrUrl });
            const fileName = `qr-only-${design.id}-${placementId}-${Date.now()}.png`;
            const uploadResult = await uploadImageFromBuffer(
              qrOnlyResult.pngBuffer,
              fileName,
              'image/png'
            );
            console.log(`[Custom Design] Generated QR-only for ${placementId}: ${uploadResult.publicUrl}`);
            imageUrl = uploadResult.publicUrl;
            
            const qrOnlyWhiteResult = await renderQrOnlyToPng({ qrUrl, qrColor: 'white' });
            const whiteFileName = `qr-only-white-${design.id}-${placementId}-${Date.now()}.png`;
            const whiteUploadResult = await uploadImageFromBuffer(
              qrOnlyWhiteResult.pngBuffer,
              whiteFileName,
              'image/png'
            );
            console.log(`[Custom Design] Generated WHITE QR-only for ${placementId}: ${whiteUploadResult.publicUrl}`);
            whiteImageUrl = whiteUploadResult.publicUrl;
          } else {
            imageUrl = await generateFullArtworkWithFallback(placementId, 'black');
            
            whiteImageUrl = await generateFullArtworkWithFallback(placementId, 'white');
          }
          
          if (imageUrl) {
            placementImages[placementId] = imageUrl;
            
            if (!primaryCompositeUrl && mode === "full") {
              primaryCompositeUrl = imageUrl;
            }
          }
          
          if (whiteImageUrl) {
            placementImages[`${placementId}-white`] = whiteImageUrl;
            console.log(`[Custom Design] Stored white version as ${placementId}-white`);
          }
        } catch (renderError: any) {
          console.error(`[Custom Design] Render failed for ${placementId}:`, renderError.message);
        }
      }
      
      if (!primaryCompositeUrl && Object.keys(placementImages).length > 0) {
        primaryCompositeUrl = Object.values(placementImages)[0];
      }
      
      const updatedDesign = await storage.updateCustomDesign(design.id, {
        qrCodeUrl: qrCodeDataUrl,
        printifyCompositeUrl: primaryCompositeUrl,
        placementImages,
      });
      
      if (designData.savedToStore && designData.storeName) {
        const categoryPath = designData.segment 
          ? `${designData.storeName}/${designData.segment}`
          : designData.storeName;
        
        const productId = `custom_${design.id}`;
        
        const textUpchargeTotal = (validatedData.topText ? validatedData.textUpcharge : 0) + 
                                  (validatedData.bottomText ? validatedData.textUpcharge : 0);
        const totalCost = validatedData.basePrice + textUpchargeTotal + validatedData.hostingPrice;
        
        const customerPrice = (totalCost * (1 + validatedData.markupPercent / 100)) + validatedData.markupFixed;
        
        const existingProduct = await storage.getProduct(productId);
        
        if (existingProduct) {
          await storage.updateProduct(productId, {
            name: validatedData.productName,
            description: `Custom QR design for ${categoryPath}`,
            category: categoryPath,
            basePrice: String(totalCost.toFixed(2)),
            customerPrice: String(customerPrice.toFixed(2)),
            markupPercent: String(validatedData.markupPercent),
            markupFixed: String(validatedData.markupFixed),
            imageUrl: validatedData.productImage || null,
            blueprintId: validatedData.productId || null,
            printProviderId: validatedData.printProviderId || null,
            madeInUSA: validatedData.madeInUSA || false,
            isFeatured: validatedData.isFeatured || false,
            isEnabled: true,
            metadata: { customDesignId: design.id, source: "custom" },
          });
        } else {
          await storage.createProduct({
            id: productId,
            name: validatedData.productName,
            description: `Custom QR design for ${categoryPath}`,
            basePrice: String(totalCost.toFixed(2)),
            customerPrice: String(customerPrice.toFixed(2)),
            markupPercent: String(validatedData.markupPercent),
            markupFixed: String(validatedData.markupFixed),
            category: categoryPath,
            imageUrl: validatedData.productImage || null,
            blueprintId: validatedData.productId || null,
            printProviderId: validatedData.printProviderId || null,
            madeInUSA: validatedData.madeInUSA || false,
            isFeatured: validatedData.isFeatured || false,
            isEnabled: true,
            metadata: { customDesignId: design.id, source: "custom" },
          });
        }
        
        console.log(`[Custom Design] Created/updated product catalog entry: ${productId} in category: ${categoryPath} with price $${customerPrice.toFixed(2)}`);
        
        if (validatedData.productId && validatedData.printProviderId) {
          try {
            const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
            
            const { printifyPrintProviders } = await import('@shared/schema');
            const [provider] = await db.select()
              .from(printifyPrintProviders)
              .where(
                and(
                  eq(printifyPrintProviders.blueprintId, validatedData.productId),
                  eq(printifyPrintProviders.providerId, validatedData.printProviderId)
                )
              );
            
            const availableColors = provider?.availableColors as Array<{name: string; hex: string}> || [];
            
            if (availableColors.length > 0) {
              const artworkUrl = (placementImages as any)?.["front-chest"] || 
                                 Object.values(placementImages || {})[0] as string;
              
              if (artworkUrl) {
                const artworkVariant = "black" as const;
                
                const jobs = await mockupJobQueue.createBatchJobs({
                  productId,
                  colors: availableColors,
                  qrSizes: ["small", "medium", "large"],
                  placements: ["front-chest"],
                  blueprintId: validatedData.productId,
                  printProviderId: validatedData.printProviderId,
                  artworkUrl,
                  artworkVariant,
                });
                
                console.log(`[Custom Design] Queued ${jobs.length} mockup jobs for ${availableColors.length} colors x 3 sizes`);
              } else {
                console.warn(`[Custom Design] No artwork URL found for auto-mockup generation`);
              }
            } else {
              console.warn(`[Custom Design] No colors found in local catalog for blueprint ${validatedData.productId} provider ${validatedData.printProviderId}`);
            }
          } catch (mockupError: any) {
            console.error(`[Custom Design] Failed to queue mockup jobs:`, mockupError.message);
          }
        }
      }
      
      res.json(updatedDesign);
    } catch (error: any) {
      console.error("[Custom Design Save] Error:", error);
      if (error instanceof z.ZodError) {
        console.error("[Custom Design Save] Zod validation errors:", JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ error: "Validation failed", details: error.errors });
      }
      res.status(500).json({ error: error.message });
    }
  });
  
  app.get("/api/admin/custom-designs", isAdmin, async (req, res) => {
    try {
      const designs = await storage.getCustomDesigns();
      res.json(designs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  async function handleCustomDesignUpdate(req: any, res: any) {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const existing = await storage.getCustomDesign(id);
      if (!existing) {
        return res.status(404).json({ error: "Custom design not found" });
      }
      
      const updatedDesign = await storage.updateCustomDesign(id, updates);
      res.json(updatedDesign);
    } catch (error: any) {
      console.error("[Custom Design Update] Error:", error);
      res.status(500).json({ error: error.message });
    }
  }
  
  app.put("/api/admin/custom-designs/:id", isAdmin, handleCustomDesignUpdate);
  app.patch("/api/admin/custom-designs/:id", isAdmin, handleCustomDesignUpdate);
  
  app.delete("/api/admin/custom-designs/:id", isAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteCustomDesign(id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============ SVG TEXT WARP RENDER ENDPOINTS ============
  
  app.get("/api/render/config", async (req, res) => {
    try {
      const { getFontAllowlist, getWarpPresets } = await import("../lib/svg-renderer");
      res.json({
        fonts: getFontAllowlist(),
        warpPresets: getWarpPresets(),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  app.all("/api/render/preview", async (req, res) => {
    try {
      const { buildPreviewSvg } = await import("../lib/svg-renderer");
      const params = req.method === 'GET' ? req.query : req.body;
      const { header, footer, qrUrl, previewWidth, previewHeight } = params as any;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const svgString = buildPreviewSvg(
        { templateType: 'shirt-front', header, footer, qrUrl },
        previewWidth || 450,
        previewHeight || 540
      );
      
      res.type('image/svg+xml').send(svgString);
    } catch (error: any) {
      console.error("[SVG Preview] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/render/png", isAdmin, async (req, res) => {
    try {
      const { renderDesignToPng } = await import("../lib/svg-renderer");
      const { header, footer, qrUrl, templateType } = req.body;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const result = await renderDesignToPng({
        templateType: templateType || 'shirt-front',
        header,
        footer,
        qrUrl,
      });
      
      const fileName = `svg-render-${Date.now()}.png`;
      const uploadResult = await uploadImageFromBuffer(
        result.pngBuffer,
        fileName,
        'image/png'
      );
      
      res.json({
        url: uploadResult.publicUrl,
        width: result.width,
        height: result.height,
      });
    } catch (error: any) {
      console.error("[PNG Render] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  app.post("/api/render/png/download", isAdmin, async (req, res) => {
    try {
      const { renderDesignToPng } = await import("../lib/svg-renderer");
      const { header, footer, qrUrl, templateType } = req.body;
      
      if (!qrUrl) {
        return res.status(400).json({ error: "qrUrl is required" });
      }
      
      const result = await renderDesignToPng({
        templateType: templateType || 'shirt-front',
        header,
        footer,
        qrUrl,
      });
      
      res.set({
        'Content-Type': 'image/png',
        'Content-Disposition': 'attachment; filename="printify-design.png"',
        'Content-Length': result.pngBuffer.length,
      });
      res.send(result.pngBuffer);
    } catch (error: any) {
      console.error("[PNG Download] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

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

  // ================================================================
  // GIFT MODE API
  // ================================================================

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
      if (db) {
        const { giftCodes } = await import("@shared/schema");
        const { desc } = await import("drizzle-orm");
        const codes = await db.select().from(giftCodes)
          .orderBy(desc(giftCodes.createdAt))
          .limit(100);
        res.json(codes);
      } else {
        res.json([]);
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/admin/gifts/redemptions", isAdmin, async (req: any, res) => {
    try {
      if (db) {
        const { giftRedemptions } = await import("@shared/schema");
        const { desc } = await import("drizzle-orm");
        const redemptions = await db.select().from(giftRedemptions)
          .orderBy(desc(giftRedemptions.redeemedAt))
          .limit(100);
        res.json(redemptions);
      } else {
        res.json([]);
      }
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
      const { libraryAssets } = await import("@shared/schema");
      
      const typeFilter = (req.query.type as string) || 'source';
      const validTypes = ['source', 'cropped', 'background', 'template', 'design'];
      
      if (!validTypes.includes(typeFilter)) {
        return res.status(400).json({ error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
      }
      
      const assets = await db.select().from(libraryAssets)
        .where(and(eq(libraryAssets.isActive, true), eq(libraryAssets.assetType, typeFilter)))
        .orderBy(libraryAssets.createdAt);
      
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
      const { libraryAssets } = await import("@shared/schema");
      
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
            
            const displayName = imageName.replace(/\.[^/.]+$/, '');
            const proxyUrl = `/api/library-files/${encodeURIComponent(uniqueName)}`;
            
            const [asset] = await db.insert(libraryAssets).values({
              ownerType: 'admin',
              assetType: assetType,
              mediaType: 'image',
              name: displayName,
              fileName: uniqueName,
              originalName: imageName,
              mimeType: imageMimeType,
              sizeBytes: imageBuffer.length,
              storageUrl: uploadResult.storageUrl,
              publicUrl: proxyUrl,
              isActive: true,
            }).returning();
            
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
      const ext = mimeType?.split('/')[1] || 'png';
      const fileName = `${Date.now()}-${name.replace(/[^a-zA-Z0-9.-]/g, '_')}.${ext}`;
      
      const uploadResult = await uploadToFirebaseStorage(
        buffer,
        fileName,
        mimeType || 'image/png',
        folderPath
      );
      
      const proxyUrl = `/api/library-files/${encodeURIComponent(fileName)}`;
      
      const [asset] = await db.insert(libraryAssets).values({
        ownerType: 'admin',
        assetType: assetType,
        mediaType: 'image',
        name,
        fileName,
        originalName: name,
        mimeType: mimeType || 'image/png',
        sizeBytes: buffer.length,
        storageUrl: uploadResult.storageUrl,
        publicUrl: proxyUrl,
        isActive: true,
      }).returning();
      
      res.json({ ...asset, proxyUrl: asset.publicUrl });
    } catch (error: any) {
      console.error("Error uploading background asset:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      const { libraryAssets } = await import("@shared/schema");
      const { name, isActive } = req.body;
      
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (isActive !== undefined) updateData.isActive = isActive;
      
      const [updated] = await db.update(libraryAssets)
        .set(updateData)
        .where(eq(libraryAssets.id, req.params.id))
        .returning();
      
      res.json({ ...updated, proxyUrl: updated.publicUrl });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/admin/background-assets/:id", isAdmin, async (req: any, res) => {
    try {
      const { libraryAssets } = await import("@shared/schema");
      
      await db.update(libraryAssets)
        .set({ isActive: false })
        .where(eq(libraryAssets.id, req.params.id));
      
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
      const { libraryAssets } = await import("@shared/schema");
      const folder = 'library/backgrounds/raw';
      
      console.log(`[LibraryAssets] Syncing assets from: ${folder}`);
      
      const storageFiles = await listFilesInFolder(folder);
      console.log(`[LibraryAssets] Found ${storageFiles.length} files`);
      
      const existingAssets = await db.select().from(libraryAssets)
        .where(and(eq(libraryAssets.isActive, true), eq(libraryAssets.assetType, 'background')));
      const existingPaths = new Set(existingAssets.map(a => a.storageUrl));
      
      const newFiles = storageFiles.filter(f => !existingPaths.has(f.fullPath));
      console.log(`[LibraryAssets] ${newFiles.length} files need database records`);
      
      const createdAssets: any[] = [];
      for (const file of newFiles) {
        if (!file.contentType.startsWith('image/')) continue;
        
        try {
          const displayName = file.name.replace(/\.[^/.]+$/, '');
          const proxyUrl = `/api/library-files/${encodeURIComponent(file.name)}`;
          
          const [asset] = await db.insert(libraryAssets).values({
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
          }).returning();
          
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

  // ============ TEST: FULFILLMENT PROVIDERS ============
  app.get("/api/test/fulfillment-providers", async (req: any, res) => {
    try {
      const printifyKey = process.env.PRINTIFY_API_KEY;
      const printfulKey = process.env.PRINTFUL_API_KEY;
      const apliiqKey = process.env.APLIIQ_API_KEY;
      
      const providers = [
        { 
          id: "printify", 
          name: "Printify", 
          configured: !!printifyKey && printifyKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printify network"
        },
        { 
          id: "printful", 
          name: "Printful", 
          configured: !!printfulKey && printfulKey.length > 10,
          role: "fulfillment",
          description: "Print-on-demand fulfillment via Printful"
        },
        { 
          id: "apliiq", 
          name: "Apliiq", 
          configured: !!apliiqKey && apliiqKey.length > 10,
          role: "fulfillment",
          description: "Custom apparel via Apliiq"
        },
      ];
      
      console.log(`[FulfillmentProviders] Returning ${providers.filter(p => p.configured).length} configured providers`);
      res.json(providers);
    } catch (error: any) {
      console.error('[FulfillmentProviders] Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PRODUCTS ============
  app.get("/api/test/products", async (req: any, res) => {
    try {
      const provider = req.query.provider as string | undefined;
      const { products, printfulProducts } = await import("@shared/schema");
      
      if (provider === "printful") {
        const allProducts = await db.select().from(printfulProducts);
        console.log(`[TestProducts] GET returned ${allProducts.length} Printful products`);
        
        const transformed = allProducts.map(p => ({
          id: `printful-${p.id}`,
          name: p.title || `Printful Product ${p.id}`,
          printfulId: p.id,
          blueprintId: p.id,
          isEnabled: true,
          fulfillmentProvider: "printful",
          image: p.image,
          variantCount: p.variantCount || 0,
          brand: p.brand,
          model: p.model,
          description: p.type,
        }));
        
        return res.json(transformed);
      }
      
      const allProducts = await db.select().from(products).where(eq(products.isEnabled, true));
      console.log(`[TestProducts] GET returned ${allProducts.length} Printify products`);
      res.json(allProducts);
    } catch (error: any) {
      console.error('[TestProducts] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/products/sync", async (req: any, res) => {
    try {
      console.log('[TestProducts] Sync requested');
      const { printify } = await import("../lib/printify");
      const { detectCategory } = await import("../lib/printify");
      
      if (!printify) {
        return res.status(503).json({ error: "Printify API not configured" });
      }
      
      const latestSync = await storage.getLatestCatalogSync();
      if (latestSync?.status === 'running') {
        return res.status(409).json({ error: "Sync already in progress" });
      }
      
      const syncRecord = await storage.createCatalogSync({
        syncType: 'full',
        status: 'running',
        blueprintsCount: 0,
        providersCount: 0,
      });
      
      res.json({ syncId: syncRecord.id, status: 'started', message: "Catalog sync started in background" });
      
      (async () => {
        try {
          console.log('[TestProducts] Starting full catalog sync...');
          
          const blueprints = await printify.getCatalogBlueprints();
          console.log(`[TestProducts] Found ${blueprints.length} blueprints`);
          
          let blueprintsCount = 0;
          let providersCount = 0;
          
          for (const bp of blueprints) {
            try {
              await storage.upsertPrintifyBlueprint({
                id: bp.id,
                title: bp.title,
                description: bp.description || null,
                brand: bp.brand || null,
                model: bp.model || null,
                images: bp.images || null,
                primaryImageUrl: bp.images?.[0] || null,
                category: detectCategory(bp.title, bp.brand || ''),
              });
              blueprintsCount++;
              
              const providers = await printify.getPrintProviders(bp.id);
              
              for (const provider of providers) {
                const isUSA = provider.location?.country === 'US' || 
                              provider.location?.country === 'USA';
                
                await storage.upsertPrintifyPrintProvider({
                  blueprintId: bp.id,
                  providerId: provider.id,
                  title: provider.title,
                  country: provider.location?.country || null,
                  isUSA,
                });
                providersCount++;
              }
              
              await new Promise(r => setTimeout(r, 100));
              
            } catch (bpError: any) {
              console.error(`[TestProducts] Error syncing blueprint ${bp.id}:`, bpError.message);
            }
          }
          
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'completed',
            blueprintsCount,
            providersCount,
            completedAt: new Date(),
          });
          
          console.log(`[TestProducts] Sync completed. ${blueprintsCount} blueprints, ${providersCount} providers`);
          
        } catch (bgError: any) {
          console.error('[TestProducts] Background sync error:', bgError.message);
          await storage.updateCatalogSync(syncRecord.id, {
            status: 'failed',
            errorMessage: bgError.message,
            completedAt: new Date(),
          });
        }
      })();
      
    } catch (error: any) {
      console.error('[TestProducts] Sync error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/test/products/:id", async (req: any, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      const { products } = await import("@shared/schema");
      
      const cleanUpdate: Record<string, any> = {};
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          cleanUpdate[key] = value;
        }
      }
      cleanUpdate.updatedAt = new Date();
      
      const [updated] = await db
        .update(products)
        .set(cleanUpdate)
        .where(eq(products.id, id))
        .returning();
      
      if (!updated) {
        return res.status(404).json({ error: 'Product not found' });
      }
      
      console.log(`[TestProducts] PUT ${id} updated:`, Object.keys(cleanUpdate));
      res.json(updated);
    } catch (error: any) {
      console.error('[TestProducts] PUT error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: STORES (Firestore) ============
  app.get("/api/test/stores", async (req: any, res) => {
    try {
      const roleType = req.query.roleType as string;
      console.log(`[TestStores] GET stores for roleType: ${roleType}`);
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      
      let query = fsDb.collection('stores');
      if (roleType) {
        query = query.where('roleType', '==', roleType) as any;
      }
      
      const snapshot = await query.get();
      const stores = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      stores.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || ''));
      
      console.log(`[TestStores] Found ${stores.length} stores for roleType: ${roleType || 'all'}`);
      res.json(stores);
    } catch (error: any) {
      console.error('[TestStores] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test/stores/by-id/:storeId", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      console.log(`[TestStores] GET store by ID: ${storeId}`);
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      
      let doc = await fsDb.collection('stores').doc(storeId).get();
      
      if (doc.exists) {
        const data = doc.data();
        const store = {
          id: doc.id,
          name: data?.name || storeId,
          type: data?.roleType || 'internal',
          roleType: data?.roleType || 'internal',
          isActive: data?.isActive ?? true,
        };
        console.log(`[TestStores] Found store in stores: ${storeId}`);
        return res.json(store);
      }
      
      doc = await fsDb.collection('partnerStores').doc(storeId).get();
      
      if (doc.exists) {
        const data = doc.data();
        const store = {
          id: doc.id,
          name: data?.name || storeId,
          type: data?.isInternal ? 'internal' : 'external',
          roleType: data?.isInternal ? 'internal' : 'external',
          isActive: data?.isActive ?? true,
          isPartnerStore: true,
        };
        console.log(`[TestStores] Found store in partnerStores: ${storeId}`);
        return res.json(store);
      }
      
      return res.status(404).json({ error: 'Store not found' });
    } catch (error: any) {
      console.error('[TestStores] GET by-id error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/stores", async (req: any, res) => {
    try {
      const { name, roleType } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Store name is required' });
      }
      if (!roleType || !['internal', 'external', 'member'].includes(roleType)) {
        return res.status(400).json({ error: 'Valid roleType is required (internal, external, member)' });
      }
      
      const storeId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const storeData = {
        name: name.trim(),
        roleType,
        isActive: true,
        channelCount: 0,
        createdAt: new Date().toISOString(),
      };
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('stores').doc(storeId).set(storeData);
      
      console.log(`[TestStores] Created store: ${storeId} (${roleType})`);
      res.json({ id: storeId, ...storeData });
    } catch (error: any) {
      console.error('[TestStores] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/test/stores/:storeId", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      
      const channelsSnapshot = await fsDb.collection('storeChannels')
        .where('storeId', '==', storeId)
        .get();
      
      const batch = fsDb.batch();
      channelsSnapshot.docs.forEach((doc: any) => {
        batch.delete(doc.ref);
      });
      
      batch.delete(fsDb.collection('stores').doc(storeId));
      await batch.commit();
      
      console.log(`[TestStores] Deleted store: ${storeId} (and ${channelsSnapshot.size} channels)`);
      res.json({ success: true, deletedChannels: channelsSnapshot.size });
    } catch (error: any) {
      console.error('[TestStores] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: STORE CHANNELS ============
  app.get("/api/test/stores/:storeId/channels", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      console.log(`[TestChannels] GET channels for store: ${storeId}`);
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      const snapshot = await fsDb.collection('storeChannels')
        .where('storeId', '==', storeId)
        .get();
      
      const channels = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      channels.sort((a: any, b: any) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      
      console.log(`[TestChannels] Found ${channels.length} channels for ${storeId}`);
      res.json(channels);
    } catch (error: any) {
      console.error('[TestChannels] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/stores/:storeId/channels", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Channel name is required' });
      }
      
      const channelId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const channelData = {
        name: name.trim(),
        storeId,
        isActive: true,
        productCount: 0,
        createdAt: new Date().toISOString(),
      };
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('storeChannels').doc(channelId).set(channelData);
      console.log(`[TestChannels] Created channel: ${channelId} for store ${storeId}`);
      
      res.json({ id: channelId, ...channelData });
    } catch (error: any) {
      console.error('[TestChannels] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/test/stores/:storeId/channels/:channelId", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      await fsDb.collection('storeChannels').doc(channelId).delete();
      console.log(`[TestChannels] Deleted channel: ${channelId} from store ${storeId}`);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('[TestChannels] DELETE error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: ALLOWED PRODUCTS ============
  app.get("/api/test/stores/:storeId/allowed-products", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      console.log(`[AllowedProducts] GET allowed products for store: ${storeId}`);
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      
      const doc = await fsDb.collection('storeAllowedProducts').doc(storeId).get();
      
      if (!doc.exists) {
        return res.json({ storeId, products: [] });
      }
      
      const data = doc.data();
      res.json({ 
        storeId, 
        products: data?.products || [],
        updatedAt: data?.updatedAt 
      });
    } catch (error: any) {
      console.error('[AllowedProducts] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/stores/:storeId/allowed-products", async (req: any, res) => {
    try {
      const { storeId } = req.params;
      const { products } = req.body;
      
      if (!Array.isArray(products)) {
        return res.status(400).json({ error: 'products must be an array' });
      }
      
      console.log(`[AllowedProducts] POST ${products.length} products for store: ${storeId}`);
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const fsDb = getFirestoreDb();
      
      const pricingDoc = await fsDb.collection("testSettings").doc("pricing").get();
      const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
      
      const markupPercent = pricingSettings?.markupPercent ?? 25;
      const markupFixed = pricingSettings?.markupFixed ?? 0;
      const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
      const textLineUpcharge = pricingSettings?.textLineUpcharge ?? 2;
      const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
      
      console.log(`[AllowedProducts] Using pricing: ${markupPercent}% markup, ${memberProfitShare * 100}% member share`);
      
      const { downloadAndStoreFromUrl } = await import("../lib/firebase-storage-service");
      const { syncProductVariants } = await import("../lib/printify");
      
      const enrichedProducts = await Promise.all(
        products.map(async (p: { blueprintId: number; title: string; addedAt?: string }) => {
          try {
            const blueprint = await storage.getPrintifyBlueprint(p.blueprintId);
            const providers = await storage.getPrintifyPrintProviders(p.blueprintId);
            
            const usaProviders = providers.filter((prov: any) => prov.isUSA);
            const selectedProvider = usaProviders[0] || providers[0];
            
            let availableColors: Array<{name: string; hex: string}> = [];
            let availableSizes: string[] = [];
            
            if (selectedProvider?.availableColors && Array.isArray(selectedProvider.availableColors)) {
              availableColors = selectedProvider.availableColors as Array<{name: string; hex: string}>;
              availableSizes = (selectedProvider.availableSizes as string[]) || [];
            } else if (selectedProvider?.id) {
              try {
                const variantData = await syncProductVariants(p.blueprintId, Number(selectedProvider.id));
                availableColors = variantData.colors;
                availableSizes = variantData.sizes;
                console.log(`[AllowedProducts] Synced ${availableColors.length} colors for blueprint ${p.blueprintId}`);
              } catch (syncErr) {
                console.error(`[AllowedProducts] Failed to sync variants for ${p.blueprintId}:`, syncErr);
              }
            }
            
            const baseCostCents = selectedProvider?.minCost || 0;
            const baseCost = baseCostCents / 100;
            
            const retailPrice = Math.ceil((baseCost * (1 + markupPercent / 100) + markupFixed) * 100) / 100;
            const profit = retailPrice - baseCost;
            const memberEarnings = Math.round(profit * memberProfitShare * 100) / 100;
            
            let imageUrl: string | null = null;
            if (blueprint?.primaryImageUrl) {
              imageUrl = await downloadAndStoreFromUrl(
                blueprint.primaryImageUrl, 
                `product-blueprint-${p.blueprintId}`
              );
              console.log(`[AllowedProducts] Stored primary image for blueprint ${p.blueprintId}: ${imageUrl}`);
            }
            
            const mockupsByColor: Record<string, { front: string | null }> = {};
            if (availableColors.length > 0 && imageUrl) {
              const firstColor = availableColors[0].name;
              mockupsByColor[firstColor] = { front: imageUrl };
              console.log(`[AllowedProducts] Set default mockup for ${firstColor}: ${imageUrl}`);
            }
            
            if (availableColors.length > 1 && selectedProvider?.id) {
              console.log(`[AllowedProducts] Queuing mockup generation for ${availableColors.length - 1} additional colors...`);
            }
            
            return {
              blueprintId: p.blueprintId,
              title: p.title,
              addedAt: p.addedAt || new Date().toISOString(),
              imageUrl,
              brand: blueprint?.brand || null,
              availableColors,
              availableSizes,
              mockupsByColor,
              printProviderId: selectedProvider?.id || null,
              baseCost,
              retailPrice,
              profit,
              memberEarnings,
              hasUSAProvider: usaProviders.length > 0,
              pricingUsed: {
                markupPercent,
                markupFixed,
                additionalPlacementCost,
                textLineUpcharge,
                memberProfitShare,
              },
              packetCreatedAt: new Date().toISOString(),
            };
          } catch (err) {
            console.error(`[AllowedProducts] Error enriching blueprint ${p.blueprintId}:`, err);
            return {
              ...p,
              addedAt: p.addedAt || new Date().toISOString(),
              error: 'Failed to enrich product data',
            };
          }
        })
      );
      
      await fsDb.collection('storeAllowedProducts').doc(storeId).set({
        products: enrichedProducts,
        updatedAt: new Date().toISOString(),
      });
      
      console.log(`[AllowedProducts] Saved ${enrichedProducts.length} products for store ${storeId}`);
      res.json({ storeId, products: enrichedProducts });
    } catch (error: any) {
      console.error('[AllowedProducts] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PARTNER STORES (Firestore) ============
  app.get("/api/test/partner-stores", async (req: any, res) => {
    try {
      console.log('[TestPartnerStores] GET partner-stores from Firestore');
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('partnerStores').get();
      const stores = snapshot.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name,
          slug: data.slug,
          isInternal: data.isInternal ?? true,
          isActive: data.isActive ?? true,
          availableSegments: data.availableSegments || [],
          apiKey: data.apiKey || null,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || null,
        };
      });
      
      console.log(`[TestPartnerStores] Found ${stores.length} stores`);
      res.json(stores);
    } catch (error: any) {
      console.error('[TestPartnerStores] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test/partner-stores/:id/products", async (req: any, res) => {
    try {
      const { id } = req.params;
      console.log(`[TestPartnerStores] GET products for store ${id}`);
      
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection('partnerStoreProducts')
        .where('storeId', '==', id)
        .get();
      
      const products = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      console.log(`[TestPartnerStores] Found ${products.length} products for store ${id}`);
      res.json(products);
    } catch (error: any) {
      console.error('[TestPartnerStores] GET products error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/partner-stores/:id/products", async (req: any, res) => {
    try {
      const { id } = req.params;
      const { productIds } = req.body;
      
      console.log(`[TestPartnerStores] POST sync products for store ${id}:`, productIds);
      
      if (!Array.isArray(productIds)) {
        return res.status(400).json({ error: 'productIds must be an array' });
      }
      
      const { getFirestoreDb, getFirebaseAdmin } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = getFirebaseAdmin();
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      const batch = firestoreDb.batch();
      
      const existingSnapshot = await firestoreDb.collection('partnerStoreProducts')
        .where('storeId', '==', id)
        .get();
      existingSnapshot.docs.forEach((doc: any) => batch.delete(doc.ref));
      
      for (const productId of productIds) {
        const docRef = firestoreDb.collection('partnerStoreProducts').doc();
        batch.set(docRef, {
          storeId: id,
          productId,
          createdAt: now,
        });
      }
      
      await batch.commit();
      
      console.log(`[TestPartnerStores] Synced ${productIds.length} products to store ${id}`);
      res.json({ success: true, synced: productIds.length });
    } catch (error: any) {
      console.error('[TestPartnerStores] POST products error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PRINTIFY CATALOG ============
  const TEST_USA_MADE_BRANDS = [
    'american apparel', 'royal apparel', 'bayside', 'los angeles apparel',
    'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage',
    'shaka wear', 'backpacks usa', 'american giant', 'next level',
  ];

  app.get("/api/test/printify/catalog", async (req: any, res) => {
    try {
      console.log('[TestCatalog] GET Printify catalog');
      const localBlueprints = await storage.getPrintifyBlueprints();
      
      if (localBlueprints.length === 0) {
        return res.json([]);
      }
      
      const { hasKnownMockupMapping } = await import("../lib/mockup-service");
      
      const { printifyPrintProviders } = await import("@shared/schema");
      const allProviders = await db.select().from(printifyPrintProviders);
      
      const providersByBlueprint: Record<number, typeof allProviders[0]> = {};
      for (const p of allProviders) {
        const existing = providersByBlueprint[p.blueprintId];
        if (!existing || (p.minCost && (!existing.minCost || p.minCost < existing.minCost))) {
          providersByBlueprint[p.blueprintId] = p;
        }
      }
      
      const categories: Record<string, any[]> = {
        "T-Shirts": [],
        "Sweatshirts & Hoodies": [],
        "Hats & Caps": [],
        "Drinkware": [],
        "Bags": [],
        "Other": [],
      };
      
      for (const bp of localBlueprints) {
        const title = bp.title.toLowerCase();
        const brandLower = (bp.brand || '').toLowerCase();
        const isUSABrand = TEST_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        
        const provider = providersByBlueprint[bp.id];
        const colors = provider?.availableColors as Array<{name: string; hex: string}> | null;
        const colorCount = colors?.length || 0;
        const minPrice = provider?.minCost ? (provider.minCost / 100).toFixed(2) : null;
        const maxPrice = provider?.maxCost ? (provider.maxCost / 100).toFixed(2) : null;
        
        const sizes = provider?.availableSizes as string[] || ["S", "M", "L", "XL", "2XL"];
        
        const item = {
          id: bp.id,
          title: bp.title,
          brand: bp.brand,
          model: bp.model,
          imageUrl: bp.images?.[0] || null,
          madeInUSA: isUSABrand || provider?.isUSA || false,
          minPrice,
          maxPrice,
          colorCount,
          availableColors: colors || [],
          availableSizes: sizes,
          blueprintId: bp.id,
          printProviderId: provider?.providerId || null,
          hasMockupMapping: hasKnownMockupMapping(bp.id),
        };
        
        if (title.includes('t-shirt') || title.includes('tee') || title.includes('tank')) {
          categories["T-Shirts"].push(item);
        } else if (title.includes('hoodie') || title.includes('sweatshirt') || title.includes('crew') || title.includes('pullover')) {
          categories["Sweatshirts & Hoodies"].push(item);
        } else if (title.includes('hat') || title.includes('cap') || title.includes('beanie') || title.includes('visor')) {
          categories["Hats & Caps"].push(item);
        } else if (title.includes('mug') || title.includes('tumbler') || title.includes('bottle') || title.includes('cup') || title.includes('glass')) {
          categories["Drinkware"].push(item);
        } else if (title.includes('bag') || title.includes('tote') || title.includes('backpack') || title.includes('pouch')) {
          categories["Bags"].push(item);
        } else {
          categories["Other"].push(item);
        }
      }
      
      const result = Object.entries(categories)
        .filter(([_, items]) => items.length > 0)
        .map(([name, items]) => ({ name, items, count: items.length }));
      
      console.log(`[TestCatalog] Returning ${result.length} categories`);
      res.json(result);
    } catch (error: any) {
      console.error('[TestCatalog] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test/printify/catalog/:blueprintId", async (req: any, res) => {
    try {
      const { blueprintId } = req.params;
      console.log(`[TestCatalog] GET blueprint details for ${blueprintId}`);
      
      const { printifyPrintProviders } = await import("@shared/schema");
      
      const providers = await db.select().from(printifyPrintProviders)
        .where(eq(printifyPrintProviders.blueprintId, parseInt(blueprintId)));
      
      if (providers.length === 0) {
        return res.json({
          id: blueprintId,
          colors: [
            { name: "Black", hex: "#000000" },
            { name: "White", hex: "#FFFFFF" },
            { name: "Navy", hex: "#000080" },
            { name: "Red", hex: "#FF0000" },
            { name: "Heather Gray", hex: "#9CA3AF" },
            { name: "Forest Green", hex: "#228B22" },
          ],
          sizes: ["S", "M", "L", "XL", "2XL"],
        });
      }
      
      const provider = providers[0];
      const colors = (provider.availableColors as Array<{name: string; hex?: string}>) || [];
      const sizes = (provider.availableSizes as string[]) || ["S", "M", "L", "XL", "2XL"];
      
      res.json({
        id: blueprintId,
        providerId: provider.providerId,
        colors,
        sizes,
        minPrice: provider.minCost ? (provider.minCost / 100).toFixed(2) : null,
        maxPrice: provider.maxCost ? (provider.maxCost / 100).toFixed(2) : null,
      });
    } catch (error: any) {
      console.error('[TestCatalog] GET blueprint error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/stores/:storeId/channels/:channelId/products", async (req: any, res) => {
    try {
      const { storeId, channelId } = req.params;
      const { products } = req.body;
      
      console.log(`[TestAssignment] POST ${products?.length || 0} products to ${storeId}/${channelId}`);
      
      if (!products || !Array.isArray(products)) {
        return res.status(400).json({ error: "products array required" });
      }
      
      const assignedProducts = products.map((p: any) => ({
        id: p.id,
        baseProductId: p.baseProductId,
        baseProductName: p.baseProductName,
        storeId,
        channelId,
        enabledColors: p.enabledColors,
        enabledSizes: p.enabledSizes,
        defaultColor: p.defaultColor,
        isBlankCanvas: p.isBlankCanvas,
        assignedAt: new Date().toISOString(),
      }));
      
      console.log(`[TestAssignment] Assigned:`, assignedProducts);
      
      res.json({
        success: true,
        assigned: assignedProducts.length,
        products: assignedProducts,
      });
    } catch (error: any) {
      console.error('[TestAssignment] POST error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PROVIDER COUNTS ============
  app.get("/api/test/provider-counts", async (req: any, res) => {
    try {
      console.log('[TestCatalog] GET provider counts');
      const { printfulProducts, printifyPrintProviders } = await import("@shared/schema");
      const { count } = await import("drizzle-orm");
      
      const [printifyResult] = await db.select({ count: count() }).from(printifyPrintProviders);
      const [printfulResult] = await db.select({ count: count() }).from(printfulProducts);
      
      const counts = {
        printify: printifyResult?.count || 0,
        printful: printfulResult?.count || 0,
      };
      
      console.log(`[TestCatalog] Provider counts:`, counts);
      res.json(counts);
    } catch (error: any) {
      console.error('[TestCatalog] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: SYNC TO FIRESTORE ============
  app.post("/api/test/sync-blueprints-to-firestore", async (req: any, res) => {
    try {
      console.log('[Sync] Starting blueprint sync to Firestore...');
      const { printifyBlueprints } = await import("@shared/schema");
      const FirestoreAdapter = (await import("../lib/firestore-adapter")).FirestoreAdapter;
      
      const allBlueprints = await db.select().from(printifyBlueprints);
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

  app.post("/api/test/sync-providers-to-firestore", async (req: any, res) => {
    try {
      console.log('[Sync] Starting provider sync to Firestore...');
      const { printifyPrintProviders } = await import("@shared/schema");
      const FirestoreAdapter = (await import("../lib/firestore-adapter")).FirestoreAdapter;
      
      const allProviders = await db.select().from(printifyPrintProviders);
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

  // ============ TEST: PRINTFUL CATALOG SYNC ============
  app.post("/api/test/catalog/sync-printful", async (req: any, res) => {
    try {
      console.log('[TEST SYNC] ========================================');
      console.log('[TEST SYNC] STARTING PRINTFUL CATALOG SYNC');
      console.log('[TEST SYNC] ========================================');
      
      const { syncPrintfulCatalog, printfulClient } = await import("../lib/printful");
      
      if (!printfulClient.isConfigured) {
        console.error('[TEST SYNC] ERROR: Printful API key not configured!');
        return res.status(500).json({ error: 'Printful API key not configured' });
      }
      
      res.json({ message: 'Printful catalog sync started - check logs for progress' });
      
      const result = await syncPrintfulCatalog(db);
      
      console.log('[TEST SYNC] ========================================');
      console.log('[TEST SYNC] PRINTFUL SYNC COMPLETE');
      console.log(`[TEST SYNC] Products: ${result.productsAdded} added, ${result.productsUpdated} updated`);
      console.log(`[TEST SYNC] Variants: ${result.variantsAdded} added, ${result.variantsUpdated} updated`);
      if (result.errors.length > 0) {
        console.error('[TEST SYNC] ERRORS:', result.errors.length);
        result.errors.forEach(e => console.error('[TEST SYNC]   -', e));
      }
      console.log('[TEST SYNC] ========================================');
      
    } catch (error: any) {
      console.error('[TEST SYNC] ========================================');
      console.error('[TEST SYNC] FATAL ERROR:', error.message);
      console.error('[TEST SYNC] ========================================');
    }
  });

  app.get("/api/test/catalog/printful-products", async (req: any, res) => {
    try {
      console.log('[TestCatalog] GET Printful products');
      const { printfulProducts } = await import("@shared/schema");
      const { desc } = await import("drizzle-orm");
      
      const products = await db.select().from(printfulProducts).orderBy(desc(printfulProducts.lastSyncedAt));
      
      const transformedProducts = products.map(product => {
        const placements = (product.availablePlacements || []).map((placementId: string) => ({
          id: placementId,
          type: placementId,
          title: placementId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          additionalPrice: 0,
        }));
        
        return {
          ...product,
          placements: placements.length > 0 ? placements : null,
        };
      });
      
      const categoryMap = new Map<string, any[]>();
      for (const product of transformedProducts) {
        const category = product.type || "Other";
        if (!categoryMap.has(category)) {
          categoryMap.set(category, []);
        }
        categoryMap.get(category)!.push(product);
      }
      
      const grouped = Array.from(categoryMap.entries()).map(([name, items]) => ({
        name,
        items,
        count: items.length,
      }));
      
      console.log(`[TestCatalog] Returning ${products.length} Printful products in ${grouped.length} categories`);
      res.json(grouped);
    } catch (error: any) {
      console.error('[TestCatalog] GET error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PRODUCT CONFIGS ============
  app.get("/api/test/product-configs", async (req: any, res) => {
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

  app.patch("/api/test/products/:id/options", async (req: any, res) => {
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

  app.post("/api/test/products/:id/sync-printify", async (req: any, res) => {
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
        availablePlacements: placements.map(p => p.position),
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

  // ============ TEST: TEMPLATES FULL SAVE ============
  app.post("/api/test/templates/full-save", async (req: any, res) => {
    try {
      let template: any;
      let colors: any[] = [];
      let placements: string[] = ["front", "back"];
      
      if (req.body.template) {
        template = req.body.template;
        colors = req.body.colors || [];
        placements = req.body.placements || ["front", "back"];
      } else if (req.body.name || req.body.productId) {
        const { name, description, category, productId, blueprintId, printProviderId, 
                artworkUrl, artworkVariant, thumbnailUrl, qrContent, pricing, 
                colors: bodyColors, placements: bodyPlacements, qrSizes } = req.body;
        
        template = {
          name: name || `Template - ${new Date().toLocaleDateString()}`,
          description: description || "",
          category: category || "General",
          productId: productId || "",
          blueprintId: blueprintId || 0,
          printProviderId: printProviderId || 0,
          artworkUrl: artworkUrl || "",
          artworkVariant: artworkVariant || "black",
          thumbnailUrl: thumbnailUrl || artworkUrl || "",
          qrContent: qrContent || "",
          pricing: pricing || null,
          isActive: true,
        };
        colors = bodyColors || [];
        placements = bodyPlacements || ["front"];
      } else {
        return res.status(400).json({ error: "Template data is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      const admin = (await import("../lib/firebase-admin")).getFirebaseAdmin();
      
      const now = admin.firestore.FieldValue.serverTimestamp();
      
      const templateData = {
        ...template,
        createdAt: now,
        updatedAt: now,
      };
      const templateRef = await firestoreDb.collection("productTemplates").add(templateData);
      const templateId = templateRef.id;

      const qrSizes = ["small", "medium", "large"];
      let jobsQueued = 0;

      for (const color of colors) {
        for (const placement of placements) {
          const sizesToGenerate = (placement === "front" || placement === "back") ? qrSizes : ["large"];
          
          for (const qrSize of sizesToGenerate) {
            const jobData = {
              templateId,
              colorName: color.name,
              colorHex: color.hex,
              placement,
              qrSize,
              status: "pending",
              createdAt: now,
            };
            await firestoreDb.collection("mockupJobs").add(jobData);
            jobsQueued++;
          }
        }
      }

      console.log(`[Templates TEST] Full save: template=${templateId}, ${jobsQueued} jobs queued`);

      res.json({
        success: true,
        templateId,
        jobsQueued,
        message: `Template saved with ${jobsQueued} mockup jobs queued (test endpoint)`,
      });
    } catch (error: any) {
      console.error("[Templates TEST] Error in full save:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: PRIORITY MOCKUP ============
  app.post("/api/test/mockup/priority", async (req: any, res) => {
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
        canonicalPlacementId: placement || "FRONT_CHEST",
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
      });
    } catch (error: any) {
      console.error("[Pricing Settings] Error getting settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/pricing-settings", async (req: any, res) => {
    try {
      const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing } = req.body;
      
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

  app.post("/api/pricing-settings/sync", async (req: any, res) => {
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
  app.get("/api/test/pricing-settings", async (req: any, res) => {
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
      });
    } catch (error: any) {
      console.error("[Pricing Settings TEST] Error getting settings:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/test/pricing-settings", async (req: any, res) => {
    try {
      const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing } = req.body;
      
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

  app.post("/api/test/pricing-settings/sync", async (req: any, res) => {
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

  // ============ TEST: PACKETS ============
  app.post("/api/test/packets", async (req: any, res) => {
    try {
      const { 
        qrOnlyUrl, 
        compositeUrl, 
        qrContent,
        headerText,
        footerText,
        pricing,
        productId,
        productName,
        productDescription,
        productImageUrl,
        blueprintId,
        printProviderId,
        manufacturer,
        madeInUSA,
        category,
        defaultColor,
        defaultColorHex,
        defaultPlacement,
        qrProductState,
        placements,
        availablePlacements,
        sizes,
        colors,
        basePrice,
        customerPrice,
        mockupsByColor,
        landingPageTitle,
        landingPageDescription,
        landingPageBackgroundUrl,
        landingPageSlug,
        headerStyle,
        footerStyle,
        roleType,
        storeId,
        storeName,
        channelId,
        channelName,
        fulfillmentProvider,
        playMediaUrl,
        playMediaType,
      } = req.body;

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const { FieldValue } = await import("firebase-admin/firestore");
      const firestoreDb = getFirestoreDb();
      
      const now = FieldValue.serverTimestamp();
      
      const packetData = {
        qrOnlyUrl: qrOnlyUrl || null,
        compositeUrl: compositeUrl || null,
        qrContent: qrContent || null,
        headerText: headerText || null,
        footerText: footerText || null,
        pricing: pricing || null,
        productId: productId || null,
        productName: productName || null,
        productDescription: productDescription || null,
        productImageUrl: productImageUrl || null,
        blueprintId: blueprintId || null,
        printProviderId: printProviderId || null,
        manufacturer: manufacturer || null,
        madeInUSA: madeInUSA || false,
        category: category || null,
        defaultColor: defaultColor || null,
        defaultColorHex: defaultColorHex || null,
        defaultPlacement: defaultPlacement || null,
        qrProductState: qrProductState || null,
        placements: placements || [],
        availablePlacements: availablePlacements || [],
        sizes: sizes || [],
        colors: colors || [],
        basePrice: basePrice || null,
        customerPrice: customerPrice || null,
        mockupsByColor: mockupsByColor || null,
        landingPageTitle: landingPageTitle || null,
        landingPageDescription: landingPageDescription || null,
        landingPageBackgroundUrl: landingPageBackgroundUrl || null,
        landingPageSlug: landingPageSlug || null,
        headerStyle: headerStyle || null,
        footerStyle: footerStyle || null,
        roleType: roleType || null,
        storeId: storeId || null,
        storeName: storeName || null,
        channelId: channelId || null,
        channelName: channelName || null,
        fulfillmentProvider: fulfillmentProvider || 'printify',
        playMediaUrl: playMediaUrl || null,
        playMediaType: playMediaType || null,
        createdAt: now,
        updatedAt: now,
      };
      
      const packetRef = await firestoreDb.collection("productPackets").add(packetData);
      const packetId = packetRef.id;
      
      console.log(`[Packets TEST] Created packet: ${packetId}`);

      let mockupJobsQueued = 0;
      if (blueprintId && printProviderId && colors && Array.isArray(colors) && colors.length > 0) {
        try {
          const { mockupJobQueue } = await import('../lib/mockup-job-queue.js');
          
          const artworkUrl = compositeUrl || qrOnlyUrl;
          if (artworkUrl) {
            const targetPlacements = (placements && placements.length > 0) ? placements : ["front"];
            const qrSizes: Array<"small" | "medium" | "large"> = ["small", "medium", "large"];
            
            const productIdForMockups = `packet_${packetId}`;
            
            console.log(`[Packets TEST] Queueing mockups for ${colors.length} colors × ${targetPlacements.length} placements × ${qrSizes.length} sizes`);
            
            const jobs = await mockupJobQueue.createBatchJobs({
              productId: productIdForMockups,
              colors: colors.map((c: any) => ({ name: c.name || c, hex: c.hex || '#000000' })),
              qrSizes,
              placements: targetPlacements,
              blueprintId: parseInt(blueprintId),
              printProviderId: parseInt(printProviderId),
              artworkUrl,
              artworkVariant: "black",
            });
            
            mockupJobsQueued = jobs.length;
            console.log(`[Packets TEST] Queued ${mockupJobsQueued} mockup jobs for packet ${packetId}`);
          } else {
            console.log(`[Packets TEST] No artwork URL available yet, skipping mockup queue`);
          }
        } catch (err: any) {
          console.error(`[Packets TEST] Failed to queue mockup jobs:`, err.message);
        }
      }

      res.json({
        success: true,
        packetId,
        mockupJobsQueued,
        message: `Product packet created${mockupJobsQueued > 0 ? ` with ${mockupJobsQueued} mockup jobs queued` : ''}`,
      });
    } catch (error: any) {
      console.error("[Packets TEST] Error creating packet:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test/packets", async (req: any, res) => {
    try {
      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("productPackets")
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      
      const packets = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        };
      });
      
      console.log(`[Packets TEST] Retrieved ${packets.length} packets`);
      
      res.json({
        success: true,
        packets,
        count: packets.length,
      });
    } catch (error: any) {
      console.error("[Packets TEST] Error getting packets:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/test/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const doc = await firestoreDb.collection("productPackets").doc(packetId).get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const data = doc.data();
      
      let linkedTemplateId = null;
      const templatesSnapshot = await firestoreDb.collection("productTemplates")
        .where("packetId", "==", packetId)
        .limit(1)
        .get();
      
      if (!templatesSnapshot.empty) {
        linkedTemplateId = templatesSnapshot.docs[0].id;
      }
      
      res.json({
        success: true,
        packet: {
          id: doc.id,
          ...data,
          templateId: linkedTemplateId,
          createdAt: data?.createdAt?.toDate?.() || null,
          updatedAt: data?.updatedAt?.toDate?.() || null,
        },
      });
    } catch (error: any) {
      console.error("[Packets TEST] Error getting packet:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.patch("/api/test/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;
      const updates = req.body;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb, FieldValue } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection("productPackets").doc(packetId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      await docRef.update({
        ...updates,
        updatedAt: FieldValue.serverTimestamp(),
      });
      
      console.log(`[Packets PATCH] Updated packet ${packetId}:`, Object.keys(updates));
      
      res.json({
        success: true,
        packetId,
        message: "Packet updated",
      });
    } catch (error: any) {
      console.error("[Packets PATCH] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/test/packets/:packetId", async (req: any, res) => {
    try {
      const { packetId } = req.params;

      if (!packetId) {
        return res.status(400).json({ error: "packetId is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const docRef = firestoreDb.collection("productPackets").doc(packetId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return res.status(404).json({ error: "Packet not found" });
      }
      
      const cascadeResults = {
        graphics: 0,
        templates: 0,
        storeProductLinks: 0,
      };
      
      const graphicsSnap = await firestoreDb.collection("productGraphics")
        .where("packetId", "==", packetId)
        .get();
      for (const graphicDoc of graphicsSnap.docs) {
        await graphicDoc.ref.delete();
        cascadeResults.graphics++;
      }
      
      const templatesSnap = await firestoreDb.collection("productTemplates")
        .where("packetId", "==", packetId)
        .get();
      for (const templateDoc of templatesSnap.docs) {
        await templateDoc.ref.delete();
        cascadeResults.templates++;
      }
      
      const linksSnap = await firestoreDb.collection("storeProductLinks")
        .where("packetId", "==", packetId)
        .get();
      for (const linkDoc of linksSnap.docs) {
        await linkDoc.ref.delete();
        cascadeResults.storeProductLinks++;
      }
      
      await docRef.delete();
      
      console.log(`[Packets DELETE] Deleted packet ${packetId} with cascade:`, cascadeResults);
      
      res.json({
        success: true,
        packetId,
        message: "Packet deleted with cascade cleanup",
        cascade: cascadeResults,
      });
    } catch (error: any) {
      console.error("[Packets DELETE] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: LANDING PAGE ============
  app.get("/api/test/landing/:slug", async (req: any, res) => {
    try {
      const { slug } = req.params;
      
      if (!slug) {
        return res.status(400).json({ error: "slug is required" });
      }

      const { getFirestoreDb } = await import("../lib/firebase-admin");
      const firestoreDb = getFirestoreDb();
      
      const snapshot = await firestoreDb.collection("productPackets")
        .where("landingPageSlug", "==", slug)
        .limit(1)
        .get();
      
      if (snapshot.empty) {
        return res.status(404).json({ error: "Landing page not found" });
      }
      
      const doc = snapshot.docs[0];
      const data = doc.data();
      
      const landingPage = {
        packetId: doc.id,
        title: data.landingPageTitle || data.productName || "QR Product",
        description: data.landingPageDescription || data.productDescription || "",
        backgroundUrl: data.landingPageBackgroundUrl || data.compositeUrl || null,
        compositeUrl: data.compositeUrl || null,
        qrOnlyUrl: data.qrOnlyUrl || null,
        qrContent: data.qrContent || null,
        productName: data.productName || null,
        productImageUrl: data.productImageUrl || null,
        headerStyle: data.headerStyle || null,
        footerStyle: data.footerStyle || null,
        pricing: data.pricing || null,
        createdAt: data.createdAt?.toDate?.() || null,
        landingPageSnapshotUrl: data.landingPageSnapshotUrl || data.compositeUrl || null,
        qrProductState: data.qrProductState || data.mode || "qr_canvas",
        playMediaUrl: data.playMediaUrl || data.videoUrl || null,
        playMediaType: data.playMediaType || data.mediaType || null,
        landingPageTitle: data.landingPageTitle || data.productName || null,
        landingPageDescription: data.landingPageDescription || null,
        landingPageBackgroundUrl: data.landingPageBackgroundUrl || null,
      };
      
      console.log(`[Landing Page] Found page for slug: ${slug}`);
      
      res.json({
        success: true,
        landingPage,
      });
    } catch (error: any) {
      console.error("[Landing Page] Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============ TEST: CONTENT UPLOAD ============
  app.post("/api/test/content/upload", async (req: any, res) => {
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
