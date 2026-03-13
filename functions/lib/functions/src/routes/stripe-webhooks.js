"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const order_service_1 = require("../services/order-service");
const stripe_1 = __importDefault(require("stripe"));
const nexusmail_1 = require("../nexusmail");
function register(app) {
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
                    const source = session.metadata?.source;
                    console.log(`Checkout session completed: ${session.id}, source=${source || 'direct_cart'}`);
                    if (source === 'external_embed') {
                        try {
                            await (0, order_service_1.confirmEmbedOrderPayout)(session.id);
                        }
                        catch (embedErr) {
                            console.error('[Webhook] Error confirming embed payout:', embedErr.message);
                        }
                        break;
                    }
                    try {
                        const userId = session.metadata?.userId;
                        const cartItemIds = session.metadata?.cartItemIds ? JSON.parse(session.metadata.cartItemIds) : [];
                        if (!userId) {
                            console.error('No userId in checkout session metadata');
                            break;
                        }
                        let cartItems = [];
                        if (cartItemIds.length > 0) {
                            for (const itemId of cartItemIds) {
                                const itemDoc = await core_1.db.collection('cartItems').doc(itemId).get();
                                if (itemDoc.exists) {
                                    cartItems.push({ id: itemDoc.id, ...itemDoc.data() });
                                }
                            }
                        }
                        else {
                            const cartSnapshot = await core_1.db.collection('cartItems').where('userId', '==', userId).get();
                            cartItems = cartSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        }
                        if (cartItems.length === 0) {
                            console.warn('No cart items found for order creation');
                            break;
                        }
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
                        const totalAmount = cartItems.reduce((sum, item) => {
                            return sum + parseFloat(item.price || '0') * (item.quantity || 1);
                        }, 0);
                        const { orderId, alreadyExisted } = await (0, order_service_1.createCanonicalOrder)({
                            source: 'direct_cart',
                            stripeSessionId: session.id,
                            stripePaymentIntentId: session.payment_intent,
                            buyerEmail: customerDetails?.email || '',
                            buyerName: customerDetails?.name || '',
                            shippingAddress,
                            totalAmount,
                            userId,
                            cartItems,
                        });
                        if (alreadyExisted) {
                            console.log(`[Webhook] Order already exists for session ${session.id}, skipping side effects`);
                            break;
                        }
                        const referrerId = session.metadata?.referrerId;
                        if (referrerId) {
                            await (0, order_service_1.writePayoutAttribution)({
                                source: 'direct_cart',
                                orderId,
                                orderTotal: totalAmount,
                                productCost: 0,
                                referrerId,
                                buyerEmail: customerDetails?.email || undefined,
                            });
                        }
                        const customerEmail = customerDetails?.email;
                        if (customerEmail) {
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
                            const customerName = shippingAddress
                                ? `${shippingAddress.firstName} ${shippingAddress.lastName}`.trim()
                                : customerDetails?.name || 'Customer';
                            await (0, nexusmail_1.sendOrderConfirmation)(core_1.db, orderId, customerEmail, customerName, emailItems, totalAmount.toFixed(2), shippingAddress ? {
                                address1: shippingAddress.address1,
                                address2: shippingAddress.address2,
                                city: shippingAddress.city,
                                region: shippingAddress.region,
                                zip: shippingAddress.zip,
                                country: shippingAddress.country,
                            } : undefined);
                        }
                        const batch = core_1.db.batch();
                        for (const item of cartItems) {
                            batch.delete(core_1.db.collection('cartItems').doc(item.id));
                        }
                        await batch.commit();
                        console.log(`[OrderService] Cleared ${cartItems.length} cart items for user ${userId}`);
                    }
                    catch (orderError) {
                        console.error('Error creating order from checkout:', orderError);
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