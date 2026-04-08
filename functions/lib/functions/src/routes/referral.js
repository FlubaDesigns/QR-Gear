"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = register;
const core_1 = require("../core");
const constants_1 = require("../constants");
function register(app) {
    // ============ REFERRAL TRACKING (Share & Earn — Forever) ============
    app.post('/public/referral/capture', async (req, res) => {
        try {
            const { referrerId, buyerEmail, buyerUserId } = req.body;
            if (!referrerId) {
                res.status(400).json({ error: "referrerId is required" });
                return;
            }
            if (!buyerEmail && !buyerUserId) {
                res.status(400).json({ error: "buyerEmail or buyerUserId is required" });
                return;
            }
            const buyerKey = buyerUserId || buyerEmail;
            const existingQuery = await core_1.db.collection('referrals')
                .where('buyerKey', '==', buyerKey)
                .limit(1).get();
            if (!existingQuery.empty) {
                res.json({ success: true, message: 'Referral already exists', referralId: existingQuery.docs[0].id, existing: true });
                return;
            }
            const referralData = {
                referrerId,
                buyerKey,
                buyerEmail: buyerEmail || null,
                buyerUserId: buyerUserId || null,
                profitSharePercent: 25,
                lifetime: true,
                createdAt: new Date().toISOString(),
            };
            const docRef = await core_1.db.collection('referrals').add(referralData);
            console.log(`[Referral] Captured: ${referrerId} -> ${buyerKey} (${docRef.id})`);
            res.json({ success: true, referralId: docRef.id });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/public/referral/lookup', async (req, res) => {
        try {
            const buyerKey = (req.query.buyerUserId || req.query.buyerEmail);
            if (!buyerKey) {
                res.status(400).json({ error: "buyerUserId or buyerEmail required" });
                return;
            }
            const snapshot = await core_1.db.collection('referrals').where('buyerKey', '==', buyerKey).limit(1).get();
            if (snapshot.empty) {
                res.json({ success: true, referral: null });
                return;
            }
            const doc = snapshot.docs[0];
            res.json({ success: true, referral: { id: doc.id, ...doc.data() } });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.get('/public/member-packet/:packetId', async (req, res) => {
        try {
            const { packetId } = req.params;
            if (!packetId) {
                res.status(400).json({ error: "packetId is required" });
                return;
            }
            let doc = await core_1.db.collection(constants_1.MEMBER_PACKETS_COLLECTION).doc(packetId).get();
            if (!doc.exists) {
                doc = await core_1.db.collection('productPackets').doc(packetId).get();
            }
            if (!doc.exists) {
                res.status(404).json({ error: "Packet not found" });
                return;
            }
            const data = doc.data();
            const publicData = {
                id: doc.id,
                title: data.title || 'QR Gear Product',
                description: data.description || '',
                itemImage: data.itemImage || data.qrCanvasMockup || data.qrBasicMockup || data.qrPlusMockup || data.qrPlayMockup || data.composeMockup || data.productGraphic || null,
                retailPrice: data.pricingSnapshot?.retailPriceBase || data.boundProduct?.retailPrice || data.pricingSnapshot?.customerPrice || null,
                productTitle: data.boundProduct?.title || data.title || 'QR Gear Product',
                productImage: data.boundProduct?.imageUrl || null,
                selectedColor: data.selectedColor || null,
                selectedShirtSize: data.selectedShirtSize || null,
                qrType: data.qrType || data.packetType || null,
                memberId: data.memberId || null,
                status: data.status || 'unknown',
            };
            res.json({ success: true, packet: publicData });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
    app.post('/public/referral/record-earnings', async (req, res) => {
        try {
            const { orderId, buyerKey, orderTotal, productCost } = req.body;
            if (!orderId || !buyerKey) {
                res.status(400).json({ error: "orderId and buyerKey required" });
                return;
            }
            const refSnap = await core_1.db.collection('referrals').where('buyerKey', '==', buyerKey).limit(1).get();
            if (refSnap.empty) {
                res.json({ success: true, message: 'No referral found for buyer', earnings: 0 });
                return;
            }
            const referral = refSnap.docs[0].data();
            const profit = (orderTotal || 0) - (productCost || 0);
            if (profit <= 0) {
                res.json({ success: true, message: 'No profit to share', earnings: 0 });
                return;
            }
            const sharePercent = referral.profitSharePercent || 25;
            const earnings = Math.round((profit * sharePercent / 100) * 100) / 100;
            const earningsData = {
                memberId: referral.referrerId,
                orderId,
                buyerKey,
                referralId: refSnap.docs[0].id,
                orderTotal,
                productCost,
                profit,
                sharePercent,
                earnings,
                status: 'pending',
                createdAt: new Date().toISOString(),
            };
            const earningsRef = await core_1.db.collection('referral_earnings').add(earningsData);
            console.log(`[Referral Earnings] ${referral.referrerId} earned $${earnings} from order ${orderId}`);
            res.json({ success: true, earningsId: earningsRef.id, earnings });
        }
        catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}
//# sourceMappingURL=referral.js.map