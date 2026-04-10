import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { PLATFORM_STORE_ID } from '../constants';
import { verifyAuth, requireAuth, requireAdmin, verifyMemberAuthCF, ADMIN_USER_IDS } from '../middleware';
import { printfulClient, updatePrintfulKeyCache } from '../services/printful';
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
  // ============ BATCH: REMAINING ADMIN & MISC ROUTES ============

app.get('/admin/dashboard/metrics', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [productsSnap, ordersSnap, customersSnap, packetsSnap] = await Promise.all([
      db.collection('products').get(),
      db.collection('orders').get(),
      db.collection('customers').get(),
      db.collection('product_packets').get(),
    ]);
    const orders = ordersSnap.docs.map((d: any) => d.data());
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let revenueToday = 0, revenueWeek = 0, revenueMonth = 0;
    let pendingCount = 0, productionCount = 0, shippedCount = 0;
    for (const o of orders) {
      const amount = o.totalAmount || 0;
      const created = o.createdAt || '';
      if (created >= todayStart) revenueToday += amount;
      if (created >= weekAgo) revenueWeek += amount;
      if (created >= monthAgo) revenueMonth += amount;
      if (o.status === 'pending') pendingCount++;
      if (o.status === 'routed' || o.status === 'in_production') productionCount++;
      if (o.status === 'shipped') shippedCount++;
    }

    const newCustomersThisWeek = customersSnap.docs.filter((d: any) => {
      const c = d.data();
      return (c.createdAt || '') >= weekAgo;
    }).length;

    res.json({
      revenue: { today: revenueToday, week: revenueWeek, month: revenueMonth, trend: 0 },
      orders: { total: ordersSnap.size, pending: pendingCount, inProduction: productionCount, shipped: shippedCount, trend: 0 },
      customers: { total: customersSnap.size, newThisWeek: newCustomersThisWeek, returning: 0 },
      products: { active: productsSnap.size, lowStock: 0, syncErrors: 0 },
      health: { printify: 'healthy', stripe: 'healthy', lastCheck: now.toISOString() },
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/customers', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    let snapshot;
    try {
      snapshot = await db.collection('customers').orderBy('createdAt', 'desc').limit(100).get();
    } catch {
      snapshot = await db.collection('customers').limit(100).get();
    }
    const ordersSnap = await db.collection('orders').get();
    const ordersByCustomer: Record<string, { count: number; total: number; lastDate: string | null }> = {};
    for (const od of ordersSnap.docs) {
      const o = od.data() as any;
      const cid = o.customerId || o.userId || '';
      if (!cid) continue;
      if (!ordersByCustomer[cid]) ordersByCustomer[cid] = { count: 0, total: 0, lastDate: null };
      ordersByCustomer[cid].count++;
      ordersByCustomer[cid].total += (o.totalAmount || 0);
      const d = o.createdAt || null;
      if (d && (!ordersByCustomer[cid].lastDate || d > ordersByCustomer[cid].lastDate)) {
        ordersByCustomer[cid].lastDate = d;
      }
    }
    const customers = snapshot.docs.map((d: any) => {
      const data = d.data();
      const stats = ordersByCustomer[d.id] || { count: 0, total: 0, lastDate: null };
      return {
        id: d.id,
        email: data.email || null,
        firstName: data.firstName || data.displayName?.split(' ')[0] || null,
        lastName: data.lastName || data.displayName?.split(' ').slice(1).join(' ') || null,
        profileImageUrl: data.profileImageUrl || data.photoURL || null,
        createdAt: data.createdAt || null,
        orderCount: stats.count,
        totalSpent: stats.total,
        lastOrderDate: stats.lastDate,
      };
    });
    res.json(customers);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/customers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('customers').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Customer not found" }); return; }
    const data = doc.data() as any;
    const ordersSnap = await db.collection('orders')
      .where('customerId', '==', req.params.id).orderBy('createdAt', 'desc').limit(20).get()
      .catch(() => db.collection('orders').where('customerId', '==', req.params.id).limit(20).get());
    const recentOrders = ordersSnap.docs.map((od: any) => ({ id: od.id, ...od.data() }));
    const totalSpent = recentOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
    const customer = {
      id: doc.id,
      email: data.email || null,
      firstName: data.firstName || data.displayName?.split(' ')[0] || null,
      lastName: data.lastName || data.displayName?.split(' ').slice(1).join(' ') || null,
      profileImageUrl: data.profileImageUrl || data.photoURL || null,
      createdAt: data.createdAt || null,
      orderCount: recentOrders.length,
      totalSpent,
      lastOrderDate: recentOrders[0]?.createdAt || null,
    };
    res.json({ customer, recentOrders });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/email-templates', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('email_templates').get();
    const templates = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ templates });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/email-templates', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('email_templates').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('email_templates').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('email_templates').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/email-logs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const snapshot = await db.collection('email_logs').orderBy('sentAt', 'desc').limit(limit).get();
    const logs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ logs });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/collections', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('collections').get();
    const collections = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ collections });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/collections', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('collections').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('collection_items').where('collectionId', '==', req.params.collectionId).get();
    const items = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ items });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/collections/:collectionId/items', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('collection_items').add({ ...req.body, collectionId: req.params.collectionId, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/collections/:collectionId/items/:itemId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('collection_items').doc(req.params.itemId).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/collections/:collectionId/items/reorder', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body;
    const batch = db.batch();
    items.forEach((item: any, index: number) => {
      batch.update(db.collection('collection_items').doc(item.id), { sortOrder: index });
    });
    await batch.commit();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/coupons', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('coupons').get();
    const coupons = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ coupons });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/coupons', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('coupons').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/coupons/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('coupons').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/coupons/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('coupons').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/coupons/validate', async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ valid: false, error: "Code is required" }); return; }
    const snapshot = await db.collection('coupons').where('code', '==', code.toUpperCase()).limit(1).get();
    if (snapshot.empty) { res.json({ valid: false, error: "Invalid coupon code" }); return; }
    const coupon = snapshot.docs[0].data();
    if (!coupon.isActive) { res.json({ valid: false, error: "Coupon is expired" }); return; }
    res.json({ valid: true, coupon: { id: snapshot.docs[0].id, ...coupon } });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/custom-designs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('custom_designs').orderBy('createdAt', 'desc').get();
    const designs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ designs });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/custom-designs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('custom_designs').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.put('/admin/custom-designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('custom_designs').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/custom-designs/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('custom_designs').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

// ============ BATCH: ORCHESTRATION ROUTES ============

app.get('/admin/orchestration/master-products', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('master_catalog').orderBy('createdAt', 'desc').get();
    const products = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ products });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/orchestration/master-products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('master_catalog').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/orchestration/master-products', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('master_catalog').add({ ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/orchestration/master-products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('master_catalog').doc(req.params.id).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.delete('/admin/orchestration/master-products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('master_catalog').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/orchestration/channel-configs', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('channel_configs').get();
    const configs = snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    res.json({ configs });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/orchestration/channel-configs/:channelType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('channel_configs').doc(req.params.channelType).get();
    if (!doc.exists) { res.status(404).json({ error: "Config not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/orchestration/channel-configs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { channelType, ...configData } = req.body;
    await db.collection('channel_configs').doc(channelType).set({ ...configData, channelType, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/orchestration/channel-configs/:channelType', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('channel_configs').doc(req.params.channelType).update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/orchestration/routing/route', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('routing_decisions').add({ ...req.body, createdAt: new Date().toISOString() });
    res.json({ id: docRef.id, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.post('/admin/orchestration/routing/batch', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { routes } = req.body;
    const batch = db.batch();
    const ids: string[] = [];
    for (const route of routes) {
      const ref = db.collection('routing_decisions').doc();
      batch.set(ref, { ...route, createdAt: new Date().toISOString() });
      ids.push(ref.id);
    }
    await batch.commit();
    res.json({ ids, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});



  }
