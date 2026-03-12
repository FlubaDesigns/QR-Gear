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
  // ============ BATCH: PACKETS & LANDING PAGES ============

app.post('/packets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const now = admin.firestore.FieldValue.serverTimestamp();
    const packetData = stripUndef({ ...req.body, createdAt: now, updatedAt: now });
    delete packetData.mockupJobsQueued;
    if (packetData.headerStyle) packetData.headerStyle = sanitizeStyleForFirestore(packetData.headerStyle);
    if (packetData.footerStyle) packetData.footerStyle = sanitizeStyleForFirestore(packetData.footerStyle);
    if (packetData.titleStyle) packetData.titleStyle = sanitizeStyleForFirestore(packetData.titleStyle);
    if (packetData.descriptionStyle) packetData.descriptionStyle = sanitizeStyleForFirestore(packetData.descriptionStyle);
    const ref = await db.collection('productPackets').add(packetData);
    res.json({ success: true, packetId: ref.id, mockupJobsQueued: 0, message: 'Product packet created' });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('productPackets').orderBy('createdAt', 'desc').limit(100).get();
    const packets = snap.docs.map(d => { const data = d.data(); return { id: d.id, ...data, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null }; });
    res.json({ success: true, packets, count: packets.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('productPackets').doc(req.params.packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const data = doc.data() as any;
    let linkedTemplateId = null;
    const tSnap = await db.collection('productTemplates').where('packetId', '==', req.params.packetId).limit(1).get();
    if (!tSnap.empty) linkedTemplateId = tSnap.docs[0].id;
    res.json({ success: true, packet: { id: doc.id, ...data, templateId: linkedTemplateId, createdAt: data.createdAt?.toDate?.() || null, updatedAt: data.updatedAt?.toDate?.() || null } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/public/landing/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('productPackets').where('landingPageSlug', '==', req.params.slug).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Landing page not found" }); return; }
    const doc = snap.docs[0];
    const d = doc.data() as any;
    res.json({ success: true, landingPage: { packetId: doc.id, title: d.landingPageTitle || d.productName || 'QR Product', description: d.landingPageDescription || d.productDescription || '', backgroundUrl: d.landingPageBackgroundUrl || d.compositeUrl || null, compositeUrl: d.compositeUrl || null, qrOnlyUrl: d.qrOnlyUrl || null, qrContent: d.qrContent || null, productName: d.productName || null, productImageUrl: d.productImageUrl || null, headerStyle: d.headerStyle || null, footerStyle: d.footerStyle || null, pricing: d.pricing || null, createdAt: d.createdAt?.toDate?.() || null, landingPageSnapshotUrl: d.landingPageSnapshotUrl || d.compositeUrl || null, qrProductState: d.qrProductState || d.mode || 'qr_canvas', playMediaUrl: d.playMediaUrl || d.videoUrl || null, playMediaType: d.playMediaType || d.mediaType || null, landingPageTitle: d.landingPageTitle || d.productName || null, landingPageDescription: d.landingPageDescription || null, landingPageBackgroundUrl: d.landingPageBackgroundUrl || null } });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


  }
  