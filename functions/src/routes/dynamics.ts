import { readFlubaProviderKey } from '../services/fluba-provider-keys';
import { randomBytes, createHash } from 'crypto';
import { prepareOwnerBuild, ownedMemberBuild, saveMemberArtwork, previewMemberBuild, commitOwnerBuild } from '../services/member-build';
import { prepareOwnerOrder, finalizeMemberPayment } from '../services/order-service';
import { resolveRuntimeConfig } from '../runtime-config';
import { Request, Response, NextFunction } from 'express';
import { ownedDynamicsInstance, updateDynamicsSlots, resolveDynamicsInstance } from '../services/qr-dynamics';
  import express from 'express';
  import Stripe from 'stripe';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { MOSAIC_TEMPLATES_COLLECTION, PRODUCT_PACKETS_COLLECTION, STORE_PRODUCT_LINKS_COLLECTION, DYNAMICS_SURFACES_COLLECTION, CHANNEL_CONTENT_COLLECTION, COLLECTION_ITEMS_COLLECTION, QR_DYNAMICS_INSTANCES_COLLECTION, MEMBER_PACKETS_COLLECTION } from '../constants';
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
    const stripeKey = (await readFlubaProviderKey('STRIPE_SECRET_KEY'));
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
    const stripeKey = (await readFlubaProviderKey('STRIPE_SECRET_KEY'));
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
    const surfaceRef = await db.collection(DYNAMICS_SURFACES_COLLECTION).add(surfaceData);
    res.json({ success: true, surfaceId: surfaceRef.id, message: `Dynamics surface created for ${collectionName}` });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/dynamics/surfaces', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection(DYNAMICS_SURFACES_COLLECTION).orderBy("createdAt", "desc").limit(100).get();
    const surfaces = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null, updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || null }));
    res.json({ success: true, surfaces, count: surfaces.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/public/dynamics/resolve/:surfaceId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { surfaceId } = req.params;
    const surfaceDoc = await db.collection(DYNAMICS_SURFACES_COLLECTION).doc(surfaceId).get();
    if (!surfaceDoc.exists) { res.status(404).json({ error: "Surface not found" }); return; }
    const surface = surfaceDoc.data() as any;
    if (!surface.isEnabled) { res.json({ success: true, surfaceId, isEnabled: false, activeItem: null, message: "Surface is disabled" }); return; }
    const { storeId, channelId, collectionName, rotationInterval, timezone } = surface;
    const linksSnapshot = await db.collection(STORE_PRODUCT_LINKS_COLLECTION).where("storeId", "==", storeId).where("channel", "==", channelId).where("collection", "==", collectionName).orderBy("createdAt", "asc").get();
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
    const contentSnapshot = await db.collection(CHANNEL_CONTENT_COLLECTION).where("storeId", "==", storeId).where("channelId", "==", channelId).get();
    const explicitContent = contentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const channelIdLower = channelId.toLowerCase();
    let packetsSnapshot = await db.collection(PRODUCT_PACKETS_COLLECTION).where("storeId", "==", storeId).where("channelId", "==", channelId).get();
    if (packetsSnapshot.empty && channelId !== channelIdLower) packetsSnapshot = await db.collection(PRODUCT_PACKETS_COLLECTION).where("storeId", "==", storeId).where("channelId", "==", channelIdLower).get();
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
    const docRef = await db.collection(CHANNEL_CONTENT_COLLECTION).add({ storeId, channelId, name, contentType, url, thumbnailUrl: thumbnailUrl || url, metadata: metadata || {}, createdAt: new Date(), updatedAt: new Date() });
    res.json({ success: true, contentId: docRef.id, name });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/stores/:storeId/channels/:channelId/content/:contentId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { contentId } = req.params;
    await db.collection(CHANNEL_CONTENT_COLLECTION).doc(contentId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params;
    const { contentId, contentType, name, url, thumbnailUrl, rotationInterval } = req.body;
    if (!collectionId || !contentId || !contentType || !name || !url) { res.status(400).json({ error: "Missing required fields" }); return; }
    const existingItems = await db.collection(COLLECTION_ITEMS_COLLECTION).where("collectionId", "==", collectionId).orderBy("order", "desc").limit(1).get();
    const maxOrder = existingItems.empty ? 0 : (existingItems.docs[0].data().order || 0);
    const docRef = await db.collection(COLLECTION_ITEMS_COLLECTION).add({ collectionId, contentId, contentType, name, url, thumbnailUrl: thumbnailUrl || url, order: maxOrder + 1, rotationInterval: rotationInterval || 'daily', addedAt: new Date() });
    res.json({ success: true, itemId: docRef.id, order: maxOrder + 1 });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { collectionId } = req.params;
    const itemsSnapshot = await db.collection(COLLECTION_ITEMS_COLLECTION).where("collectionId", "==", collectionId).orderBy("order", "asc").get();
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
    await db.collection(COLLECTION_ITEMS_COLLECTION).doc(itemId).update(updateData);
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/collections/:collectionId/items/:itemId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = req.params;
    await db.collection(COLLECTION_ITEMS_COLLECTION).doc(itemId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/collections/:collectionId/items/reorder', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemOrders } = req.body;
    if (!itemOrders || !Array.isArray(itemOrders)) { res.status(400).json({ error: "itemOrders array is required" }); return; }
    const batch = db.batch();
    for (const { itemId, order } of itemOrders) { batch.update(db.collection(COLLECTION_ITEMS_COLLECTION).doc(itemId), { order, updatedAt: new Date() }); }
    await batch.commit();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/stores/:storeId/channels/:channelId/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { storeId, channelId } = req.params;
    const linksSnapshot = await db.collection(STORE_PRODUCT_LINKS_COLLECTION).where("storeId", "==", storeId).where("channel", "==", channelId).get();
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
    const linksSnapshot = await db.collection(STORE_PRODUCT_LINKS_COLLECTION).where("storeId", "==", storeId).where("channel", "==", channelId).where("collection", "==", collectionName).get();
    const items = linksSnapshot.docs.map(doc => { const data = doc.data(); return { id: doc.id, linkId: doc.id, packetId: data.packetId || null, name: data.productName || "Untitled Product", imageUrl: data.compositeUrl || data.qrOnlyUrl || null, mockupUrl: data.mockupUrl || null, qrProductState: data.qrProductState || null, landingPageUrl: data.landingPageUrl || null, createdAt: data.createdAt?.toDate?.()?.toISOString() || null }; });
    res.json({ success: true, items, collection: collectionName, count: items.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/dynamics/packets', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const storeId = req.query.storeId as string;
    const channelId = req.query.channelId as string;
    if (!storeId) { res.status(400).json({ error: "storeId is required" }); return; }
    const packetsSnapshot = await db.collection(PRODUCT_PACKETS_COLLECTION).where("storeId", "==", storeId).get();
    let docs = packetsSnapshot.docs;
    if (channelId) { const channelIdLower = channelId.toLowerCase(); docs = docs.filter(doc => { const d = doc.data(); return d.channelId === channelId || d.channelId === channelIdLower; }); }
    const packets = docs.map(doc => { const data = doc.data(); if (!data.landingPageSnapshotUrl) return null; let qrType: string = 'qr-canvas'; if ((data.landingPageSnapshotUrl || '').includes('/play/')) qrType = 'qr-play'; return { id: doc.id, packetId: doc.id, name: data.productName || data.landingPageTitle || 'Untitled', qrProductType: qrType, thumbnailUrl: data.landingPageSnapshotUrl, landingPageSlug: data.landingPageSlug, landingPageUrl: data.landingPageSlug ? `/p/${data.landingPageSlug}` : null, storeId: data.storeId, channelId: data.channelId }; }).filter(Boolean);
    res.json({ success: true, packets, count: packets.length });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// Creation is part of the canonical build/sale commit so an instance cannot be orphaned.
app.get('/dynamics/instances', requireAuth, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const docs = await db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).where('ownerId', '==', (req as any).user.uid).get();
    const instances = docs.docs.map(doc => ({ ...doc.data(), id: doc.id })).filter((item: any) => item.status === 'active');
    res.json({ success: true, instances });
  } catch (error: any) { console.error('[QR Dynamics] List failed:', error.message); res.status(500).json({ error: error.message }); }
});

app.post('/dynamics/instances', requireAuth, (_req: Request, res: Response) => {
  res.status(409).json({ error: 'Create the QR experience through the item builder so its ownership and QRG identity are connected.' });
});

app.get('/dynamics/instances/:instanceId', requireAuth, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    const { instance } = await ownedDynamicsInstance((req as any).user.uid, req.params.instanceId);
    res.json({ success: true, instance: { ...instance, id: req.params.instanceId } });
  } catch (error: any) { console.error('[QR Dynamics] Read failed:', error.message); res.status(error.status || 500).json({ error: error.message }); }
});

app.get('/dynamics/instances/:instanceId/preview', requireAuth, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    await ownedDynamicsInstance((req as any).user.uid, req.params.instanceId);
    const { result, targets, instance } = await resolveDynamicsInstance(req.params.instanceId);
    res.json({ success: true, ...result, composeMode: instance.composeMode, destinationUrl: targets[result.activeIndex] });
  } catch (error: any) { console.error('[QR Dynamics] Preview failed:', error.message); res.status(error.status || 500).json({ error: error.message }); }
});

app.put('/dynamics/instances/:instanceId/slots', requireAuth, async (req: Request, res: Response) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    res.json(await updateDynamicsSlots((req as any).user.uid, req.params.instanceId, req.body.slots, req.body.composeMode));
  } catch (error: any) { console.error('[QR Dynamics] Update failed:', error.message); res.status(error.status || 500).json({ error: error.message }); }
});

// The label opens only the public item identity, never ownership, order or claim data.
app.get('/qr/item/:instanceId', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try {
    const id = req.params.instanceId;
    if (!/^[A-Za-z0-9_-]{1,200}$/.test(id)) { res.status(404).type('text').send('Item not found.'); return; }
    const item = (await db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc(id).get()).data();
    if (!item || !['active', 'static'].includes(item.status) || !/^QRG-[1-6][1-9]\d{3}-O-\d{6}$/.test(item.qrgBaseCode || '')) {
      res.status(404).type('text').send('Item not found.'); return;
    }
    const packet = (await db.collection(PRODUCT_PACKETS_COLLECTION).doc(item.packetId).get()).data();
    if (!packet || packet.status !== 'published' || packet.qrgBaseCode !== item.qrgBaseCode || packet.composeInstanceId !== id) {
      res.status(404).type('text').send('Item not found.'); return;
    }
    const link = item.status === 'active' ? `<p><a href="/qr/d/${encodeURIComponent(id)}">Open this item’s QR experience</a></p>` : '';
    res.set('X-Robots-Tag', 'noindex');
    res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR Gear Item</title><style>body{margin:0;background:#0d1b29;color:#edf7ff;font:18px system-ui;min-height:100vh;display:grid;place-items:center}main{padding:32px;max-width:640px}img{width:180px;max-width:100%}h1{font-size:28px}code{display:block;padding:20px 0;font-size:clamp(16px,4vw,24px);color:#82d3ff}a{color:#82d3ff}</style></head><body><main><h1>QR Gear</h1><p>${escapeHtml(String(item.title || 'Your QR Gear item'))}</p><p>Individual item number</p><code>${escapeHtml(item.qrgBaseCode)}</code>${link}</main></body></html>`);
  } catch (error: any) { console.error('[QR Item Label]', error.message); res.status(503).type('text').send('Item information is temporarily unavailable.'); }
});

app.get('/qr/d/:instanceId', async (req: Request, res: Response) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { instance, result, targets } = await resolveDynamicsInstance(req.params.instanceId);
    if (instance.composeMode === 'scan-to-reveal') {
      const urls = JSON.stringify(targets).replace(/</g, '\\u003c');
      const key = JSON.stringify(`qr_str_${req.params.instanceId}`).replace(/</g, '\\u003c');
      res.type('html').send(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>QR Gear</title></head><body><p id="message">Opening your QR experience…</p><script>(function(){var urls=${urls};var key=${key};try{var i=Number(localStorage.getItem(key)||0);if(!Number.isSafeInteger(i)||i<0)i=0;localStorage.setItem(key,String((i+1)%urls.length));location.replace(urls[i%urls.length]);}catch(e){document.getElementById('message').textContent='Allow browser storage to use scan to reveal.';}})();</script><noscript>Enable JavaScript to use scan to reveal.</noscript></body></html>`);
    } else res.redirect(302, targets[result.activeIndex]);
  } catch (error: any) { console.error('[QR Dynamics] Scan failed:', error.message); res.status(error.status || 500).type('text').send(error.message); }
});

// Public builders use the same production schema as member/admin builders.
// The raw capability is returned only on creation; the saved ownerId is its digest.
function ownerKey(req: Request) {
  const token = req.header('X-QR-Build-Token');
  if (!token || !/^[a-f0-9]{64}$/.test(token)) throw Object.assign(new Error('Reopen your build before continuing.'), { status: 403 });
  return createHash('sha256').update(token).digest('hex');
}
function buildError(res: Response, error: any) {
  console.error('[OwnerBuild]', error.message);
  res.status(error.status || 400).json({ error: error.message });
}
app.post('/public/builds', async (req: Request, res: Response) => {
  try {
    const token = randomBytes(32).toString('hex');
    const build = await prepareOwnerBuild(createHash('sha256').update(token).digest('hex'), req.body);
    res.set('Cache-Control', 'no-store').json({ ...build, buildToken: token });
  } catch (error) { buildError(res, error); }
});
app.post('/public/builds/:packetId/artwork', async (req: Request, res: Response) => {
  try { res.json(await saveMemberArtwork(ownerKey(req), req.params.packetId, req.body.placement, req.body.imageData, 'owner')); }
  catch (error) { buildError(res, error); }
});
app.post('/public/builds/:packetId/preview', async (req: Request, res: Response) => {
  try { res.json(await previewMemberBuild(ownerKey(req), req.params.packetId, 'owner')); }
  catch (error) { buildError(res, error); }
});
app.post('/public/checkout', async (req: Request, res: Response) => {
  try {
    const ownerId = ownerKey(req), packetId = req.body.packetId;
    await ownedMemberBuild(ownerId, packetId, 'owner');
    const stripeKey = (await readFlubaProviderKey('STRIPE_SECRET_KEY'));
    if (!stripeKey) throw Object.assign(new Error('Payment not configured.'), { status: 503 });
    const packet = await commitOwnerBuild(ownerId, packetId);
    const prepared = await prepareOwnerOrder(packetId, packet, ownerId);
    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' as any });
    const origin = resolveRuntimeConfig().origin;
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'], mode: 'payment', customer_creation: 'if_required',
      shipping_address_collection: { allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE'] },
      line_items: [{ price_data: { currency: 'usd', unit_amount: prepared.amount,
        product_data: { name: packet.title, description: `${packet.selectedColor} / ${packet.selectedShirtSize}`, images: [packet.mockupUrl] } }, quantity: 1 }],
      success_url: `${origin}/build/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/build`,
      metadata: { source: 'public_wizard', orderId: prepared.orderId, packetId },
    }, { idempotencyKey: `checkout-${prepared.orderId}` });
    await db.collection('orders').doc(prepared.orderId).update({ stripeSessionId: session.id });
    res.json({ url: session.url, total: prepared.amount / 100 });
  } catch (error) { buildError(res, error); }
});
app.get('/public/checkout/verify/:sessionId', async (req: Request, res: Response) => {
  try {
    const key = (await readFlubaProviderKey('STRIPE_SECRET_KEY'));
    if (!key) throw Object.assign(new Error('Payment not configured.'), { status: 503 });
    const session = await new Stripe(key, { apiVersion: '2023-10-16' as any }).checkout.sessions.retrieve(req.params.sessionId);
    if (session.metadata?.source !== 'public_wizard' || !session.metadata.orderId) throw new Error('This session has no canonical owner order. Contact support to reconcile a legacy purchase.');
    res.set('Cache-Control', 'no-store').json(await finalizeMemberPayment(session));
  } catch (error) { buildError(res, error); }
});

}
