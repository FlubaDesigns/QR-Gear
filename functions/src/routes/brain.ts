import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { PLATFORM_STORE_ID } from '../constants';
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
  // ============ BRAIN PROXY ENDPOINTS ============
app.post("/brain/submit", requireAuth, async (req: Request, res: Response) => {
  try {
    const secret = process.env.FLUBA_SITE_SECRET;
    const brainUrl = process.env.FLUBA_BRAIN_URL;
    if (!secret || !brainUrl) {
      res.status(503).json({ error: "Brain proxy not configured" });
      return;
    }
    const crypto = await import("crypto");
    const body = {
      action: req.body.action,
      payload: req.body.payload,
      prompt: req.body.prompt,
    };
    const raw = JSON.stringify(body);
    const sig = crypto.createHmac("sha256", secret).update(raw).digest("hex");
    const r = await fetch(brainUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-site-id": PLATFORM_STORE_ID,
        "x-signature": sig,
      },
      body: raw,
    });
    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    console.error("[Brain Proxy CF] Error:", err.message);
    res.status(500).json({ error: "Brain proxy failed" });
  }
});


  }
  