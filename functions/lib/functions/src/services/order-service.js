"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freezePricingSnapshot = freezePricingSnapshot;
exports.freezePacketPricing = freezePacketPricing;
exports.createCanonicalOrder = createCanonicalOrder;
exports.confirmEmbedOrderPayout = confirmEmbedOrderPayout;
exports.writePayoutAttribution = writePayoutAttribution;
const core_1 = require("../core");
const constants_1 = require("../constants");
const surfaces_1 = require("../../../shared/surfaces");
function freezePricingSnapshot(input) {
    return (0, surfaces_1.computePricingSnapshot)({
        salePrice: input.salePrice,
        productCost: input.productCost,
        providerCost: input.providerCost,
        platformFeeAmount: input.platformFeeAmount,
        shippingCostBurden: input.shippingCostBurden,
        discountBurden: input.discountBurden,
        affiliatePercent: input.affiliatePercent,
        currency: input.currency,
    });
}
async function freezePacketPricing(ctx) {
    const pricingDoc = await core_1.db.collection('testSettings').doc('pricing').get();
    const ps = pricingDoc.exists ? pricingDoc.data() : null;
    const defaultSU = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
    const sizeUpcharges = ps?.sizeUpcharges || defaultSU;
    let basePrice = 0;
    if (ctx.packet.pricingSnapshot?.retailPriceBase) {
        basePrice = ctx.packet.pricingSnapshot.retailPriceBase;
    }
    else if (ctx.packet.boundProduct?.retailPrice) {
        basePrice = parseFloat(ctx.packet.boundProduct.retailPrice);
    }
    else if (ctx.packet.socialPacket?.retailPrice) {
        basePrice = parseFloat(ctx.packet.socialPacket.retailPrice);
    }
    else {
        basePrice = ps?.baseRetailPrice || 29.99;
    }
    const sizeUpcharge = sizeUpcharges[ctx.selectedSize] || 0;
    const totalPrice = Math.round((basePrice + sizeUpcharge) * 100) / 100;
    const productCost = ctx.packet.pricingSnapshot?.printifyCostBase || ctx.packet.pricingSnapshot?.totalCostBase || 0;
    const snapshot = freezePricingSnapshot({
        salePrice: totalPrice,
        productCost,
        affiliatePercent: 25,
        currency: 'USD',
    });
    return { totalPrice, productCost, snapshot };
}
function getPeriodKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function generateClaimCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++)
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    return code;
}
async function createCanonicalOrder(input) {
    const now = new Date();
    const nowISO = now.toISOString();
    if (input.source === 'direct_cart') {
        return createDirectCartOrder(input, nowISO);
    }
    else if (input.source === 'packet_share') {
        return createPacketOrder(input, nowISO);
    }
    else {
        return createEmbedOrder(input, nowISO);
    }
}
async function createDirectCartOrder(input, nowISO) {
    const existingSnapshot = await core_1.db.collection('orders')
        .where('stripeSessionId', '==', input.stripeSessionId)
        .limit(1).get();
    if (!existingSnapshot.empty) {
        const doc = existingSnapshot.docs[0];
        console.log(`[OrderService] Order already exists for session ${input.stripeSessionId}, skipping`);
        return { orderId: doc.id, alreadyExisted: true, orderData: doc.data() };
    }
    const cartItems = input.cartItems || [];
    const totalAmount = cartItems.reduce((sum, item) => {
        return sum + parseFloat(item.price || '0') * (item.quantity || 1);
    }, 0);
    const pricingSnapshot = input.pricingSnapshot || freezePricingSnapshot({
        salePrice: totalAmount,
        productCost: 0,
        currency: 'USD',
    });
    const shippingAddress = input.shippingAddress;
    const orderData = {
        userId: input.userId,
        status: 'paid',
        totalAmount: totalAmount.toFixed(2),
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId || null,
        customerEmail: input.buyerEmail || null,
        shippingAddress,
        pricingSnapshot,
        source: 'direct_cart',
        createdAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: core_1.admin.firestore.FieldValue.serverTimestamp(),
    };
    const orderRef = await core_1.db.collection('orders').add(orderData);
    console.log(`[OrderService] Direct cart order created: ${orderRef.id}`);
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
    console.log(`[OrderService] Created ${cartItems.length} order items for order ${orderRef.id}`);
    return { orderId: orderRef.id, alreadyExisted: false, orderData };
}
async function createPacketOrder(input, nowISO) {
    const existingQuery = await core_1.db.collection('orders_public')
        .where('stripeSessionId', '==', input.stripeSessionId).limit(1).get();
    if (!existingQuery.empty) {
        const doc = existingQuery.docs[0];
        console.log(`[OrderService] Packet order already exists for session ${input.stripeSessionId}, skipping`);
        return {
            orderId: doc.id,
            claimCode: doc.data().claimCode,
            alreadyExisted: true,
            orderData: doc.data(),
        };
    }
    const claimCode = generateClaimCode();
    const packet = input.packet || {};
    const productCost = packet.pricingSnapshot?.printifyCostBase || packet.pricingSnapshot?.totalCostBase || 0;
    const pricingSnapshot = input.pricingSnapshot || freezePricingSnapshot({
        salePrice: input.totalAmount,
        productCost,
        affiliatePercent: 25,
        currency: 'USD',
    });
    const orderData = {
        packetId: input.packetId,
        stripeSessionId: input.stripeSessionId,
        stripePaymentIntentId: input.stripePaymentIntentId || null,
        buyerEmail: input.buyerEmail,
        buyerName: input.buyerName,
        shippingAddress: input.shippingAddress,
        claimCode,
        productTitle: packet.title || 'QR Gear Product',
        qrType: packet.qrType || packet.packetType || 'qr-basic',
        selectedColor: packet.selectedColor || '',
        selectedSize: input.selectedSize || 'M',
        totalAmount: input.totalAmount,
        pricingSnapshot,
        mockupUrl: packet.itemImage || null,
        creatorMemberId: input.creatorMemberId || '',
        referrerId: input.referrerId || '',
        source: 'packet_share',
        status: 'paid',
        createdAt: nowISO,
        updatedAt: nowISO,
    };
    const orderRef = await core_1.db.collection('orders_public').add(orderData);
    console.log(`[OrderService] Packet order created: ${orderRef.id} for packet ${input.packetId}`);
    return { orderId: orderRef.id, claimCode, alreadyExisted: false, orderData };
}
async function createEmbedOrder(input, nowISO) {
    const ctx = input.embedContext;
    const qty = input.cartItems?.[0]?.quantity || 1;
    const snapshot = input.pricingSnapshot;
    const existingAttrib = await core_1.db.collection(constants_1.EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION)
        .where('stripeCheckoutSessionId', '==', input.stripeSessionId)
        .limit(1).get();
    if (!existingAttrib.empty) {
        const existing = existingAttrib.docs[0].data();
        console.log(`[OrderService] Embed attribution already exists for ${input.stripeSessionId}, returning existing`);
        return { orderId: input.stripeSessionId, orderItemId: existing.orderItemId || '', alreadyExisted: true, orderData: existing };
    }
    const orderItemId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    const attributionData = {
        orderId: input.stripeSessionId,
        orderItemId,
        builderHostId: ctx.builderHostId,
        builderPlacementId: ctx.builderPlacementId,
        builderProfileId: ctx.builderProfileId || '',
        affiliateUserId: ctx.affiliateUserId || '',
        surfaceId: ctx.surfaceId,
        variantId: ctx.variantId || null,
        pricingPolicyId: ctx.pricingPolicyId || '',
        revenueSplitId: ctx.revenueSplitId || '',
        ...(snapshot || {}),
        quantity: qty,
        designSelections: ctx.designSelections || {},
        qrSelections: ctx.qrSelections || {},
        previewSnapshot: ctx.previewSnapshot || null,
        stripeCheckoutSessionId: input.stripeSessionId,
        status: 'pending_payment',
        createdAt: nowISO,
    };
    const batch = core_1.db.batch();
    const attribRef = core_1.db.collection(constants_1.EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION).doc();
    batch.set(attribRef, attributionData);
    if (ctx.affiliateUserId) {
        const payoutRef = core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION).doc();
        batch.set(payoutRef, {
            affiliateUserId: ctx.affiliateUserId,
            builderHostId: ctx.builderHostId || '',
            builderPlacementId: ctx.builderPlacementId || '',
            orderId: input.stripeSessionId,
            orderItemId,
            affiliateAmount: (snapshot?.affiliateAmount || 0) * qty,
            currency: snapshot?.currency || 'USD',
            status: 'pending',
            periodKey: getPeriodKey(),
            createdAt: nowISO,
        });
    }
    await batch.commit();
    console.log(`[OrderService] Embed attribution + payout ledger created atomically for stripe session ${input.stripeSessionId}`);
    return { orderId: input.stripeSessionId, orderItemId, alreadyExisted: false, orderData: attributionData };
}
async function confirmEmbedOrderPayout(stripeSessionId) {
    const nowISO = new Date().toISOString();
    const attribSnap = await core_1.db.collection(constants_1.EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION)
        .where('stripeCheckoutSessionId', '==', stripeSessionId)
        .limit(1).get();
    if (attribSnap.empty) {
        console.warn(`[OrderService] No attribution found for stripe session ${stripeSessionId}`);
        return;
    }
    const attribDoc = attribSnap.docs[0];
    const attrib = attribDoc.data();
    if (attrib.status === 'paid') {
        console.log(`[OrderService] Embed attribution already confirmed for ${stripeSessionId}, skipping`);
        return;
    }
    const batch = core_1.db.batch();
    batch.update(attribDoc.ref, { status: 'paid', paidAt: nowISO });
    const payoutSnap = await core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION)
        .where('orderId', '==', stripeSessionId)
        .limit(1).get();
    if (!payoutSnap.empty) {
        batch.update(payoutSnap.docs[0].ref, { status: 'approved', approvedAt: nowISO });
        console.log(`[OrderService] Payout ledger ${payoutSnap.docs[0].id} confirmed for ${stripeSessionId}`);
    }
    else if (attrib.affiliateUserId && attrib.affiliateAmount > 0) {
        const legacyPayoutRef = core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION).doc();
        batch.set(legacyPayoutRef, {
            affiliateUserId: attrib.affiliateUserId,
            builderHostId: attrib.builderHostId || '',
            builderPlacementId: attrib.builderPlacementId || '',
            orderId: stripeSessionId,
            orderItemId: attrib.orderItemId || '',
            affiliateAmount: attrib.affiliateAmount * (attrib.quantity || 1),
            currency: attrib.currency || 'USD',
            status: 'approved',
            approvedAt: nowISO,
            periodKey: getPeriodKey(),
            createdAt: nowISO,
            legacyBackfill: true,
        });
        console.log(`[OrderService] Legacy payout ledger created for pre-patch attribution ${stripeSessionId}`);
    }
    await batch.commit();
    console.log(`[OrderService] Embed attribution ${attribDoc.id} confirmed paid for ${stripeSessionId}`);
}
async function writePayoutAttribution(input) {
    const nowISO = new Date().toISOString();
    if (input.source === 'packet_share' || input.source === 'direct_cart') {
        await writeCreatorAndReferralPayouts(input, nowISO);
    }
    if (input.source === 'external_embed') {
        await writeAffiliatePayouts(input, nowISO);
    }
}
async function writeCreatorAndReferralPayouts(input, nowISO) {
    const profit = input.orderTotal - input.productCost;
    if (input.creatorMemberId && profit > 0) {
        try {
            const creatorEarnings = Math.round((profit * 0.25) * 100) / 100;
            const connectTransferApplied = !!input.connectTransferApplied;
            const connectAccountId = input.connectAccountId || '';
            await core_1.db.collection('member_earnings').add({
                memberId: input.creatorMemberId,
                orderId: input.orderId,
                packetId: input.packetId || '',
                orderTotal: input.orderTotal,
                productCost: input.productCost,
                profit,
                sharePercent: 25,
                earnings: creatorEarnings,
                type: 'product_sale',
                status: connectTransferApplied ? 'transferred' : 'pending',
                connectTransferApplied,
                ...(connectAccountId ? { connectAccountId } : {}),
                createdAt: nowISO,
            });
            console.log(`[OrderService] Creator ${input.creatorMemberId} earned $${creatorEarnings} from order ${input.orderId}`);
        }
        catch (err) {
            console.error('[OrderService] Non-fatal creator earnings error:', err.message);
        }
    }
    if (input.referrerId && input.buyerEmail) {
        try {
            const buyerKey = input.buyerEmail;
            const existingRef = await core_1.db.collection('referrals')
                .where('buyerKey', '==', buyerKey).limit(1).get();
            if (existingRef.empty) {
                await core_1.db.collection('referrals').add({
                    referrerId: input.referrerId,
                    buyerKey,
                    profitSharePercent: 25,
                    lifetime: true,
                    source: input.source,
                    createdAt: nowISO,
                });
                console.log(`[OrderService] Referral captured: ${input.referrerId} -> ${buyerKey}`);
            }
            if (profit > 0 && input.referrerId !== input.creatorMemberId) {
                const referralEarnings = Math.round((profit * 0.25) * 100) / 100;
                await core_1.db.collection('referral_earnings').add({
                    memberId: input.referrerId,
                    orderId: input.orderId,
                    buyerKey,
                    orderTotal: input.orderTotal,
                    productCost: input.productCost,
                    profit,
                    sharePercent: 25,
                    earnings: referralEarnings,
                    status: 'pending',
                    createdAt: nowISO,
                });
                console.log(`[OrderService] Referral ${input.referrerId} earned $${referralEarnings} from order ${input.orderId}`);
            }
        }
        catch (err) {
            console.error('[OrderService] Non-fatal referral error:', err.message);
        }
    }
}
async function writeAffiliatePayouts(input, nowISO) {
    const snapshot = input.pricingSnapshot;
    if (!input.affiliateUserId || !snapshot || snapshot.affiliateAmount <= 0)
        return;
    const existingPayout = await core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION)
        .where('orderId', '==', input.orderId)
        .where('affiliateUserId', '==', input.affiliateUserId)
        .limit(1).get();
    if (!existingPayout.empty) {
        console.log(`[OrderService] Payout ledger already exists for ${input.orderId}/${input.affiliateUserId}, skipping`);
        return;
    }
    const qty = input.quantity || 1;
    const payoutEntry = {
        affiliateUserId: input.affiliateUserId,
        builderHostId: input.builderHostId || '',
        builderPlacementId: input.builderPlacementId || '',
        orderId: input.orderId,
        orderItemId: input.orderItemId || '',
        affiliateAmount: snapshot.affiliateAmount * qty,
        currency: snapshot.currency,
        status: 'pending',
        periodKey: getPeriodKey(),
        createdAt: nowISO,
    };
    await core_1.db.collection(constants_1.AFFILIATE_PAYOUT_LEDGER_COLLECTION).add(payoutEntry);
    console.log(`[OrderService] Affiliate ${input.affiliateUserId} payout $${payoutEntry.affiliateAmount} for order ${input.orderId}`);
}
//# sourceMappingURL=order-service.js.map