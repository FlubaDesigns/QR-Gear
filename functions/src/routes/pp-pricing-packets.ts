import { syncCatalogMarkup } from '../services/catalog-instance-update';
import { pricingSettingsSchema } from '../../../shared/schema-orders';
import { updatePacketWithComposition } from '../services/composition-links';
import { validatePacketComposition } from '../services/assembly-store';
import { packetBuildFields } from '../../../shared/builderSnapshot';
import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF, normalizePrintfulCategory } from '../core';
import { PRODUCT_PACKETS_COLLECTION, STORE_PRODUCT_LINKS_COLLECTION } from '../constants';
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
  // ============ PRODUCTS PAGE: FULFILLMENT PROVIDERS ============

app.get('/admin/fulfillment-providers', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const config = (await db.collection('system_config').doc('api_keys').get()).data() || {};
    const printifyKey = process.env.PRINTIFY_API_KEY;
    const printfulKey = config.printfulApiKey || process.env.PRINTFUL_API_KEY;
    const apliiqKey = process.env.APLIIQ_API_KEY;
    const providers = [
      { id: "printify", name: "Printify", configured: !!printifyKey && printifyKey.length > 10 && !!process.env.PRINTIFY_SHOP_ID, role: "fulfillment", description: "Print-on-demand fulfillment via Printify network" },
      { id: "printful", name: "Printful", configured: !!printfulKey && printfulKey.length > 10, role: "fulfillment", description: "Print-on-demand fulfillment via Printful" },
      { id: "apliiq", name: "Apliiq", configured: !!apliiqKey && (apliiqKey?.length || 0) > 10, role: "fulfillment", description: "Custom apparel via Apliiq" },
    ];
    console.log(`[FulfillmentProviders] Returning ${providers.filter(p => p.configured).length} configured`);
    res.json(providers);
  } catch (error: any) {
    console.error('[FulfillmentProviders] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Public and admin readers share the same saved settings. Both save URLs use
// this one admin-only handler; the old copy in members-library is removed.
const readPricing = async (_req: Request, res: Response): Promise<void> => {
  try {
    const saved = await db.collection('testSettings').doc('pricing').get();
    if (_req.path.includes('/admin/')) { res.setHeader('Cache-Control', 'no-store'); res.json(saved.data() || {}); return; }
    const parsed = pricingSettingsSchema.safeParse(saved.data());
    if (!parsed.success) { res.status(409).json({ error: 'Saved pricing is incomplete or invalid. Review Admin Pricing configuration.' }); return; }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ...saved.data(), ...parsed.data });
  } catch (error: any) { res.status(503).json({ error: error.message }); }
};
app.post(['/admin/pricing-settings/sync', '/pricing-settings/sync'], requireAdmin, async (req: Request, res: Response): Promise<void> => {
  if (req.body?.previewToken !== undefined && (typeof req.body.previewToken !== 'string' || !/^[a-f0-9]{64}$/.test(req.body.previewToken))) {
    res.status(400).json({ error: 'A valid markup preview is required.' }); return;
  }
  try {
    res.json(await syncCatalogMarkup(db, admin.firestore.FieldValue.serverTimestamp(), (req as any).user.uid, req.body?.previewToken));
  } catch (error: any) { res.status(error.status || 503).json({ error: error.message }); }
});
app.get('/pricing-settings', readPricing);
app.get('/admin/pricing-settings', requireAdmin, readPricing);
app.post(['/admin/pricing-settings', '/pricing-settings'], requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const parsed = pricingSettingsSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ') }); return; }
  try {
    await db.collection('testSettings').doc('pricing').set({ ...parsed.data, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { mergeFields: [...Object.keys(parsed.data), 'updatedAt'] });
    res.json({ success: true, settings: parsed.data, message: 'Pricing settings saved' });
  } catch (error: any) { res.status(503).json({ error: error.message }); }
});

function stripUndef(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object' || obj instanceof Date) return obj;
  if (Array.isArray(obj)) return obj.map(stripUndef);
  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) clean[k] = stripUndef(v);
  }
  return clean;
}

function sanitizeStyleForFirestore(style: any): any {
  if (!style || typeof style !== 'object') return style;
  const sanitized = { ...style };
  for (const [k, v] of Object.entries(sanitized)) {
    if (typeof v === 'string' && v.length > 500000) {
      sanitized[k] = '';
    }
    if (typeof v === 'string' && v.startsWith('data:')) {
      sanitized[k] = '';
    }
  }
  return stripUndef(sanitized);
}

// ============ PRODUCTS PAGE: PACKETS CRUD ============

app.post('/admin/packets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      qrOnlyUrl, compositeUrl, qrContent, headerText, footerText, pricing,
      productId, productName, productDescription, productImageUrl,
      blueprintId, printProviderId, manufacturer, madeInUSA, category,
      defaultColor, defaultColorHex, defaultPlacement, qrProductState,
      placements, availablePlacements, sizes, colors, basePrice, customerPrice,
      mockupsByColor, landingPageTitle, landingPageDescription,
      landingPageBackgroundUrl, landingPageSlug, headerStyle, footerStyle,
      roleType, storeId, storeName, channelId, channelName,
      fulfillmentProvider, playMediaUrl, playMediaType,
    } = req.body;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const packetData: Record<string, any> = {
      qrOnlyUrl: qrOnlyUrl || null, compositeUrl: compositeUrl || null,
      qrContent: qrContent || null, headerText: headerText || null, footerText: footerText || null,
      pricing: stripUndef(pricing) || null, productId: productId || null, productName: productName || null,
      productDescription: productDescription || null, productImageUrl: productImageUrl || null,
      blueprintId: blueprintId || null, printProviderId: printProviderId || null,
      manufacturer: manufacturer || null, madeInUSA: madeInUSA || false,
      category: category || null, defaultColor: defaultColor || null,
      defaultColorHex: defaultColorHex || null, defaultPlacement: defaultPlacement || null,
      qrProductState: qrProductState || null, placements: placements || [],
      availablePlacements: availablePlacements || [], sizes: sizes || [],
      colors: stripUndef(colors) || [], basePrice: basePrice || null, customerPrice: customerPrice || null,
      mockupsByColor: stripUndef(mockupsByColor) || null,
      landingPageTitle: landingPageTitle || null, landingPageDescription: landingPageDescription || null,
      landingPageBackgroundUrl: landingPageBackgroundUrl || null,
      landingPageSlug: landingPageSlug || null,
      headerStyle: sanitizeStyleForFirestore(headerStyle) || null, footerStyle: sanitizeStyleForFirestore(footerStyle) || null,
      roleType: roleType || null, storeId: storeId || null,
      storeName: storeName || null, channelId: channelId || null,
      channelName: channelName || null, fulfillmentProvider: fulfillmentProvider || 'printify',
      playMediaUrl: playMediaUrl || null, playMediaType: playMediaType || null,
      createdAt: now, updatedAt: now,
    };
      if (req.body.builderSnapshot) {
        try { Object.assign(packetData, packetBuildFields(req.body.builderSnapshot)); }
        catch (error: any) { res.status(400).json({ error: error.message }); return; }
      }
    const packetRef = await db.collection(PRODUCT_PACKETS_COLLECTION).add(packetData);
    const packetId = packetRef.id;
    console.log(`[Packets CF] Created packet: ${packetId}`);

    let mockupJobsQueued = 0;
    const canQueueMockups = blueprintId && colors && Array.isArray(colors) && colors.length > 0 &&
      (fulfillmentProvider === 'printful' || printProviderId);
    if (canQueueMockups) {
      try {
        const artworkUrl = compositeUrl || qrOnlyUrl;
        if (artworkUrl) {
          const targetPlacements = (placements && placements.length > 0) ? placements : ["front"];
          const qrSizes = ["small", "medium", "large"];
          const productIdForMockups = `packet_${packetId}`;
          console.log(`[Packets CF] Queueing mockups for ${colors.length} colors × ${targetPlacements.length} placements × ${qrSizes.length} sizes`);
          let priority = 0;
          const batch = db.batch();
          for (const placement of targetPlacements) {
            for (const color of colors) {
              for (const qrSize of qrSizes) {
                const jobRef = db.collection("mockup_jobs").doc();
                batch.set(jobRef, {
                  productId: productIdForMockups,
                  colorName: color.name || color,
                  qrSize,
                  placement,
                  jobData: {
                    blueprintId: parseInt(blueprintId),
                    printProviderId: printProviderId ? parseInt(printProviderId) : null,
                    artworkUrl,
                    artworkVariant: "black",
                    fulfillmentProvider: fulfillmentProvider || 'printify',
                  },
                  status: "pending",
                  priority: priority++,
                  attempts: 0,
                  maxAttempts: 5,
                  createdAt: admin.firestore.FieldValue.serverTimestamp(),
                  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                mockupJobsQueued++;
              }
            }
          }
          await batch.commit();
          console.log(`[Packets CF] Queued ${mockupJobsQueued} mockup jobs for packet ${packetId}`);
        } else {
          console.log(`[Packets CF] No artwork URL available yet, skipping mockup queue`);
        }
      } catch (err: any) {
        console.error(`[Packets CF] Failed to queue mockup jobs:`, err.message);
      }
    }

    res.json({
      success: true, packetId, mockupJobsQueued,
      message: `Product packet created${mockupJobsQueued > 0 ? ` with ${mockupJobsQueued} mockup jobs queued` : ''}`,
    });
  } catch (error: any) {
    console.error("[Packets] Error creating packet:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/packets', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(PRODUCT_PACKETS_COLLECTION).orderBy("createdAt", "desc").limit(100).get();
    const packets = snapshot.docs.map(doc => {
      const data = doc.data();
      return { id: doc.id, ...data, createdAt: data?.createdAt?.toDate?.() || null, updatedAt: data?.updatedAt?.toDate?.() || null };
    });
    console.log(`[Packets] Retrieved ${packets.length} packets`);
    res.json({ success: true, packets, count: packets.length });
  } catch (error: any) {
    console.error("[Packets] Error getting packets:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/packets/:packetId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }
    const doc = await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const data = doc.data();
    let linkedTemplateId = null;
    const templatesSnapshot = await db.collection("productTemplates").where("packetId", "==", packetId).limit(1).get();
    if (!templatesSnapshot.empty) { linkedTemplateId = templatesSnapshot.docs[0].id; }
    res.json({
      success: true,
      packet: { id: doc.id, ...data, templateId: linkedTemplateId, createdAt: data?.createdAt?.toDate?.() || null, updatedAt: data?.updatedAt?.toDate?.() || null },
    });
  } catch (error: any) {
    console.error("[Packets] Error getting packet:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/public/packets/:packetId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }
    const doc = await db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId).get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const data = doc.data();
    let linkedTemplateId = null;
    const templatesSnapshot = await db.collection("productTemplates").where("packetId", "==", packetId).limit(1).get();
    if (!templatesSnapshot.empty) { linkedTemplateId = templatesSnapshot.docs[0].id; }
    res.json({
      success: true,
      packet: { id: doc.id, ...data, templateId: linkedTemplateId, createdAt: data?.createdAt?.toDate?.() || null, updatedAt: data?.updatedAt?.toDate?.() || null },
    });
  } catch (error: any) {
    console.error("[Packets] Error getting packet:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/packets/:packetId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    const updates = req.body;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }
    const docRef = db.collection(PRODUCT_PACKETS_COLLECTION).doc(packetId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const cleanUpdates = stripUndef(updates);
    if (cleanUpdates.headerStyle) cleanUpdates.headerStyle = sanitizeStyleForFirestore(cleanUpdates.headerStyle);
    if (cleanUpdates.footerStyle) cleanUpdates.footerStyle = sanitizeStyleForFirestore(cleanUpdates.footerStyle);

    // ── Data-URI guard: never let a raw base64 image reach Firestore ──────────
    // A base64 PNG is ~11 MB — far above Firestore's 1 MB document limit.
    // Strip any field whose value is a data: URI so the write always succeeds.
    for (const k of Object.keys(cleanUpdates)) {
      if (typeof cleanUpdates[k] === 'string' && cleanUpdates[k].startsWith('data:')) {
        console.error(`[Packets PATCH] Field "${k}" contains a data URI — stripped to prevent Firestore overflow`);
        cleanUpdates[k] = '';
      }
    }
    // ── end data-URI guard ────────────────────────────────────────────────────

    await updatePacketWithComposition(db, packetId, cleanUpdates, admin.firestore.FieldValue.serverTimestamp());

    // ── GRF registration for mockup URLs ────────────────────────────────────
    const incomingLifestyle     = cleanUpdates.lifestyleMockupUrl  || null;
    const incomingPlacementUrls = cleanUpdates.placementMockupUrls || null;
    if (incomingLifestyle || incomingPlacementUrls) {
      try {
        const { registerMockupGrfAssets } = await import('../services/grf-registrar');
        await registerMockupGrfAssets(packetId, incomingLifestyle, incomingPlacementUrls);
      } catch (grfErr: any) {
        console.error(`[Packets PATCH] GRF mockup registration failed (non-fatal):`, grfErr.message);
      }
    }
    // ── end GRF registration ─────────────────────────────────────────────────

    console.log(`[Packets PATCH] Updated packet ${packetId}:`, Object.keys(updates));
    res.json({ success: true, packetId, message: "Packet updated" });
  } catch (error: any) {
    console.error("[Packets PATCH] Error:", error);
    res.status(500).json({ error: error.message });
  }
});


  }
