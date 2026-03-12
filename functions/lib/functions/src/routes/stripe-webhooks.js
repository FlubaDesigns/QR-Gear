"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const stripe_1 = __importDefault(require("stripe"));
const nexusmail_1 = require("../nexusmail");
function register(app) {
    // ============ STRIPE WEBHOOKS ============
    app.post('/webhooks/stripe', async (req, res) => {
        try {
            const sig = req.headers['stripe-signature'];
            const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
            if (!sig || !webhookSecret) {
                res.status(400).json({ error: 'Missing signature or webhook secret' });
                return;
            }
            const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeSecretKey) {
                res.status(500).json({ error: 'Stripe not configured' });
                return;
            }
            const stripe = new stripe_1.default(stripeSecretKey, { apiVersion: '2023-10-16' });
            let event;
            try {
                event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
            }
            catch (err) {
                console.error('Webhook signature verification failed:', err.message);
                res.status(400).json({ error: `Webhook Error: ${err.message}` });
                return;
            }
            switch (event.type) {
                case 'checkout.session.completed': {
                    const session = event.data.object;
                    console.log('Checkout session completed:', session.id);
                    // Create order from checkout session
                    try {
                        const userId = session.metadata?.userId;
                        const cartItemIds = session.metadata?.cartItemIds ? JSON.parse(session.metadata.cartItemIds) : [];
                        if (!userId) {
                            console.error('No userId in checkout session metadata');
                            break;
                        }
                        // Idempotency check: prevent duplicate orders from Stripe retries
                        const existingOrderSnapshot = await core_1.db.collection('orders')
                            .where('stripeSessionId', '==', session.id)
                            .limit(1)
                            .get();
                        if (!existingOrderSnapshot.empty) {
                            console.log(`Order already exists for session ${session.id}, skipping`);
                            break;
                        }
                        // Get cart items
                        let cartItems = [];
                        if (cartItemIds.length > 0) {
                            // Use specific cart item IDs from metadata
                            for (const itemId of cartItemIds) {
                                const itemDoc = await core_1.db.collection('cartItems').doc(itemId).get();
                                if (itemDoc.exists) {
                                    cartItems.push({ id: itemDoc.id, ...itemDoc.data() });
                                }
                            }
                        }
                        else {
                            // Fallback: get all cart items for user
                            const cartSnapshot = await core_1.db.collection('cartItems').where('userId', '==', userId).get();
                            cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        }
                        if (cartItems.length === 0) {
                            console.warn('No cart items found for order creation');
                            break;
                        }
                        // Calculate total from cart items
                        const totalAmount = cartItems.reduce((sum, item) => {
                            return sum + parseFloat(item.price || '0') * (item.quantity || 1);
                        }, 0);
                        // Extract shipping address from Stripe session
                        const shippingDetails = session.shipping_details;
                        const customerDetails = session.customer_details;
                        const shippingAddress = shippingDetails ? {
                            firstName: shippingDetails.name?.split(' ')[0] || '',
                            lastName: shippingDetails.name?.split(' ').slice(1).join(' ') || '',
                            email: customerDetails?.email || '',
                            phone: shippingDetails.phone || customerDetails?.phone || '',
                            address1: shippingDetails.address?.line1 || '',
                            address2: shippingDetails.address?.line2 || '',
                            city: shippingDetails.address?.city || '',
                            region: shippingDetails.address?.state || '',
                            zip: shippingDetails.address?.postal_code || '',
                            country: shippingDetails.address?.country || 'US',
                        } : null;
                        // Create order
                        const orderRef = await core_1.db.collection('orders').add({
                            userId,
                            status: 'paid',
                            totalAmount: totalAmount.toFixed(2),
                            stripeSessionId: session.id,
                            stripePaymentIntentId: session.payment_intent,
                            customerEmail: session.customer_details?.email || null,
                            shippingAddress,
                            createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                            updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                        });
                        console.log(`Order created: ${orderRef.id}`);
                        // Create order items from cart
                        for (const item of cartItems) {
                            await core_1.db.collection('orderItems').add({
                                orderId: orderRef.id,
                                productId: item.productId,
                                quantity: item.quantity || 1,
                                price: item.price,
                                customization: item.customization || {},
                                createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
                            });
                        }
                        console.log(`Created ${cartItems.length} order items for order ${orderRef.id}`);
                        // Send order confirmation email BEFORE clearing cart (use orderItems data)
                        const customerEmail = customerDetails?.email;
                        if (customerEmail) {
                            // Fetch order items we just created for accurate email data
                            const orderItemsSnapshot = await core_1.db.collection('orderItems')
                                .where('orderId', '==', orderRef.id)
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
                            const customerName = shippingAddress
                                ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim()
                                : customerDetails?.name || 'Customer';
                            // Use NexusMail for order confirmation (queue-first, idempotent)
                            await (0, nexusmail_1.sendOrderConfirmation)(core_1.db, orderRef.id, customerEmail, customerName, emailItems, totalAmount.toFixed(2), shippingAddress ? {
                                address1: shippingAddress.address1,
                                address2: shippingAddress.address2,
                                city: shippingAddress.city,
                                region: shippingAddress.region,
                                zip: shippingAddress.zip,
                                country: shippingAddress.country,
                            } : undefined);
                        }
                        // Clear cart items AFTER email is sent
                        const batch = core_1.db.batch();
                        for (const item of cartItems) {
                            batch.delete(core_1.db.collection('cartItems').doc(item.id));
                        }
                        await batch.commit();
                        console.log(`Cleared ${cartItems.length} cart items for user ${userId}`);
                    }
                    catch (orderError) {
                        console.error('Error creating order from checkout:', orderError);
                        // Don't fail the webhook - order can be manually reconciled
                    }
                    break;
                }
                case 'payment_intent.succeeded': {
                    const paymentIntent = event.data.object;
                    console.log('Payment succeeded:', paymentIntent.id);
                    break;
                }
                default:
                    console.log(`Unhandled event type: ${event.type}`);
            }
            res.json({ received: true });
        }
        catch (error) {
            console.error('Webhook error:', error);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=stripe-webhooks.js.map