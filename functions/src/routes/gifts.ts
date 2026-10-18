import { isFreeGiftPromotion, giftExpiry, assertRedeemableGift } from '../services/gift-validation';
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
  // ============ BATCH: GIFT SYSTEM ============

app.get('/gifts/packages', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_packages').where('isActive', '==', true).get();
    res.json(snap.docs.filter(d => isFreeGiftPromotion(d.data())).map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/gifts/packages/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('gift_packages').doc(req.params.id).get();
    if (!doc.exists || !isFreeGiftPromotion(doc.data())) { res.status(404).json({ error: "Gift package not available" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.post('/gifts/purchase', async (req: Request, res: Response): Promise<void> => {
  try {
    const { giftPackageId, buyerEmail, buyerName, personalMessage, recipientEmail } = req.body;
    if (typeof giftPackageId !== 'string' || !giftPackageId || giftPackageId.includes('/')) { res.status(400).json({ error: 'Choose a gift package' }); return; }
    const code = generateGiftCode(), ref = db.collection('gift_codes').doc(code);
    const { expiresAt, packageName } = await db.runTransaction(async tx => {
      const doc = await tx.get(db.collection('gift_packages').doc(giftPackageId));
      const pkg = doc.data();
      if (!isFreeGiftPromotion(pkg)) throw Object.assign(new Error('Paid gifts are unavailable until payment-backed issuance is enabled. Only explicitly free promotions can issue codes.'), { status: 409 });
      const days = pkg!.redemptionValidDays;
      if (!Number.isSafeInteger(days) || days <= 0 || days > 3650) throw Object.assign(new Error('Gift validity must be configured'), { status: 400 });
      const expiresAt = new Date(Date.now() + days * 86400000);
      tx.create(ref, { code, giftPackageId, buyerEmail: buyerEmail || '', buyerName: buyerName || '', personalMessage: pkg!.includePersonalMessage ? personalMessage || null : null,
        expiresAt, status: 'active', issuanceType: 'free_promotion', lastEmailedTo: null, lastEmailedAt: null, createdAt: new Date() });
      return { expiresAt, packageName: pkg!.name };
    });
    res.json({ success: true, giftCode: code, expiresAt, packageName });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/gifts/redeem/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_codes').where('code', '==', req.params.code.toUpperCase()).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Gift code not found" }); return; }
    const gc = snap.docs[0].data() as any;
    assertRedeemableGift(gc);
    const pkgDoc = await db.collection('gift_packages').doc(gc.giftPackageId).get();
    if (!pkgDoc.exists) { res.status(500).json({ error: "Package not found" }); return; }
    const pkg = pkgDoc.data() as any;
    res.json({ giftCodeId: snap.docs[0].id, packageName: pkg.name, packageDescription: pkg.description, giftType: pkg.giftType, personalMessage: gc.personalMessage, buyerName: gc.buyerName, expiresAt: giftExpiry(gc.expiresAt)?.toISOString(), allowColorChoice: pkg.allowColorChoice, allowSizeChoice: pkg.allowSizeChoice, allowQrCustomization: pkg.allowQrCustomization, dynamicsTier: pkg.dynamicsTier, dynamicsMonths: pkg.dynamicsMonths });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.post('/gifts/redeem/:code', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_codes').where('code', '==', req.params.code.toUpperCase()).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Gift code not found" }); return; }
    const giftRef = snap.docs[0].ref;
    const redemptionRef = db.collection('gift_redemptions').doc(giftRef.id);
    const { recipientEmail, recipientName, selectedColor, selectedSize, qrContent, qrStyle, shippingAddress } = req.body;
    await db.runTransaction(async tx => {
      const gift = await tx.get(giftRef), previous = await tx.get(redemptionRef);
      assertRedeemableGift(gift.data());
      if (previous.exists) throw Object.assign(new Error('Gift already redeemed'), { status: 409 });
      tx.create(redemptionRef, { giftCodeId: giftRef.id, recipientEmail: recipientEmail || '', recipientName: recipientName || '', selectedColor: selectedColor || null,
        selectedSize: selectedSize || null, qrContent: qrContent || null, qrStyle: qrStyle || null, shippingAddress: shippingAddress || null, fulfillmentStatus: 'pending', redeemedAt: new Date() });
      tx.update(giftRef, { status: 'redeemed', redemptionId: redemptionRef.id });
    });
    res.json({ success: true, message: "Gift redeemed successfully!" });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/admin/gifts/packages', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_packages').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.post('/admin/gifts/packages', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await db.collection('gift_packages').add({ ...req.body, createdAt: new Date() });
    const doc = await ref.get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.patch('/admin/gifts/packages/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('gift_packages').doc(req.params.id).update(req.body);
    const doc = await db.collection('gift_packages').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.delete('/admin/gifts/packages/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('gift_packages').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/admin/gifts/codes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_codes').orderBy('createdAt', 'desc').limit(100).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.get('/admin/gifts/redemptions', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('gift_redemptions').orderBy('redeemedAt', 'desc').limit(100).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});

app.patch('/admin/gifts/redemptions/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('gift_redemptions').doc(req.params.id).update(req.body);
    const doc = await db.collection('gift_redemptions').doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
});


  }
  