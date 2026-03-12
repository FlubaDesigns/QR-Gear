import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import Stripe from 'stripe';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { MOSAIC_TEMPLATES_COLLECTION } from '../constants';
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
  // ============ QR DYNAMICS & RESOLVE ROUTES (Batch 4) ============

app.get('/resolve/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const instanceDoc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!instanceDoc.exists) { res.status(404).json({ error: "Instance not found", redirect: "/not-found" }); return; }
    const instance = instanceDoc.data() as any;
    const isActive = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) > new Date() : true;
    if (!isActive) { res.json({ expired: true, redirect: `/renew/${instanceId}`, message: "Your QR hosting has expired. Please renew to continue." }); return; }
    res.json({ expired: false, destinationUrl: instance.destinationUrl, packetId: instance.packetId, instanceId: instance.instanceId });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/buyer/instances', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid;
    const snapshot = await db.collection('buyer_instances').where('buyerUserId', '==', userId).get();
    const instances = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ instances });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/buyer/instances/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    const instance = doc.data() as any;
    const isActive = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) > new Date() : true;
    res.json({ instance: { id: doc.id, ...instance }, isActive });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/buyer/instances/:instanceId', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { destinationUrl } = req.body;
    const userId = (req as any).user?.uid;
    const doc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    if (doc.data()?.buyerUserId !== userId) { res.status(403).json({ error: "Not authorized" }); return; }
    await db.collection('buyer_instances').doc(instanceId).update({ destinationUrl, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/buyer/instances/:instanceId/renew', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    const instance = doc.data() as any;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const baseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';
    const session = await stripe.checkout.sessions.create({ payment_method_types: ['card'], line_items: [{ price_data: { currency: 'usd', product_data: { name: 'QR Hosting Renewal - 3 Years', description: 'Extend your QR hosting for another 3 years' }, unit_amount: 499 }, quantity: 1 }], mode: 'payment', success_url: `${baseUrl}/renew/${instanceId}/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl}/renew/${instanceId}`, metadata: { instanceId, type: 'hosting_renewal' }, customer_email: instance.buyerEmail });
    res.json({ url: session.url, sessionId: session.id });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/buyer/instances/:instanceId/verify-renewal', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { sessionId } = req.body;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') { res.status(400).json({ error: "Payment not completed" }); return; }
    if (session.metadata?.instanceId !== instanceId) { res.status(400).json({ error: "Session does not match instance" }); return; }
    const doc = await db.collection('buyer_instances').doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    const instance = doc.data() as any;
    const currentExpiry = instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) : new Date();
    const base = currentExpiry > new Date() ? currentExpiry : new Date();
    const newExpiry = new Date(base.getTime() + 3 * 365 * 24 * 60 * 60 * 1000);
    await db.collection('buyer_instances').doc(instanceId).update({ hostingExpiresAt: newExpiry.toISOString(), renewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ success: true, instance: { ...instance, hostingExpiresAt: newExpiry.toISOString() }, newExpirationDate: newExpiry.toISOString() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/dynamics/surfaces', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, storeId, channelId, collectionName, rotationInterval, timezone, isEnabled } = req.body;
    if (!storeId || !channelId || !collectionName) { res.status(400).json({ error: "storeId, channelId, and collectionName are required" }); return; }
    const surfaceData = { name: name || `Dynamics - ${collectionName}`, storeId, channelId, collectionName, rotationInterval: rotationInterval || "daily", timezone: timezone || "America/New_York", isEnabled: isEnabled !== false, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
    const surfaceRef = await db.collection("qrDynamicsSurfaces").add(surfaceData);
    res.json({ success: true, surfaceId: surfaceRef.id, message: `Dynamics surface created for ${collectionName}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/dynamics/surfaces', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection("qrDynamicsSurfaces").orderBy("createdAt", "desc").limit(100).get();
    const surfaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null, updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null }));
    res.json({ success: true, surfaces, count: surfaces.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/public/dynamics/resolve/:surfaceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const surfaceDoc = await db.collection("qrDynamicsSurfaces").doc(surfaceId).get();
    if (!surfaceDoc.exists) { res.status(404).json({ error: "Surface not found" }); return; }
    const surface = surfaceDoc.data() as any;
    if (!surface.isEnabled) { res.json({ success: true, surfaceId, isEnabled: false, activeItem: null, message: "Surface is disabled" }); return; }
    const { storeId, channelId, collectionName, rotationInterval, timezone } = surface;
    const linksSnapshot = await db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).where("collection", "==", collectionName).orderBy("createdAt", "asc").get();
    if (linksSnapshot.empty) { res.json({ success: true, surfaceId, isEnabled: true, activeItem: null, message: "No items in collection" }); return; }
    const items = linksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const now = new Date();
    const tz = timezone || "America/New_York";
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hour12: false });
    const parts = fmt.formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
    const year = Number(get("year")); const month = Number(get("month")); const day = Number(get("day"));
    let indexKey: number;
    if (rotationInterval === "daily") indexKey = year * 10000 + month * 100 + day;
    else if (rotationInterval === "weekly") { const startOfYear = new Date(year, 0, 1); indexKey = year * 100 + Math.floor((now.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000) / 7); }
    else indexKey = year * 100 + month;
    const activeIndex = indexKey % items.length;
    const activeItem = items[activeIndex] as any;
    res.json({ success: true, serverNowIso: now.toISOString(), surfaceId, isEnabled: true, rotationInterval, timezone: tz, totalItems: items.length, activeIndex, activeItem: { id: activeItem.id, packetId: activeItem.packetId, name: activeItem.productName || "Untitled", imageUrl: activeItem.compositeUrl || activeItem.qrOnlyUrl, mockupUrl: activeItem.mockupUrl, landingPageUrl: activeItem.landingPageUrl, qrProductState: activeItem.qrProductState }, nextSwitch: rotationInterval === "daily" ? "Midnight (local time)" : rotationInterval === "weekly" ? "Sunday midnight" : "1st of next month" });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/stores/:storeId/channels/:channelId/content', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const contentSnapshot = await db.collection("dynamicsChannelContent").where("storeId", "==", storeId).where("channelId", "==", channelId).get();
    const explicitContent = contentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const channelIdLower = channelId.toLowerCase();
    let packetsSnapshot = await db.collection("productPackets").where("storeId", "==", storeId).where("channelId", "==", channelId).get();
    if (packetsSnapshot.empty && channelId !== channelIdLower) packetsSnapshot = await db.collection("productPackets").where("storeId", "==", storeId).where("channelId", "==", channelIdLower).get();
    const packetContent = packetsSnapshot.docs.map(doc => { const data = doc.data(); if (data.landingPageSnapshotUrl) { return { id: `packet-${doc.id}`, storeId, channelId, name: data.productName || data.landingPageTitle || 'Landing Page', contentType: 'image', url: data.landingPageSnapshotUrl, thumbnailUrl: data.landingPageSnapshotUrl, sourceType: 'packet', packetId: doc.id, landingPageSlug: data.landingPageSlug }; } return null; }).filter(Boolean);
    const content = [...explicitContent, ...packetContent];
    res.json({ success: true, content, count: content.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/stores/:storeId/channels/:channelId/content', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const { name, contentType, url, thumbnailUrl, metadata } = req.body;
    if (!name || !contentType || !url) { res.status(400).json({ error: "name, contentType, and url are required" }); return; }
    const docRef = await db.collection("dynamicsChannelContent").add({ storeId, channelId, name, contentType, url, thumbnailUrl: thumbnailUrl || url, metadata: metadata || {}, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, contentId: docRef.id, name });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/stores/:storeId/channels/:channelId/content/:contentId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params;
    await db.collection("dynamicsChannelContent").doc(contentId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params;
    const { contentId, contentType, name, url, thumbnailUrl, rotationInterval } = req.body;
    if (!collectionId || !contentId || !contentType || !name || !url) { res.status(400).json({ error: "Missing required fields" }); return; }
    const existingItems = await db.collection("dynamicsCollectionItems").where("collectionId", "==", collectionId).orderBy("order", "desc").limit(1).get();
    const maxOrder = existingItems.empty ? 0 : (existingItems.docs[0].data().order || 0);
    const docRef = await db.collection("dynamicsCollectionItems").add({ collectionId, contentId, contentType, name, url, thumbnailUrl: thumbnailUrl || url, order: maxOrder + 1, rotationInterval: rotationInterval || 'daily', addedAt: new Date() });
    res.json({ success: true, itemId: docRef.id, order: maxOrder + 1 });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params;
    const itemsSnapshot = await db.collection("dynamicsCollectionItems").where("collectionId", "==", collectionId).orderBy("order", "asc").get();
    const items = itemsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ success: true, items, count: items.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/collections/:collectionId/items/:itemId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    const { order, rotationInterval } = req.body;
    const updateData: any = { updatedAt: new Date() };
    if (order !== undefined) updateData.order = order;
    if (rotationInterval) updateData.rotationInterval = rotationInterval;
    await db.collection("dynamicsCollectionItems").doc(itemId).update(updateData);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/collections/:collectionId/items/:itemId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    await db.collection("dynamicsCollectionItems").doc(itemId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/collections/:collectionId/items/reorder', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemOrders } = req.body;
    if (!itemOrders || !Array.isArray(itemOrders)) { res.status(400).json({ error: "itemOrders array is required" }); return; }
    const batch = db.batch();
    for (const { itemId, order } of itemOrders) { batch.update(db.collection("dynamicsCollectionItems").doc(itemId), { order, updatedAt: new Date() }); }
    await batch.commit();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const linksSnapshot = await db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).get();
    const collectionsSet = new Set<string>();
    linksSnapshot.docs.forEach(doc => { const c = doc.data().collection; if (c) collectionsSet.add(c); });
    const explicitSnapshot = await db.collection(MOSAIC_TEMPLATES_COLLECTION).where("storeId", "==", storeId).where("channelId", "==", channelId).get();
    explicitSnapshot.docs.forEach(doc => { const n = doc.data().name; if (n) collectionsSet.add(n); });
    const collections = Array.from(collectionsSet).sort();
    res.json({ success: true, collections, count: collections.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const { name } = req.body;
    if (!name) { res.status(400).json({ error: "name is required" }); return; }
    const docRef = await db.collection(MOSAIC_TEMPLATES_COLLECTION).add({ storeId, channelId, name, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, collectionId: docRef.id, name });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/stores/:storeId/channels/:channelId/collections/:collectionName/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId, collectionName } = req.params;
    const linksSnapshot = await db.collection("storeProductLinks").where("storeId", "==", storeId).where("channel", "==", channelId).where("collection", "==", collectionName).get();
    const items = linksSnapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, linkId: doc.id, packetId: data.packetId || null, name: data.productName || "Untitled Product", imageUrl: data.compositeUrl || data.qrOnlyUrl || null, mockupUrl: data.mockupUrl || null, qrProductState: data.qrProductState || null, landingPageUrl: data.landingPageUrl || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null }; });
    res.json({ success: true, items, collection: collectionName, count: items.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamics/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string;
    const channelId = req.query.channelId as string;
    if (!storeId) { res.status(400).json({ error: "storeId is required" }); return; }
    const packetsSnapshot = await db.collection("productPackets").where("storeId", "==", storeId).get();
    let docs = packetsSnapshot.docs;
    if (channelId) { const channelIdLower = channelId.toLowerCase(); docs = docs.filter(doc => { const d = doc.data(); return d.channelId === channelId || d.channelId === channelIdLower; }); }
    const packets = docs.map(doc => { const data = doc.data(); if (!data.landingPageSnapshotUrl) return null; let qrType: string = 'qr-canvas'; if ((data.landingPageSnapshotUrl || '').includes('/play/')) qrType = 'qr-play'; return { id: doc.id, packetId: doc.id, name: data.productName || data.landingPageTitle || 'Untitled', qrProductType: qrType, thumbnailUrl: data.landingPageSnapshotUrl, landingPageSlug: data.landingPageSlug, landingPageUrl: data.landingPageSlug ? `/p/${data.landingPageSlug}` : null, storeId: data.storeId, channelId: data.channelId }; }).filter(Boolean);
    res.json({ success: true, packets, count: packets.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/dynamics/instances', async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId, collectionId, slots, fallbackUrl } = req.body;
    if (!slots || !Array.isArray(slots) || slots.length === 0) { res.status(400).json({ error: "slots array is required" }); return; }
    const nowEpoch = Math.floor(Date.now() / 1000);
    const instanceData = { orderId: orderId || null, collectionId: collectionId || null, createdAt: nowEpoch, startTimestamp: nowEpoch, mode: 'loop', fallbackUrl: fallbackUrl || null, slots: slots.map((slot: any, index: number) => ({ slotId: slot.slotId || `slot-${Date.now()}-${index}`, packetId: slot.packetId, durationSeconds: slot.durationSeconds || 86400, order: slot.order ?? index + 1 })) };
    const docRef = await db.collection("qr_dynamics_instances").add(instanceData);
    res.json({ success: true, instanceId: docRef.id, resolverUrl: `/qr/d/${docRef.id}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamics/instances/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection("qr_dynamics_instances").doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    res.json({ success: true, instance: { id: doc.id, ...doc.data() } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamics/instances/:instanceId/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection("qr_dynamics_instances").doc(instanceId).get();
    if (!doc.exists) { res.status(404).json({ error: "Instance not found" }); return; }
    const instance = doc.data() as any;
    const slots = instance.slots || [];
    if (slots.length === 0) { res.json({ success: true, activeSlot: null, message: "No slots configured" }); return; }
    const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);
    const nowEpoch = Math.floor(Date.now() / 1000);
    const elapsed = nowEpoch - instance.startTimestamp;
    let cycleLength = 0;
    for (const slot of sortedSlots) cycleLength += slot.durationSeconds;
    if (cycleLength <= 0) { res.status(500).json({ error: "Invalid cycle length" }); return; }
    const position = elapsed % cycleLength;
    let running = 0; let activeSlot = null; let activeIndex = 0;
    for (let i = 0; i < sortedSlots.length; i++) { running += sortedSlots[i].durationSeconds; if (position < running) { activeSlot = sortedSlots[i]; activeIndex = i; break; } }
    let packetDetails = null;
    if (activeSlot) { const packetDoc = await db.collection("productPackets").doc(activeSlot.packetId).get(); if (packetDoc.exists) { const pd = packetDoc.data() as any; packetDetails = { name: pd.productName || pd.landingPageTitle || 'Untitled', thumbnailUrl: pd.landingPageSnapshotUrl, landingPageSlug: pd.landingPageSlug, qrProductType: pd.qrProductType }; } }
    let timeRemainingSeconds = 0;
    if (activeSlot) { const slotStart = running - activeSlot.durationSeconds; timeRemainingSeconds = activeSlot.durationSeconds - (position - slotStart); }
    res.json({ success: true, nowEpoch, elapsed, cycleLength, position, activeIndex, totalSlots: sortedSlots.length, activeSlot: activeSlot ? { ...activeSlot, packet: packetDetails } : null, timeRemainingSeconds, nextSlotIndex: (activeIndex + 1) % sortedSlots.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/dynamics/instances/:instanceId/slots', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const { slots } = req.body;
    if (!slots || !Array.isArray(slots)) { res.status(400).json({ error: "slots array is required" }); return; }
    const nowEpoch = Math.floor(Date.now() / 1000);
    await db.collection("qr_dynamics_instances").doc(instanceId).update({ slots: slots.map((slot: any, index: number) => ({ slotId: slot.slotId || `slot-${Date.now()}-${index}`, packetId: slot.packetId, durationSeconds: slot.durationSeconds || 86400, order: slot.order ?? index + 1 })), startTimestamp: nowEpoch });
    res.json({ success: true, instanceId, newStartTimestamp: nowEpoch });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/qr/d/:instanceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { instanceId } = req.params;
    const doc = await db.collection("qr_dynamics_instances").doc(instanceId).get();
    if (!doc.exists) { res.status(404).send("QR Dynamics instance not found"); return; }
    const instance = doc.data() as any;
    const slots = instance.slots || [];
    if (slots.length === 0) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(404).send("No content configured"); return; }
    const sortedSlots = [...slots].sort((a: any, b: any) => a.order - b.order);
    if (instance.composeMode === 'scan-to-reveal') {
      const slotPacketIds = sortedSlots.map((s: any) => s.packetId);
      const packetSlugs: string[] = [];
      for (const pid of slotPacketIds) { let pDoc = await db.collection("productPackets").doc(pid).get(); if (!pDoc.exists) pDoc = await db.collection("memberPackets").doc(pid).get(); const pData = pDoc.exists ? pDoc.data() : null; packetSlugs.push((pData as any)?.landingPageSlug || ''); }
      const validSlugs = packetSlugs.filter(s => s !== '');
      if (validSlugs.length === 0) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(404).send("No content configured"); return; }
      const slugsJson = JSON.stringify(validSlugs);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Loading...</title></head><body><script>(function(){var k='qr_str_'+${JSON.stringify(instanceId)};var slugs=${slugsJson};var idx=parseInt(localStorage.getItem(k)||'0',10);if(isNaN(idx)||idx<0)idx=0;var current=idx%slugs.length;localStorage.setItem(k,String(idx+1));window.location.replace('/p/'+slugs[current]);})();</script><noscript><p>JavaScript is required.</p></noscript></body></html>`;
      res.status(200).type('html').send(html); return;
    }
    const nowEpoch = Math.floor(Date.now() / 1000);
    const elapsed = nowEpoch - instance.startTimestamp;
    let cycleLength = 0;
    for (const slot of sortedSlots) cycleLength += slot.durationSeconds;
    if (cycleLength <= 0) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(500).send("Invalid config"); return; }
    const position = elapsed % cycleLength;
    let running = 0; let activeSlot = null;
    for (const slot of sortedSlots) { running += slot.durationSeconds; if (position < running) { activeSlot = slot; break; } }
    if (!activeSlot) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(500).send("Unable to resolve slot"); return; }
    let packetDoc = await db.collection("productPackets").doc(activeSlot.packetId).get();
    if (!packetDoc.exists) packetDoc = await db.collection("memberPackets").doc(activeSlot.packetId).get();
    if (!packetDoc.exists) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(404).send("Content not available"); return; }
    const packetData = packetDoc.data() as any;
    if (!packetData.landingPageSlug) { if (instance.fallbackUrl) { res.redirect(302, instance.fallbackUrl); return; } res.status(404).send("Landing page not configured"); return; }
    res.redirect(302, `/p/${packetData.landingPageSlug}`);
  } catch (error: any) { res.status(500).send("QR Dynamics error"); }
});

// ============ TEMP PACKETS & PUBLIC WIZARD (Batch 5) ============

app.post('/public/packets', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const packetData = stripUndef({ status: 'building', ...req.body, createdAt: now.toISOString(), updatedAt: now.toISOString(), expiresAt: expiresAt.toISOString() });
    if (packetData.headerStyle) packetData.headerStyle = sanitizeStyleForFirestore(packetData.headerStyle);
    if (packetData.footerStyle) packetData.footerStyle = sanitizeStyleForFirestore(packetData.footerStyle);
    const docRef = await db.collection('temp_packets').add(packetData);
    res.json({ success: true, tempPacketId: docRef.id, expiresAt: expiresAt.toISOString() });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.patch('/public/packets/:tempPacketId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempPacketId } = req.params;
    const docRef = db.collection('temp_packets').doc(tempPacketId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ success: false, error: "Temp packet not found" }); return; }
    if (doc.data()?.status === 'completed') { res.status(400).json({ success: false, error: "Packet already completed" }); return; }
    const tempClean = stripUndef({ ...req.body, updatedAt: new Date().toISOString() });
    if (tempClean.headerStyle) tempClean.headerStyle = sanitizeStyleForFirestore(tempClean.headerStyle);
    if (tempClean.footerStyle) tempClean.footerStyle = sanitizeStyleForFirestore(tempClean.footerStyle);
    await docRef.update(tempClean);
    res.json({ success: true, tempPacketId });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/public/packets/:tempPacketId/complete', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempPacketId } = req.params;
    const docRef = db.collection('temp_packets').doc(tempPacketId);
    const doc = await docRef.get();
    if (!doc.exists) { res.status(404).json({ success: false, error: "Temp packet not found" }); return; }
    await docRef.update({ status: 'completed', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ success: true, tempPacketId });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.delete('/public/packets/cleanup/expired', async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const expiredQuery = await db.collection('temp_packets').where('status', '==', 'building').where('expiresAt', '<', now).limit(100).get();
    let deletedCount = 0;
    const batch = db.batch();
    expiredQuery.docs.forEach(doc => { batch.delete(doc.ref); deletedCount++; });
    if (deletedCount > 0) await batch.commit();
    res.json({ success: true, deletedCount });
  } catch (error: any) { res.status(500).json({ success: false, error: error.message }); }
});

app.post('/public/checkout', async (req: Request, res: Response): Promise<void> => {
  try {
    const { tempPacketId } = req.body;
    if (!tempPacketId) { res.status(400).json({ error: "Missing tempPacketId" }); return; }
    const packetDoc = await db.collection('temp_packets').doc(tempPacketId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Temp packet not found" }); return; }
    const packet = packetDoc.data()!;
    if (packet.status === 'completed') { res.status(400).json({ error: "Already purchased" }); return; }
    const pricingDoc = await db.collection("testSettings").doc("pricing").get();
    const ps = pricingDoc.exists ? pricingDoc.data() : null;
    const defaultSU: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const sizeUpcharges = ps?.sizeUpcharges || defaultSU;
    const additionalPlacementCost = ps?.additionalPlacementCost ?? 4;
    const textLineUpcharge = ps?.textLineUpcharge ?? 2;
    const basePrice = parseFloat(packet.retailPrice) || ps?.baseRetailPrice || 29.99;
    const selectedSize = packet.selectedShirtSize || packet.selectedSize || 'M';
    const sizeUpcharge = sizeUpcharges[selectedSize] || 0;
    const placements = packet.selectedPlacements || ['front'];
    const placementCost = Math.max(0, placements.length - 1) * additionalPlacementCost;
    const textLayout = packet.textLayoutChoice || '';
    let textCostLines = 0;
    if (textLayout === 'both') textCostLines = 2;
    else if (textLayout === 'header' || textLayout === 'footer') textCostLines = 1;
    const textCost = textCostLines * textLineUpcharge;
    const serverTotal = Math.round((basePrice + sizeUpcharge + placementCost + textCost) * 100) / 100;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const productTitle = packet.productTitle || 'QR Gear Custom Product';
    const baseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';
    const session = await stripe.checkout.sessions.create({ payment_method_types: ['card'], line_items: [{ price_data: { currency: 'usd', product_data: { name: productTitle, images: packet.mockupUrl ? [packet.mockupUrl.startsWith('http') ? packet.mockupUrl : `${baseUrl}${packet.mockupUrl}`] : [] }, unit_amount: Math.round(serverTotal * 100) }, quantity: 1 }], mode: 'payment', success_url: `${baseUrl}/build/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${baseUrl}/build`, metadata: { tempPacketId, source: 'public_wizard', serverTotal: serverTotal.toString() }, customer_creation: 'if_required' });
    await packetDoc.ref.update({ stripeSessionId: session.id, serverCalculatedTotal: serverTotal, checkoutCreatedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ url: session.url, sessionId: session.id, total: serverTotal });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/public/checkout/verify/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { sessionId } = req.params;
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) { res.status(503).json({ error: "Payment not configured" }); return; }
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') { res.status(400).json({ error: "Payment not completed" }); return; }
    const tempPacketId = session.metadata?.tempPacketId;
    if (!tempPacketId) { res.status(400).json({ error: "No packet linked" }); return; }
    const existingOrderQuery = await db.collection('orders_public').where('stripeSessionId', '==', sessionId).limit(1).get();
    if (!existingOrderQuery.empty) { const existingOrder = existingOrderQuery.docs[0].data(); res.json({ success: true, alreadyProcessed: true, order: { id: existingOrderQuery.docs[0].id, ...existingOrder } }); return; }
    const packetDoc = await db.collection('temp_packets').doc(tempPacketId).get();
    if (!packetDoc.exists) { res.status(404).json({ error: "Temp packet not found" }); return; }
    const packet = packetDoc.data()!;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let claimCode = '';
    for (let i = 0; i < 8; i++) claimCode += chars.charAt(Math.floor(Math.random() * chars.length));
    const buyerEmail = (session.customer_details as any)?.email || '';
    const buyerName = (session.customer_details as any)?.name || '';
    const now = new Date();
    const realPacketData = { ...packet, status: 'purchased', source: 'public_wizard', buyerEmail, buyerName, stripeSessionId: sessionId, stripePaymentIntentId: session.payment_intent as string, purchasedAt: now.toISOString(), createdAt: packet.createdAt || now.toISOString(), updatedAt: now.toISOString() } as any;
    delete realPacketData.expiresAt; delete realPacketData.checkoutCreatedAt; delete realPacketData.serverCalculatedTotal;
    const realPacketRef = await db.collection('product_packets').add(realPacketData);
    const serverTotal = parseFloat(packet.serverCalculatedTotal || (session as any).amount_total! / 100);
    const orderData = { tempPacketId, realPacketId: realPacketRef.id, stripeSessionId: sessionId, stripePaymentIntentId: session.payment_intent as string, buyerEmail, buyerName, claimCode, productTitle: packet.productTitle || 'QR Gear Product', qrType: packet.qrType || 'qr-basic', selectedColor: packet.selectedColor || '', selectedSize: packet.selectedShirtSize || packet.selectedSize || 'M', totalAmount: serverTotal, mockupUrl: packet.mockupUrl || null, lifestyleMockupUrl: packet.lifestyleMockupUrl || null, status: 'paid', graphicRetainedUntil: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(), createdAt: now.toISOString(), updatedAt: now.toISOString() };
    const orderRef = await db.collection('orders_public').add(orderData);
    await packetDoc.ref.update({ status: 'completed', completedAt: now.toISOString(), realPacketId: realPacketRef.id, orderId: orderRef.id, updatedAt: now.toISOString() });
    res.json({ success: true, order: { id: orderRef.id, ...orderData }, realPacketId: realPacketRef.id, claimCode });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});


  }
  