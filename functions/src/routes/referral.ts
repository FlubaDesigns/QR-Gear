import { isPublicMemberPacket, isPublicPacket } from '../services/publication';
import { memberBuildProjection } from '../services/member-build';
import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { MEMBER_PACKETS_COLLECTION } from '../constants';
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
  // ============ REFERRAL TRACKING (Share & Earn — Forever) ============

// Attribution is established only by the verified checkout transaction.
app.post('/public/referral/capture', (_req: Request, res: Response): void => {
  res.status(410).json({ error: 'Referral attribution is recorded during verified checkout.' });
});

app.get('/public/referral/lookup', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const buyerKey = (req.query.buyerUserId || req.query.buyerEmail) as string;
    if (!buyerKey) { res.status(400).json({ error: "buyerUserId or buyerEmail required" }); return; }
    const snapshot = await db.collection('referrals').where('buyerKey', '==', buyerKey).limit(1).get();
    if (snapshot.empty) { res.json({ success: true, referral: null }); return; }
    const doc = snapshot.docs[0];
    res.json({ success: true, referral: { id: doc.id, ...doc.data() } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/public/member-packet/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }
    let doc = await db.collection(MEMBER_PACKETS_COLLECTION).doc(packetId).get();
    const memberRecord = doc.exists;
    if (!memberRecord) doc = await db.collection('productPackets').doc(packetId).get();
    const visible = doc.exists && (memberRecord ? await isPublicMemberPacket(packetId, doc.data()) : await isPublicPacket(packetId, doc.data()));
    if (!visible) { res.status(404).json({ error: "Packet not found" }); return; }
    const data = doc.data()?.productionPacketId ? await memberBuildProjection(packetId) : doc.data()!;
    const publicData = {
      id: doc.id,
      title: data.title || 'QR Gear Product',
      description: data.description || '',
      itemImage: data.itemImage || data.qrCanvasMockup || data.qrBasicMockup || data.qrPlusMockup || data.qrPlayMockup || data.composeMockup || data.productGraphic || null,
      retailPrice: data.pricing?.customerPrice ?? data.pricingSnapshot?.retailPriceBase ?? data.boundProduct?.retailPrice ?? data.pricingSnapshot?.customerPrice ?? null,
      productTitle: data.boundProduct?.title || data.title || 'QR Gear Product',
      productImage: data.boundProduct?.imageUrl || null,
      selectedColor: data.selectedColor || null,
      selectedShirtSize: data.selectedShirtSize || null,
      qrType: data.qrType || data.packetType || null,
      memberId: data.memberId || null,
      status: data.status || 'unknown',
      availableSizes: data.availableSizes || null,
      sizeUpcharges: data.pricing?.sizeUpcharges || null,
    };
    res.json({ success: true, packet: publicData });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// The canonical paid-order ledger owns earnings and replay protection.
app.post('/public/referral/record-earnings', requireAdmin, (_req: Request, res: Response): void => {
  res.status(410).json({ error: 'Earnings are recorded from verified orders, not caller-supplied totals.' });
});

}
