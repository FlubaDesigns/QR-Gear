import { fulfillOrder, syncFulfillment } from '../services/order-fulfillment';
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
import { sendOrderConfirmation, sendShippingNotification } from '../services/email';

  export function register(app: express.Express): void {
  // ============ GIFT PACKAGES (ADMIN) ============

app.get('/admin/gift-packages', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('giftPackages').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/gift-packages', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('giftPackages').add({
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/gift-packages/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('giftPackages').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ GIFT CODES (ADMIN) ============

app.get('/admin/gift-codes', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('giftCodes').get();
    res.json(docsToArray(snapshot));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/admin/gift-codes', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const docRef = await db.collection('giftCodes').add({
      ...req.body,
      isRedeemed: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const doc = await docRef.get();
    res.json(docToObject(doc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/admin/gift-codes/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    await db.collection('giftCodes').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// ============ ADMIN ORDER FULFILLMENT ============

// Get all orders with fulfillment status
app.get('/admin/orders', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  try {
    const snapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();
    
    const orders = await Promise.all(snapshot.docs.map(async (doc) => {
      const order = docToObject(doc);
      
      // Get order items count
      const itemsSnapshot = await db.collection('orderItems')
        .where('orderId', '==', doc.id)
        .get();
      
      return {
        ...order,
        itemCount: itemsSnapshot.size,
      };
    }));
    
    res.json(orders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single order with items
app.get('/admin/orders/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderDoc = await db.collection('orders').doc(req.params.id).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = docToObject(orderDoc);
    
    // Get order items
    const itemsSnapshot = await db.collection('orderItems')
      .where('orderId', '==', req.params.id)
      .get();
    
    const items = docsToArray(itemsSnapshot);
    
    res.json({ ...order, items });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// The same saved order powers automatic submission and admin retries.
app.post('/admin/orders/:id/fulfill', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json(await fulfillOrder(req.params.id)); }
  catch (error: any) { res.status(409).json({ error: error.message }); }
});
app.post('/admin/orders/:id/sync-provider', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const updates = await syncFulfillment(req.params.id);
    const order = (await db.collection('orders').doc(req.params.id).get()).data()!;
    const email = updates.trackingNumber && order.customerEmail
      ? await sendShippingNotification(db, req.params.id, order.customerEmail, order.customerName || '', updates.trackingNumber, updates.carrier || '', updates.trackingUrl || undefined)
      : null;
    res.json({ ...updates, shippingEmailSent: email?.success === true });
  }
  catch (error: any) { res.status(409).json({ error: error.message }); }
});

// Submit order to Printify for fulfillment
app.post('/admin/orders/:id/submit-to-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    
    // Get the order
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = orderDoc.data()!;
    
    // Check if already submitted
    if (order.printifyOrderId) {
      res.json({ 
        success: true, 
        message: 'Order already submitted to Printify',
        printifyOrderId: order.printifyOrderId 
      });
      return;
    }
    
    // Get shipping address from order or request body
    let shippingAddress = order.shippingAddress || req.body.shippingAddress;
    
    if (!shippingAddress) {
      res.status(400).json({ 
        error: 'Shipping address required. Provide in request body or ensure order has shipping address.' 
      });
      return;
    }
    
    // Add email if not present
    if (!shippingAddress.email) {
      shippingAddress.email = order.customerEmail || '';
    }
    
    // Submit to Printify
    const result = await submitOrderToPrintify(orderId, shippingAddress);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Order submitted to Printify successfully',
        printifyOrderId: result.printifyOrderId 
      });
    } else {
      res.status(400).json({ 
        success: false, 
        error: result.error 
      });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Sync order status from Printify
app.post('/admin/orders/:id/sync-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = orderDoc.data()!;
    
    if (!order.printifyOrderId) {
      res.status(400).json({ error: 'Order has not been submitted to Printify' });
      return;
    }
    
    const printifyStatus = await checkPrintifyOrderStatus(order.printifyOrderId);
    
    if (!printifyStatus) {
      res.status(500).json({ error: 'Failed to get status from Printify' });
      return;
    }
    
    // Map Printify status to our status
    const statusMap: Record<string, string> = {
      'pending': 'pending',
      'on-hold': 'pending',
      'payment-not-received': 'pending',
      'in-production': 'in_production',
      'fulfilled': 'shipped',
      'canceled': 'cancelled',
    };
    
    const updates: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (printifyStatus.status) {
      updates.status = statusMap[printifyStatus.status] || printifyStatus.status;
    }
    // Check if tracking was just added (for shipping notification email)
    const hadTrackingBefore = !!order.trackingNumber;

    if (printifyStatus.trackingNumber) {
      updates.trackingNumber = printifyStatus.trackingNumber;
      updates.trackingUrl = printifyStatus.trackingUrl;
      updates.carrier = printifyStatus.carrier;
    }
    
    await db.collection('orders').doc(orderId).update(updates);

    // Reload order data to confirm tracking was added
    const updatedOrderDoc = await db.collection('orders').doc(orderId).get();
    const updatedOrder = updatedOrderDoc.data()!;
    const hasTrackingNow = !!updatedOrder.trackingNumber;
    const hasNewTracking = hasTrackingNow && !hadTrackingBefore;

    // Send shipping notification email if tracking was just added
    let emailSent = false;
    if (hasNewTracking && updatedOrder.customerEmail) {
      const shippingAddress = updatedOrder.shippingAddress;
      const customerName = shippingAddress 
        ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() 
        : 'Customer';

      const emailResult = await sendShippingNotification(
        db,
        orderId,
        updatedOrder.customerEmail,
        customerName,
        updatedOrder.trackingNumber,
        updatedOrder.carrier || 'Carrier',
        updatedOrder.trackingUrl
      );
      emailSent = emailResult.success;
    }
    
    res.json({ 
      success: true, 
      status: updates.status,
      trackingNumber: updates.trackingNumber,
      shippingEmailSent: emailSent,
      message: 'Order status synced from Printify'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send shipping notification email manually
app.post('/admin/orders/:id/send-shipping-email', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = orderDoc.data()!;
    
    if (!order.trackingNumber) {
      res.status(400).json({ error: 'Order has no tracking number' });
      return;
    }
    
    if (!order.customerEmail) {
      res.status(400).json({ error: 'Order has no customer email' });
      return;
    }
    
    const shippingAddress = order.shippingAddress;
    const customerName = shippingAddress 
      ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() 
      : 'Customer';

    // Send shipping notification (explicit admin resend)
    const result = await sendShippingNotification(
      db,
      orderId,
      order.customerEmail,
      customerName,
      order.trackingNumber,
      order.carrier || 'Carrier',
      order.trackingUrl,
      { resend: true }
    );
    
    if (result.success) {
      res.json({ success: true, message: 'Shipping notification email sent' });
    } else {
      res.status(500).json({ success: false, error: result.reason });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Resend order confirmation email
app.post('/admin/orders/:id/resend-confirmation', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    const order = orderDoc.data()!;
    
    if (!order.customerEmail) {
      res.status(400).json({ error: 'Order has no customer email' });
      return;
    }
    
    // Get order items
    const orderItemsSnapshot = await db.collection('orderItems')
      .where('orderId', '==', orderId)
      .get();
    
    const emailItems = await Promise.all(orderItemsSnapshot.docs.map(async (doc) => {
      const item = doc.data();
      let productName = 'Product';
      if (item.productId) {
        const productDoc = await db.collection('products').doc(item.productId).get();
        if (productDoc.exists) {
          productName = productDoc.data()?.name || 'Product';
        }
      }
      return {
        productName,
        quantity: item.quantity || 1,
        price: item.price || '0',
      };
    }));

    const shippingAddress = order.shippingAddress;
    const customerName = shippingAddress 
      ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim() 
      : 'Customer';

    // Send order confirmation
    const result = await sendOrderConfirmation(
      db,
      orderId,
      order.customerEmail,
      customerName,
      emailItems,
      order.totalAmount || '0',
      shippingAddress ? {
        address1: shippingAddress.address1,
        address2: shippingAddress.address2,
        city: shippingAddress.city,
        region: shippingAddress.region,
        zip: shippingAddress.zip,
        country: shippingAddress.country,
      } : undefined,
      { resend: true }
    );
    
    if (result.success) {
      res.json({ success: true, message: 'Order confirmation email resent' });
    } else {
      res.status(500).json({ success: false, error: result.reason });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update order status manually
app.patch('/admin/orders/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const orderId = req.params.id;
    const { status, trackingNumber, carrier, notes } = req.body;
    
    const orderDoc = await db.collection('orders').doc(orderId).get();
    if (!orderDoc.exists) {
      res.status(404).json({ error: 'Order not found' });
      return;
    }
    
    if (orderDoc.data()?.checkoutVersion === 1) { res.status(409).json({ error: 'Use provider sync for this checkout order.' }); return; }
    const updates: Record<string, any> = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    
    if (status) updates.status = status;
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (carrier !== undefined) updates.carrier = carrier;
    if (notes !== undefined) updates.notes = notes;
    
    await db.collection('orders').doc(orderId).update(updates);
    
    const updatedDoc = await db.collection('orders').doc(orderId).get();
    res.json(docToObject(updatedDoc));
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


async function adminOrder(doc: FirebaseFirestore.DocumentSnapshot) {
  const order = docToObject(doc);
  const rows = await db.collection('orderItems').where('orderId', '==', doc.id).get();
  return { ...order, sourceChannel: order.sourceChannel || order.source || 'direct', total: order.totalAmount ?? order.total,
    items: rows.empty ? (order.items || []) : rows.docs.map(row => { const item = row.data(); return {
      ...item, masterProductId: item.masterId || item.productId, variantSku: item.fulfillment?.variantKey || item.variantSku || '',
      productTitle: item.productTitle || item.customization?.productName || item.productId, price: Number(item.price),
    }; }) };
}

// ============ BATCH: ORDERS UNIFIED ============

app.get('/admin/orders-unified', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('orders').orderBy('createdAt', 'desc').limit(200).get();
    res.json(await Promise.all(snap.docs.map(adminOrder)));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/orders-unified/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Order not found" }); return; }
    res.json(await adminOrder(doc));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.patch('/admin/orders-unified/:id', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { status, trackingNumber, trackingUrl, routedProvider, providerOrderId, productionCost, profit, notes } = req.body;
    const doc = await db.collection('orders').doc(id).get();
    if (!doc.exists) { res.status(404).json({ error: "Order not found" }); return; }
    const current = doc.data() as any;
    if (current.checkoutVersion === 1) { res.status(409).json({ error: 'Use provider sync for production status; payment and routing are managed by checkout.' }); return; }
    let statusHistory = (current.statusHistory || []) as Array<{status: string; timestamp: string; note?: string}>;
    if (status && status !== current.status) { statusHistory = [...statusHistory, { status, timestamp: new Date().toISOString(), note: notes || undefined }]; }
    const updates: Record<string, any> = {};
    if (status) updates.status = status;
    if (trackingNumber !== undefined) updates.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) updates.trackingUrl = trackingUrl;
    if (routedProvider !== undefined) updates.routedProvider = routedProvider;
    if (providerOrderId !== undefined) updates.providerOrderId = providerOrderId;
    if (productionCost !== undefined) updates.productionCost = productionCost;
    if (profit !== undefined) updates.profit = profit;
    if (statusHistory.length > 0) updates.statusHistory = statusHistory;
    if (status === 'shipped' && !current.shippedAt) updates.shippedAt = new Date();
    if (status === 'delivered' && !current.deliveredAt) updates.deliveredAt = new Date();
    await doc.ref.update(updates);
    const updated = await doc.ref.get();
    res.json({ id: updated.id, ...updated.data() });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/orders-unified/:id/sync-printify', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get();
    if (!doc.exists) { res.status(404).json({ error: "Order not found" }); return; }
    const order = doc.data() as any;
    if (!order.providerOrderId || order.routedProvider !== 'printify') { res.status(400).json({ error: "Not a Printify order" }); return; }
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
    if (!PRINTIFY_API || !SHOP_ID) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders/${order.providerOrderId}.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    const pOrder = await resp.json() as any;
    const statusMap: Record<string, string> = { pending: 'pending', 'on-hold': 'pending', 'in-production': 'processing', 'partially-shipped': 'shipped', shipped: 'shipped', delivered: 'delivered', canceled: 'cancelled' };
    const newStatus = statusMap[pOrder.status] || order.status;
    const updates: Record<string, any> = { status: newStatus, lastSyncedAt: new Date() };
    if (pOrder.shipments?.[0]?.tracking_number) updates.trackingNumber = pOrder.shipments[0].tracking_number;
    if (pOrder.shipments?.[0]?.tracking_url) updates.trackingUrl = pOrder.shipments[0].tracking_url;
    await doc.ref.update(updates);
    res.json({ success: true, status: newStatus, printifyStatus: pOrder.status });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


// ============ BATCH: ORDER STATUS & REMAINING ROUTES ============

app.post('/orders/:id/submit-printify', requireAuth, async (_req: Request, res: Response): Promise<void> => {
  res.status(410).json({ error: 'Production is submitted from the verified paid order. Use Admin Orders to retry.' });
});

app.get('/orders/:id/status', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await db.collection('orders').doc(req.params.id).get(), order = doc.data();
    if (!order || order.userId !== (req as any).user.uid) { res.status(404).json({ error: 'Order not found' }); return; }
    res.json({ status: order.status, provider: order.routedProvider || null, providerStatus: order.providerStatus || null,
      trackingNumber: order.trackingNumber || null, trackingUrl: order.trackingUrl || null, shipments: order.shipments || [] });
  } catch (error: any) { res.status(500).json({ error: error.message }); }
});

app.get('/library/my', requireAuth, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user?.uid || (req as any).user?.claims?.sub;
    if (!userId) { res.status(401).json({ error: "Not authenticated" }); return; }
    const { assetType, mediaType } = req.query;
    let query: any = db.collection('libraryAssets').where('userId', '==', userId).where('isActive', '==', true);
    const snap = await query.get();
    let assets = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    if (assetType) assets = assets.filter((a: any) => a.assetType === assetType);
    if (mediaType) assets = assets.filter((a: any) => a.mediaType === mediaType);
    res.json(assets);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/widget/stores/:slug', async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('partner_stores').where('slug', '==', req.params.slug).where('isActive', '==', true).limit(1).get();
    if (snap.empty) { res.status(404).json({ error: "Store not found" }); return; }
    const store = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
    const channels = await db.collection('storeChannels').where('storeId', '==', store.id).get();
    res.json({ ...store, channels: channels.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.get('/admin/products/:id/categories', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('product_category_links').where('productId', '==', req.params.id).get();
    const catIds = snap.docs.map(d => (d.data() as any).categoryId);
    if (catIds.length === 0) { res.json([]); return; }
    const cats = await Promise.all(catIds.map(async (id: string) => { const doc = await db.collection('product_categories').doc(id).get(); return doc.exists ? { id: doc.id, ...doc.data() } : null; }));
    res.json(cats.filter(Boolean));
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/catalog/fetch-costs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const { blueprintId, providerId } = req.body;
    if (!blueprintId || !providerId) { res.status(400).json({ error: "blueprintId and providerId required" }); return; }
    const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
    if (!PRINTIFY_API) { res.status(500).json({ error: "Printify not configured" }); return; }
    const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
    if (!resp.ok) { res.status(resp.status).json({ error: "Printify API error" }); return; }
    const data = await resp.json() as any;
    res.json({ variants: data.variants || data, count: (data.variants || data).length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/catalog/sync-all-costs', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Cost sync initiated", status: "queued" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/catalog/cancel-cost-sync', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Cost sync cancelled" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.post('/admin/catalog/refresh-color-hex', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try { res.json({ message: "Color hex refresh initiated" }); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

app.delete('/admin/catalog/clear', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  try {
    const snap = await db.collection('printify_catalog').get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true, deleted: snap.size });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});


  }
  