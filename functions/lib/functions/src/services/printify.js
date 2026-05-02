"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRINTIFY_API_BASE = exports.PrintifyClient = exports.printifyClient = void 0;
exports.getPrintifyApiKey = getPrintifyApiKey;
exports.getPrintifyShopId = getPrintifyShopId;
exports.submitOrderToPrintify = submitOrderToPrintify;
exports.checkPrintifyOrderStatus = checkPrintifyOrderStatus;
const core_1 = require("../core");
// ============ PRINTIFY CLIENT (Order Fulfillment) ============
const PRINTIFY_API_BASE = 'https://api.printify.com/v1';
exports.PRINTIFY_API_BASE = PRINTIFY_API_BASE;
// Get Printify API key - fallback for Cloud Functions environment
function getPrintifyApiKey() {
    return process.env.PRINTIFY_API_KEY || 'eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzN2Q0YmQzMDM1ZmUxMWU5YTgwM2FiN2VlYjNjY2M5NyIsImp0aSI6ImFiM2JkYjFlZTk2ZmFkYWI0ZTg5NzBlYjM3YjZlYjI0ZWUwZDM5YTkwMDk0ZjE1ZGIwNzZjZWRhY2Y5ZjU1MjQ5M2RhNzMyYzI1ZTNiNGNkIiwiaWF0IjoxNzY3ODExMzQ5LjA2MjgzOSwibmJmIjoxNzY3ODExMzQ5LjA2Mjg0MSwiZXhwIjoxNzk5MzQ3MzQ5LjA1NjU0LCJzdWIiOiIyMTA3MDg5MiIsInNjb3BlcyI6WyJzaG9wcy5tYW5hZ2UiLCJzaG9wcy5yZWFkIiwiY2F0YWxvZy5yZWFkIiwib3JkZXJzLnJlYWQiLCJvcmRlcnMud3JpdGUiLCJwcm9kdWN0cy5yZWFkIiwicHJvZHVjdHMud3JpdGUiLCJ3ZWJob29rcy5yZWFkIiwid2ViaG9va3Mud3JpdGUiLCJ1cGxvYWRzLnJlYWQiLCJ1cGxvYWRzLndyaXRlIiwicHJpbnRfcHJvdmlkZXJzLnJlYWQiLCJ1c2VyLmluZm8iXX0.GR2_7kqoGmuJTw_0bGOfsFuanPEOpwy7M4iGgQ7x25a7Bh4-5vJ8E5xX46CLV3IRs8j24roKrB9p47cmfX1FSv-oIyv-Zlzc5WjIQDq-Y3US8fCedLqNgP3-mokMCaRi9LVdMtH8c9PQ_WkHsHCK6W21iVpebz5NEYkf0Pf4aUekwZBoQvrF1VloYdF6EqEp92AJZ-rO_o3h--_kV_lifjoS5eAzD5lkwJjYp5Q9j6Io-WwM1B32GOhPiNJv-Dp7FJb05nsoSiXBW9i8UuejYhSvcuI487_gbz4tKvyjreFNAUtP9JhuAYvrwDrTwV01qicKl18qP_bbaQSMqfagBMqNE9cl7-eOhX48yCp9CEKoSrhUSsdSvKChYuLinQ89g7RBbrra-q7RzjcE7bpv_7Mn7HUHO8rX6Wg8ZxWI4rxEixCUqt1YEBJ9kfFMUL4IZUM-qcu-vXdZ8GPqfymD27GV7XzFYmrWkm7fKGjFvkbuOL5u9ZeVdzJlJtnk_yztg4AUwSHtZCiAMueWLNRmUrMVQWuYiQptfXdexujBK9aaBlOcdAAX8PEIaicqHSyLlROsuiK_ZRPRRLwGwU45Coe-e_GgaKBpq8lPTHvU0j9F_L45Y9HY4gXHQvTkNM5wcPfoMAvcz2rwPGzZyvi3ejuaEP4lSCfUi-Wiozkfdiw';
}
// Get Printify Shop ID - fallback for Cloud Functions environment
function getPrintifyShopId() {
    return (process.env.PRINTIFY_SHOP_ID || '19642701').trim();
}
class PrintifyClient {
    get headers() {
        return {
            'Authorization': `Bearer ${getPrintifyApiKey()}`,
            'Content-Type': 'application/json',
        };
    }
    get isConfigured() {
        const key = getPrintifyApiKey();
        const shopId = getPrintifyShopId();
        return !!key && key.length > 10 && !!shopId;
    }
    async request(method, endpoint, body) {
        const url = `${PRINTIFY_API_BASE}${endpoint}`;
        const options = { method, headers: this.headers };
        if (body)
            options.body = JSON.stringify(body);
        const response = await fetch(url, options);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Printify API error: ${response.status} - ${errorText}`);
        }
        return response.json();
    }
    async createOrder(orderRequest) {
        const shopId = getPrintifyShopId();
        return this.request('POST', `/shops/${shopId}/orders.json`, orderRequest);
    }
    async submitOrderToProduction(orderId) {
        const shopId = getPrintifyShopId();
        await this.request('POST', `/shops/${shopId}/orders/${orderId}/send_to_production.json`, {});
    }
    async getOrder(orderId) {
        const shopId = getPrintifyShopId();
        return this.request('GET', `/shops/${shopId}/orders/${orderId}.json`);
    }
    async getOrders() {
        const shopId = getPrintifyShopId();
        const result = await this.request('GET', `/shops/${shopId}/orders.json`);
        return result.data || [];
    }
    async getCatalogBlueprints() {
        return this.request('GET', '/catalog/blueprints.json');
    }
    async getBlueprintDetails(blueprintId) {
        return this.request('GET', `/catalog/blueprints/${blueprintId}.json`);
    }
    async getPrintProviders(blueprintId) {
        return this.request('GET', `/catalog/blueprints/${blueprintId}/print_providers.json`);
    }
    async getAllPrintProviders() {
        return this.request('GET', '/catalog/print_providers.json');
    }
    async getVariants(blueprintId, printProviderId) {
        return this.request('GET', `/catalog/blueprints/${blueprintId}/print_providers/${printProviderId}/variants.json`);
    }
    async uploadImage(fileName, url) {
        return this.request('POST', '/uploads/images.json', { file_name: fileName, url });
    }
    async createProduct(product) {
        const shopId = getPrintifyShopId();
        return this.request('POST', `/shops/${shopId}/products.json`, product);
    }
    async publishProduct(productId) {
        const shopId = getPrintifyShopId();
        await this.request('POST', `/shops/${shopId}/products/${productId}/publish.json`, {
            title: true,
            description: true,
            images: true,
            variants: true,
            tags: true,
            keyFeatures: true,
            shipping_template: true,
        });
    }
    async getProduct(productId) {
        const shopId = getPrintifyShopId();
        return this.request('GET', `/shops/${shopId}/products/${productId}.json`);
    }
    async updateProduct(productId, updates) {
        const shopId = getPrintifyShopId();
        await this.request('PUT', `/shops/${shopId}/products/${productId}.json`, updates);
    }
}
exports.PrintifyClient = PrintifyClient;
const printifyClient = new PrintifyClient();
exports.printifyClient = printifyClient;
async function submitOrderToPrintify(orderId, shippingAddress) {
    try {
        if (!printifyClient.isConfigured) {
            return { success: false, error: 'Printify API not configured (missing API key or shop ID)' };
        }
        // Get the order
        const orderDoc = await core_1.db.collection('orders').doc(orderId).get();
        if (!orderDoc.exists) {
            return { success: false, error: 'Order not found' };
        }
        const order = orderDoc.data();
        // Check if already submitted
        if (order.printifyOrderId) {
            return { success: true, printifyOrderId: order.printifyOrderId };
        }
        // Get order items
        const orderItemsSnapshot = await core_1.db.collection('orderItems')
            .where('orderId', '==', orderId)
            .get();
        if (orderItemsSnapshot.empty) {
            return { success: false, error: 'No order items found' };
        }
        const lineItems = [];
        for (const doc of orderItemsSnapshot.docs) {
            const item = doc.data();
            const customization = item.customization;
            if (!customization?.printifyProductId || !customization?.printifyVariantId) {
                console.warn(`Order item ${doc.id} missing Printify product/variant IDs`);
                continue;
            }
            lineItems.push({
                product_id: customization.printifyProductId,
                variant_id: customization.printifyVariantId,
                quantity: item.quantity || 1,
                print_areas: customization.printAreas,
            });
        }
        if (!lineItems.length) {
            return { success: false, error: 'No valid line items for Printify (missing product/variant IDs)' };
        }
        const addressTo = {
            first_name: shippingAddress.firstName,
            last_name: shippingAddress.lastName,
            email: shippingAddress.email,
            phone: shippingAddress.phone || '',
            country: shippingAddress.country,
            region: shippingAddress.region,
            address1: shippingAddress.address1,
            address2: shippingAddress.address2,
            city: shippingAddress.city,
            zip: shippingAddress.zip,
        };
        const printifyOrderRequest = {
            external_id: orderId,
            label: `QR Gear Order ${orderId.slice(0, 8).toUpperCase()}`,
            line_items: lineItems,
            shipping_method: 1, // Standard shipping
            send_shipping_notification: true,
            address_to: addressTo,
        };
        // Create order in Printify
        const printifyOrder = await printifyClient.createOrder(printifyOrderRequest);
        // Update order status
        await core_1.db.collection('orders').doc(orderId).update({
            printifyOrderId: printifyOrder.id,
            status: 'processing',
            updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        // Submit to production
        await printifyClient.submitOrderToProduction(printifyOrder.id);
        // Update status to in_production
        await core_1.db.collection('orders').doc(orderId).update({
            status: 'in_production',
            updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`Order ${orderId} submitted to Printify: ${printifyOrder.id}`);
        return { success: true, printifyOrderId: printifyOrder.id };
    }
    catch (error) {
        console.error(`Failed to submit order ${orderId} to Printify:`, error);
        return { success: false, error: error.message };
    }
}
async function checkPrintifyOrderStatus(printifyOrderId) {
    try {
        if (!printifyClient.isConfigured) {
            return null;
        }
        const printifyOrder = await printifyClient.getOrder(printifyOrderId);
        const status = printifyOrder.status?.toLowerCase() || 'unknown';
        const shipments = printifyOrder.shipments || [];
        if (shipments.length > 0) {
            const latestShipment = shipments[shipments.length - 1];
            return {
                status,
                trackingNumber: latestShipment.tracking_number,
                trackingUrl: latestShipment.tracking_url,
                carrier: latestShipment.carrier,
            };
        }
        return { status };
    }
    catch (error) {
        console.error(`Failed to check Printify order status for ${printifyOrderId}:`, error);
        return null;
    }
}
//# sourceMappingURL=printify.js.map