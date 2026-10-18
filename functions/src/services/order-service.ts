import { resolveLifetimeReferral } from './lifetime-referral';
import { freezeMemberCompensation, validateMemberCompensation, reconcileMemberTransfer, type MemberCompensation } from './member-compensation';
import { readFlubaProviderKey } from './fluba-provider-keys';
import { sendActivationEmail } from './email';
import { getSizeUpcharges } from './pricing';
import { selectCatalogSaleVariant } from './catalog-sale-variants';
import { validatePacketComposition } from './assembly-store';
import { quoteCartBundle } from './product-bundles';
import { createHash } from 'crypto';
import Stripe from 'stripe';
import { resolveSaleItem, verifyProviderItems, fulfillOrder } from './order-fulfillment';
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
  if (ctx.packet.productionPacketId) {
    const packet = ctx.packet;
    const production = (await db.collection('productPackets').doc(packet.productionPacketId).get()).data();
    if (!production || production.memberId !== packet.memberId) throw new Error('Member production packet is unavailable.');
    await validatePacketComposition(db, packet.productionPacketId, production);
    const master = (await db.collection('master_catalog').doc(packet.sourceMasterId).get()).data();
    selectCatalogSaleVariant({ enabledColors: [packet.selectedColor], enabledSizes: [ctx.selectedSize] }, master, packet.fulfillmentProvider, ctx.selectedSize, packet.selectedColor);
    const upcharges = await getSizeUpcharges();
    const base = Number(packet.pricing?.customerPrice), productCost = Number(packet.pricing?.subtotal);
    if (!(base > 0) || !Number.isFinite(productCost)) throw new Error('Product pricing is incomplete.');
    const totalPrice = Math.round((base + (upcharges[ctx.selectedSize] ?? 0)) * 100) / 100;
    return { totalPrice, productCost, snapshot: freezePricingSnapshot({ salePrice: totalPrice, productCost }) };
  }
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
    items.forEach(({ frozenProduction, ...item }, index) => {
      const id = `${ref.id}_${index}`;
      tx.create(db.collection('orderItems').doc(id), { ...item, orderId: ref.id, createdAt: now });
      tx.create(db.collection('orderProductionSources').doc(id), { ...frozenProduction, orderId: ref.id });
    });
  });
  return { orderId: ref.id, items, amount };
}

/** Caller must verify the webhook signature (or retrieve this session from Stripe). */
export async function finalizeCartPayment(session: Stripe.Checkout.Session) {
  const orderId = session.metadata?.orderId;
  if (!orderId || !['direct_cart', 'packet_share', 'public_wizard'].includes(session.metadata?.source || '')) throw new Error('Checkout has no frozen order. Manual reconciliation required.');
  if (session.payment_status !== 'paid') throw new Error('Payment is not complete.');
  const ref = db.collection('orders').doc(orderId);
  await db.runTransaction(async tx => {
    const order = (await tx.get(ref)).data();
    if (!order || order.checkoutVersion !== 1 || order.source !== session.metadata?.source || (order.source === 'direct_cart' && order.userId !== session.metadata?.userId) ||
        (order.stripeSessionId && order.stripeSessionId !== session.id) || order.currency !== session.currency ||
        order.amountTotalCents !== session.amount_total) throw new Error('Stripe payment does not match the frozen order.');
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
    const refund = paymentIntentId ? (await tx.get(db.collection('paymentRefunds').doc(paymentIntentId))).data() : null;
    if (refund || order.productionHold || ['refunded', 'partially_refunded'].includes(order.paymentStatus)) throw new Error('Refunded payment cannot be restored by checkout replay.');
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
  if (session.metadata?.source === 'direct_cart') await db.runTransaction(async tx => {
    const carts = await Promise.all(items.map(item => tx.get(db.collection('cartItems').doc(item.cartItemId))));
    carts.forEach((cart, i) => {
      if (cart.exists && cart.data()?.userId === session.metadata?.userId && cartFingerprint(cart.data()) === items[i].cartFingerprint) tx.delete(cart.ref);
    });
  });
  return { orderId, order: (await ref.get()).data()!, items };
}

/** Member sales use the same frozen production contract as catalog sales. */
export async function prepareMemberOrder(packetId: string, packet: Record<string, any>, size: string, referrerId: string) {
  return prepareProductOrder(packetId, packet, size, referrerId);
}
export async function prepareOwnerOrder(packetId: string, packet: Record<string, any>, ownerId: string) {
  return prepareProductOrder(packetId, packet, packet.selectedShirtSize, '', ownerId);
}
async function prepareProductOrder(packetId: string, packet: Record<string, any>, size: string, referrerId: string, ownerId?: string) {
  const item = await resolveSaleItem({ id: packetId, quantity: 1, customization: { memberPacketId: ownerId ? null : packetId, productSize: size, productColor: packet.selectedColor } }, ownerId ? { packetId, ownerId } : undefined);
  await verifyProviderItems([item]);
  const memberCompensation = item.creatorMemberId ? await freezeMemberCompensation(item.unitAmount, item.productCost) : null;
  const ref = db.collection('orders').doc(), now = new Date().toISOString();
  const batch = db.batch();
  batch.create(ref, { userId: null, source: ownerId ? 'public_wizard' : 'packet_share', sourceChannel: ownerId ? 'owner' : 'member', checkoutVersion: 1,
    packetId, productTitle: item.productTitle, qrType: packet.packetType, selectedSize: size, selectedColor: packet.selectedColor,
    mockupUrl: packet.mockupUrl || packet.itemImage || null, creatorMemberId: item.creatorMemberId, productCost: item.productCost, memberCompensation,
    status: 'awaiting_payment', paymentStatus: 'unpaid', fulfillmentState: 'waiting_for_payment',
    amountTotalCents: item.unitAmount, currency: 'usd', totalAmount: (item.unitAmount / 100).toFixed(2),
    referrerId, routedProvider: item.fulfillment.provider, createdAt: now, updatedAt: now });
  const { frozenProduction, ...publicItem } = item;
  batch.create(db.collection('orderItems').doc(`${ref.id}_0`), { ...publicItem, orderId: ref.id, createdAt: now });
  batch.create(db.collection('orderProductionSources').doc(`${ref.id}_0`), { ...frozenProduction, orderId: ref.id });
  await batch.commit();
  return { orderId: ref.id, amount: item.unitAmount, memberCompensation };
}

/** The signed webhook and Stripe-retrieved return page converge on one durable order. */
export async function finalizeMemberPayment(session: Stripe.Checkout.Session) {
  if (!['packet_share', 'public_wizard'].includes(session.metadata?.source || '')) throw new Error('This is not a product checkout.');
  const { orderId, order } = await finalizeCartPayment(session);
  if (session.metadata?.source === 'packet_share' && order.memberCompensation) {
    const key = await readFlubaProviderKey('STRIPE_SECRET_KEY');
    if (!key) throw new Error('Payment reconciliation is unavailable.');
    order.transferSettlement = await reconcileMemberTransfer(new Stripe(key), order);
    await db.collection('orders').doc(orderId).update({ transferSettlement: order.transferSettlement });
  }
  if (session.metadata?.source === 'packet_share') await writePayoutAttribution({ source: 'packet_share', orderId, orderTotal: order.amountTotalCents / 100,
    productCost: order.productCost, creatorMemberId: order.creatorMemberId, referrerId: order.referrerId,
    buyerEmail: order.customerEmail, packetId: order.packetId,
    memberCompensation: order.memberCompensation, transferSettlement: order.transferSettlement, connectAccountId: order.connectAccountId });
  await fulfillOrder(orderId);
  const line = (await db.collection('orderItems').doc(`${orderId}_0`).get()).data();
  const instanceId = line?.dynamicsInstanceIds?.[0];
  const instance = instanceId ? (await db.collection('qr_dynamics_instances').doc(instanceId).get()).data() : null;
  if (!instance?.claimCode) throw new Error('Purchased item claim is not ready. Retry order verification.');
  const updated = (await db.collection('orders').doc(orderId).get()).data()!;
  const publicOrder = { packetId: order.packetId, stripeSessionId: session.id, productTitle: order.productTitle,
    qrType: order.qrType, selectedColor: order.selectedColor, selectedSize: order.selectedSize, totalAmount: order.amountTotalCents / 100,
    buyerEmail: order.customerEmail, buyerName: order.customerName, mockupUrl: order.mockupUrl,
    status: updated.status, claimCode: instance.claimCode, instanceId, qrgBaseCode: instance.qrgBaseCode,
    createdAt: order.createdAt, source: order.source };
  await db.collection('orders_public').doc(orderId).set(publicOrder, { merge: true });
  if (order.customerEmail && !updated.activationEmailSentAt) {
    const sent = await sendActivationEmail({ customerEmail: order.customerEmail, customerName: order.customerName || 'Customer',
      activationCode: instance.claimCode, productName: order.productTitle, previewImageUrl: order.mockupUrl, orderId });
    await db.collection('orders').doc(orderId).update(sent ? { activationEmailSentAt: new Date().toISOString(), activationEmailError: null } : { activationEmailError: 'Activation email was not sent; claim code is available on the order confirmation.' });
  }
  return { success: true, order: { id: orderId, ...publicOrder }, claimCode: instance.claimCode };
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
    mockupUrl: packet.mockupUrl || packet.itemImage || null,
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
    throw new Error(`Missing attribution for paid embed session ${stripeSessionId}; reconciliation required.`);
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
  memberCompensation?: MemberCompensation;
  transferSettlement?: { status: string; amountCents: number; transferId: string | null };
  connectTransferApplied?: boolean;
  connectAccountId?: string;
}

export async function writePayoutAttribution(input: PayoutAttributionInput): Promise<void> {
  const nowISO = new Date().toISOString();
  const ref = db.collection('payout_work').doc(input.orderId);
  const safeInput = JSON.parse(JSON.stringify(input));
  await ref.set({ input: safeInput, status: 'pending', updatedAt: nowISO }, { merge: true });
  try {
    if (input.source === 'packet_share' || input.source === 'direct_cart') await writeCreatorAndReferralPayouts(input, nowISO);
    if (input.source === 'external_embed') await writeAffiliatePayouts(input, nowISO);
    await ref.update({ status: 'completed', completedAt: new Date().toISOString(), error: null });
  } catch (error: any) {
    await ref.update({ status: 'pending', error: error.message }).catch(() => {});
    throw error;
  }
}

async function recordEarningOnce(collection: string, id: string, value: Record<string, any>) {
  const ref = db.collection(collection).doc(id);
  await db.runTransaction(async tx => {
    const previous = await tx.get(ref);
    if (!previous.exists) tx.create(ref, value);
    else if (value.memberCompensation && value.transferSettlement && !previous.data()?.refund) {
      if (JSON.stringify(previous.data()?.memberCompensation) !== JSON.stringify(value.memberCompensation)) throw new Error('Earnings policy differs from its frozen record.');
      tx.update(ref, { status: value.status, connectTransferApplied: value.connectTransferApplied, transferSettlement: value.transferSettlement });
    }
  });
}

async function writeCreatorAndReferralPayouts(input: PayoutAttributionInput, nowISO: string): Promise<void> {
  const profit = input.orderTotal - input.productCost;

  if (input.creatorMemberId && profit > 0) {
    try {
      // Historical orders without a frozen policy remain visibly unreconciled.
      const policy = input.memberCompensation ? validateMemberCompensation(input.memberCompensation, Math.round(input.orderTotal * 100)) : await freezeMemberCompensation(Math.round(input.orderTotal * 100), input.productCost);
      const creatorEarnings = policy.amountCents / 100;
      const connectTransferApplied = !!input.memberCompensation && input.transferSettlement?.status === 'transferred' && input.transferSettlement.amountCents === policy.amountCents;
      const connectAccountId = input.connectAccountId || '';
      await recordEarningOnce('member_earnings', `${input.orderId}_${input.creatorMemberId}`, {
        memberId: input.creatorMemberId,
        orderId: input.orderId,
        packetId: input.packetId || '',
        orderTotal: input.orderTotal,
        productCost: input.productCost,
        profit,
        sharePercent: policy.share * 100, memberCompensation: policy,
        earnings: creatorEarnings,
        type: 'product_sale',
        status: !input.memberCompensation ? 'needs_review' : connectTransferApplied ? 'transferred' : input.transferSettlement?.status || 'pending',
        transferSettlement: input.transferSettlement || null,
        connectTransferApplied,
        ...(connectAccountId ? { connectAccountId } : {}),
        createdAt: nowISO,
      });
      console.log(`[OrderService] Creator ${input.creatorMemberId} earned $${creatorEarnings} from order ${input.orderId}`);
    } catch (err: any) {
      throw err;
    }
  }

  if (input.buyerEmail) {
    const attribution = await resolveLifetimeReferral(input.orderId, input.buyerEmail, input.referrerId);
    if (attribution?.referrerId && profit > 0 && attribution.referrerId !== input.creatorMemberId) {
      const referralEarnings = Math.round(profit * attribution.sharePercent) / 100;
      await recordEarningOnce('referral_earnings', `${input.orderId}_${attribution.referrerId}`, {
        memberId: attribution.referrerId, orderId: input.orderId, buyerKey: attribution.buyerKey,
        orderTotal: input.orderTotal, productCost: input.productCost, profit,
        sharePercent: attribution.sharePercent, earnings: referralEarnings, status: 'pending', createdAt: nowISO,
      });
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

