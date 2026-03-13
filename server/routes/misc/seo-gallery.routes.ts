import type { Express } from "express";
import { storage } from "../../storage";
import { escapeHtml } from "../route-helpers";
import { generateSitemap } from "../../lib/sitemap";

export function registerSeoGalleryRoutes(app: Express): void {

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

  app.get('/p/:packetId', async (req, res, next) => {
    try {
      const { packetId } = req.params;
      
      const userAgent = req.headers['user-agent'] || '';
      const isCrawler = /facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|Slackbot|TelegramBot|WhatsApp/i.test(userAgent);
      
      if (!isCrawler) {
        return next();
      }
      
      const { getFirestoreDb } = await import("../../lib/firebase-admin");
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
}
