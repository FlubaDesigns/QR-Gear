import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { PLATFORM_STORE_ID, CHANNEL_ITEMS_COLLECTION } from '../constants';
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

export function registerMembersLibraryRoutes(app: express.Express): void {
app.get('/members/:memberId/graphics', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const snapshot = await db.collection("hostedImages").where("userId", "==", memberId).get();
    const images = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const graphicSets = [{ id: 'my-uploads', name: 'My Uploads', thumbnailUrl: (images[0] as any)?.storageUrl || '', imageCount: images.length, images: images.map((img: any) => ({ id: img.id, url: img.storageUrl, name: img.fileName, createdAt: img.createdAt })) }];
    res.json(graphicSets);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const { kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    if (!background?.url) { res.status(400).json({ error: "background.url is required" }); return; }
    const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packetData = { packetId, memberId, kind: kind || 'qr_compose', urlContent: urlContent || null, background: { url: background.url, crop: background.crop || null, assetId: background.assetId || null }, textLayers: textLayers || [], boundProduct: boundProduct || null, metadata: metadata || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.collection('memberPackets').doc(packetId).set(packetData);
    res.json({ packetId, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/members/:memberId/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, packetId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const updates = req.body;
    if (!memberId || !packetId) { res.status(400).json({ error: "memberId and packetId are required" }); return; }
    const doc = await db.collection('memberPackets').doc(packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    if (doc.data()?.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    const memberClean = stripUndef(updates);
    if (memberClean.headerStyle) memberClean.headerStyle = sanitizeStyleForFirestore(memberClean.headerStyle);
    if (memberClean.footerStyle) memberClean.footerStyle = sanitizeStyleForFirestore(memberClean.footerStyle);
    await db.collection('memberPackets').doc(packetId).update({ ...memberClean, updatedAt: new Date().toISOString() });
    res.json({ success: true, packetId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/claim-temp-packet', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const { tempPacketId } = req.body;
    if (!tempPacketId) { res.status(400).json({ error: "tempPacketId is required" }); return; }
    const docRef = db.collection('temp_packets').doc(tempPacketId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Temp packet not found or expired" }); return; }
    const packet = doc.data()!;
    if (packet.status === 'completed') { res.status(410).json({ error: "Temp packet already used" }); return; }
    await docRef.update({ claimedByMemberId: memberId, claimedAt: new Date().toISOString(), status: 'claimed', updatedAt: new Date().toISOString() });
    res.json({ success: true, packetConfig: { blueprintId: packet.blueprintId || null, productTitle: packet.productTitle || null, selectedColor: packet.selectedColor || null, selectedShirtSize: packet.selectedShirtSize || null, qrType: packet.qrType || null, selectedPlacements: packet.selectedPlacements || [], graphicSize: packet.graphicSize || null, headerStyle: packet.headerStyle || null, footerStyle: packet.footerStyle || null, textLayoutChoice: packet.textLayoutChoice || null, qrBasicContent: packet.qrBasicContent || null, mockupUrl: packet.mockupUrl || null, lifestyleMockupUrl: packet.lifestyleMockupUrl || null } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/packets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, kind, urlContent, background, textLayers, boundProduct, metadata, source, status } = req.body;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    if (!background?.url) { res.status(400).json({ error: "background.url is required" }); return; }
    const packetId = `pkt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packetData = { packetId, memberId, kind: kind || 'qr_compose', urlContent: urlContent || null, background: { url: background.url, crop: background.crop || null, assetId: background.assetId || null }, textLayers: textLayers || [], boundProduct: boundProduct || null, metadata: metadata || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.collection('memberPackets').doc(packetId).set(packetData);
    res.json({ packetId, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/member/packets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.query.memberId as string;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const snapshot = await db.collection('memberPackets').where('memberId', '==', memberId as string).limit(100).get();
    const packets = snapshot.docs.map(doc => doc.data());
    res.json({ packets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/member/packets/:packetId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const { memberId } = req.body;
    if (!packetId || !memberId) { res.status(400).json({ error: "packetId and memberId are required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const doc = await db.collection('memberPackets').doc(packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    if (doc.data()?.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    await db.collection('memberPackets').doc(packetId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/graphics/create', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, packetId } = req.body;
    if (!memberId || !packetId) { res.status(400).json({ error: "memberId and packetId are required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const packet = packetDoc.data();
    if (!packet || packet.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    const graphicsId = `gfx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const compositeUrl = packet.background?.url || null;
    const graphicsData = { graphicsId, packetId, memberId, compositeUrl, qrOnlyUrl: null, status: 'generated', createdAt: new Date().toISOString() };
    await db.collection('memberGraphics').doc(graphicsId).set(graphicsData);
    await db.collection('memberPackets').doc(packetId).update({ status: 'graphics_ready', graphicsId, updatedAt: new Date().toISOString() });
    res.json({ graphicsId, compositeUrl, qrOnlyUrl: null });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/templates/save', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, packetId, compositeUrl, titleText, descriptionText, kind, metadata } = req.body;
    if (!memberId || !packetId) { res.status(400).json({ error: "memberId and packetId are required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const templateId = `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    const packetData = packetDoc.data() || {};
    const templateData = { templateId, packetId, memberId, kind: kind || packetData.kind || 'qr_compose', compositeUrl: compositeUrl || null, titleText: titleText || '', descriptionText: descriptionText || '', background: packetData.background || null, textLayers: packetData.textLayers || [], metadata: metadata || null, createdAt: new Date().toISOString() };
    await db.collection('memberTemplates').doc(templateId).set(templateData);
    await db.collection('memberPackets').doc(packetId).update({ templateId, updatedAt: new Date().toISOString() });
    res.json({ templateId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/library-links', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, packetId, channelId, templateId, compositeUrl, qrOnlyUrl, boundProduct, metadata, status } = req.body;
    if (!memberId || !packetId) { res.status(400).json({ error: "memberId and packetId are required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const libraryLinkId = `lib-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const linkData = { libraryLinkId, packetId, channelId: channelId || null, storeId: memberId, templateId: templateId || null, memberId, compositeUrl: compositeUrl || null, qrOnlyUrl: qrOnlyUrl || null, boundProduct: boundProduct || null, metadata: metadata || null, status: status || 'active', shareUrl: `/share/${packetId}`, createdAt: new Date().toISOString() };
    await db.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
    await db.collection('memberPackets').doc(packetId).update({ status: 'published', libraryLinkId, updatedAt: new Date().toISOString() });
    res.json({ libraryLinkId, shareUrl: `/share/${packetId}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/member/library-links', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const memberId = req.query.memberId as string;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const snapshot = await db.collection('memberLibraryLinks').where('memberId', '==', memberId as string).limit(100).get();
    const items = snapshot.docs.map(doc => doc.data());
    res.json({ items });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ PRICING ROUTES (Batch 2) ============

app.post('/pricing-settings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, centerGraphicUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing, preferredLabelPosition } = req.body;
    const defaultSU: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBLP = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    const settings = { markupPercent: parseFloat(markupPercent) || 25, markupFixed: parseFloat(markupFixed) || 0, additionalPlacementCost: parseFloat(additionalPlacementCost) || 4, textLineUpcharge: parseFloat(textLineUpcharge) || 2, centerGraphicUpcharge: parseFloat(centerGraphicUpcharge) || 5, memberProfitShare: parseFloat(memberProfitShare) || 0.25, sizeUpcharges: sizeUpcharges || defaultSU, hostingTiers: hostingTiers || [{ code: "1_year", name: "1 Year", price: 5 }, { code: "2_year", name: "2 Years", price: 8 }, { code: "3_year", name: "3 Years", price: 10 }], brandLabelPricing: brandLabelPricing || defaultBLP, preferredLabelPosition: preferredLabelPosition || 'outside', updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    await db.collection("testSettings").doc("pricing").set(settings, { merge: true });
    res.json({ success: true, settings, message: "Pricing settings saved" });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


// ============ MEMBER PLAY PACKETS ============

app.post('/member/play-packets', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, videoUrl, title, description, background, thumbnailUrl, metadata, storeId, channelId, source, status } = req.body;
    if (!memberId) { res.status(400).json({ error: "memberId is required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const packetId = `pkt-play-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const packetData = { packetId, memberId, packetType: 'qr-play', videoUrl: videoUrl || null, title: title || 'Untitled', description: description || '', background: background || null, thumbnailUrl: thumbnailUrl || null, metadata: metadata || null, storeId: storeId || memberId, channelId: channelId || null, source: source || { entryPoint: 'wizard' }, status: status || 'draft', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    await db.collection('memberPackets').doc(packetId).set(packetData);
    res.json({ packetId, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


// ============ BATCH: MEMBER MOCKUP & GRAPHIC ROUTES ============

app.post('/members/mockup/priority', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
    if (!blueprintId || !colorName || !artworkUrl) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" }); return;
    }
    console.log(`[CF Member Mockup] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
      colorName, colorHex, artworkUrl, artworkVariant: 'black',
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      placement: placement || 'front',
      qrSize: qrSize as 'small' | 'medium' | 'large',
      hasCompositeGraphic: true,
    });
    console.log(`[CF Member Mockup] Generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
    res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, fromCache: result.fromCache, generatedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error("[CF Member Mockup] Error:", error);
    console.error("[CF Member Mockup] Mockup generation failed:", error.message);
    res.json({ success: false, error: error.message, mockupUrl: null, lifestyleMockupUrl: null, message: "Mockup generation failed - please try again" });
  }
});

app.post('/members/generate-product-graphic', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black' } = req.body;
    if (!qrUrl) { res.status(400).json({ error: "Missing required field: qrUrl" }); return; }
    console.log(`[CF ProductGraphic] Generating composite with layout: ${textLayoutChoice}`);
    const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
    const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
    const topText = showHeader && (headerStyle?.text || (headerStyle?.mode === 'image' && headerStyle?.imageUrl)) ? {
      text: headerStyle.text || '', fontFamily: headerStyle.fontFamily || 'Arial',
      fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
      letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
      strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
      mode: headerStyle.mode, imageUrl: headerStyle.imageUrl,
      verticalOffset: headerStyle.verticalOffset, horizontalOffset: headerStyle.horizontalOffset, imageScale: headerStyle.imageScale,
    } : null;
    const bottomText = showFooter && (footerStyle?.text || (footerStyle?.mode === 'image' && footerStyle?.imageUrl)) ? {
      text: footerStyle.text || '', fontFamily: footerStyle.fontFamily || 'Arial',
      fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
      letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
      strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
      mode: footerStyle.mode, imageUrl: footerStyle.imageUrl,
      verticalOffset: footerStyle.verticalOffset, horizontalOffset: footerStyle.horizontalOffset, imageScale: footerStyle.imageScale,
    } : null;
    const productGraphicDataUrl = await cfGeneratePrintifyComposite(qrUrl, topText, bottomText, 1200, 1800, qrColor as 'black' | 'white');
    const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL format from composite generator");
    const buffer = Buffer.from(match[2], 'base64');
    const uploadResult = await cfUploadBufferToStorage(buffer, match[1], 'member-graphics');
    console.log(`[CF ProductGraphic] Uploaded: ${uploadResult.publicUrl}`);
    res.json({ success: true, productGraphic: uploadResult.publicUrl });
  } catch (error: any) {
    console.error("[CF ProductGraphic] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/public/generate-product-graphic', async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black' } = req.body;
    if (!qrUrl) { res.status(400).json({ error: "Missing required field: qrUrl" }); return; }
    console.log(`[CF PublicProductGraphic] Generating composite with layout: ${textLayoutChoice}`);
    const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
    const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
    const topText = showHeader && (headerStyle?.text || (headerStyle?.mode === 'image' && headerStyle?.imageUrl)) ? {
      text: headerStyle.text || '', fontFamily: headerStyle.fontFamily || 'Arial',
      fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
      letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
      strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
      mode: headerStyle.mode, imageUrl: headerStyle.imageUrl,
      verticalOffset: headerStyle.verticalOffset, horizontalOffset: headerStyle.horizontalOffset, imageScale: headerStyle.imageScale,
    } : null;
    const bottomText = showFooter && (footerStyle?.text || (footerStyle?.mode === 'image' && footerStyle?.imageUrl)) ? {
      text: footerStyle.text || '', fontFamily: footerStyle.fontFamily || 'Arial',
      fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
      letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
      strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
      mode: footerStyle.mode, imageUrl: footerStyle.imageUrl,
      verticalOffset: footerStyle.verticalOffset, horizontalOffset: footerStyle.horizontalOffset, imageScale: footerStyle.imageScale,
    } : null;
    const productGraphicDataUrl = await cfGeneratePrintifyComposite(qrUrl, topText, bottomText, 1200, 1800, qrColor as 'black' | 'white');
    const match = productGraphicDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error("Invalid data URL format from composite generator");
    const buffer = Buffer.from(match[2], 'base64');
    const uploadResult = await cfUploadBufferToStorage(buffer, match[1], 'public-graphics');
    console.log(`[CF PublicProductGraphic] Uploaded: ${uploadResult.publicUrl}`);
    res.json({ success: true, productGraphic: uploadResult.publicUrl });
  } catch (error: any) {
    console.error("[CF PublicProductGraphic] Error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/public/generate-mockup', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      tempPacketId, blueprintId, printProviderId, colorName, colorHex,
      placement = 'front', qrSize = 'medium', fulfillmentProvider = 'printify',
      qrUrl, headerStyle, footerStyle, textLayoutChoice, qrColor = 'black',
    } = req.body;
    if (!blueprintId || !colorName) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName" }); return;
    }
    console.log(`[CF PublicMockup] Starting for packet: ${tempPacketId || 'none'}, color: ${colorName}`);
    let artworkUrl: string;
    const cfHasHeaderContent = headerStyle?.text || (headerStyle?.mode === 'image' && headerStyle?.imageUrl);
    const cfHasFooterContent = footerStyle?.text || (footerStyle?.mode === 'image' && footerStyle?.imageUrl);
    if (textLayoutChoice && textLayoutChoice !== '' && (cfHasHeaderContent || cfHasFooterContent)) {
      console.log(`[CF PublicMockup] Generating composite artwork with text layout: ${textLayoutChoice}`);
      const showHeader = textLayoutChoice === 'header' || textLayoutChoice === 'both';
      const showFooter = textLayoutChoice === 'footer' || textLayoutChoice === 'both';
      const topText = showHeader && cfHasHeaderContent ? {
        text: headerStyle.text || '', fontFamily: headerStyle.fontFamily || 'Arial',
        fontSize: headerStyle.fontSize || '48', color: headerStyle.color || '#000000',
        letterSpacing: headerStyle.letterSpacing || 0, warpPreset: headerStyle.warpPreset || 'straight',
        strokeColor: headerStyle.strokeColor, strokeWidth: headerStyle.strokeWidth,
        mode: headerStyle.mode, imageUrl: headerStyle.imageUrl,
        verticalOffset: headerStyle.verticalOffset, horizontalOffset: headerStyle.horizontalOffset, imageScale: headerStyle.imageScale,
      } : null;
      const bottomText = showFooter && cfHasFooterContent ? {
        text: footerStyle.text || '', fontFamily: footerStyle.fontFamily || 'Arial',
        fontSize: footerStyle.fontSize || '48', color: footerStyle.color || '#000000',
        letterSpacing: footerStyle.letterSpacing || 0, warpPreset: footerStyle.warpPreset || 'straight',
        strokeColor: footerStyle.strokeColor, strokeWidth: footerStyle.strokeWidth,
        mode: footerStyle.mode, imageUrl: footerStyle.imageUrl,
        verticalOffset: footerStyle.verticalOffset, horizontalOffset: footerStyle.horizontalOffset, imageScale: footerStyle.imageScale,
      } : null;
      const compositeDataUrl = await cfGeneratePrintifyComposite(
        qrUrl || 'https://example.com', topText, bottomText, 1200, 1800, qrColor as 'black' | 'white'
      );
      const match = compositeDataUrl.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) throw new Error("Invalid data URL format from composite generator");
      const buffer = Buffer.from(match[2], 'base64');
      const uploadResult = await cfUploadBufferToStorage(buffer, match[1], 'public-graphics');
      artworkUrl = uploadResult.publicUrl;
      console.log(`[CF PublicMockup] Composite uploaded: ${artworkUrl}`);
    } else {
      const qrContent = qrUrl || 'https://example.com';
      artworkUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(qrContent)}&format=png&qzone=2&ecc=H&color=000000&bgcolor=ffffff`;
      console.log(`[CF PublicMockup] Using raw QR artwork: ${artworkUrl}`);
    }
    const hasComposite = !!(textLayoutChoice && textLayoutChoice !== '' && (cfHasHeaderContent || cfHasFooterContent));
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId), printProviderId: parseInt(printProviderId) || 99,
      colorName, colorHex: colorHex || '#000000', artworkUrl,
      artworkVariant: qrColor === 'white' ? 'white' : 'black',
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      placement,
      qrSize: qrSize as 'small' | 'medium' | 'large',
      hasCompositeGraphic: hasComposite,
    });
    console.log(`[CF PublicMockup] Mockup generated: ${result.mockupUrl} (cached: ${result.fromCache})`);
    if (tempPacketId) {
      try {
        await db.collection('temp_packets').doc(tempPacketId).update({
          mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl,
          artworkUrl, updatedAt: new Date().toISOString(),
        });
        console.log(`[CF PublicMockup] Packet ${tempPacketId} updated with mockup`);
      } catch (pktErr: any) {
        console.warn(`[CF PublicMockup] Failed to update packet: ${pktErr.message}`);
      }
    }
    res.json({ success: true, mockupUrl: result.mockupUrl, lifestyleMockupUrl: result.lifestyleMockupUrl, artworkUrl, fromCache: result.fromCache });
  } catch (error: any) {
    console.error("[CF PublicMockup] Error:", error);
    const bid = parseInt(req.body.blueprintId);
    let fallbackUrl: string | null = null;
    try {
      const bpDoc = await db.collection('printifyBlueprints').doc(String(bid)).get();
      if (bpDoc.exists) {
        const bpData = bpDoc.data()!;
        fallbackUrl = bpData.images?.[0] || bpData.image || null;
      }
      if (!fallbackUrl) {
        const memberProds = await db.collection('storeAllowedProducts').doc('member-products').get();
        if (memberProds.exists) {
          const prods = memberProds.data()?.products || [];
          const match = prods.find((p: any) => p.blueprintId === bid);
          if (match?.image) fallbackUrl = match.image;
        }
      }
      if (fallbackUrl) {
        console.log(`[CF PublicMockup] Using catalog fallback image for blueprint ${bid}`);
      }
    } catch (fbErr: any) {
      console.error("[CF PublicMockup] Fallback lookup failed:", fbErr.message);
    }
    if (fallbackUrl) {
      res.json({ success: true, mockupUrl: fallbackUrl, lifestyleMockupUrl: null, fromCache: false, fallback: true });
    } else {
      res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
    }
  }
});

// ============ BATCH: MEMBER ALLOWED PRODUCTS ============

app.post('/members/allowed-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products)) { res.status(400).json({ error: "products must be an array" }); return; }
    await db.collection("storeAllowedProducts").doc("member-products").set({ products, updatedAt: new Date().toISOString() });
    console.log(`[CF Member Product Library] Saved ${products.length} products to storeAllowedProducts/member-products`);
    res.json({ success: true, count: products.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


// ============ BATCH: MEMBER LIBRARY SYSTEM ============

app.get('/members/common-library', async (req: Request, res: Response): Promise<void> => {
  try {
    const assetType = (req.query.assetType as string) || 'background';
    let commonQuery: any = db.collection('commonLibrary').where('isActive', '==', true);
    if (assetType) commonQuery = commonQuery.where('assetType', '==', assetType);
    let adminQuery: any = db.collection('libraryAssets').where('ownerType', '==', 'admin');
    const [commonSnapshot, adminSnapshot] = await Promise.all([
      commonQuery.orderBy('createdAt', 'desc').get(),
      adminQuery.get(),
    ]);
    const mapAsset = (doc: any) => { const d = doc.data(); return { id: doc.id, name: d.name, assetType: d.assetType, mediaType: d.mediaType || 'image', thumbnailUrl: d.thumbnailUrl || d.publicUrl || d.storageUrl, publicUrl: d.publicUrl || d.storageUrl, width: d.width, height: d.height, category: d.category }; };
    const commonAssets = commonSnapshot.docs.map(mapAsset);
    const adminAssets = adminSnapshot.docs.map(mapAsset).filter((a: any) => a.assetType === assetType);
    const seenIds = new Set<string>();
    const assets = [...commonAssets, ...adminAssets].filter((a: any) => { if (seenIds.has(a.id)) return false; seenIds.add(a.id); return true; }).sort((a: any, b: any) => (b.createdAt || '') > (a.createdAt || '') ? 1 : -1);
    console.log(`[CF Common Library] Found ${assets.length} ${assetType} assets (${commonAssets.length} common + ${adminAssets.length} admin)`);
    res.json({ assets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/members/:memberId/library', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const assetType = req.query.assetType as string;
    let query: any = db.collection('memberLibrary').where('memberId', '==', memberId).where('isActive', '==', true);
    if (assetType) query = query.where('assetType', '==', assetType);
    const snapshot = await query.orderBy('createdAt', 'desc').get();
    const assets = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      return { id: doc.id, name: data.name, assetType: data.assetType, mediaType: data.mediaType || 'image', thumbnailUrl: data.thumbnailUrl || data.publicUrl, publicUrl: data.publicUrl, width: data.width, height: data.height, sourceAssetId: data.sourceAssetId, isCropped: data.isCropped || false, originalAssetId: data.originalAssetId };
    });
    console.log(`[CF Member Library] Found ${assets.length} assets for member ${memberId}`);
    res.json({ assets });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/library', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const { publicUrl, storageUrl, assetType, mediaType, name, fileName } = req.body;
    if (!publicUrl) { res.status(400).json({ error: 'publicUrl is required' }); return; }
    const now = new Date().toISOString();
    const ref = await db.collection('memberLibrary').add({
      memberId,
      publicUrl,
      storageUrl: storageUrl || publicUrl,
      assetType: assetType || 'graphic',
      mediaType: mediaType || 'image',
      name: name || 'Untitled',
      fileName: fileName || 'untitled.png',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    console.log(`[CF Member Library] Saved asset ${ref.id} for member ${memberId}`);
    res.json({ id: ref.id, publicUrl, assetType: assetType || 'graphic', name: name || 'Untitled' });
  } catch (error: any) {
    console.error('[CF Member Library] Save error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/members/:memberId/library/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const { assetType = 'background', name, imageData, mimeType: inputMimeType, originalName: inputOriginalName, isCropped = false, originalAssetId } = req.body;
    if (!imageData) { res.status(400).json({ error: "No imageData provided" }); return; }
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const allowedImageTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
    const mimeType = inputMimeType || 'image/png';
    if (!allowedImageTypes.includes(mimeType)) { res.status(400).json({ error: `Invalid file type: ${mimeType}. Allowed: PNG, JPEG, WebP, GIF, MP4, WebM` }); return; }
    const maxSize = 25 * 1024 * 1024;
    if (buffer.length > maxSize) { res.status(400).json({ error: "File exceeds 25MB limit" }); return; }
    const originalName = inputOriginalName || `upload-${Date.now()}.png`;
    const displayName = name || originalName;
    const mediaType = mimeType.startsWith('video/') ? 'video' : 'image';
    const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const folder = isCropped ? `members/${memberId}/library/cropped` : mediaType === 'video' ? `members/${memberId}/library/videos` : `members/${memberId}/library/backgrounds`;
    const bucket = storage.bucket();
    const file = bucket.file(`${folder}/${sanitizedName}`);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
    const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
    const assetData: any = {
      memberId, assetType, mediaType, name: displayName, fileName: sanitizedName, originalName,
      storageUrl, publicUrl: proxyUrl, mimeType, sizeBytes: buffer.length, isActive: true,
      isCropped, createdAt: new Date().toISOString(),
    };
    if (originalAssetId) assetData.originalAssetId = originalAssetId;
    const assetDoc = await db.collection('memberLibrary').add(assetData);
    console.log(`[CF Member Upload] Created ${assetType} asset ${assetDoc.id} for member ${memberId}`);
    res.json({ success: true, asset: { id: assetDoc.id, name: displayName, publicUrl: proxyUrl, assetType, mediaType, isCropped } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/library/crop', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const { sourceAssetId, name, cropData, imageData } = req.body;
    if (!imageData) { res.status(400).json({ error: "No imageData provided" }); return; }
    const base64Data = imageData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const maxSize = 25 * 1024 * 1024;
    if (buffer.length > maxSize) { res.status(400).json({ error: "Cropped image exceeds 25MB limit" }); return; }
    const mimeType = 'image/png';
    const sanitizedName = `${Date.now()}-cropped-${sourceAssetId}.png`;
    const folder = `members/${memberId}/library/cropped`;
    const bucket = storage.bucket();
    const file = bucket.file(`${folder}/${sanitizedName}`);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
    const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
    const assetDoc = await db.collection('memberLibrary').add({
      memberId, assetType: 'cropped', mediaType: 'image', name: name || 'Cropped Image',
      fileName: sanitizedName, originalName: `cropped-${sourceAssetId}`,
      storageUrl, publicUrl: proxyUrl, mimeType, sizeBytes: buffer.length,
      sourceAssetId, cropData: cropData ? JSON.parse(cropData) : null,
      isActive: true, createdAt: new Date().toISOString(),
    });
    console.log(`[CF Member Crop] Created cropped asset ${assetDoc.id} from ${sourceAssetId} for member ${memberId}`);
    res.json({ success: true, asset: { id: assetDoc.id, name: name || 'Cropped Image', publicUrl: proxyUrl, sourceAssetId } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/members/:memberId/videos/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId } = req.params;
    const auth = await verifyMemberAuthCF(req, memberId);
    if (!auth.authorized) { res.status(401).json({ error: auth.error }); return; }
    const { videoData, mimeType: inputMimeType, fileName: inputFileName } = req.body;
    if (!videoData) { res.status(400).json({ error: "No videoData provided" }); return; }
    const allowedVideoTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const mimeType = inputMimeType || 'video/mp4';
    if (!allowedVideoTypes.includes(mimeType)) { res.status(400).json({ error: "Invalid video type. Allowed: MP4, WebM, MOV" }); return; }
    const base64Data = videoData.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const maxSize = 100 * 1024 * 1024;
    if (buffer.length > maxSize) { res.status(400).json({ error: "Video exceeds 100MB limit" }); return; }
    const ext = mimeType === 'video/mp4' ? 'mp4' : mimeType === 'video/webm' ? 'webm' : 'mov';
    const originalName = inputFileName || `video-${Date.now()}.${ext}`;
    const sanitizedName = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const folder = `members/${memberId}/library/videos`;
    const bucket = storage.bucket();
    const file = bucket.file(`${folder}/${sanitizedName}`);
    await file.save(buffer, { metadata: { contentType: mimeType } });
    const storageUrl = `gs://${bucket.name}/${folder}/${sanitizedName}`;
    const proxyUrl = `/api/member-files/${memberId}/${encodeURIComponent(sanitizedName)}`;
    const assetDoc = await db.collection('memberLibrary').add({
      memberId, assetType: 'video', mediaType: 'video', name: originalName,
      fileName: sanitizedName, originalName, storageUrl, publicUrl: proxyUrl,
      mimeType, sizeBytes: buffer.length, isActive: true, createdAt: new Date().toISOString(),
    });
    console.log(`[CF Member Video] Created video asset ${assetDoc.id} for member ${memberId}, size: ${(buffer.length / 1024 / 1024).toFixed(2)}MB`);
    res.json({ success: true, videoUrl: proxyUrl, assetId: assetDoc.id, fileName: sanitizedName });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: MEMBER PLAY-PACKET PUBLISH & SHARE-CARD ============

app.post('/member/play-packets/:packetId/share-card', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const { memberId } = req.body;
    if (!packetId || !memberId) { res.status(400).json({ error: "packetId and memberId are required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const packet = packetDoc.data();
    if (packet?.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    const shareCardUrl = packet?.videoSource?.posterUrl || null;
    await db.collection('memberPackets').doc(packetId).update({ shareCardUrl, updatedAt: new Date().toISOString() });
    console.log(`[CF QR Play] Generated share card for ${packetId}`);
    res.json({ shareCardUrl, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/member/play-packets/:packetId/publish', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const { memberId, channelId, metadata } = req.body;
    if (!packetId || !memberId) { res.status(400).json({ error: "packetId and memberId are required" }); return; }
    if ((req as any).user.uid !== memberId) { res.status(403).json({ error: "Forbidden" }); return; }
    const packetDoc = await db.collection('memberPackets').doc(packetId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const packet = packetDoc.data();
    if (packet?.memberId !== memberId) { res.status(403).json({ error: "Not authorized" }); return; }
    const libraryLinkId = `link-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const titleLayer = packet?.textLayers?.find((l: any) => l.id === 'title' || l.label?.toLowerCase() === 'title');
    const linkData = {
      libraryLinkId, packetId, channelId: channelId || null, storeId: memberId, memberId,
      kind: 'qr_play', videoSource: packet?.videoSource || null,
      shareCardUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl || null,
      titleText: titleLayer?.text || 'Untitled Video', textLayers: packet?.textLayers || [],
      textBackdrop: packet?.textBackdrop || 'off', playSettings: packet?.playSettings || {},
      metadata: metadata || packet?.metadata || null, status: 'active',
      shareUrl: `/play/${packetId}`, createdAt: new Date().toISOString(),
    };
    await db.collection('memberLibraryLinks').doc(libraryLinkId).set(linkData);
    await db.collection('memberPackets').doc(packetId).update({ status: 'published', libraryLinkId, updatedAt: new Date().toISOString() });
    if (channelId) {
      const itemId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await db.collection(CHANNEL_ITEMS_COLLECTION).doc(itemId).set({
        channelId, packetId, title: titleLayer?.text || 'Untitled Video',
        description: metadata?.description || '', previewImageUrl: packet?.shareCardUrl || packet?.videoSource?.posterUrl || null,
        price: metadata?.price || null, createdAt: new Date().toISOString(),
      });
      console.log(`[CF QR Play] Also wrote to channel_items for channel ${channelId}`);
    }
    console.log(`[CF QR Play] Published packet ${packetId} as ${libraryLinkId}`);
    res.json({ libraryLinkId, shareUrl: `/play/${packetId}`, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


}
