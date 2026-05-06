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
  // ============ BATCH: MEMBER FILES PROXY ============

app.get('/member-files/:memberId/:filename', async (req: Request, res: Response): Promise<void> => {
  try {
    const { memberId, filename } = req.params;
    const decodedFilename = decodeURIComponent(filename);
    const bucket = storage.bucket();
    const snapshot = await db.collection('memberLibrary')
      .where('memberId', '==', memberId)
      .where('fileName', '==', decodedFilename)
      .limit(1).get();
    if (!snapshot.empty) {
      const data = snapshot.docs[0].data();
      if (data.storageUrl) {
        let storagePath = data.storageUrl;
        if (storagePath.startsWith('gs://')) storagePath = storagePath.replace(/^gs:\/\/[^\/]+\//, '');
        const file = bucket.file(storagePath);
        const [exists] = await file.exists();
        if (exists) {
          const [metadata] = await file.getMetadata();
          res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          const stream = file.createReadStream();
          stream.pipe(res);
          return;
        }
      }
    }
    const possiblePaths = [
      `members/${memberId}/library/backgrounds/${decodedFilename}`,
      `members/${memberId}/library/cropped/${decodedFilename}`,
      `members/${memberId}/library/videos/${decodedFilename}`,
      `members/${memberId}/backgrounds/${decodedFilename}`,
      `members/${memberId}/videos/${decodedFilename}`,
      `members/${memberId}/cropped/${decodedFilename}`,
    ];
    for (const path of possiblePaths) {
      const file = bucket.file(path);
      const [exists] = await file.exists();
      if (exists) {
        const [metadata] = await file.getMetadata();
        res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        const stream = file.createReadStream();
        stream.pipe(res);
        return;
      }
    }
    console.log(`[CF Member Files] File not found: ${memberId}/${decodedFilename}`);
    res.status(404).json({ error: "File not found" });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: MEMBER MEDIA UPLOAD ============

app.post('/members/:memberId/media', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid || (req as any).userId;
    if (!userId) { res.status(401).json({ error: "Authentication required" }); return; }
    console.log(`[CF MemberMedia] Starting media upload for member: ${userId}`);
    const contentType = req.headers["content-type"] || "";
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) { res.status(400).json({ error: "Invalid content type - expected multipart/form-data" }); return; }
    const boundary = boundaryMatch[1];
    const rawBody = (req as any).rawBody || Buffer.from(req.body || '');
    if (!rawBody || rawBody.length === 0) { res.status(400).json({ error: "No request body received" }); return; }
    console.log(`[CF MemberMedia] Received ${rawBody.length} bytes`);
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts: Buffer[] = [];
    let start = 0;
    while (true) {
      const boundaryIndex = rawBody.indexOf(boundaryBuffer, start);
      if (boundaryIndex === -1) break;
      if (start > 0) parts.push(rawBody.slice(start, boundaryIndex - 2));
      start = boundaryIndex + boundaryBuffer.length + 2;
    }
    let fileBuffer: Buffer | null = null;
    let fileName = `media-${Date.now()}`;
    let fileMimeType = "video/mp4";
    for (const part of parts) {
      const headerEnd = part.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;
      const headers = part.slice(0, headerEnd).toString();
      const body = part.slice(headerEnd + 4);
      const filenameMatch = headers.match(/filename="([^"]+)"/);
      const contentTypeMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
      if (filenameMatch) {
        fileName = filenameMatch[1];
        if (contentTypeMatch) fileMimeType = contentTypeMatch[1].trim();
        fileBuffer = body;
      }
    }
    if (!fileBuffer || fileBuffer.length === 0) { res.status(400).json({ error: "No file uploaded" }); return; }
    const allowedTypes = ["video/mp4", "video/webm", "video/quicktime", "video/3gpp", "video/3gpp2", "video/x-m4v", "video/x-matroska", "image/gif", "image/webp", "image/png", "image/jpeg"];
    if (!allowedTypes.includes(fileMimeType) && !fileMimeType.startsWith("video/")) {
      res.status(400).json({ error: `Invalid file type: ${fileMimeType}` }); return;
    }
    const mediaType = fileMimeType.startsWith("video/") ? "video" : "image";
    const uniqueFilename = `${Date.now()}-${fileName}`;
    const storagePath = `library/member/${userId}/${mediaType}/${uniqueFilename}`;
    const mediaUrl = `/api/library-files/member/${userId}/${mediaType}/${uniqueFilename}`;
    console.log(`[CF MemberMedia] Uploading ${fileName} (${fileMimeType}, ${fileBuffer.length} bytes) to ${storagePath}`);
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    await file.save(fileBuffer, { metadata: { contentType: fileMimeType } });
    console.log(`[CF MemberMedia] Upload complete: ${mediaUrl}`);
    res.json({ url: mediaUrl, mimeType: fileMimeType, fileName, size: fileBuffer.length, storagePath });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


  }
  