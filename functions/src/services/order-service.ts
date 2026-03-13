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
 *   in stripe-webhooks.ts on checkout.session.completed via createCanonicalOrder.
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
    return createDirectCartOrder(input, nowISO);
  } else if (input.source === 'packet_share') {
    return createPacketOrder(input, nowISO);
  } else {
    return createEmbedOrder(input, nowISO);
  }
}

async function createDirectCartOrder(input: CreateOrderInput, nowISO: string): Promise<CreateOrderResult> {
  const existingSnapshot = await db.collection('orders')
    .where('stripeSessionId', '==', input.stripeSessionId)
    .limit(1).get();
  if (!existingSnapshot.empty) {
    const doc = existingSnapshot.docs[0];
    console.log(`[OrderService] Order already exists for session ${input.stripeSessionId}, skipping`);
    return { orderId: doc.id, alreadyExisted: true, orderData: doc.data()! };
  }

  const cartItems = input.cartItems || [];
  const totalAmount = cartItems.reduce((sum: number, item: any) => {
    return sum + parseFloat(item.price || '0') * (item.quantity || 1);
  }, 0);

  const pricingSnapshot = input.pricingSnapshot || freezePricingSnapshot({
    salePrice: totalAmount,
    productCost: 0,
    currency: 'USD',
  });

  const shippingAddress = input.shippingAddress;
  const orderData: Record<string, any> = {
    userId: input.userId,
    status: 'paid',
    totalAmount: totalAmount.toFixed(2),
    stripeSessionId: input.stripeSessionId,
    stripePaymentIntentId: input.stripePaymentIntentId || null,
    customerEmail: input.buyerEmail || null,
    shippingAddress,
    pricingSnapshot,
    source: 'direct_cart',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const orderRef = await db.collection('orders').add(orderData);
  console.log(`[OrderService] Direct cart order created: ${orderRef.id}`);

  for (const item of cartItems) {
    await db.collection('orderItems').add({
      orderId: orderRef.id,
      productId: item.productId,
      quantity: item.quantity || 1,
      price: item.price,
      customization: item.customization || {},
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  console.log(`[OrderService] Created ${cartItems.length} order items for order ${orderRef.id}`);

  return { orderId: orderRef.id, alreadyExisted: false, orderData };
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
  const orderItemId = Math.random().toString(36).substring(2) + Date.now().toString(36);

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
    ...(input.pricingSnapshot || {}),
    quantity: input.cartItems?.[0]?.quantity || 1,
    designSelections: ctx.designSelections || {},
    qrSelections: ctx.qrSelections || {},
    previewSnapshot: ctx.previewSnapshot || null,
    stripeCheckoutSessionId: input.stripeSessionId,
    status: 'pending_payment',
    createdAt: nowISO,
  };

  await db.collection(EMBEDDED_ORDER_ATTRIBUTIONS_COLLECTION).add(attributionData);
  console.log(`[OrderService] Embed attribution created for stripe session ${input.stripeSessionId}`);

  return { orderId: input.stripeSessionId, orderItemId, alreadyExisted: false, orderData: attributionData };
}

export async function confirmEmbedOrderPayout(stripeSessionId: string): Promise<void> {
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

  await attribDoc.ref.update({ status: 'paid', paidAt: new Date().toISOString() });
  console.log(`[OrderService] Embed attribution ${attribDoc.id} confirmed paid for ${stripeSessionId}`);

  const snapshot: PricingSnapshot = {
    baseSalePrice: attrib.baseSalePrice || 0,
    displaySalePrice: attrib.displaySalePrice || 0,
    productCost: attrib.productCost || 0,
    providerCost: attrib.providerCost || 0,
    platformFeeAmount: attrib.platformFeeAmount || 0,
    shippingCostBurden: attrib.shippingCostBurden || 0,
    discountBurden: attrib.discountBurden || 0,
    grossProfitAmount: attrib.grossProfitAmount || 0,
    affiliatePercent: attrib.affiliatePercent || 0,
    affiliateBasis: attrib.affiliateBasis || 'gross_profit',
    affiliateAmount: attrib.affiliateAmount || 0,
    netPlatformProfitAmount: attrib.netPlatformProfitAmount || 0,
    currency: attrib.currency || 'USD',
    pricingSnapshotVersion: attrib.pricingSnapshotVersion || '1.0',
    createdAt: attrib.createdAt || new Date().toISOString(),
  };

  await writePayoutAttribution({
    source: 'external_embed',
    orderId: stripeSessionId,
    orderItemId: attrib.orderItemId || '',
    orderTotal: snapshot.displaySalePrice * (attrib.quantity || 1),
    productCost: snapshot.productCost,
    pricingSnapshot: snapshot,
    affiliateUserId: attrib.affiliateUserId || '',
    builderHostId: attrib.builderHostId || '',
    builderPlacementId: attrib.builderPlacementId || '',
    quantity: attrib.quantity || 1,
  });
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
        status: 'pending',
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
