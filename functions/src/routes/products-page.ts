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
        memberProfitShare: 0.25, sizeUpcharges: defaultSizeUpcharges,
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
    const { markupPercent, markupFixed, additionalPlacementCost, textLineUpcharge, centerGraphicUpcharge, memberProfitShare, hostingTiers, sizeUpcharges, brandLabelPricing, preferredLabelPosition } = req.body;
    const defaultSizeUpcharges: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const defaultBrandLabelPricing = { printifyInside: 0.55, printifyOutside: 0.55, printfulInside: 0.99, printfulOutside: 2.49 };
    const settings = {
      markupPercent: parseFloat(markupPercent) || 25,
      markupFixed: parseFloat(markupFixed) || 0,
      additionalPlacementCost: parseFloat(additionalPlacementCost) || 4,
      textLineUpcharge: parseFloat(textLineUpcharge) || 2,
      centerGraphicUpcharge: parseFloat(centerGraphicUpcharge) || 5,
      memberProfitShare: parseFloat(memberProfitShare) || 0.25,
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

// ============ PRODUCTS PAGE: STORE-PRODUCT-LINKS CRUD ============

app.get('/admin/store-product-links', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const linksSnapshot = await db.collection("storeProductLinks").orderBy("createdAt", "desc").limit(100).get();
    const links = linksSnapshot.docs.map(doc => ({
      id: doc.id, ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null,
      updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null,
    }));
    console.log(`[Store Links] Listed ${links.length} total links`);
    res.json({ success: true, links, count: links.length });
  } catch (error: any) {
    console.error("[Store Links] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/store-product-links', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      storeId, storeName, channel, collection, packetId, templateId, graphicsId,
      qrContent, productName, compositeUrl, qrOnlyUrl, pricing,
      enabledColors, enabledSizes, selectedGraphicSize, defaultColor,
      qrProductState, landingPageUrl, mockupUrl
    } = req.body;
    if (!storeId || !channel) { res.status(400).json({ error: "storeId and channel are required" }); return; }
    if (!packetId && !templateId && !graphicsId) { res.status(400).json({ error: "At least one of packetId, templateId, or graphicsId is required" }); return; }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const linkData: Record<string, any> = {
      storeId, storeName: storeName || "", channel, collection: collection || null,
      packetId: packetId || null, templateId: templateId || null, graphicsId: graphicsId || null,
      qrContent: qrContent || null, productName: productName || null,
      compositeUrl: compositeUrl || null, qrOnlyUrl: qrOnlyUrl || null, pricing: pricing || null,
      enabledColors: enabledColors || [], enabledSizes: enabledSizes || [],
      selectedGraphicSize: selectedGraphicSize || null, defaultColor: defaultColor || null,
      qrProductState: qrProductState || null, landingPageUrl: landingPageUrl || null,
      mockupUrl: mockupUrl || null, createdAt: now, updatedAt: now,
    };
    const linkRef = await db.collection("storeProductLinks").add(linkData);
    console.log(`[Store Links] Created link: ${linkRef.id} for store ${storeId} / channel ${channel}`);
    res.json({ success: true, linkId: linkRef.id, message: `Product linked to ${storeName || storeId} / ${channel}` });
  } catch (error: any) {
    console.error("[Store Links] Error creating link:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/stores/:storeId/channels/:channelId/products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    if (!storeId || !channelId) { res.status(400).json({ error: "storeId and channelId are required" }); return; }
    const linksSnapshot = await db.collection("storeProductLinks")
      .where("storeId", "==", storeId).where("channel", "==", channelId).get();
    const products = linksSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id, linkId: doc.id, packetId: data.packetId || null,
        templateId: data.templateId || null, name: data.productName || "Untitled Product",
        imageUrl: data.compositeUrl || data.qrOnlyUrl || null, mockupUrl: data.mockupUrl || null,
        qrContent: data.qrContent || null, pricing: data.pricing || null,
        enabledColors: data.enabledColors || [], enabledSizes: data.enabledSizes || [],
        selectedGraphicSize: data.selectedGraphicSize || null, defaultColor: data.defaultColor || null,
        collection: data.collection || null, qrProductState: data.qrProductState || null,
        landingPageUrl: data.landingPageUrl || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null,
      };
    });
    console.log(`[Store Links] Found ${products.length} products for ${storeId}/${channelId}`);
    res.json(products);
  } catch (error: any) {
    console.error("[Store Links] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/store-product-links/:linkId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    const updates = req.body;
    if (!linkId) { res.status(400).json({ error: "linkId is required" }); return; }
    const docRef = db.collection("storeProductLinks").doc(linkId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Link not found" }); return; }
    await docRef.update({ ...stripUndef(updates), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
    console.log(`[Store Links PATCH] Updated link ${linkId}:`, Object.keys(updates));
    res.json({ success: true, linkId, message: "Link updated" });
  } catch (error: any) {
    console.error("[Store Links PATCH] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/store-product-links/:linkId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { linkId } = req.params;
    if (!linkId) { res.status(400).json({ error: "linkId is required" }); return; }
    const docRef = db.collection("storeProductLinks").doc(linkId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ error: "Link not found" }); return; }
    await docRef.delete();
    console.log(`[Store Links DELETE] Deleted link ${linkId}`);
    res.json({ success: true, linkId, message: "Link deleted" });
  } catch (error: any) {
    console.error("[Store Links DELETE] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: CATALOG SYNC ============

app.get('/admin/catalog/sync-status', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const syncId = req.query.syncId as string;
    if (syncId) {
      const syncDoc = await db.collection("catalogSyncs").doc(syncId).get();
      if (!syncDoc.exists) { res.status(404).json({ error: "Sync not found" }); return; }
      const syncData = syncDoc.data();
      let summary = null;
      if (syncData?.status === 'completed' && syncData?.errorMessage) {
        try { summary = JSON.parse(syncData.errorMessage); } catch {}
      }
      res.json({ id: syncDoc.id, ...syncData, summary });
      return;
    }
    const latestSnapshot = await db.collection("catalogSyncs").orderBy("startedAt", "desc").limit(1).get();
    if (latestSnapshot.empty) { res.json({ status: 'none', message: 'No sync has been run yet' }); return; }
    const latest = { id: latestSnapshot.docs[0].id, ...latestSnapshot.docs[0].data() };
    let summary = null;
    if ((latest as any).status === 'completed' && (latest as any).errorMessage) {
      try { summary = JSON.parse((latest as any).errorMessage); } catch {}
    }
    const bpSnapshot = await db.collection("printify_blueprints").limit(1).get();
    res.json({ ...latest, summary, totalBlueprints: bpSnapshot.size, isConfigured: printifyClient.isConfigured });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/catalog/sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const latestSnapshot = await db.collection("catalogSyncs").orderBy("startedAt", "desc").limit(1).get();
    if (!latestSnapshot.empty) {
      const latest = latestSnapshot.docs[0].data();
      if (latest.status === 'running') {
        const startedAt = latest.startedAt?.toDate?.()?.getTime() || 0;
        if (Date.now() - startedAt < 30 * 60 * 1000) {
          res.status(409).json({ error: "Sync already in progress", syncId: latestSnapshot.docs[0].id });
          return;
        }
        await latestSnapshot.docs[0].ref.update({ status: 'failed', errorMessage: 'Timed out - cleared as stale' });
      }
    }
    const syncRef = await db.collection("catalogSyncs").add({
      syncType: 'smart', status: 'running', blueprintsCount: 0, providersCount: 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ syncId: syncRef.id, status: 'started', message: 'Smart sync started' });
    (async () => {
      try {
        console.log('[SmartSync CF] Starting catalog sync...');
        const existingBpSnapshot = await db.collection("printify_blueprints").get();
        const existingBpMap = new Map<number, any>();
        for (const doc of existingBpSnapshot.docs) { existingBpMap.set(doc.data().id || parseInt(doc.id), doc); }
        const blueprints = await printifyClient.getCatalogBlueprints();
        console.log(`[SmartSync CF] Found ${blueprints.length} blueprints`);
        let bpAdded = 0, bpUpdated = 0, bpSkipped = 0;
        for (const bp of blueprints) {
          try {
            const existing = existingBpMap.get(bp.id);
            const existingData = existing?.data();
            const changed = !existingData || existingData.title !== bp.title || existingData.brand !== (bp.brand || null) || existingData.model !== (bp.model || null);
            if (changed || !existingData?.richDescription) {
              let richDescription = existingData?.richDescription || null;
              if (!richDescription) {
                try {
                  const details = await printifyClient.getBlueprintDetails(bp.id);
                  if (details && details.description) {
                    richDescription = details.description;
                  }
                  await new Promise(r => setTimeout(r, 200));
                } catch (detailErr: any) {
                  console.warn(`[SmartSync CF] Could not fetch details for bp ${bp.id}: ${detailErr.message}`);
                }
              }
              await db.collection("printify_blueprints").doc(String(bp.id)).set({
                id: bp.id, title: bp.title, description: bp.description || null,
                richDescription: richDescription || null,
                brand: bp.brand || null, model: bp.model || null,
                images: bp.images || null, primaryImageUrl: bp.images?.[0] || null,
                lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
              }, { merge: true });
              if (existingData) { bpUpdated++; } else { bpAdded++; }
            } else { bpSkipped++; }
            await new Promise(r => setTimeout(r, 50));
          } catch (bpError: any) { console.error(`[SmartSync CF] Error syncing bp ${bp.id}:`, bpError.message); }
        }
        const summary = { blueprints: { added: bpAdded, updated: bpUpdated, skipped: bpSkipped, total: blueprints.length } };
        await syncRef.update({
          status: 'completed', blueprintsCount: bpAdded + bpUpdated,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          errorMessage: JSON.stringify(summary),
        });
        console.log(`[SmartSync CF] Done:`, JSON.stringify(summary));
      } catch (error: any) {
        console.error('[SmartSync CF] Error:', error.message);
        await syncRef.update({ status: 'failed', errorMessage: error.message, completedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/catalog/sync-printful', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printfulClient.isConfigured) { res.status(503).json({ error: "Printful API key not configured" }); return; }
    const syncRef = await db.collection("catalogSyncs").add({
      syncType: 'printful', status: 'running', productsCount: 0,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ syncId: syncRef.id, status: 'started', message: "Printful catalog sync started in background" });
    (async () => {
      try {
        console.log('[Printful Sync CF] Starting full catalog sync...');
        const headers = { 'Authorization': `Bearer ${await getPrintfulApiKeyAsync()}`, 'Content-Type': 'application/json' };
        const catResp = await fetch('https://api.printful.com/products', { headers });
        if (!catResp.ok) throw new Error(`Printful catalog API error: ${catResp.status}`);
        const catData = await catResp.json();
        const products = catData.result || [];
        console.log(`[Printful Sync CF] Found ${products.length} products`);

        const existingSnap = await db.collection('printfulCatalog').get();
        const existingMap = new Map<number, any>();
        existingSnap.forEach(doc => existingMap.set(parseInt(doc.id), doc.data()));

        let added = 0, updated = 0, skipped = 0;
        for (const product of products) {
          try {
            const pid = product.id;
            const existing = existingMap.get(pid);
            const category = normalizePrintfulCategory(product.type || '', product.title || '');

            let minPrice: string | null = null;
            let maxPrice: string | null = null;
            try {
              const detailResp = await fetch(`https://api.printful.com/products/${pid}`, { headers });
              if (detailResp.ok) {
                const detailData = await detailResp.json();
                const variants = detailData.result?.variants || [];
                if (variants.length > 0) {
                  const prices = variants.map((v: any) => parseFloat(v.price)).filter((p: number) => !isNaN(p) && p > 0);
                  if (prices.length > 0) {
                    minPrice = Math.min(...prices).toFixed(2);
                    maxPrice = Math.max(...prices).toFixed(2);
                  }
                }
              }
              await new Promise(r => setTimeout(r, 200));
            } catch (priceErr: any) {
              console.error(`[Printful Sync CF] Price fetch error for ${pid}:`, priceErr.message);
            }

            const productData: any = {
              id: pid, title: product.title, type: product.type, brand: product.brand || null,
              model: product.model || null, image: product.image || null,
              variantCount: product.variant_count || 0,
              category, description: product.description || null,
              isAvailable: true, lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
            };
            if (minPrice !== null) { productData.minPrice = minPrice; productData.maxPrice = maxPrice; }

            const changed = !existing || existing.title !== product.title || existing.brand !== (product.brand || null) || existing.variantCount !== (product.variant_count || 0) || !existing.minPrice;
            if (changed) {
              await db.collection('printfulCatalog').doc(String(pid)).set(productData, { merge: true });
              if (existing) { updated++; } else { added++; }
            } else { skipped++; }
            await new Promise(r => setTimeout(r, 30));
          } catch (pErr: any) { console.error(`[Printful Sync CF] Error syncing product ${product.id}:`, pErr.message); }
        }

        const summary = { products: { added, updated, skipped, total: products.length } };
        await syncRef.update({
          status: 'completed', productsCount: added + updated,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          summary: JSON.stringify(summary),
        });
        console.log(`[Printful Sync CF] Done:`, JSON.stringify(summary));
      } catch (syncError: any) {
        console.error('[Printful Sync CF] Error:', syncError.message);
        await syncRef.update({ status: 'failed', errorMessage: syncError.message, completedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    })();
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog/printful', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const search = (req.query.search as string || '').toLowerCase();
    const snapshot = await db.collection('printfulCatalog').get();
    let products: any[] = [];
    snapshot.forEach(doc => products.push({ docId: doc.id, ...doc.data() }));
    if (search) {
      products = products.filter(p =>
        (p.title || '').toLowerCase().includes(search) ||
        (p.brand || '').toLowerCase().includes(search) ||
        (p.model || '').toLowerCase().includes(search) ||
        (p.category || '').toLowerCase().includes(search)
      );
    }
    res.json(products);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog/printful/:productId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const productId = parseInt(req.params.productId);
    if (!printfulClient.isConfigured) { res.status(503).json({ error: "Printful API not configured" }); return; }
    const productData = await printfulClient.getProduct(productId);
    const printfileData = await printfulClient.getPrintfiles(productId).catch(() => null);
    const placements = printfileData?.available_placements ? Object.keys(printfileData.available_placements) : [];
    const colors = new Set<string>();
    const sizes = new Set<string>();
    if (productData?.variants) {
      for (const v of productData.variants) {
        if (v.color) colors.add(v.color);
        if (v.size) sizes.add(v.size);
      }
    }
    res.json({
      ...productData.product,
      variants: productData.variants,
      placements,
      colors: Array.from(colors),
      sizes: Array.from(sizes),
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/catalog/printful-mapping', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { printifyBlueprintId, printfulProductId, notes } = req.body;
    if (!printifyBlueprintId || !printfulProductId) {
      res.status(400).json({ error: "printifyBlueprintId and printfulProductId required" }); return;
    }
    const existingSnap = await db.collection('printify_printful_mapping')
      .where('printifyBlueprintId', '==', printifyBlueprintId)
      .where('isActive', '==', true).limit(1).get();
    if (!existingSnap.empty) {
      await existingSnap.docs[0].ref.update({ isActive: false, deactivatedAt: admin.firestore.FieldValue.serverTimestamp() });
    }
    const mappingRef = await db.collection('printify_printful_mapping').add({
      printifyBlueprintId, printfulProductId, isActive: true,
      notes: notes || null, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    res.json({ success: true, mappingId: mappingRef.id, message: `Mapped Printify #${printifyBlueprintId} → Printful #${printfulProductId}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/catalog/printful-mappings', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('printify_printful_mapping').where('isActive', '==', true).get();
    const mappings: any[] = [];
    snap.forEach(doc => mappings.push({ id: doc.id, ...doc.data() }));
    const hardcoded = Object.entries(DEFAULT_BLUEPRINT_MAPPINGS).map(([bpId, pfId]) => ({
      printifyBlueprintId: parseInt(bpId), printfulProductId: pfId, source: 'hardcoded'
    }));
    res.json({ firestoreMappings: mappings, hardcodedMappings: hardcoded });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ PRODUCTS PAGE: CATALOG PLACEMENTS ============

app.get('/admin/catalog/placements', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as string;
    const blueprintId = req.query.blueprintId ? parseInt(req.query.blueprintId as string) : null;
    const printProviderId = req.query.printProviderId ? parseInt(req.query.printProviderId as string) : null;
    const productId = req.query.productId ? parseInt(req.query.productId as string) : null;

    if (provider === 'printify') {
      if (!blueprintId || !printProviderId) { res.status(400).json({ error: "blueprintId and printProviderId required for Printify" }); return; }
      if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
      try {
        const variantData = await printifyClient.getVariants(blueprintId, printProviderId);
        const placementSet = new Set<string>();
        if (variantData?.variants) {
          for (const v of variantData.variants) {
            if (v.placeholders) {
              for (const ph of v.placeholders) { placementSet.add(ph.position || ph.placeholder); }
            }
          }
        }
        if (placementSet.size === 0) placementSet.add('front');
        const normalized = normalizePlacements('printify', Array.from(placementSet));
        const mapped = normalized.map(p => ({
          id: p, type: p, title: p.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), additionalPrice: 0,
        }));
        res.json({ placements: mapped, source: 'printify-api' });
      } catch (err: any) {
        res.json({ placements: [{ id: 'front', type: 'front', title: 'Front', additionalPrice: 0 }], source: 'default-fallback' });
      }
      return;
    }

    if (provider === 'printful') {
      if (!productId) { res.status(400).json({ error: "productId required for Printful" }); return; }
      const printfileInfo = await printfulClient.getPrintfiles(productId);
      const rawPlacements = printfileInfo?.available_placements ? Object.keys(printfileInfo.available_placements) : [];
      const printPlacements = rawPlacements.filter(p => !isEmbroideryPlacement(p));
      const grouped = groupPlacementsByLocation('printful', printPlacements);
      const mapped = grouped.map(g => ({
        id: g.internal, type: g.internal,
        title: g.internal.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        additionalPrice: 0,
        methods: g.methods.map(m => ({ method: m.method, providerName: m.providerName })),
      }));
      res.json({ placements: mapped, source: 'printful-api' });
      return;
    }

    res.status(400).json({ error: "provider must be 'printify' or 'printful'" });
  } catch (error: any) {
    console.error("Placement fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/public/catalog/placements', async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = req.query.provider as string;
    const blueprintId = req.query.blueprintId ? parseInt(req.query.blueprintId as string) : null;
    const printProviderId = req.query.printProviderId ? parseInt(req.query.printProviderId as string) : null;
    const productId = req.query.productId ? parseInt(req.query.productId as string) : null;

    if (provider === 'printify') {
      if (!blueprintId || !printProviderId) { res.status(400).json({ error: "blueprintId and printProviderId required for Printify" }); return; }
      if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
      try {
        const variantData = await printifyClient.getVariants(blueprintId, printProviderId);
        const placementSet = new Set<string>();
        if (variantData?.variants) {
          for (const v of variantData.variants) {
            if (v.placeholders) {
              for (const ph of v.placeholders) { placementSet.add(ph.position || ph.placeholder); }
            }
          }
        }
        if (placementSet.size === 0) placementSet.add('front');
        const normalized = normalizePlacements('printify', Array.from(placementSet));
        const mapped = normalized.map(p => ({
          id: p, type: p, title: p.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()), additionalPrice: 0,
        }));
        res.json({ placements: mapped, source: 'printify-api' });
      } catch (err: any) {
        res.json({ placements: [{ id: 'front', type: 'front', title: 'Front', additionalPrice: 0 }], source: 'default-fallback' });
      }
      return;
    }

    if (provider === 'printful') {
      if (!productId) { res.status(400).json({ error: "productId required for Printful" }); return; }
      const printfileInfo = await printfulClient.getPrintfiles(productId);
      const rawPlacements = printfileInfo?.available_placements ? Object.keys(printfileInfo.available_placements) : [];
      const printPlacements = rawPlacements.filter(p => !isEmbroideryPlacement(p));
      const grouped = groupPlacementsByLocation('printful', printPlacements);
      const mapped = grouped.map(g => ({
        id: g.internal, type: g.internal,
        title: g.internal.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
        additionalPrice: 0,
        methods: g.methods.map(m => ({ method: m.method, providerName: m.providerName })),
      }));
      res.json({ placements: mapped, source: 'printful-api' });
      return;
    }

    res.status(400).json({ error: "provider must be 'printify' or 'printful'" });
  } catch (error: any) {
    console.error("Public placement fetch error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRINTIFY CATALOG BROWSER ============

const CF_USA_MADE_BRANDS = [
  'american apparel', 'royal apparel', 'bayside', 'los angeles apparel',
  'bella+canvas', 'bella canvas', 'lane seven', 'cotton heritage',
  'shaka wear', 'backpacks usa', 'american giant', 'next level',
];

function cfCategorizeProduct(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('t-shirt') || t.includes('tee') || t.includes('tank') || t.includes('jersey') || t.includes('bodysuit') || t.includes('onesie') || t.includes('baby tee')) return "T-Shirts & Tops";
  if (t.includes('hoodie') || t.includes('sweatshirt') || t.includes('crew neck') || t.includes('pullover') || t.includes('crewneck')) return "Sweatshirts & Hoodies";
  if (t.includes('hat') || t.includes('cap') || t.includes('beanie') || t.includes('visor') || t.includes('bucket')) return "Hats & Caps";
  if (t.includes('mug') || t.includes('tumbler') || t.includes('bottle') || t.includes('cup') || t.includes('glass') || t.includes('can cooler')) return "Drinkware";
  if (t.includes('bag') || t.includes('tote') || t.includes('backpack') || t.includes('pouch') || t.includes('clutch') || t.includes('duffel') || t.includes('weekender') || t.includes('fanny') || t.includes('cosmetic')) return "Bags & Accessories";
  if (t.includes('phone') || t.includes('case') || t.includes('airpod') || t.includes('laptop sleeve')) return "Phone Cases & Tech";
  if (t.includes('sticker') || t.includes('magnet') || t.includes('pin button') || t.includes('bumper') || t.includes('decal')) return "Stickers & Magnets";
  if (t.includes('poster') || t.includes('canvas') || t.includes('art print') || t.includes('framed') || t.includes('wall') || t.includes('tapestry')) return "Wall Art & Posters";
  if (t.includes('pillow') || t.includes('blanket') || t.includes('comforter') || t.includes('shower') || t.includes('bath') || t.includes('rug') || t.includes('coaster') || t.includes('placemat') || t.includes('towel')) return "Home & Living";
  if (t.includes('journal') || t.includes('notebook') || t.includes('card') || t.includes('postcard') || t.includes('calendar') || t.includes('puzzle')) return "Stationery & Paper";
  if (t.includes('legging') || t.includes('jogger') || t.includes('shorts') || t.includes('skirt') || t.includes('dress') || t.includes('swimsuit') || t.includes('bikini') || t.includes('swim trunk') || t.includes('boxer') || t.includes('brief') || t.includes('bra') || t.includes('jacket') || t.includes('windbreaker') || t.includes('pants') || t.includes('pajama') || t.includes('rash guard') || t.includes('flip flop') || t.includes('sneaker') || t.includes('shoe')) return "Activewear & Specialty";
  if (t.includes('pet') || t.includes('dog')) return "Pet Products";
  if (t.includes('ornament') || t.includes('stocking') || t.includes('tree skirt') || t.includes('snowflake')) return "Holiday & Seasonal";
  if (t.includes('sock') || t.includes('scarf') || t.includes('necktie') || t.includes('watch band') || t.includes('apron') || t.includes('bandana') || t.includes('headband') || t.includes('gaiter') || t.includes('mask') || t.includes('scrunchie')) return "Accessories";
  return "Other";
}

function cfClassifyPrintfulProduct(typeName: string): string {
  const n = (typeName || "").toLowerCase();
  if (n.startsWith("all-over print")) return "All-Over Print";
  if (n.includes("t-shirt") || n.includes("tank top") || n.includes("crop top") || n.includes("jersey") || (n.includes("tee") && !n.includes("steer"))) return "T-Shirts & Tops";
  if (n.includes("hoodie") || n.includes("hood") || n.includes("sweatshirt") || n.includes("pullover") || n.includes("fleece")) return "Hoodies & Sweatshirts";
  if (n.includes("hat") || n.includes("beanie") || n.includes("cap") || n.includes("visor")) return "Hats & Headwear";
  if (n.includes("mug") || n.includes("tumbler") || n.includes("glass") || n.includes("bottle") || n.includes("can cooler") || n.includes("wine")) return "Drinkware";
  if (n.includes("poster") || n.includes("canvas") || n.includes("framed") || n.includes("tapestry") || n.includes("flag") || n.includes("pennant") || n.includes("metal print") || n.includes("photo paper")) return "Wall Art & Prints";
  if (n.includes("iphone") || n.includes("samsung") || n.includes("airpods") || n.includes("magsafe") || n.includes("phone case") || n.includes("snap case")) return "Phone & Tech Cases";
  if (n.includes("sticker") || n.includes("decal") || n.includes("magnet") || n.includes("patch")) return "Stickers & Patches";
  if (n.includes("bag") || n.includes("tote") || n.includes("backpack") || n.includes("fanny pack") || n.includes("crossbody") || n.includes("luggage") || n.includes("duffle") || n.includes("weekender")) return "Bags & Accessories";
  if (n.includes("pillow") || n.includes("blanket") || n.includes("comforter") || n.includes("rug") || n.includes("towel") || n.includes("curtain") || n.includes("coaster") || n.includes("apron") || n.includes("shower")) return "Home & Living";
  if (n.includes("sock") || n.includes("gaiter") || n.includes("bandana") || n.includes("headband") || n.includes("scarf")) return "Socks & Accessories";
  if (n.includes("pet") || n.includes("dog") || n.includes("collar") || n.includes("leash")) return "Pet Products";
  if (n.includes("notebook") || n.includes("journal") || n.includes("notepad") || n.includes("calendar") || n.includes("greeting card") || n.includes("business card")) return "Stationery & Paper";
  if (n.includes("dress") || n.includes("skirt") || n.includes("bikini") || n.includes("swimsuit") || n.includes("swim trunk")) return "Dresses & Swimwear";
  if (n.includes("short") || n.includes("pant") || n.includes("jogger") || n.includes("legging") || n.includes("sweatpant")) return "Bottoms";
  if (n.includes("ornament") || n.includes("christmas") || n.includes("stocking") || n.includes("gift wrap")) return "Seasonal & Holiday";
  if (n.includes("jacket") || n.includes("windbreaker") || n.includes("bomber") || n.includes("vest") || n.includes("sweater")) return "Outerwear & Layers";
  if (n.includes("canvas shoe") || n.includes("athletic shoe") || n.includes("slide") || n.includes("sneaker") || (n.includes("shoe") && !n.includes("shower"))) return "Footwear";
  if (n.includes("mouse pad") || n.includes("desk mat") || n.includes("laptop")) return "Desk & Office";
  if (n.includes("kid") || n.includes("youth") || n.includes("baby")) return "Kids & Youth";
  if (n.includes("polo")) return "Polo Shirts";
  if (n.includes("pin button") || n.includes("pin ") || n.includes("set of pin")) return "Pins & Buttons";
  return "Other";
}

function cfBuildPrintfulVariantLookup(variants: any[]): Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }> {
  const lookup = new Map<number, { colorsMap: Map<string, string>; sizesSet: Set<string> }>();
  for (const v of variants) {
    const pid = v.productId;
    if (!pid) continue;
    if (!lookup.has(pid)) lookup.set(pid, { colorsMap: new Map(), sizesSet: new Set() });
    const entry = lookup.get(pid)!;
    if (v.color && !entry.colorsMap.has(v.color)) entry.colorsMap.set(v.color, v.colorCode || "#888");
    if (v.size) entry.sizesSet.add(v.size);
  }
  const result = new Map<number, { colors: Array<{ name: string; hex: string }>; sizes: string[] }>();
  for (const [pid, entry] of Array.from(lookup.entries())) {
    result.set(pid, {
      colors: Array.from(entry.colorsMap.entries()).map(([name, hex]: [string, string]) => ({ name, hex })),
      sizes: Array.from(entry.sizesSet),
    });
  }
  return result;
}

app.get('/admin/printify/catalog', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const providerFilter = (req.query.provider as string) || 'all';
    const categories: Record<string, any[]> = {};

    const bpSnapshot = await db.collection("printify_blueprints").get();
    const allPrintifyBlueprints = bpSnapshot.docs.map(doc => {
      const d = doc.data();
      return { id: d.id || parseInt(doc.id), title: d.title, description: d.description || '', richDescription: d.richDescription || '', brand: d.brand, model: d.model, images: d.images || [] };
    });

    const provSnapshot = await db.collection("printify_providers").get();
    let allProviders = provSnapshot.docs.map(doc => doc.data());
    if (allProviders.length === 0) {
      const ppSnapshot = await db.collection("printifyPrintProviders").get();
      allProviders = ppSnapshot.docs.map(doc => {
        const d = doc.data();
        return { blueprintId: d.blueprintId, providerId: d.providerId, minCost: d.minCost || 0, maxCost: d.maxCost || 0, availableColors: d.availableColors || [], availableSizes: d.availableSizes || [] };
      });
    }
    const providersByBlueprint = new Map<number, { colors: Array<{name: string; hex?: string}>; sizes: string[]; minCost: number; maxCost: number; providerId: number }>();
    for (const prov of allProviders) {
      const existing = providersByBlueprint.get(prov.blueprintId);
      const colors = Array.isArray(prov.availableColors) ? prov.availableColors : [];
      const sizes = Array.isArray(prov.availableSizes) ? prov.availableSizes : [];
      const minCost = prov.minCost || 0;
      const maxCost = prov.maxCost || 0;
      if (!existing || colors.length > existing.colors.length) {
        providersByBlueprint.set(prov.blueprintId, { colors, sizes, minCost, maxCost, providerId: prov.providerId });
      }
    }

    const pfSnapshot = await db.collection("printful_products").get();
    const allPrintfulRows = pfSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));

    let matchedModels: Set<string> | null = null;
    if (providerFilter === 'matched') {
      const printifyModels = new Set(allPrintifyBlueprints.filter(bp => bp.model && bp.model.trim() !== '').map(bp => bp.model.trim().toLowerCase()));
      const printfulModels = new Set(allPrintfulRows.filter((pf: any) => pf.model && pf.model.trim() !== '').map((pf: any) => pf.model!.trim().toLowerCase()));
      matchedModels = new Set(Array.from(printifyModels).filter(m => printfulModels.has(m)));
    }

    if (providerFilter === 'all' || providerFilter === 'printify' || providerFilter === 'matched') {
      let blueprints = allPrintifyBlueprints;
      if (providerFilter === 'matched') { blueprints = blueprints.filter(bp => bp.model && matchedModels!.has(bp.model.trim().toLowerCase())); }
      for (const bp of blueprints) {
        const brandLower = (bp.brand || '').toLowerCase();
        const isUSABrand = CF_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        const category = cfCategorizeProduct(bp.title);
        if (!categories[category]) categories[category] = [];
        const modelLower = (bp.model || '').trim().toLowerCase();
        const matchedPrintful = modelLower ? allPrintfulRows.find((pf: any) => ((pf as any).model || '').trim().toLowerCase() === modelLower) : null;
        const provData = providersByBlueprint.get(bp.id);
        const rawDesc = bp.richDescription || bp.description || '';
        const cleanDesc = rawDesc.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        categories[category].push({
          id: bp.id, title: bp.title, description: cleanDesc, brand: bp.brand, model: bp.model,
          imageUrl: bp.images?.[0] || null, madeInUSA: isUSABrand, blueprintId: bp.id,
          printProviderId: provData?.providerId || null,
          minPrice: provData?.minCost ? (provData.minCost / 100).toFixed(2) : null,
          maxPrice: provData?.maxCost ? (provData.maxCost / 100).toFixed(2) : null,
          colorCount: provData?.colors.length || 0, availableColors: provData?.colors || [],
          availableSizes: provData?.sizes || [], fulfillmentProvider: 'printify', provider: 'printify',
          dualProvider: !!matchedPrintful, matchedProviderId: matchedPrintful ? `printful-${(matchedPrintful as any).id}` : null,
        });
      }
    }

    if (providerFilter === 'all' || providerFilter === 'printful' || providerFilter === 'matched') {
      let printfulRows = allPrintfulRows as any[];
      if (providerFilter === 'matched') { printfulRows = printfulRows.filter(pf => pf.model && matchedModels!.has(pf.model.trim().toLowerCase())); }
      for (const pf of printfulRows) {
        const isUSA = (pf.originCountry || '').toUpperCase() === 'USA' || (pf.originCountry || '').toUpperCase() === 'US';
        const brandLower = (pf.brand || '').toLowerCase();
        const isUSABrand = isUSA || CF_USA_MADE_BRANDS.some(usaBrand => brandLower.includes(usaBrand));
        const category = cfCategorizeProduct(pf.title);
        if (!categories[category]) categories[category] = [];
        const modelLower = (pf.model || '').trim().toLowerCase();
        const matchedPrintify = modelLower ? allPrintifyBlueprints.find(bp => (bp.model || '').trim().toLowerCase() === modelLower) : null;
        const pfColors = Array.isArray(pf.availableColors) ? pf.availableColors : [];
        const pfSizes = Array.isArray(pf.availableSizes) ? pf.availableSizes : [];
        categories[category].push({
          id: pf.id, title: pf.title, description: pf.description || '', brand: pf.brand || '', model: pf.model || '',
          imageUrl: pf.image || null, madeInUSA: isUSABrand, blueprintId: pf.id, printProviderId: null,
          minPrice: pf.minPrice || null, maxPrice: pf.maxPrice || null, colorCount: pfColors.length,
          availableColors: pfColors, availableSizes: pfSizes, fulfillmentProvider: 'printful', provider: 'printful',
          dualProvider: !!matchedPrintify, matchedProviderId: matchedPrintify ? `printify-${matchedPrintify.id}` : null,
        });
      }
    }

    const sortedCategories = [
      "T-Shirts & Tops", "Sweatshirts & Hoodies", "Hats & Caps", "Drinkware",
      "Bags & Accessories", "Phone Cases & Tech", "Stickers & Magnets",
      "Wall Art & Posters", "Home & Living", "Stationery & Paper",
      "Activewear & Specialty", "Accessories", "Pet Products", "Holiday & Seasonal", "Other"
    ];
    const result = sortedCategories
      .filter(name => categories[name] && categories[name].length > 0)
      .map(name => ({
        name, items: categories[name].sort((a: any, b: any) => a.title.localeCompare(b.title)),
        count: categories[name].length,
        usaCount: categories[name].filter((i: any) => i.madeInUSA).length,
        printifyCount: categories[name].filter((i: any) => i.provider === 'printify').length,
        printfulCount: categories[name].filter((i: any) => i.provider === 'printful').length,
      }));
    const extraCategories = Object.entries(categories)
      .filter(([name]) => !sortedCategories.includes(name))
      .filter(([_, items]) => items.length > 0)
      .map(([name, items]) => ({
        name, items: items.sort((a: any, b: any) => a.title.localeCompare(b.title)),
        count: items.length, usaCount: items.filter((i: any) => i.madeInUSA).length,
        printifyCount: items.filter((i: any) => i.provider === 'printify').length,
        printfulCount: items.filter((i: any) => i.provider === 'printful').length,
      }));
    res.json([...result, ...extraCategories]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/printify/catalog/:blueprintId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const blueprintId = parseInt(req.params.blueprintId);
    const [blueprint, providers] = await Promise.all([
      printifyClient.getBlueprintDetails(blueprintId),
      printifyClient.getPrintProviders(blueprintId),
    ]);
    res.json({ blueprint, providers });
  } catch (error: any) {
    console.error("Printify blueprint error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/printify/catalog/batch-details', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    if (!printifyClient.isConfigured) { res.status(503).json({ error: "Printify API not configured" }); return; }
    const { blueprintIds } = req.body;
    if (!Array.isArray(blueprintIds) || blueprintIds.length === 0) { res.status(400).json({ error: "blueprintIds array required" }); return; }
    const limitedIds = blueprintIds.slice(0, 20);
    const results: Record<number, any> = {};
    for (const blueprintId of limitedIds) {
      try {
        const [blueprint, providers] = await Promise.all([
          printifyClient.getBlueprintDetails(blueprintId),
          printifyClient.getPrintProviders(blueprintId),
        ]);
        const usaProviders = providers.filter((p: any) => p.location?.country === 'US' || p.location?.country === 'USA');
        let variants: any[] = [];
        const selectedProvider = usaProviders[0] || providers[0];
        if (selectedProvider) {
          try { const variantData = await printifyClient.getVariants(blueprintId, selectedProvider.id); variants = variantData.variants || []; } catch {}
        }
        const liveColors = Array.from(new Set(variants.map((v: any) => v.options?.color).filter(Boolean)));
        const liveSizes = Array.from(new Set(variants.map((v: any) => v.options?.size).filter(Boolean)));
        let basePrice = 0, maxPrice = 0;
        const costs = variants.map((v: any) => v.cost || 0).filter((c: number) => c > 0);
        basePrice = costs.length > 0 ? Math.min(...costs) / 100 : 0;
        maxPrice = costs.length > 0 ? Math.max(...costs) / 100 : 0;
        results[blueprintId] = {
          blueprintId, basePrice, maxPrice, costsAvailable: basePrice > 0,
          colors: liveColors, sizes: liveSizes,
          madeInUSA: usaProviders.length > 0, providerId: selectedProvider?.id, providerName: selectedProvider?.title,
        };
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (err: any) {
        results[blueprintId] = { blueprintId, error: true, message: err.message || "Failed to fetch details" };
      }
    }
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRINTFUL PRODUCTS CATALOG ============

app.get('/admin/catalog/printful-products', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const products = productsSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));
    const variantsSnapshot = await db.collection("printful_variants").get();
    const allVariants = variantsSnapshot.docs.map(doc => doc.data());
    const variantLookup = cfBuildPrintfulVariantLookup(allVariants);
    const grouped: Record<string, any[]> = {};
    for (const p of products as any[]) {
      const categoryName = cfClassifyPrintfulProduct(p.typeName || p.type || "");
      if (!grouped[categoryName]) grouped[categoryName] = [];
      const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
      grouped[categoryName].push({
        id: p.id, title: p.title, brand: p.brand || "", model: p.model || "",
        imageUrl: p.image || null, madeInUSA: (p.originCountry || "").toUpperCase() === "US",
        minPrice: p.minPrice || null, maxPrice: p.maxPrice || null,
        colorCount: vData.colors.length, availableColors: vData.colors, availableSizes: vData.sizes,
        blueprintId: p.id, printProviderId: null, hasMockupMapping: false,
        fulfillmentProvider: 'printful',
      });
    }
    const result = Object.entries(grouped).map(([name, items]) => ({ name, items, count: items.length }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/catalog/printful-status', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const variantsSnapshot = await db.collection("printful_variants").get();
    res.json({
      isConfigured: printfulClient.isConfigured,
      productCount: productsSnapshot.size,
      variantCount: variantsSnapshot.size,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/catalog/printful-products', async (_req: Request, res: Response): Promise<void> => {
  try {
    const productsSnapshot = await db.collection("printful_products").get();
    const products = productsSnapshot.docs.map(doc => ({ id: parseInt(doc.id) || doc.data().id, ...doc.data() }));
    const variantsSnapshot = await db.collection("printful_variants").get();
    const allVariants = variantsSnapshot.docs.map(doc => doc.data());
    const variantLookup = cfBuildPrintfulVariantLookup(allVariants);
    const grouped: Record<string, any[]> = {};
    for (const p of products as any[]) {
      const categoryName = cfClassifyPrintfulProduct(p.typeName || p.type || "");
      if (!grouped[categoryName]) grouped[categoryName] = [];
      const vData = variantLookup.get(p.id) || { colors: [], sizes: [] };
      const placements = ((p as any).availablePlacements || []).map((pid: string) => {
        const nId = normalizePlacement('printful', pid);
        const title = nId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
        return { id: nId, type: nId, title, additionalPrice: 0 };
      });
      grouped[categoryName].push({
        id: p.id, title: (p as any).title, brand: (p as any).brand || "", model: (p as any).model || "",
        imageUrl: (p as any).image || null, madeInUSA: ((p as any).originCountry || "").toUpperCase() === "US",
        minPrice: (p as any).minPrice || null, maxPrice: (p as any).maxPrice || null,
        colorCount: vData.colors.length, availableColors: vData.colors, availableSizes: vData.sizes,
        blueprintId: p.id, printProviderId: null, hasMockupMapping: false,
        fulfillmentProvider: 'printful', placements: placements.length > 0 ? placements : null,
      });
    }
    const result = Object.entries(grouped).map(([name, items]) => ({ name, items, count: items.length }));
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: QUEUE/PROCESS ============

app.post('/admin/queue/retry-failed', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const failedSnapshot = await db.collection("mockup_jobs").where("status", "==", "failed").get();
    if (failedSnapshot.empty) {
      res.json({ success: true, reset: 0, message: "No failed jobs to retry" });
      return;
    }
    let resetCount = 0;
    const batch = db.batch();
    for (const doc of failedSnapshot.docs) {
      batch.update(doc.ref, {
        status: "pending",
        error: null,
        retryCount: admin.firestore.FieldValue.increment(1),
        lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      resetCount++;
    }
    await batch.commit();
    console.log(`[Queue CF] Reset ${resetCount} failed jobs to pending`);
    res.json({ success: true, reset: resetCount, message: `Reset ${resetCount} failed jobs to pending` });
  } catch (error: any) {
    console.error("[Queue CF] Error retrying failed:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/queue/process', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { limit = 5 } = req.body;
    const processLimit = Math.min(limit, 20);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const processingSnapshot = await db.collection("mockup_jobs").where("status", "==", "processing").limit(50).get();
    let recoveredCount = 0;
    for (const doc of processingSnapshot.docs) {
      const data = doc.data();
      const startedAt = data.startedAt?.toMillis?.() || data.startedAt || 0;
      if (startedAt < fiveMinutesAgo) {
        await db.collection("mockup_jobs").doc(doc.id).update({
          status: "pending", retryCount: admin.firestore.FieldValue.increment(1),
          lastRetryAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        recoveredCount++;
      }
    }
    const pendingSnapshot = await db.collection("mockup_jobs").where("status", "==", "pending").limit(processLimit).get();
    if (pendingSnapshot.empty) {
      res.json({ success: true, processed: 0, recovered: recoveredCount, message: "No pending jobs in queue" });
      return;
    }
    console.log(`[Queue CF] Processing ${pendingSnapshot.size} mockup jobs`);
    const results: Array<{ jobId: string; status: string; error?: string }> = [];
    for (const jobDoc of pendingSnapshot.docs) {
      const job = jobDoc.data();
      const jobId = jobDoc.id;
      try {
        const claimed = await db.runTransaction(async (transaction) => {
          const jobRef = db.collection("mockup_jobs").doc(jobId);
          const freshDoc = await transaction.get(jobRef);
          if (!freshDoc.exists || freshDoc.data()?.status !== "pending") return false;
          transaction.update(jobRef, { status: "processing", startedAt: admin.firestore.FieldValue.serverTimestamp(), processorId: `cf-${Date.now()}` });
          return true;
        });
        if (!claimed) { console.log(`[Queue CF] Job ${jobId} already claimed`); continue; }
        await new Promise(resolve => setTimeout(resolve, 2000));
        const templateDoc = await db.collection("productTemplates").doc(job.templateId).get();
        if (!templateDoc.exists) throw new Error(`Template ${job.templateId} not found`);
        const template = templateDoc.data()!;
        const mockupResult = await generateMockupFromPrintful({
          blueprintId: template.blueprintId || 5,
          printProviderId: template.printProviderId || 39,
          colorName: job.colorName,
          artworkUrl: template.artworkUrl,
          artworkVariant: template.artworkVariant || "black",
          fulfillmentProvider: template.fulfillmentProvider || job.fulfillmentProvider || "printify",
          hasCompositeGraphic: true,
        });
        if ((mockupResult as any).error) throw new Error((mockupResult as any).error);
        const colorKey = job.colorName.replace(/\s+/g, "_").toLowerCase();
        const placementKey = job.placement || "front";
        const sizeKey = job.qrSize || "large";
        const mockupPath = `mockupsByColor.${colorKey}.${placementKey}.${sizeKey}`;
        await db.collection("productTemplates").doc(job.templateId).update({
          [mockupPath]: (mockupResult as any).mockupUrl || null,
          [`mockupsByColor.${colorKey}.${placementKey}.lifestyle`]: (mockupResult as any).lifestyleUrl || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await db.collection("mockup_jobs").doc(jobId).update({
          status: "completed", mockupUrl: (mockupResult as any).mockupUrl || null,
          lifestyleUrl: (mockupResult as any).lifestyleUrl || null,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ jobId, status: "completed" });
        console.log(`[Queue CF] Job ${jobId} completed`);
      } catch (error: any) {
        console.error(`[Queue CF] Job ${jobId} failed:`, error.message);
        await db.collection("mockup_jobs").doc(jobId).update({
          status: "failed", error: error.message, failedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        results.push({ jobId, status: "failed", error: error.message });
      }
    }
    const completed = results.filter(r => r.status === "completed").length;
    const failed = results.filter(r => r.status === "failed").length;
    res.json({ success: true, processed: results.length, completed, failed, recovered: recoveredCount, results, message: `Processed ${results.length} jobs: ${completed} completed, ${failed} failed` });
  } catch (error: any) {
    console.error("[Queue CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});


// ============ PRODUCTS PAGE: MOCKUP PRIORITY ============

app.post('/admin/mockup/priority', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, printProviderId, colorName, colorHex, placement, artworkUrl, qrSize = "medium", fulfillmentProvider = "printify" } = req.body;
    if (!blueprintId || !colorName || !artworkUrl) {
      res.status(400).json({ error: "Missing required fields: blueprintId, colorName, artworkUrl" });
      return;
    }
    console.log(`[Priority Mockup CF] Generating for: ${colorName} @ ${placement}, provider: ${fulfillmentProvider}`);
    const result = await generateMockupFromPrintful({
      blueprintId: parseInt(blueprintId),
      printProviderId: printProviderId ? parseInt(printProviderId) : 0,
      colorName,
      colorHex,
      artworkUrl,
      artworkVariant: "black",
      fulfillmentProvider: fulfillmentProvider as 'printify' | 'printful',
      hasCompositeGraphic: true,
    });
    console.log(`[Priority Mockup CF] Generated: ${(result as any).mockupUrl}`);
    res.json({
      success: true, mockupUrl: (result as any).mockupUrl,
      lifestyleMockupUrl: (result as any).lifestyleUrl || null,
      fromCache: false, generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Priority Mockup CF] Error:", error);
    res.json({ success: false, error: error.message, mockupUrl: null, message: "Mockup generation in progress - check back shortly" });
  }
});

// ============ PRODUCTS PAGE: CONTENT UPLOAD ============

app.post('/admin/content/upload', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { mode, userId, packetId, base64Data, mimeType, fileName } = req.body;
    if (!mode || !userId || !packetId || !base64Data) {
      res.status(400).json({ error: "mode, userId, packetId, and base64Data are required" });
      return;
    }
    const validModes = ['canvas', 'play', 'dynamics', 'basics'];
    if (!validModes.includes(mode)) {
      res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` });
      return;
    }
    const base64Match = base64Data.match(/^data:([^;]+);base64,(.+)$/);
    const actualMimeType = base64Match?.[1] || mimeType || 'image/png';
    const actualBase64 = base64Match?.[2] || base64Data;
    if (!actualBase64 || actualBase64.length === 0) {
      res.status(400).json({ error: 'No file data received' });
      return;
    }
    const buffer = Buffer.from(actualBase64, 'base64');
    if (buffer.length === 0) { res.status(400).json({ error: 'File data is empty after decoding' }); return; }
    const ext = actualMimeType.includes('png') ? 'png' : actualMimeType.includes('mp4') ? 'mp4' : actualMimeType.includes('webm') ? 'webm' : 'jpg';
    const storagePath = `content/${mode}/${userId}/${packetId}/${Date.now()}.${ext}`;
    const bucket = admin.storage().bucket();
    const file = bucket.file(storagePath);
    await file.save(buffer, { metadata: { contentType: actualMimeType } });
    await file.makePublic();
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (mode === 'canvas' || mode === 'basics') { updateData.compositeUrl = publicUrl; }
    else if (mode === 'play') { updateData.playMediaUrl = publicUrl; updateData.playMediaType = actualMimeType; }
    else if (mode === 'dynamics') { updateData.dynamicsMediaUrl = publicUrl; updateData.dynamicsMediaType = actualMimeType; }
    await db.collection("productPackets").doc(packetId).update(updateData);
    console.log(`[Content Upload CF] Uploaded ${mode} content for packet ${packetId}`);
    res.json({ success: true, publicUrl, storagePath, mimeType: actualMimeType, message: `${mode} content uploaded successfully` });
  } catch (error: any) {
    console.error("[Content Upload CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: COMPOSE (QR DYNAMICS) ============

app.get('/admin/published-compose-items', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('packets').where('status', '==', 'published').get();
    const items = snapshot.docs
      .map((doc: any) => ({ id: doc.id, ...doc.data() }))
      .filter((p: any) => ['qr-canvas', 'qr-play'].includes(p.packetType || p.type));
    res.json({ items });
  } catch (error: any) {
    console.error("[ComposeItems CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/compose/publish', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { composeItems, composeMode, composeHostingTerm, productId, blueprintId, color, colorHex } = req.body;
    if (!composeItems || !Array.isArray(composeItems) || composeItems.length === 0) {
      res.status(400).json({ error: 'At least one compose item is required' });
      return;
    }
    const nowEpoch = Math.floor(Date.now() / 1000);
    const instanceData = {
      createdAt: nowEpoch, startTimestamp: nowEpoch,
      mode: composeMode || 'auto-rotate', hostingTerm: composeHostingTerm || '1-year',
      productId: productId || null, blueprintId: blueprintId || null,
      color: color || null, colorHex: colorHex || null,
      slots: composeItems.map((item: any, index: number) => ({
        slotId: item.slotId || `slot-${Date.now()}-${index}`,
        packetId: item.packetId || item.id,
        durationSeconds: item.durationSeconds || 86400,
        order: item.order ?? index + 1,
      })),
    };
    const docRef = await db.collection("qr_dynamics_instances").add(instanceData);
    console.log(`[ComposePublish CF] Created instance ${docRef.id} with ${composeItems.length} slots`);
    res.json({ success: true, instanceId: docRef.id, composeInstanceId: docRef.id });
  } catch (error: any) {
    console.error("[ComposePublish CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: SHELF GROUPS & BUILD SHELF ============

app.get('/admin/shelf-groups', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection("admin_shelf_groups").orderBy("sortOrder", "asc").get();
    const groups = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(groups);
  } catch (error: any) {
    console.error("[BuildShelf CF] List groups error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/shelf-groups', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, sortOrder = 0 } = req.body;
    if (!name || typeof name !== 'string' || name.length === 0) { res.status(400).json({ error: "name is required" }); return; }
    const existing = await db.collection("admin_shelf_groups").where("name", "==", name).get();
    if (!existing.empty) { res.status(409).json({ error: "A group with that name already exists" }); return; }
    const docRef = await db.collection("admin_shelf_groups").add({
      name, sortOrder, createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json({ id: docRef.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Create group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/shelf-groups/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, sortOrder } = req.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) {
      const existing = await db.collection("admin_shelf_groups").where("name", "==", name).get();
      if (!existing.empty && existing.docs[0].id !== req.params.id) { res.status(409).json({ error: "A group with that name already exists" }); return; }
      updates.name = name;
    }
    if (sortOrder !== undefined) updates.sortOrder = sortOrder;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("admin_shelf_groups").doc(req.params.id).update(updates);
    const doc = await db.collection("admin_shelf_groups").doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Update group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/shelf-groups/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection("admin_shelf_groups").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error("[BuildShelf CF] Delete group error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/admin/build-shelf', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { provider, groupId } = req.query;
    let items: any[];
    if (groupId) {
      const snapshot = await db.collection("admin_build_shelf").where("groupIds", "array-contains", groupId).orderBy("createdAt", "desc").get();
      items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } else {
      const snapshot = await db.collection("admin_build_shelf").orderBy("createdAt", "desc").get();
      items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    if (provider) { items = items.filter((item: any) => item.providerId === provider); }
    res.json(items);
  } catch (error: any) {
    console.error("[BuildShelf CF] List items error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/build-shelf', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { providerId, catalogId, catalog, groupIds = [] } = req.body;
    if (!providerId || !catalogId || !catalog) { res.status(400).json({ error: "providerId, catalogId, and catalog are required" }); return; }
    const key = `${providerId}:${catalogId}`;
    const existing = await db.collection("admin_build_shelf").where("shelfKey", "==", key).get();
    if (!existing.empty) {
      await existing.docs[0].ref.update({ catalog, groupIds, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
      const updated = await existing.docs[0].ref.get();
      res.json({ id: updated.id, ...updated.data() });
      return;
    }
    const docRef = await db.collection("admin_build_shelf").add({
      shelfKey: key, providerId, catalogId, catalog, groupIds,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json({ id: docRef.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Add item error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/admin/build-shelf/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updates: Record<string, any> = {};
    if (req.body.groupIds !== undefined) updates.groupIds = req.body.groupIds;
    if (req.body.catalog !== undefined) updates.catalog = req.body.catalog;
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await db.collection("admin_build_shelf").doc(req.params.id).update(updates);
    const doc = await db.collection("admin_build_shelf").doc(req.params.id).get();
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) {
    console.error("[BuildShelf CF] Update item error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/build-shelf/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection("admin_build_shelf").doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error("[BuildShelf CF] Delete item error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============ PRODUCTS PAGE: PRICING SETTINGS SYNC ============

app.post('/admin/pricing-settings/sync', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const pricingDoc = await db.collection("testSettings").doc("pricing").get();
    const pricingSettings = pricingDoc.exists ? pricingDoc.data() : null;
    const markupPercent = pricingSettings?.markupPercent ?? 25;
    const markupFixed = pricingSettings?.markupFixed ?? 0;
    const memberProfitShare = pricingSettings?.memberProfitShare ?? 0.25;
    const additionalPlacementCost = pricingSettings?.additionalPlacementCost ?? 4;
    console.log(`[Pricing Sync CF] Settings: markup=${markupPercent}%, fixed=${markupFixed}, memberShare=${memberProfitShare}`);
    res.json({
      success: true,
      message: "Pricing sync completed",
      settings: { markupPercent, markupFixed, memberProfitShare, additionalPlacementCost },
    });
  } catch (error: any) {
    console.error("[Pricing Sync CF] Error:", error);
    res.status(500).json({ error: error.message });
  }
});


  }
  