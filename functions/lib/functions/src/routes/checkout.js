"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const order_service_1 = require("../services/order-service");
const email_1 = require("../services/email");
const constants_1 = require("../constants");
const stripe_1 = __importDefault(require("stripe"));
function register(app) {
    app.post('/public/packet-checkout', async (req, res) => {
        try {
            const { packetId, selectedShirtSize, referrerId: rawReferrerId } = req.body;
            if (!packetId) {
                res.status(400).json({ error: "packetId is required" });
                return;
            }
            let referrerId = '';
            if (rawReferrerId) {
                const referrerDoc = await core_1.db.collection('users').doc(rawReferrerId).get();
                if (referrerDoc.exists) {
                    referrerId = rawReferrerId;
                }
                else {
                    console.warn(`[PacketCheckout] Invalid referrerId '${rawReferrerId}' — not a real user, ignoring`);
                }
            }
            const packetDoc = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(packetId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: "Product not found" });
                return;
            }
            const packet = packetDoc.data();
            if (packet.status !== 'published' && packet.status !== 'active') {
                res.status(400).json({ error: "Product is no longer available" });
                return;
            }
            const size = selectedShirtSize || packet.selectedShirtSize || 'M';
            const { totalPrice: serverTotal } = await (0, order_service_1.freezePacketPricing)({ packet, selectedSize: size });
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                res.status(503).json({ error: "Payment not configured" });
                return;
            }
            const stripe = new stripe_1.default(stripeKey, { apiVersion: '2023-10-16' });
            const productTitle = packet.title || 'QR Gear Custom Product';
            const productImage = packet.itemImage || packet.socialPacket?.itemImage || null;
            const packetBaseUrl = process.env.FIREBASE_HOSTING_URL || 'https://qrgear-c1ffd.web.app';
            const session = await stripe.checkout.sessions.create({
                payment_method_types: ['card'],
                line_items: [{
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: productTitle,
                                description: `Size: ${size}`,
                                images: productImage ? [productImage.startsWith('http') ? productImage : `${packetBaseUrl}${productImage}`] : [],
                            },
                            unit_amount: Math.round(serverTotal * 100),
                        },
                        quantity: 1,
                    }],
                mode: 'payment',
                shipping_address_collection: {
                    allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR', 'ES', 'IT', 'NL', 'BE'],
                },
                success_url: `${packetBaseUrl}/p/success?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${packetBaseUrl}/p/${packetId}`,
                metadata: {
                    packetId,
                    selectedShirtSize: size,
                    referrerId: referrerId || '',
                    source: 'packet_share',
                    memberId: packet.memberId || '',
                    serverTotal: serverTotal.toString(),
                },
                customer_creation: 'if_required',
            });
            console.log(`[PacketCheckout] Created session ${session.id} for packet ${packetId}, total: $${serverTotal}`);
            res.json({ url: session.url, sessionId: session.id, total: serverTotal });
        }
        catch (error) {
            console.error('[PacketCheckout] Error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/public/packet-checkout/verify/:sessionId', async (req, res) => {
        try {
            const { sessionId } = req.params;
            const stripeKey = process.env.STRIPE_SECRET_KEY;
            if (!stripeKey) {
                res.status(503).json({ error: "Payment not configured" });
                return;
            }
            const stripe = new stripe_1.default(stripeKey, { apiVersion: '2023-10-16' });
            const session = await stripe.checkout.sessions.retrieve(sessionId);
            if (session.payment_status !== 'paid') {
                res.status(400).json({ error: "Payment not completed", status: session.payment_status });
                return;
            }
            const packetId = session.metadata?.packetId;
            const referrerId = session.metadata?.referrerId;
            const selectedSize = session.metadata?.selectedShirtSize || 'M';
            const creatorMemberId = session.metadata?.memberId || '';
            const serverTotal = parseFloat(session.metadata?.serverTotal || '0');
            if (!packetId) {
                res.status(400).json({ error: "No packet linked to this session" });
                return;
            }
            const existingOrderQuery = await core_1.db.collection('orders_public')
                .where('stripeSessionId', '==', sessionId).limit(1).get();
            if (!existingOrderQuery.empty) {
                const existingOrder = existingOrderQuery.docs[0].data();
                res.json({ success: true, alreadyProcessed: true, order: { id: existingOrderQuery.docs[0].id, ...existingOrder } });
                return;
            }
            const packetDoc = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(packetId).get();
            const packet = packetDoc.exists ? packetDoc.data() : {};
            const buyerEmail = session.customer_details?.email || '';
            const buyerName = session.customer_details?.name || '';
            const shippingAddress = session.shipping_details?.address || null;
            const totalAmount = serverTotal || (session.amount_total / 100);
            const { orderId, claimCode, alreadyExisted, orderData } = await (0, order_service_1.createCanonicalOrder)({
                source: 'packet_share',
                stripeSessionId: sessionId,
                stripePaymentIntentId: session.payment_intent,
                buyerEmail,
                buyerName,
                shippingAddress,
                totalAmount,
                packetId,
                packet,
                selectedSize,
                referrerId: referrerId || '',
                creatorMemberId,
            });
            if (!alreadyExisted) {
                const productCost = packet.pricingSnapshot?.printifyCostBase || packet.pricingSnapshot?.totalCostBase || 0;
                await (0, order_service_1.writePayoutAttribution)({
                    source: 'packet_share',
                    orderId,
                    orderTotal: totalAmount,
                    productCost,
                    creatorMemberId,
                    referrerId: referrerId || undefined,
                    buyerEmail: buyerEmail || undefined,
                    packetId,
                });
                // Send activation email with claim code
                if (buyerEmail && claimCode) {
                    (0, email_1.sendActivationEmail)({
                        customerEmail: buyerEmail,
                        customerName: buyerName || 'Customer',
                        activationCode: claimCode,
                        productName: packet.title || packet.productTitle || 'QR Gear Product',
                        previewImageUrl: packet.itemImage || packet.mockupUrl || null,
                        orderId,
                    }).catch((err) => console.error('[Checkout] Activation email error (non-fatal):', err));
                }
            }
            res.json({
                success: true,
                alreadyProcessed: alreadyExisted,
                order: { id: orderId, ...orderData },
                claimCode,
            });
        }
        catch (error) {
            console.error('[PacketCheckout Verify] Error:', error.message);
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=checkout.js.map