import { quoteCartBundle } from './product-bundles';
import { createHash } from 'crypto';
import type Stripe from 'stripe';
import { resolveSaleItem, verifyProviderItems } from './order-fulfillment';
import { db, admin } from '../core';
import {
  EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION,
  AFFILIATE_PAYOUT_LEDGER_COLLECTION,
} from '../constants';
import { computePricingSnapshot } from '../../../shared/surfaces';
import type { PricingSnapshot } from '../../../shared/surfaces';

/**
 * Canonical Order Service
 *
 * All checkout flows route through this service for order creation, pricing
 * snapshot persistence, and payout attribution:
 *
 * - direct_cart: Session created in core-routes-checkout.ts; order finalized
 *   in stripe-webhooks.ts from prepareCartOrder's frozen records via finalizeCartPayment.
 * - packet_share: Session created in checkout.ts /public/packet-checkout; order
 *   finalized in checkout.ts /verify/:sessionId via createCanonicalOrder.
 * - external_embed: Attribution staged in external-sites-public.ts /buy via
 *   createCanonicalOrder; payout confirmed in stripe-webhooks.ts via
 *   confirmEmbedOrderPayout on checkout.session.completed.
 *
 * freezePricingSnapshot() computes and returns (freezes) a PricingSnapshot at
 * call time. Each createCanonicalOrder path persists this snapshot on the order
 * record for durable audit.
 */
export type OrderSource = 'direct_cart' | 'packet_share' | 'external_embed';

export interface PricingInput {
  salePrice: number;
  productCost: number;
  providerCost?: number;
  platformFeeAmount?: number;
  shippingCostBurden?: number;
  discountBurden?: number;
  affiliatePercent?: number;
  currency?: string;
}

export function freezePricingSnapshot(input: PricingInput): PricingSnapshot {
  return computePricingSnapshot({
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

export interface PacketPricingContext {
  packet: Record<string, any>;
  selectedSize: string;
}

export async function freezePacketPricing(ctx: PacketPricingContext): Promise<{ totalPrice: number; productCost: number; snapshot: PricingSnapshot }> {
  const pricingDoc = await db.collection('testSettings').doc('pricing').get();
  const ps = pricingDoc.exists ? pricingDoc.data() : null;
  const defaultSU: Record<string, number> = { 'S': 0, 'M': 2, 'L': 4, 'XL': 6, '2XL': 8, '3XL': 10, '4XL': 12 };
  const sizeUpcharges = ps?.sizeUpcharges || defaultSU;

  let basePrice = 0;
  if (ctx.packet.pricingSnapshot?.retailPriceBase) {
    basePrice = ctx.packet.pricingSnapshot.retailPriceBase;
  } else if (ctx.packet.boundProduct?.retailPrice) {
    basePrice = parseFloat(ctx.packet.boundProduct.retailPrice);
  } else if (ctx.packet.socialPacket?.retailPrice) {
    basePrice = parseFloat(ctx.packet.socialPacket.retailPrice);
  } else {
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

function getPeriodKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function generateClaimCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export interface CreateOrderInput {
  source: OrderSource;
  stripeSessionId: string;
  stripePaymentIntentId?: string;
  buyerEmail: string;
  buyerName: string;
  shippingAddress: Record<string, any> | null;
  totalAmount: number;
  pricingSnapshot?: PricingSnapshot;
  userId?: string;
  packetId?: string;
  packet?: Record<string, any>;
  selectedSize?: string;
  referrerId?: string;
  creatorMemberId?: string;
  cartItems?: any[];
  embedContext?: {
    builderHostId: string;
    builderPlacementId: string;
    builderProfileId?: string;
    affiliateUserId?: string;
    surfaceId: string;
    variantId?: string;
    pricingPolicyId?: string;
    revenueSplitId?: string;
    designSelections?: Record<string, any>;
    qrSelections?: Record<string, any>;
    previewSnapshot?: any;
  };
}

export interface CreateOrderResult {
  orderId: string;
  claimCode?: string;
  orderItemId?: string;
  alreadyExisted: boolean;
  orderData: Record<string, any>;
}

export async function createCanonicalOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const now = new Date();
  const nowISO = now.toISOString();

  if (input.source === 'direct_cart') {
    throw new Error('Direct orders must be frozen before checkout and finalized from verified Stripe payment.');
  } else if (input.source === 'packet_share') {
    return createPacketOrder(input, nowISO);
  } else {
    return createEmbedOrder(input, nowISO);
  }
}

function cartFingerprint(cart: any): string {
  return createHash('sha256').update(JSON.stringify({ userId: cart.userId, quantity: cart.quantity,
    customization: cart.customization, price: cart.price })).digest('hex');
}

export async function readCartQuote(userId: string, selection?: { bundleId?: string; selectedItems?: string[] }) {
  const carts = (await db.collection('cartItems').where('userId', '==', userId).get()).docs.map(doc => ({ ...doc.data(), id: doc.id }));
  if (!carts.length) throw new Error('Cart is empty.');
  if (carts.length > 100) throw new Error('Split this cart into orders of at most 100 different items.');
  const items = await Promise.all(carts.map(async cart => ({ ...await resolveSaleItem(cart), cartFingerprint: cartFingerprint(cart) })));
  const quote = await quoteCartBundle(db, items, selection);
  const quoteToken = createHash('sha256').update(JSON.stringify({items:quote.items,bundle:quote.bundle,amount:quote.amount})).digest('hex');
  return { ...quote, quoteToken };
}

export async function prepareCartOrder(userId: string, referrerId = '', selection?: { bundleId?: string; selectedItems?: string[] }, expectedQuoteToken?: string) {
  const quote = await readCartQuote(userId, selection);
  if (expectedQuoteToken && quote.quoteToken !== expectedQuoteToken) throw new Error('Your cart or bundle price changed. Return to checkout and review the new total.');
  const { items, amount } = quote;
  await verifyProviderItems(items);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Checkout requires a positive order total.');
  const ref = db.collection('orders').doc(), now = new Date().toISOString();
  await db.runTransaction(async tx => {
    tx.create(ref, { userId, source: 'direct_cart', sourceChannel: 'direct', checkoutVersion: 1,
      status: 'awaiting_payment', paymentStatus: 'unpaid', fulfillmentState: 'waiting_for_payment',
      amountTotalCents: amount, subtotalCents: quote.subtotalCents, bundle: quote.bundle, currency: 'usd', totalAmount: (amount / 100).toFixed(2),
      referrerId, payoutState: referrerId ? 'needs_review' : null, routedProvider: items[0].fulfillment.provider, createdAt: now, updatedAt: now });
    items.forEach((item, index) => tx.create(db.collection('orderItems').doc(`${ref.id}_${index}`), { ...item, orderId: ref.id, createdAt: now }));
  });
  return { orderId: ref.id, items, amount };
}

/** Caller must verify the webhook signature (or retrieve this session from Stripe). */
export async function finalizeCartPayment(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId || session.metadata?.source !== 'direct_cart') throw new Error('Checkout has no frozen order. Manual reconciliation required.');
  if (session.payment_status !== 'paid') throw new Error('Payment is not complete.');
  const ref = db.collection('orders').doc(orderId);
  await db.runTransaction(async tx => {
    const order = (await tx.get(ref)).data();
    if (!order || order.checkoutVersion !== 1 || order.userId !== session.metadata?.userId ||
        (order.stripeSessionId && order.stripeSessionId !== session.id) || order.currency !== session.currency ||
        order.amountTotalCents !== session.amount_total) throw new Error('Stripe payment does not match the frozen order.');
    if (order.paymentStatus === 'paid') return;
    const shipping = (session as any).shipping_details || (session as any).collected_information?.shipping_details;
    const address = shipping?.address;
    tx.update(ref, { stripeSessionId: session.id, stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null,
      status: 'paid', paymentStatus: 'paid', paymentVerifiedAt: new Date().toISOString(), fulfillmentState: 'ready',
      customerEmail: session.customer_details?.email || '', customerName: shipping?.name || session.customer_details?.name || '',
      shippingAddress: address ? { name: shipping.name || '', firstName: shipping.name?.split(' ')[0] || '', lastName: shipping.name?.split(' ').slice(1).join(' ') || '',
        address1: address.line1 || '', address2: address.line2 || '', city: address.city || '', region: address.state || '',
        state: address.state || '', zip: address.postal_code || '', country: address.country || '', phone: session.customer_details?.phone || '' } : null,
      updatedAt: new Date().toISOString() });
  });
  // Remove only unchanged purchased cart rows. New items/edits remain in the cart.
  const items = (await db.collection('orderItems').where('orderId', '==', orderId).get()).docs.map(d => d.data());
  await db.runTransaction(async tx => {
    const carts = await Promise.all(items.map(item => tx.get(db.collection('cartItems').doc(item.cartItemId))));
    carts.forEach((cart, i) => {
      if (cart.exists && cart.data()?.userId === session.metadata?.userId && cartFingerprint(cart.data()) === items[i].cartFingerprint) tx.delete(cart.ref);
    });
  });
  return { orderId, order: (await ref.get()).data()!, items };
}

async function createPacketOrder(input: CreateOrderInput, nowISO: string): Promise<CreateOrderResult> {
  const existingQuery = await db.collection('orders_public')
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

  const orderData: Record<string, any> = {
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

  const orderRef = await db.collection('orders_public').add(orderData);
  console.log(`[OrderService] Packet order created: ${orderRef.id} for packet ${input.packetId}`);

  return { orderId: orderRef.id, claimCode, alreadyExisted: false, orderData };
}

async function createEmbedOrder(input: CreateOrderInput, nowISO: string): Promise<CreateOrderResult> {
  const ctx = input.embedContext!;
  const qty = input.cartItems?.[0]?.quantity || 1;
  const snapshot = input.pricingSnapshot;

  const existingAttrib = await db.collection(EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION)
    .where('stripeCheckoutSessionId', '==', input.stripeSessionId)
    .limit(1).get();
  if (!existingAttrib.empty) {
    const existing = existingAttrib.docs[0].data();
    console.log(`[OrderService] Embed attribution already exists for ${input.stripeSessionId}, returning existing`);
    return { orderId: input.stripeSessionId, orderItemId: existing.orderItemId || '', alreadyExisted: true, orderData: existing };
  }

  const orderItemId = require('crypto').randomBytes(16).toString('hex');

  const attributionData: Record<string, any> = {
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

  const batch = db.batch();

  const attribRef = db.collection(EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION).doc();
  batch.set(attribRef, attributionData);

  if (ctx.affiliateUserId) {
    const payoutRef = db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION).doc();
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

export async function confirmEmbedOrderPayout(stripeSessionId: string): Promise<void> {
  const nowISO = new Date().toISOString();

  const attribSnap = await db.collection(EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION)
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

  const batch = db.batch();

  batch.update(attribDoc.ref, { status: 'paid', paidAt: nowISO });

  const payoutSnap = await db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION)
    .where('orderId', '==', stripeSessionId)
    .limit(1).get();

  if (!payoutSnap.empty) {
    batch.update(payoutSnap.docs[0].ref, { status: 'approved', approvedAt: nowISO });
    console.log(`[OrderService] Payout ledger ${payoutSnap.docs[0].id} confirmed for ${stripeSessionId}`);
  } else if (attrib.affiliateUserId && attrib.affiliateAmount > 0) {
    const legacyPayoutRef = db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION).doc();
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

export interface PayoutAttributionInput {
  source: OrderSource;
  orderId: string;
  orderItemId?: string;
  orderTotal: number;
  productCost: number;
  pricingSnapshot?: PricingSnapshot;
  creatorMemberId?: string;
  referrerId?: string;
  buyerEmail?: string;
  packetId?: string;
  affiliateUserId?: string;
  builderHostId?: string;
  builderPlacementId?: string;
  quantity?: number;
  connectTransferApplied?: boolean;
  connectAccountId?: string;
}

export async function writePayoutAttribution(input: PayoutAttributionInput): Promise<void> {
  const nowISO = new Date().toISOString();

  if (input.source === 'packet_share' || input.source === 'direct_cart') {
    await writeCreatorAndReferralPayouts(input, nowISO);
  }

  if (input.source === 'external_embed') {
    await writeAffiliatePayouts(input, nowISO);
  }
}

async function writeCreatorAndReferralPayouts(input: PayoutAttributionInput, nowISO: string): Promise<void> {
  const profit = input.orderTotal - input.productCost;

  if (input.creatorMemberId && profit > 0) {
    try {
      const creatorEarnings = Math.round((profit * 0.25) * 100) / 100;
      const connectTransferApplied = !!input.connectTransferApplied;
      const connectAccountId = input.connectAccountId || '';
      await db.collection('member_earnings').add({
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
    } catch (err: any) {
      console.error('[OrderService] Non-fatal creator earnings error:', err.message);
    }
  }

  if (input.referrerId && input.buyerEmail) {
    try {
      const buyerKey = input.buyerEmail;
      const existingRef = await db.collection('referrals')
        .where('buyerKey', '==', buyerKey).limit(1).get();
      if (existingRef.empty) {
        await db.collection('referrals').add({
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
        await db.collection('referral_earnings').add({
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
    } catch (err: any) {
      console.error('[OrderService] Non-fatal referral error:', err.message);
    }
  }
}

async function writeAffiliatePayouts(input: PayoutAttributionInput, nowISO: string): Promise<void> {
  const snapshot = input.pricingSnapshot;
  if (!input.affiliateUserId || !snapshot || snapshot.affiliateAmount <= 0) return;

  const existingPayout = await db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION)
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
  await db.collection(AFFILIATE_PAYOUT_LEDGER_COLLECTION).add(payoutEntry);
  console.log(`[OrderService] Affiliate ${input.affiliateUserId} payout $${payoutEntry.affiliateAmount} for order ${input.orderId}`);
}
