import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
import { printfulClient } from '../services/printful';
  import { printifyClient, getPrintifyApiKey, getPrintifyShopId, submitOrderToPrintify, checkPrintifyOrderStatus, PRINTIFY_API_BASE } from '../services/printify';
  import { generateSignedUrl, addSignedUrlsToAssets, downloadAndStoreImage } from '../services/storage-helpers';
  import { calculateAuthoritativePrice, getAuthoritativePrice } from '../services/pricing';
  import { generateMockupFromPrintful, processMockupResult, getPrintfulProductId, toPublicUrl, DEFAULT_BLUEPRINT_MAPPINGS } from '../services/mockup-generator';
  import type { MockupRequest, MockupResult } from '../services/mockup-generator';
  import { getPrintfulApiKey, getPrintfulApiKeyAsync, getPrintfulStoreId, PRINTFUL_API_BASE } from '../services/printful';
  import type { PrintfulMockupTask, PrintfulVariant } from '../services/printful';
  import { getResendClient, QR_GEAR_FROM_EMAIL } from '../services/email';
  import { cfGenerateCompositeImage, cfGeneratePrintifyComposite, cfUploadBufferToStorage, cfGetPreviewFontSize, cfWrapText, CF_PLACEMENT_DIMENSIONS, CF_FONT_MAP, CF_PREVIEW_CONTAINER_WIDTH, CF_PREVIEW_WIDTH, CF_PREVIEW_QR_SIZE, getCanvas, getQRCode } from '../services/composite-image';

  export function register(app: express.Express): void {
  // ============ SEO & SOCIAL SHARE ROUTES ============

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

app.get('/sitemap.xml', async (req: Request, res: Response): Promise<void> => {
  try {
    const productsSnap = await db.collection('products').where('isPublished', '==', true).get();
    const baseUrl = 'https://qrgear-c1ffd.web.app';
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
    xml += `  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n`;
    xml += `  <url><loc>${baseUrl}/store</loc><changefreq>daily</changefreq><priority>0.9</priority></url>\n`;
    productsSnap.docs.forEach(doc => {
      const data = doc.data();
      xml += `  <url><loc>${baseUrl}/product/${doc.id}</loc><lastmod>${data.updatedAt || new Date().toISOString()}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    });
    xml += '</urlset>';
    res.set('Content-Type', 'application/xml');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (e: any) { res.status(500).send('Error generating sitemap'); }
});

app.get('/p/:packetId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { packetId } = req.params;
    const userAgent = req.headers['user-agent'] || '';
    const isCrawler = /facebookexternalhit|Twitterbot|LinkedInBot|Discordbot|Slackbot|TelegramBot|WhatsApp/i.test(userAgent);
    if (!isCrawler) { next(); return; }
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    let title = 'QR Gear - Dynamic QR Experience';
    let description = 'Scan to discover personalized content';
    let ogImage = 'https://qrgear-c1ffd.web.app/og-default.png';
    const canonicalUrl = `https://qrgear-c1ffd.web.app/p/${packetId}`;
    if (packetDoc.exists) {
      const packet = packetDoc.data();
      if (packet) {
        if (packet.textLayers?.length > 0) {
          const titleLayer = packet.textLayers.find((l: any) => l.id === 'title' || l.id === 'header');
          if (titleLayer?.text) title = titleLayer.text;
        }
        if (packet.textLayers?.length > 0) {
          const descLayer = packet.textLayers.find((l: any) => l.id === 'description' || l.id === 'footer');
          if (descLayer?.text) description = descLayer.text;
        }
        ogImage = packet.shareCardUrl || packet.compositeUrl || packet.videoSource?.posterUrl || packet.previewUrl || ogImage;
      }
    }
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>${escapeHtml(title)}</title><meta property="og:type" content="website"/><meta property="og:title" content="${escapeHtml(title)}"/><meta property="og:description" content="${escapeHtml(description)}"/><meta property="og:image" content="${ogImage}"/><meta property="og:url" content="${canonicalUrl}"/><meta property="og:site_name" content="QR Gear"/><meta name="twitter:card" content="summary_large_image"/><meta name="twitter:title" content="${escapeHtml(title)}"/><meta name="twitter:description" content="${escapeHtml(description)}"/><meta name="twitter:image" content="${ogImage}"/><meta http-equiv="refresh" content="0;url=/app/p/${packetId}"/><style>body{font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#0f172a;color:#fff}.loading{text-align:center}.spinner{width:40px;height:40px;border:3px solid #334155;border-top-color:#3b82f6;border-radius:50%;animation:spin 1s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="loading"><div class="spinner"></div><p>Loading your QR experience...</p></div></body></html>`;
    res.set('Content-Type', 'text/html');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(html);
  } catch (e: any) { next(); }
});

app.post('/auth/email-logout', async (req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Logged out successfully' });
});

app.post('/auth/login', async (req: Request, res: Response): Promise<void> => {
  res.status(501).json({ error: 'Email/password login uses Firebase Auth on the client side. This endpoint is not used in production.' });
});


  }
  