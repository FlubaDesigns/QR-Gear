import Stripe from 'stripe';
import { db } from '../core';
import { readFlubaProviderKey } from './fluba-provider-keys';
const idOf = (value: any): string | null => typeof value === 'string' ? value : value?.id || null;

/** Refund evidence is monotonic and survives delivery before checkout completion. */
export async function recordChargeRefund(charge: Stripe.Charge) {
  const paymentIntentId = idOf(charge.payment_intent);
  if (!paymentIntentId || !(charge.amount_refunded > 0)) return;
  const evidenceRef = db.collection('paymentRefunds').doc(paymentIntentId);
  const orders = await db.collection('orders').where('stripePaymentIntentId', '==', paymentIntentId).get();
  const transfer = typeof charge.transfer === 'object' ? charge.transfer : null;
  const evidence = { paymentIntentId, chargeId: charge.id, refundedAmountCents: charge.amount_refunded,
    chargeAmountCents: charge.amount, currency: charge.currency, transferId: idOf(charge.transfer),
    transferReversedCents: transfer?.amount_reversed ?? null, recordedAt: new Date().toISOString() };
  const savedEvidence = await db.runTransaction(async tx => {
    const prior = (await tx.get(evidenceRef)).data();
    if ((prior?.refundedAmountCents || 0) > evidence.refundedAmountCents) return prior;
    const latest = await Promise.all(orders.docs.map(doc => tx.get(doc.ref)));
    tx.set(evidenceRef, evidence);
    for (const doc of latest) if (doc.exists) tx.update(doc.ref, {
      paymentStatus: charge.amount_refunded >= charge.amount ? 'refunded' : 'partially_refunded',
      status: charge.amount_refunded >= charge.amount ? 'refunded' : 'refund_review',
      productionHold: true, refund: evidence, updatedAt: evidence.recordedAt,
    });
    return evidence;
  });
  // Persist the actual reversal separately; a customer refund does not prove a transfer reversal.
  for (const order of orders.docs) for (const collection of ['member_earnings', 'referral_earnings']) {
    const earnings = await db.collection(collection).where('orderId', '==', order.id).get();
    for (const earning of earnings.docs) await earning.ref.update({ status: 'needs_review', refund: savedEvidence });
  }
}

export async function assertProductionPayment(order: any) {
  if (order.paymentStatus !== 'paid' || order.productionHold || order.refund?.refundedAmountCents > 0) throw new Error('Refunded or held payment cannot enter production.');
  if (!order.stripePaymentIntentId) throw new Error('Order payment needs Stripe reconciliation before production.');
  const key = await readFlubaProviderKey('STRIPE_SECRET_KEY');
  if (!key) throw new Error('Payment verification is unavailable.');
  const stripe = new Stripe(key);
  const payment = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, { expand: ['latest_charge.transfer'] });
  const charge = typeof payment.latest_charge === 'object' ? payment.latest_charge : null;
  if (charge && charge.amount_refunded > 0) { await recordChargeRefund(charge); throw new Error('Stripe payment has been refunded. Production is on hold.'); }
  if (payment.status !== 'succeeded' || payment.amount_received !== order.amountTotalCents || payment.currency !== order.currency ||
      !charge || charge.paid !== true || charge.disputed || charge.amount_refunded !== 0 || idOf(charge.payment_intent) !== order.stripePaymentIntentId) throw new Error('Stripe payment is not available for production.');
}
