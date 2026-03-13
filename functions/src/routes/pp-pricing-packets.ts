import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF, normalizePrintfulCategory } from '../core';
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
    const printifyKey = process.env.PRINTIFY_API_KEY || getPrintifyApiKey();
    const printfulKey = process.env.PRINTFUL_API_KEY || getPrintfulApiKey();
    const apliiqKey = process.env.APLIIQ_API_KEY;
    const providers = [
      { id: "printify", name: "Printify", configured: !!printifyKey && printifyKey.length > 10, role: "fulfillment", description: "Print-on-demand fulfillment via Printify network" },
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

// ============ PRODUCTS PAGE: PRICING SETTINGS (PUBLIC) ============

app.get('/pricing-settings', async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection("testSettings").doc("pricing").get();
    const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBrandLabelPricing = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    if (!doc.exists) {
      res.json({
        markupPercent: 25, markupFixed: 0, additionalPlacementCost: 4,
        textLineUpcharge: 2, centerGraphicUpcharge: 5, memberProfitShare: 0.25,
        builtInShippingCost: 4.95,
        sizeUpcharges: defaultSizeUpcharges,
        hostingTiers: [
          { code: "1_year", name: "1 Year", price: 5 },
          { code: "2_year", name: "2 Years", price: 8 },
          { code: "3_year", name: "3 Years", price: 10 },
        ],
        brandLabelPricing: defaultBrandLabelPricing,
        preferredLabelPosition: 'outside',
      });
      return;
    }
    const data = doc.data();
    res.json({
      ...data,
      memberProfitShare: data?.memberProfitShare ?? 0.25,
      builtInShippingCost: data?.builtInShippingCost ?? 4.95,
      sizeUpcharges: data?.sizeUpcharges ?? defaultSizeUpcharges,
      brandLabelPricing: data?.brandLabelPricing ?? defaultBrandLabelPricing,
      preferredLabelPosition: data?.preferredLabelPosition ?? 'outside',
    });
  } catch (error: any) {
    console.error("[Pricing Settings Public CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRICING SETTINGS (ADMIN) ============

app.get('/admin/pricing-settings', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection("testSettings").doc("pricing").get();
    const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBrandLabelPricing = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    if (!doc.exists) {
      res.json({
        markupPercent: 25, markupFixed: 0, additionalPlacementCost: 4, textLineUpcharge: 2, centerGraphicUpcharge: 5,
        memberProfitShare: 0.25, builtInShippingCost: 4.95, sizeUpcharges: defaultSizeUpcharges,
        hostingTiers: [
          { code: "1_year", name: "1 Year", price: 5 },
          { code: "2_year", name: "2 Years", price: 8 },
          { code: "3_year", name: "3 Years", price: 10 },
        ],
        brandLabelPricing: defaultBrandLabelPricing,
        preferredLabelPosition: 'outside',
      });
      return;
    }
    const data = doc.data();
    res.json({
      ...data,
      memberProfitShare: data?.memberProfitShare ?? 0.25,
      builtInShippingCost: data?.builtInShippingCost ?? 4.95,
      sizeUpcharges: data?.sizeUpcharges ?? defaultSizeUpcharges,
      brandLabelPricing: data?.brandLabelPricing ?? defaultBrandLabelPricing,
      preferredLabelPosition: data?.preferredLabelPosition ?? 'outside',
    });
  } catch (error: any) {
    console.error("[Pricing Settings] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/pricing-settings', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, centerGraphicUpcharge, memberProfitShare, builtInShippingCost, hostingTiers, sizeUpcharges, brandLabelPricing, preferredLabelPosition } = req.body;
    const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBrandLabelPricing = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    const settings = {
      markupPercent: parseFloat(markupPercent) || 25,
      markupFixed: parseFloat(markupFixed) || 0,
      additionalPlacementCost: parseFloat(additionalPlacementCost) || 4,
      textLineUpcharge: parseFloat(textLineUpcharge) || 2,
      centerGraphicUpcharge: parseFloat(centerGraphicUpcharge) || 5,
      memberProfitShare: parseFloat(memberProfitShare) || 0.25,
      builtInShippingCost: typeof builtInShippingCost === 'number' ? builtInShippingCost : 4.95,
      sizeUpcharges: sizeUpcharges || defaultSizeUpcharges,
      hostingTiers: hostingTiers || [
        { code: "1_year", name: "1 Year", price: 5 },
        { code: "2_year", name: "2 Years", price: 8 },
        { code: "3_year", name: "3 Years", price: 10 },
      ],
      brandLabelPricing: brandLabelPricing || defaultBrandLabelPricing,
      preferredLabelPosition: preferredLabelPosition || 'outside',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection("testSettings").doc("pricing").set(settings, { merge: true });
    console.log("[Pricing Settings] Saved settings");
    res.json({ success: true, settings, message: "Pricing settings saved" });
  } catch (error: any) {
    console.error("[Pricing Settings] Error:", error);
    res.status(500).json({ error: error.message });
  }
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
    const packetRef = await db.collection("productPackets").add(packetData);
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
    const snapshot = await db.collection("productPackets").orderBy("createdAt", "desc").limit(100).get();
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
    const doc = await db.collection("productPackets").doc(packetId).get();
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
    const doc = await db.collection("productPackets").doc(packetId).get();
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
    const docRef = db.collection("productPackets").doc(packetId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const cleanUpdates = stripUndef(updates);
    if (cleanUpdates.headerStyle) cleanUpdates.headerStyle = sanitizeStyleForFirestore(cleanUpdates.headerStyle);
    if (cleanUpdates.footerStyle) cleanUpdates.footerStyle = sanitizeStyleForFirestore(cleanUpdates.footerStyle);
    await docRef.update({ ...cleanUpdates, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`[Packets PATCH] Updated packet ${packetId}:`, Object.keys(updates));
    res.json({ success: true, packetId, message: "Packet updated" });
  } catch (error: any) {
    console.error("[Packets PATCH] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/packets/:packetId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { packetId } = req.params;
    if (!packetId) { res.status(400).json({ error: "packetId is required" }); return; }
    const docRef = db.collection("productPackets").doc(packetId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Packet not found" }); return; }
    const cascadeResults = { graphics: 0, templates: 0, storeProductLinks: 0 };
    const graphicsSnap = await db.collection("productGraphics").where("packetId", "==", packetId).get();
    for (const graphicDoc of graphicsSnap.docs) { await graphicDoc.ref.delete(); cascadeResults.graphics++; }
    const templatesSnap = await db.collection("productTemplates").where("packetId", "==", packetId).get();
    for (const templateDoc of templatesSnap.docs) { await templateDoc.ref.delete(); cascadeResults.templates++; }
    const linksSnap = await db.collection("storeProductLinks").where("packetId", "==", packetId).get();
    for (const linkDoc of linksSnap.docs) { await linkDoc.ref.delete(); cascadeResults.storeProductLinks++; }
    await docRef.delete();
    console.log(`[Packets DELETE] Deleted packet ${packetId} with cascade:`, cascadeResults);
    res.json({ success: true, packetId, cascade: cascadeResults, message: "Packet and related data deleted" });
  } catch (error: any) {
    console.error("[Packets DELETE] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

  }
