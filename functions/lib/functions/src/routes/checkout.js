"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const stripe_1 = __importDefault(require("stripe"));
function register(app) {
    // ============ PACKET CHECKOUT (Share Link → Buy) ============
    app.post('/public/packet-checkout', async (req, res) => {
        try {
            const { packetId, selectedShirtSize, referrerId } = req.body;
            if (!packetId) {
                res.status(400).json({ error: "packetId is required" });
                return;
            }
            const packetDoc = await core_1.db.collection('memberPackets').doc(packetId).get();
            if (!packetDoc.exists) {
                res.status(404).json({ error: "Product not found" });
                return;
            }
            const packet = packetDoc.data();
            if (packet.status !== 'published' && packet.status !== 'active') {
                res.status(400).json({ error: "Product is no longer available" });
                return;
            }
            const pricingDoc = await core_1.db.collection("testSettings").doc("pricing").get();
            const ps = pricingDoc.exists ? pricingDoc.data() : null;
            const defaultSU = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
            const sizeUpcharges = ps?.sizeUpcharges || defaultSU;
            let basePrice = 0;
            if (packet.pricingSnapshot?.retailPriceBase) {
                basePrice = packet.pricingSnapshot.retailPriceBase;
            }
            else if (packet.boundProduct?.retailPrice) {
                basePrice = parseFloat(packet.boundProduct.retailPrice);
            }
            else if (packet.socialPacket?.retailPrice) {
                basePrice = parseFloat(packet.socialPacket.retailPrice);
            }
            else {
                basePrice = ps?.baseRetailPrice || 29.99;
            }
            const size = selectedShirtSize || packet.selectedShirtSize || 'M';
            const sizeUpcharge = sizeUpcharges[size] || 0;
            const serverTotal = Math.round((basePrice + sizeUpcharge) * 100) / 100;
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
            const packetDoc = await core_1.db.collection('memberPackets').doc(packetId).get();
            const packet = packetDoc.exists ? packetDoc.data() : {};
            const buyerEmail = session.customer_details?.email || '';
            const buyerName = session.customer_details?.name || '';
            const shippingAddress = session.shipping_details?.address || null;
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let claimCode = '';
            for (let i = 0; i < 8; i++)
                claimCode += chars.charAt(Math.floor(Math.random() * chars.length));
            const now = new Date();
            const orderData = {
                packetId,
                stripeSessionId: sessionId,
                stripePaymentIntentId: session.payment_intent,
                buyerEmail,
                buyerName,
                shippingAddress,
                claimCode,
                productTitle: packet.title || 'QR Gear Product',
                qrType: packet.qrType || packet.packetType || 'qr-basic',
                selectedColor: packet.selectedColor || '',
                selectedSize,
                totalAmount: serverTotal || (session.amount_total / 100),
                mockupUrl: packet.itemImage || null,
                creatorMemberId,
                referrerId: referrerId || '',
                source: 'packet_share',
                status: 'paid',
                createdAt: now.toISOString(),
                updatedAt: now.toISOString(),
            };
            const orderRef = await core_1.db.collection('orders_public').add(orderData);
            console.log(`[PacketCheckout] Order ${orderRef.id} created for packet ${packetId}`);
            const productCost = packet.pricingSnapshot?.printifyCostBase || packet.pricingSnapshot?.totalCostBase || 0;
            const profit = serverTotal - productCost;
            if (creatorMemberId && profit > 0) {
                try {
                    const creatorEarnings = Math.round((profit * 0.25) * 100) / 100;
                    await core_1.db.collection('member_earnings').add({
                        memberId: creatorMemberId,
                        orderId: orderRef.id,
                        packetId,
                        orderTotal: serverTotal,
                        productCost,
                        profit,
                        sharePercent: 25,
                        earnings: creatorEarnings,
                        type: 'product_sale',
                        status: 'pending',
                        createdAt: now.toISOString(),
                    });
                    console.log(`[Member Earnings] Creator ${creatorMemberId} earned $${creatorEarnings} from packet order ${orderRef.id}`);
                }
                catch (earnErr) {
                    console.error('[Member Earnings] Non-fatal error:', earnErr.message);
                }
            }
            if (referrerId && buyerEmail) {
                try {
                    const buyerKey = buyerEmail;
                    const existingRef = await core_1.db.collection('referrals')
                        .where('buyerKey', '==', buyerKey).limit(1).get();
                    if (existingRef.empty) {
                        await core_1.db.collection('referrals').add({
                            referrerId,
                            buyerKey,
                            profitSharePercent: 25,
                            lifetime: true,
                            source: 'packet_checkout',
                            createdAt: now.toISOString(),
                        });
                        console.log(`[Referral] Captured: ${referrerId} → ${buyerKey}`);
                    }
                    if (profit > 0 && referrerId !== creatorMemberId) {
                        const referralEarnings = Math.round((profit * 0.25) * 100) / 100;
                        await core_1.db.collection('referral_earnings').add({
                            memberId: referrerId,
                            orderId: orderRef.id,
                            buyerKey,
                            orderTotal: serverTotal,
                            productCost,
                            profit,
                            sharePercent: 25,
                            earnings: referralEarnings,
                            status: 'pending',
                            createdAt: now.toISOString(),
                        });
                        console.log(`[Referral Earnings] ${referrerId} earned $${referralEarnings} from packet order ${orderRef.id}`);
                    }
                }
                catch (refErr) {
                    console.error('[Referral] Non-fatal error recording referral:', refErr.message);
                }
            }
            res.json({
                success: true,
                order: { id: orderRef.id, ...orderData },
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