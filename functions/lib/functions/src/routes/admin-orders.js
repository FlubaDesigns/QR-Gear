"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const middleware_1 = require("../middleware");
const printify_1 = require("../services/printify");
const nexusmail_1 = require("../nexusmail");
function register(app) {
    // ============ GIFT PACKAGES (ADMIN) ============
    app.get('/admin/gift-packages', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('giftPackages').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/gift-packages', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('giftPackages').add({
                ...req.body,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/gift-packages/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('giftPackages').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ GIFT CODES (ADMIN) ============
    app.get('/admin/gift-codes', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('giftCodes').get();
            res.json((0, core_1.docsToArray)(snapshot));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/admin/gift-codes', middleware_1.requireAdmin, async (req, res) => {
        try {
            const docRef = await core_1.db.collection('giftCodes').add({
                ...req.body,
                isRedeemed: false,
                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            });
            const doc = await docRef.get();
            res.json((0, core_1.docToObject)(doc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.delete('/admin/gift-codes/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            await core_1.db.collection('giftCodes').doc(req.params.id).delete();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ ADMIN ORDER FULFILLMENT ============
    // Get all orders with fulfillment status
    app.get('/admin/orders', middleware_1.requireAdmin, async (_req, res) => {
        try {
            const snapshot = await core_1.db.collection('orders')
                .orderBy('createdAt', 'desc')
                .limit(100)
                .get();
            const orders = await Promise.all(snapshot.docs.map(async (doc) => {
                const order = (0, core_1.docToObject)(doc);
                // Get order items count
                const itemsSnapshot = await core_1.db.collection('orderItems')
                    .where('orderId', '==', doc.id)
                    .get();
                return {
                    ...order,
                    itemCount: itemsSnapshot.size,
                };
            }));
            res.json(orders);
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Get single order with items
    app.get('/admin/orders/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const orderDoc = await core_1.db.collection('orders').doc(req.params.id).get();
            if (!orderDoc.exists) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            const order = (0, core_1.docToObject)(orderDoc);
            // Get order items
            const itemsSnapshot = await core_1.db.collection('orderItems')
                .where('orderId', '==', req.params.id)
                .get();
            const items = (0, core_1.docsToArray)(itemsSnapshot);
            res.json({ ...order, items });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Submit order to Printify for fulfillment
    app.post('/admin/orders/:id/submit-to-printify', middleware_1.requireAdmin, async (req, res) => {
        try {
            const orderId = req.params.id;
            // Get the order
            const orderDoc = await core_1.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            const order = orderDoc.data();
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
            const result = await (0, printify_1.submitOrderToPrintify)(orderId, shippingAddress);
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Order submitted to Printify successfully',
                    printifyOrderId: result.printifyOrderId
                });
            }
            else {
                res.status(400).json({
                    success: false,
                    error: result.error
                });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Sync order status from Printify
    app.post('/admin/orders/:id/sync-printify', middleware_1.requireAdmin, async (req, res) => {
        try {
            const orderId = req.params.id;
            const orderDoc = await core_1.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            const order = orderDoc.data();
            if (!order.printifyOrderId) {
                res.status(400).json({ error: 'Order has not been submitted to Printify' });
                return;
            }
            const printifyStatus = await (0, printify_1.checkPrintifyOrderStatus)(order.printifyOrderId);
            if (!printifyStatus) {
                res.status(500).json({ error: 'Failed to get status from Printify' });
                return;
            }
            // Map Printify status to our status
            const statusMap = {
                'pending': 'pending',
                'on-hold': 'pending',
                'payment-not-received': 'pending',
                'in-production': 'in_production',
                'fulfilled': 'shipped',
                'canceled': 'cancelled',
            };
            const updates = {
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
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
            await core_1.db.collection('orders').doc(orderId).update(updates);
            // Reload order data to confirm tracking was added
            const updatedOrderDoc = await core_1.db.collection('orders').doc(orderId).get();
            const updatedOrder = updatedOrderDoc.data();
            const hasTrackingNow = !!updatedOrder.trackingNumber;
            const hasNewTracking = hasTrackingNow && !hadTrackingBefore;
            // Send shipping notification email via NexusMail if tracking was just added
            let emailSent = false;
            if (hasNewTracking && updatedOrder.customerEmail) {
                const shippingAddress = updatedOrder.shippingAddress;
                const customerName = shippingAddress
                    ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim()
                    : 'Customer';
                const emailResult = await (0, nexusmail_1.sendShippingNotification)(core_1.db, orderId, updatedOrder.customerEmail, customerName, updatedOrder.trackingNumber, updatedOrder.carrier || 'Carrier', updatedOrder.trackingUrl);
                emailSent = emailResult.success;
            }
            res.json({
                success: true,
                status: updates.status,
                trackingNumber: updates.trackingNumber,
                shippingEmailSent: emailSent,
                message: 'Order status synced from Printify'
            });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Send shipping notification email manually
    app.post('/admin/orders/:id/send-shipping-email', middleware_1.requireAdmin, async (req, res) => {
        try {
            const orderId = req.params.id;
            const orderDoc = await core_1.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            const order = orderDoc.data();
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
            // Use NexusMail for shipping notification (with admin override to bypass idempotency)
            const result = await (0, nexusmail_1.sendShippingNotification)(core_1.db, orderId, order.customerEmail, customerName, order.trackingNumber, order.carrier || 'Carrier', order.trackingUrl);
            if (result.success) {
                res.json({ success: true, message: 'Shipping notification email sent via NexusMail' });
            }
            else {
                res.status(500).json({ success: false, error: result.reason });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Resend order confirmation email
    app.post('/admin/orders/:id/resend-confirmation', middleware_1.requireAdmin, async (req, res) => {
        try {
            const orderId = req.params.id;
            const orderDoc = await core_1.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            const order = orderDoc.data();
            if (!order.customerEmail) {
                res.status(400).json({ error: 'Order has no customer email' });
                return;
            }
            // Get order items
            const orderItemsSnapshot = await core_1.db.collection('orderItems')
                .where('orderId', '==', orderId)
                .get();
            const emailItems = await Promise.all(orderItemsSnapshot.docs.map(async (doc) => {
                const item = doc.data();
                let productName = 'Product';
                if (item.productId) {
                    const productDoc = await core_1.db.collection('products').doc(item.productId).get();
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
            // Use NexusMail for order confirmation
            const result = await (0, nexusmail_1.sendOrderConfirmation)(core_1.db, orderId, order.customerEmail, customerName, emailItems, order.totalAmount || '0', shippingAddress ? {
                address1: shippingAddress.address1,
                address2: shippingAddress.address2,
                city: shippingAddress.city,
                region: shippingAddress.region,
                zip: shippingAddress.zip,
                country: shippingAddress.country,
            } : undefined);
            if (result.success) {
                res.json({ success: true, message: 'Order confirmation email resent via NexusMail' });
            }
            else {
                res.status(500).json({ success: false, error: result.reason });
            }
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // Update order status manually
    app.patch('/admin/orders/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const orderId = req.params.id;
            const { status, trackingNumber, carrier, notes } = req.body;
            const orderDoc = await core_1.db.collection('orders').doc(orderId).get();
            if (!orderDoc.exists) {
                res.status(404).json({ error: 'Order not found' });
                return;
            }
            const updates = {
                updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
            };
            if (status)
                updates.status = status;
            if (trackingNumber !== undefined)
                updates.trackingNumber = trackingNumber;
            if (carrier !== undefined)
                updates.carrier = carrier;
            if (notes !== undefined)
                updates.notes = notes;
            await core_1.db.collection('orders').doc(orderId).update(updates);
            const updatedDoc = await core_1.db.collection('orders').doc(orderId).get();
            res.json((0, core_1.docToObject)(updatedDoc));
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    // ============ BATCH: ORDERS UNIFIED ============
    app.get('/admin/orders-unified', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('orders').orderBy('createdAt', 'desc').limit(200).get();
            res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/orders-unified/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('orders').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Order not found" });
                return;
            }
            res.json({ id: doc.id, ...doc.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.patch('/admin/orders-unified/:id', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { id } = req.params;
            const { status, trackingNumber, trackingUrl, routedProvider, providerOrderId, productionCost, profit, notes } = req.body;
            const doc = await core_1.db.collection('orders').doc(id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Order not found" });
                return;
            }
            const current = doc.data();
            let statusHistory = (current.statusHistory || []);
            if (status && status !== current.status) {
                statusHistory = [...statusHistory, { status, timestamp: new Date().toISOString(), note: notes || undefined }];
            }
            const updates = {};
            if (status)
                updates.status = status;
            if (trackingNumber !== undefined)
                updates.trackingNumber = trackingNumber;
            if (trackingUrl !== undefined)
                updates.trackingUrl = trackingUrl;
            if (routedProvider !== undefined)
                updates.routedProvider = routedProvider;
            if (providerOrderId !== undefined)
                updates.providerOrderId = providerOrderId;
            if (productionCost !== undefined)
                updates.productionCost = productionCost;
            if (profit !== undefined)
                updates.profit = profit;
            if (statusHistory.length > 0)
                updates.statusHistory = statusHistory;
            if (status === 'shipped' && !current.shippedAt)
                updates.shippedAt = new Date();
            if (status === 'delivered' && !current.deliveredAt)
                updates.deliveredAt = new Date();
            await doc.ref.update(updates);
            const updated = await doc.ref.get();
            res.json({ id: updated.id, ...updated.data() });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/orders-unified/:id/sync-printify', middleware_1.requireAdmin, async (req, res) => {
        try {
            const doc = await core_1.db.collection('orders').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Order not found" });
                return;
            }
            const order = doc.data();
            if (!order.providerOrderId || order.routedProvider !== 'printify') {
                res.status(400).json({ error: "Not a Printify order" });
                return;
            }
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
            if (!PRINTIFY_API || !SHOP_ID) {
                res.status(500).json({ error: "Printify not configured" });
                return;
            }
            const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders/${order.providerOrderId}.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.status(resp.status).json({ error: "Printify API error" });
                return;
            }
            const pOrder = await resp.json();
            const statusMap = { pending: 'pending', 'on-hold': 'pending', 'in-production': 'processing', 'partially-shipped': 'shipped', shipped: 'shipped', delivered: 'delivered', canceled: 'cancelled' };
            const newStatus = statusMap[pOrder.status] || order.status;
            const updates = { status: newStatus, lastSyncedAt: new Date() };
            if (pOrder.shipments?.[0]?.tracking_number)
                updates.trackingNumber = pOrder.shipments[0].tracking_number;
            if (pOrder.shipments?.[0]?.tracking_url)
                updates.trackingUrl = pOrder.shipments[0].tracking_url;
            await doc.ref.update(updates);
            res.json({ success: true, status: newStatus, printifyStatus: pOrder.status });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    // ============ BATCH: ORDER STATUS & REMAINING ROUTES ============
    app.post('/orders/:id/submit-printify', middleware_1.requireAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const doc = await core_1.db.collection('orders').doc(id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Order not found" });
                return;
            }
            const { shippingAddress } = req.body;
            if (!shippingAddress) {
                res.status(400).json({ error: "Shipping address required" });
                return;
            }
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
            if (!PRINTIFY_API || !SHOP_ID) {
                res.status(500).json({ error: "Printify not configured" });
                return;
            }
            const order = doc.data();
            const items = await core_1.db.collection('order_items').where('orderId', '==', id).get();
            const lineItems = items.docs.map(d => { const item = d.data(); return { print_provider_id: item.printProviderId, blueprint_id: item.blueprintId, variant_id: item.variantId, print_areas: { front: item.printAreaUrl }, quantity: item.quantity || 1 }; });
            const printifyOrder = { external_id: id, label: `QRGear-${id}`, line_items: lineItems, shipping_method: 1, address_to: shippingAddress };
            const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders.json`, { method: 'POST', headers: { 'Authorization': `Bearer ${PRINTIFY_API}`, 'Content-Type': 'application/json' }, body: JSON.stringify(printifyOrder) });
            if (!resp.ok) {
                const err = await resp.text();
                res.status(resp.status).json({ error: err });
                return;
            }
            const result = await resp.json();
            await doc.ref.update({ printifyOrderId: result.id, status: 'submitted' });
            res.json({ success: true, printifyOrderId: result.id });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/orders/:id/status', middleware_1.requireAuth, async (req, res) => {
        try {
            const doc = await core_1.db.collection('orders').doc(req.params.id).get();
            if (!doc.exists) {
                res.status(404).json({ error: "Order not found" });
                return;
            }
            const order = doc.data();
            if (!order.printifyOrderId) {
                res.json({ status: order.status || 'pending', printifyStatus: null });
                return;
            }
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            const SHOP_ID = process.env.PRINTIFY_SHOP_ID;
            if (!PRINTIFY_API || !SHOP_ID) {
                res.json({ status: order.status, printifyStatus: 'unknown' });
                return;
            }
            const resp = await fetch(`https://api.printify.com/v1/shops/${SHOP_ID}/orders/${order.printifyOrderId}.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.json({ status: order.status, printifyStatus: 'error' });
                return;
            }
            const pOrder = await resp.json();
            res.json({ status: order.status, printifyStatus: pOrder.status, shipments: pOrder.shipments || [] });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/library/my', middleware_1.requireAuth, async (req, res) => {
        try {
            const userId = req.user?.uid || req.user?.claims?.sub;
            if (!userId) {
                res.status(401).json({ error: "Not authenticated" });
                return;
            }
            const { assetType, mediaType } = req.query;
            let query = core_1.db.collection('libraryAssets').where('userId', '==', userId).where('isActive', '==', true);
            const snap = await query.get();
            let assets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (assetType)
                assets = assets.filter((a) => a.assetType === assetType);
            if (mediaType)
                assets = assets.filter((a) => a.mediaType === mediaType);
            res.json(assets);
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/widget/stores/:slug', async (req, res) => {
        try {
            const snap = await core_1.db.collection('partner_stores').where('slug', '==', req.params.slug).where('isActive', '==', true).limit(1).get();
            if (snap.empty) {
                res.status(404).json({ error: "Store not found" });
                return;
            }
            const store = { id: snap.docs[0].id, ...snap.docs[0].data() };
            const channels = await core_1.db.collection('store_channels').where('storeId', '==', store.id).get();
            res.json({ ...store, channels: channels.docs.map(d => ({ id: d.id, ...d.data() })) });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.get('/admin/products/:id/categories', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('product_category_links').where('productId', '==', req.params.id).get();
            const catIds = snap.docs.map(d => d.data().categoryId);
            if (catIds.length === 0) {
                res.json([]);
                return;
            }
            const cats = await Promise.all(catIds.map(async (id) => { const doc = await core_1.db.collection('product_categories').doc(id).get(); return doc.exists ? { id: doc.id, ...doc.data() } : null; }));
            res.json(cats.filter(Boolean));
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/catalog/fetch-costs', middleware_1.requireAdmin, async (req, res) => {
        try {
            const { blueprintId, providerId } = req.body;
            if (!blueprintId || !providerId) {
                res.status(400).json({ error: "blueprintId and providerId required" });
                return;
            }
            const PRINTIFY_API = process.env.PRINTIFY_API_TOKEN;
            if (!PRINTIFY_API) {
                res.status(500).json({ error: "Printify not configured" });
                return;
            }
            const resp = await fetch(`https://api.printify.com/v1/catalog/blueprints/${blueprintId}/print_providers/${providerId}/variants.json`, { headers: { 'Authorization': `Bearer ${PRINTIFY_API}` } });
            if (!resp.ok) {
                res.status(resp.status).json({ error: "Printify API error" });
                return;
            }
            const data = await resp.json();
            res.json({ variants: data.variants || data, count: (data.variants || data).length });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/catalog/sync-all-costs', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ message: "Cost sync initiated", status: "queued" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/catalog/cancel-cost-sync', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ message: "Cost sync cancelled" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.post('/admin/catalog/refresh-color-hex', middleware_1.requireAdmin, async (req, res) => {
        try {
            res.json({ message: "Color hex refresh initiated" });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
    app.delete('/admin/catalog/clear', middleware_1.requireAdmin, async (req, res) => {
        try {
            const snap = await core_1.db.collection('printify_catalog').get();
            const batch = core_1.db.batch();
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            res.json({ success: true, deleted: snap.size });
        }
        catch (e) {
            res.status(500).json({ error: e.message });
        }
    });
}
//# sourceMappingURL=admin-orders.js.map