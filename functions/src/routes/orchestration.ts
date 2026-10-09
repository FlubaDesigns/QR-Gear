import { BundleError, readBundle, saveBundle, calculateBundle } from '../services/product-bundles';
import { HealthMonitorService } from '../services/health-monitor';
import { QrAnalyticsService } from '../services/qr-analytics';
import { listCatalogInstances } from '../services/catalog-list';
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
import Stripe from 'stripe';

  export function register(app: express.Express): void {
  const qrAnalyticsService = new QrAnalyticsService(db);
  // Finished products come from the same catalog as Store Builder and checkout.
  // QRG master_catalog remains the blank registry, never a second product list.
  const readProducts = async () => {
    const catalog = await listCatalogInstances(db, {});
    return Promise.all(catalog.instances.map(async (item: any) => {
      const packet = item.currentPacketId ? (await db.collection('productPackets').doc(item.currentPacketId).get()).data() : null;
      const price = item.resolved?.pricing?.customerPrice, cost = item.resolved?.pricing?.subtotal;
      const issues: string[] = [];
      if (!packet) issues.push('Saved production packet is missing.');
      else {
        if (packet.ownerInstanceId !== item.id) issues.push('Packet ownership does not match this product.');
        if (packet.pricing?.customerPrice !== price || packet.pricing?.subtotal !== cost) issues.push('Packet and catalog pricing disagree.');
        if (!packet.builderSnapshot?.layoutConfig?.selectedPlacements?.includes('label_inside') || !packet.placementGrfIds?.label_inside) issues.push('Required registered inside label is missing.');
      }
      const validPrice = typeof price === 'number' && Number.isFinite(price) && price > 0;
      const validCost = typeof cost === 'number' && Number.isFinite(cost) && cost >= 0;
      if (!validPrice || !validCost) issues.push('Saved price or cost subtotal is unavailable.');
      const provider = packet?.builderSnapshot?.metadata?.fulfillmentProvider;
      if (provider !== 'printful') issues.push('This provider does not have a validated checkout handoff.');
      else if (packet?.fulfillmentProvider !== provider) issues.push('Saved provider and packet provider disagree.');
      return { id: item.id, title: item.resolved?.title || item.id, qrgCode: item.qrgBaseCode || null,
        status: item.status, packetId: item.currentPacketId || null, sourceSessionId: item.sourceSessionId || null,
        provider: provider || null, price: validPrice ? price : null, cost: validCost ? cost : null,
        estimatedContribution: validPrice && validCost ? Math.round((price - cost) * 100) / 100 : null,
        issues };
    }));
  };
  app.get('/admin/orchestration/catalog', requireAdmin, async (_req: Request, res: Response) => {
    try { res.setHeader('Cache-Control', 'no-store'); res.json({ products: await readProducts() }); }
    catch (e: any) { console.error('[Orchestration Catalog]', e); res.status(503).json({ error: e.message }); }
  });
  // ============ BATCH: ORCHESTRATION (BUNDLES, BULK-PUBLISH, PROFIT, ANALYTICS) ============

app.get('/admin/orchestration/bundles', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('product_bundles').get();
    res.json(snap.docs.map(d => ({ ...d.data(), id: d.id } as any)).sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

const bundleFailure = (res: Response, error: any) => {
  console.error('[Product Bundles]', error.message);
  res.status(error instanceof BundleError ? error.status : 503).json({ error: error.message });
};
app.get('/admin/orchestration/bundles/:id', requireAdmin, async (req: Request, res: Response) => {
  try { res.json(await readBundle(db, req.params.id)); } catch (e) { bundleFailure(res, e); }
});
app.post('/admin/orchestration/bundles', requireAdmin, async (req: Request, res: Response) => {
  try { res.status(201).json(await saveBundle(db, req.body)); } catch (e) { bundleFailure(res, e); }
});
app.patch('/admin/orchestration/bundles/:id', requireAdmin, async (req: Request, res: Response) => {
  try { res.json(await saveBundle(db, req.body, req.params.id)); } catch (e) { bundleFailure(res, e); }
});

app.delete('/admin/orchestration/bundles/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await db.collection('bundle_items').where('bundleId', '==', req.params.id).get();
    const batch = db.batch();
    items.docs.forEach(d => batch.delete(d.ref));
    batch.delete(db.collection('product_bundles').doc(req.params.id));
    await batch.commit();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/bundles/:id/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('product_bundles').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Bundle not found" }); return; }
    await doc.ref.update({ isActive: !(doc.data() as any).isActive });
    const updated = await doc.ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/bundles/for-product/:productId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const now = new Date();
    const snap = await db.collection('product_bundles').where('isActive', '==', true).get();
    const filtered = snap.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(b => {
      if (b.startDate && new Date(b.startDate) > now) return false;
      if (b.endDate && new Date(b.endDate) < now) return false;
      if (!b.triggerProductIds || b.triggerProductIds.length === 0) return true;
      return b.triggerProductIds.includes(productId);
    });
    const results = await Promise.all(filtered.map(async (b: any) => {
      const items = await db.collection('bundle_items').where('bundleId', '==', b.id).get();
      return { ...b, items: items.docs.map(d => ({ id: d.id, ...d.data() })) };
    }));
    res.json(results);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/bundles/:id/calculate', async (req: Request, res: Response) => {
  try { res.json(await calculateBundle(db, req.params.id, req.body.selectedItems)); } catch (e) { bundleFailure(res, e); }
});

app.post('/admin/orchestration/bulk-publish',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Bulk publishing has no deployed worker. Use Marketplace publish for each saved surface.',code:'NOT_IMPLEMENTED'});});

app.get('/admin/orchestration/bulk-publish/:jobId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('bulk_publish_jobs').doc(req.params.jobId).get();
    if (!doc.exists) { res.status(404).json({ error: "Job not found" }); return; }
    res.json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/bulk-publish-jobs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('bulk_publish_jobs').orderBy('createdAt', 'desc').limit(20).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// Orchestration: Provider Health, Routing, Profit, Repricing, QR Analytics
// These use Firestore-based data; services that require imports are stubbed with Firestore queries

const health = new HealthMonitorService(db);
app.get('/admin/orchestration/provider-health', requireAdmin, async (_req:Request,res:Response)=>{
  try {res.json(await health.getHealthDashboard());}catch(e:any){console.error('[Health]',e);res.status(500).json({error:e.message});}
});
app.post('/admin/orchestration/provider-health/check', requireAdmin, async (_req:Request,res:Response)=>{
  try {res.json({checks:await health.checkAllProviders()});}catch(e:any){console.error('[Health]',e);res.status(500).json({error:e.message});}
});
app.post('/admin/orchestration/provider-health/:providerType/check', requireAdmin, async (req:Request,res:Response)=>{
  try {res.json(await health.checkProvider(req.params.providerType));}catch(e:any){res.status(e.status||500).json({error:e.message});}
});
app.get('/admin/orchestration/provider-health/:providerType/history', requireAdmin, async (req:Request,res:Response)=>{
  try {res.json(await health.getProviderHistory(req.params.providerType));}catch(e:any){res.status(500).json({error:e.message});}
});

app.get('/admin/orchestration/routing/recommendations/:blueprintId',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Automatic provider recommendations are not connected to verified QRG variants. Choose the provider on the product screen.',code:'NOT_IMPLEMENTED'});});

app.get('/admin/orchestration/routing/stats', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {const snap=await db.collection('routing_decisions').get();const rows=snap.docs.map(d=>d.data()).filter(r=>r.selectedProvider?.providerId!=null);
 const byProvider:Record<string,number>={};for(const r of rows){const key=String(r.selectedProvider.providerId);byProvider[key]=(byProvider[key]||0)+1;}
 const costs=rows.map(r=>r.selectedProvider.costCents).filter(n=>typeof n==='number'&&Number.isFinite(n));
 res.json({totalRoutings:rows.length,byProvider,avgSelectedCost:costs.length?costs.reduce((a,b)=>a+b,0)/costs.length/100:null,routingTimestamp:rows.length?rows[rows.length-1].createdAt:null}); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/routing/history', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('routing_decisions').orderBy('createdAt', 'desc').limit(20).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/profit/dashboard', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [products, orders] = await Promise.all([readProducts(), db.collection('orders').where('paymentStatus', '==', 'paid').get()]);
    const paid = orders.docs.map(d => d.data());
    const measured = paid.filter(o => Number.isSafeInteger(o.amountTotalCents) && o.amountTotalCents >= 0 && String(o.currency).toLowerCase() === 'usd');
    res.setHeader('Cache-Control', 'no-store');
    res.json({ products, paidOrders: paid.length, revenue: measured.length === paid.length ? measured.reduce((n, o) => n + o.amountTotalCents, 0) / 100 : null,
      netProfit: paid.length === 0 ? 0 : null,
      note: 'Paid store orders in USD, before refunds. Actual provider invoices and payment fees are not reconciled; product contributions below are saved-price estimates, not realized profit.' });
  } catch (e: any) { console.error('[Orchestration Profit]', e); res.status(503).json({ error: e.message }); }
});

app.get('/admin/orchestration/profit/channels',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Complete profit reporting needs recorded production, shipping and payment fees. Use per-item Marketplace fee results; no fixed fee percentages or invented profit are substituted.',code:'NOT_IMPLEMENTED'});});

app.get('/admin/orchestration/profit/products',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Complete profit reporting needs recorded production, shipping and payment fees. Use per-item Marketplace fee results; no fixed fee percentages or invented profit are substituted.',code:'NOT_IMPLEMENTED'});});

app.get('/admin/orchestration/profit/alerts',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Complete profit reporting needs recorded production, shipping and payment fees. Use per-item Marketplace fee results; no fixed fee percentages or invented profit are substituted.',code:'NOT_IMPLEMENTED'});});

app.post('/admin/orchestration/profit/calculate',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Complete profit reporting needs recorded production, shipping and payment fees. Use per-item Marketplace fee results; no fixed fee percentages or invented profit are substituted.',code:'NOT_IMPLEMENTED'});});

app.post('/admin/orchestration/profit/compare-channels',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Complete profit reporting needs recorded production, shipping and payment fees. Use per-item Marketplace fee results; no fixed fee percentages or invented profit are substituted.',code:'NOT_IMPLEMENTED'});});

app.post('/admin/orchestration/profit/recommended-price',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Complete profit reporting needs recorded production, shipping and payment fees. Use per-item Marketplace fee results; no fixed fee percentages or invented profit are substituted.',code:'NOT_IMPLEMENTED'});});

app.get('/admin/orchestration/repricing/rules', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('repricing_rules').orderBy('priority').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/repricing/stats', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {const rules=(await db.collection('repricing_rules').get()).docs.map(d=>d.data());const history=(await db.collection('repricing_history').get()).docs.map(d=>d.data());
 const recent=history.filter(h=>new Date(h.appliedAt||h.executedAt).getTime()>Date.now()-86400000);const dates=history.map(h=>h.appliedAt||h.executedAt).filter(Boolean).sort();
 res.json({totalRules:rules.length,activeRules:rules.filter(r=>r.isActive).length,lastRunTime:dates[dates.length-1]||null,productsAdjusted24h:recent.length,avgPriceChange:recent.length?recent.reduce((n,h)=>n+Math.abs(Number(h.newPrice)-Number(h.previousPrice)),0)/recent.length:0}); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/repricing/history', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('repricing_history').orderBy('executedAt', 'desc').limit(50).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/repricing/rules', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = await db.collection('repricing_rules').add({ ...req.body, createdAt: new Date() });
    const doc = await ref.get();
    res.status(201).json({ id: doc.id, ...doc.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/admin/orchestration/repricing/rules/:ruleId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = db.collection('repricing_rules').doc(req.params.ruleId);
    const doc = await ref.get();
    if (!doc.exists) { res.status(404).json({ error: "Rule not found" }); return; }
    await ref.update(req.body);
    const updated = await ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/orchestration/repricing/rules/:ruleId', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('repricing_rules').doc(req.params.ruleId).delete();
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orchestration/repricing/rules/:ruleId/toggle', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const ref = db.collection('repricing_rules').doc(req.params.ruleId);
    const doc = await ref.get();
    if (!doc.exists) { res.status(404).json({ error: "Rule not found" }); return; }
    await ref.update({ isActive: !(doc.data() as any).isActive });
    const updated = await ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orchestration/repricing/rules/:ruleId/preview',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Rule-based repricing is not connected to canonical catalog prices. Use Admin Pricing preview and apply.',code:'NOT_IMPLEMENTED'});});

app.post('/admin/orchestration/repricing/run',requireAdmin,(_req:Request,res:Response)=>{res.status(501).json({error:'Rule-based repricing is not connected to canonical catalog prices. Use Admin Pricing preview and apply.',code:'NOT_IMPLEMENTED'});});

for (const [name, read] of Object.entries({
  summary: () => qrAnalyticsService.getSummary(), products: () => qrAnalyticsService.getProductAnalytics(),
  trends: () => qrAnalyticsService.getTrends(), recent: () => qrAnalyticsService.getRecentScans(),
})) app.get(`/admin/orchestration/qr-analytics/${name}`, requireAdmin, async (_req: Request,res: Response) => {
  try { res.json(await read()); } catch(e:any) { console.error('[QR Analytics]',e);res.status(500).json({error:e.message}); }
});
app.post('/qr/scan', async (req: Request,res: Response) => {
  try {
    const {masterProductId,customDesignId,qrUrl,country,region}=req.body;
    if (!masterProductId && !customDesignId && !qrUrl) {res.status(400).json({error:'At least one identifier required'});return;}
    const userAgent=req.headers['user-agent']||'';
    await qrAnalyticsService.logScan({masterProductId,customDesignId,qrUrl,country,region,userAgent,deviceType:qrAnalyticsService.detectDeviceType(userAgent)});
    res.json({success:true});
  } catch(e:any) {console.error('[QR Scan]',e);res.status(500).json({error:e.message});}
});
}
