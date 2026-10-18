import { changeEmailTemplate } from '../services/email-template-settings';
import { orderDate, orderNetRevenueCents, orderNeedsFulfillment, orderInProduction } from '../services/order-reporting';
import { customerDirectory, customerSummary, ordersForCustomer } from '../services/customer-reporting';
import {validateCoupon} from '../services/coupons';
import {HealthMonitorService} from '../services/health-monitor';
import { Request, Response, NextFunction } from 'express';
  import express from 'express';
  import { admin, db, storage, docToObject, docsToArray, stripUndef, sanitizeStyleForFirestore, generateNanoId, escapeHtml, generateGiftCode, FulfillmentProvider, PrintMethod, normalizePlacement, normalizePlacements, toProviderPlacement, isEmbroideryPlacement, groupPlacementsByLocation, detectPrintMethod, QR_GEAR_BRANDED_TAG_URL, LABEL_PLACEMENTS_PRINTFUL, isValidHexColor, isColorDark, PRINTIFY_TO_INTERNAL, PRINTFUL_TO_INTERNAL, INTERNAL_TO_PRINTFUL, INTERNAL_TO_PRINTFUL_DTF } from '../core';
import { PLATFORM_STORE_ID } from '../constants';
import { isValidMasterCatalogDocId } from '../../../shared/qrgCodes';
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
    const [productsSnap, ordersSnap, directory] = await Promise.all([
      db.collection('products').get(),
      db.collection('orders').get(),
      customerDirectory(db),
    ]);
    const orders = ordersSnap.docs.map((d: any) => d.data());
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    let revenueToday = 0, revenueWeek = 0, revenueMonth = 0;
    let pendingCount = 0, productionCount = 0, shippedCount = 0;
    for (const o of orders) {
      const amount = orderNetRevenueCents(o);
      const created = orderDate(o.paymentVerifiedAt || o.createdAt) || '';
      if (created >= todayStart) revenueToday += amount;
      if (created >= weekAgo) revenueWeek += amount;
      if (created >= monthAgo) revenueMonth += amount;
      if (orderNeedsFulfillment(o)) pendingCount++;
      if (orderInProduction(o)) productionCount++;
      if (o.status === 'shipped') shippedCount++;
    }

    const newCustomersThisWeek = [...directory.records.values()].filter(c => (orderDate(c.createdAt) || '') >= weekAgo).length;

    res.json({
      revenue: { today: revenueToday / 100, week: revenueWeek / 100, month: revenueMonth / 100, trend: 0 },
      orders: { total: ordersSnap.size, pending: pendingCount, inProduction: productionCount, shipped: shippedCount, trend: 0 },
      customers: { total: directory.records.size, newThisWeek: newCustomersThisWeek, returning: 0 },
      products: { active: productsSnap.size, lowStock: 0, syncErrors: 0 },
      health: Object.fromEntries((await new HealthMonitorService(db).getOverview()).providers.map(p=>[p.provider,p.status])),
    });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/customers', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const [directory, ordersSnap] = await Promise.all([customerDirectory(db), db.collection('orders').get()]);
    const orders = ordersSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    const customers = [...directory.records.values()]
      .sort((a, b) => (orderDate(b.createdAt) || '').localeCompare(orderDate(a.createdAt) || ''))
      .slice(0, 100)
      .map(data => customerSummary(data, ordersForCustomer(data.id, orders, directory.legacyIds)));
    res.json(customers);
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/admin/customers/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const directory = await customerDirectory(db);
    const id = directory.legacyIds.get(req.params.id) || req.params.id;
    const data = directory.records.get(id);
    if (!data) { res.status(404).json({ error: "Customer not found" }); return; }
    const ordersSnap = await db.collection('orders').get();
    const orders = ordersForCustomer(id, ordersSnap.docs.map(d => ({ ...d.data(), id: d.id })), directory.legacyIds);
    const customer = customerSummary(data, orders);
    const recentOrders = orders.slice(0, 20);
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
  try { const template = await changeEmailTemplate(db, 'create', undefined, req.body); res.json({ ...template, success: true }); }
  catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
});
app.put('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { await changeEmailTemplate(db, 'update', req.params.id, req.body); res.json({ success: true }); }
  catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
});
app.delete('/admin/email-templates/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { await changeEmailTemplate(db, 'delete', req.params.id); res.json({ success: true }); }
  catch (error: any) { res.status(error.status || 500).json({ error: error.message }); }
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

















app.post('/coupons/validate', async (req: Request, res: Response): Promise<void> => {
 try { res.json(await validateCoupon(db,req.body.code,req.body.orderTotal)); }
 catch(error:any){res.status(error.status||400).json({valid:false,error:error.message});}
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
    res.json(products);
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
    const body = req.body as Record<string, any>;
    // Require a valid qrg_STNNN doc ID — reject ad-hoc or provider-keyed creates
    const docId: string | undefined = body.id || body.docId;
    if (!docId || !isValidMasterCatalogDocId(docId)) {
      res.status(400).json({ error: `A valid QRG catalog doc ID (qrg_STNNN format) is required. Got: ${String(docId ?? 'undefined')}` });
      return;
    }
    const { id: _id, docId: _docId, ...data } = body;
    await db.collection('master_catalog').doc(docId).set({ ...data, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, { merge: false });
    res.json({ id: docId, success: true });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.patch('/admin/orchestration/master-products/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docId = req.params.id;
    if (!isValidMasterCatalogDocId(docId)) {
      res.status(400).json({ error: `Invalid catalog doc ID: ${docId}. Must be qrg_STNNN format.` });
      return;
    }
    const body = req.body as Record<string, any>;
    // Strip any attempt to write provider-keyed blankIds directly
    const { id: _id, docId: _docId, ...data } = body;
    await db.collection('master_catalog').doc(docId).update({ ...data, updatedAt: new Date().toISOString() });
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
    res.json(configs);
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

app.post('/admin/orchestration/routing/route',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Automatic routing is not connected to verified QRG variants. Select the provider in Products; no routing decision was recorded.'});});

app.post('/admin/orchestration/routing/batch',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Automatic routing is not connected to verified QRG variants. Select the provider in Products; no routing decision was recorded.'});});



  }
