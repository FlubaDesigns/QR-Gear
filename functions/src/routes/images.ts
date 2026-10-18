import { randomUUID } from 'crypto';
import { fetchProviderImage, setUntrustedAssetHeaders, validateImageBytes, LibraryImageError } from '../services/image-validation';
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

function publicImage(id: string, data: any) {
  const date = data.createdAt?.toDate?.() ?? (data.createdAt ? new Date(data.createdAt) : null);
  return { id, publicUrl: data.publicUrl || null, title: data.title || null, description: data.description || null,
    businessName: data.businessName || null, businessLogo: data.businessLogo || null,
    views: Number.isFinite(data.views) ? data.views : 0,
    createdAt: date && Number.isFinite(date.getTime()) ? date.toISOString() : null };
}

  export function register(app: express.Express): void {
  // ============ BATCH: IMAGES, PROXY, UPLOADS, CLAIMS, STORAGE ============

app.get('/proxy-image', async (req: Request, res: Response): Promise<void> => {
  try {
    const imageUrl = req.query.url as string;
    if (!imageUrl) { res.status(400).json({ error: "Missing url parameter" }); return; }
    const buf = await fetchProviderImage(imageUrl);
    setUntrustedAssetHeaders(res, 'image/png');
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e: any) { res.status(e instanceof LibraryImageError ? e.status : 502).json({ error: e.message }); }
});

app.post('/images/upload', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { imageData, originalName, mimeType, title, description, userId } = req.body;
    if (typeof imageData !== 'string' || typeof originalName !== 'string' || !originalName || typeof mimeType !== 'string') { res.status(400).json({ error: "Missing required fields" }); return; }
    const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedMimeTypes.includes(mimeType)) { res.status(400).json({ error: `Invalid file type: ${mimeType}. Allowed: PNG, JPEG, WebP, GIF, SVG` }); return; }
    if (imageData.length > Math.ceil(25 * 1024 * 1024 / 3) * 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageData)) { res.status(400).json({ error: 'Invalid image encoding or size' }); return; }
    const buf = Buffer.from(imageData, 'base64');
    validateImageBytes(buf, mimeType);
    const maxSize = 25 * 1024 * 1024;
    if (buf.length > maxSize) { res.status(400).json({ error: "Image exceeds 25MB limit" }); return; }
    const fileName = `${randomUUID()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(`uploads/${fileName}`);
    await file.save(buf, { metadata: { contentType: mimeType, ...(mimeType === 'image/svg+xml' ? { contentDisposition: 'attachment' } : {}) } });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/uploads/${fileName}`;
    const ref = await db.collection('hosted_images').add({ userId: (req as any).user.uid, fileName, originalName, mimeType, sizeBytes: buf.length, storageUrl: `uploads/${fileName}`, publicUrl, title: title || null, description: description || null, isActive: true, createdAt: new Date() });
    res.json({ id: ref.id, publicUrl: `/view/${ref.id}`, directUrl: publicUrl, landingUrl: `/view/${ref.id}` });
  } catch (e: any) { res.status(e instanceof LibraryImageError ? e.status : 500).json({ error: e.message }); }
});

app.get('/images/:imageId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('hosted_images').doc(req.params.imageId).get();
    if (!doc.exists || doc.data()?.isActive !== true) { res.status(404).json({ error: "Image not found" }); return; }
    res.json(publicImage(doc.id, doc.data()));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/images/info/:imageId', async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('hosted_images').doc(req.params.imageId).get();
    if (!doc.exists || doc.data()?.isActive !== true) { res.status(404).json({ error: "Image not found" }); return; }
    res.json(publicImage(doc.id, doc.data()));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/images/user/:userId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  res.set('Cache-Control', 'private, no-store');
  try {
    if ((req as any).user.uid !== req.params.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
    const snap = await db.collection('hosted_images').where('userId', '==', req.params.userId).where('isActive', '==', true).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/uploads/request-url', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, contentType, size } = req.body;
    if (typeof name !== 'string' || !name || name.length > 255 || typeof contentType !== 'string') { res.status(400).json({ error: "Missing or invalid name or contentType" }); return; }
    if (!Number.isSafeInteger(size) || size <= 0 || size > 25 * 1024 * 1024) { res.status(400).json({ error: 'Choose a file between 1 byte and 25 MB.' }); return; }
    const allowedUploadTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'video/mp4', 'video/webm'];
    if (!allowedUploadTypes.includes(contentType)) { res.status(400).json({ error: `Invalid content type: ${contentType}` }); return; }
    const sanitizedName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const path = `uploads/${(req as any).user.uid}/${randomUUID()}-${sanitizedName}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(path);
    const [uploadUrl] = await file.getSignedUrl({ action: 'write', expires: Date.now() + 15 * 60 * 1000, contentType });
    res.set('Cache-Control', 'private, no-store');
    res.json({ uploadURL: uploadUrl, objectPath: path, metadata: { name, size, contentType },
      uploadUrl, fileUrl: `https://storage.googleapis.com/${bucket.name}/${path}`, path });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/claim/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.query.code as string;
    if (!code) { res.status(400).json({ valid: false, reason: "Missing claim code" }); return; }
    const snap = await db.collection('claim_codes').where('code', '==', code).limit(1).get();
    if (snap.empty) { res.json({ valid: false, reason: "Claim code not found" }); return; }
    const data = snap.docs[0].data() as any;
    if (data.status !== 'available') { res.json({ valid: false, reason: "Already used" }); return; }
    res.json({ valid: true, claimData: { claimCode: data.code, productName: data.productName || 'QR Gear Product', productDescription: data.productDescription || null, previewImageUrl: data.previewImageUrl || null, packetType: data.packetType || 'qr_basic', status: data.status } });
  } catch (e: any) { res.status(500).json({ valid: false, reason: e.message }); }
});

app.get('/storage/health', async (req: Request, res: Response): Promise<void> => {
  try {
    const bucket = admin.storage().bucket();
    res.json({ healthy: true, bucket: bucket.name });
  } catch (e: any) { res.json({ healthy: false, error: e.message }); }
});

  }
