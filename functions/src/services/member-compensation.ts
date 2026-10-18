import type Stripe from 'stripe';
import { db } from '../core';
import { pricingSettingsSchema } from '../../../shared/schema-orders';

export interface MemberCompensation {
  version: 1; currency: 'usd'; saleCents: number; costCents: number; profitCents: number;
  share: number; amountCents: number;
}
export async function freezeMemberCompensation(saleCents: number, productCost: number): Promise<MemberCompensation> {
  const settings = (await db.collection('testSettings').doc('pricing').get()).data();
  const { memberProfitShare: share } = pricingSettingsSchema.pick({ memberProfitShare: true }).parse(settings);
  const costCents = Math.round(productCost * 100);
  if (!Number.isSafeInteger(saleCents) || saleCents < 0 || !Number.isFinite(productCost) || productCost < 0 || !Number.isSafeInteger(costCents)) throw new Error('Member compensation requires valid saved price and cost.');
  const profitCents = Math.max(0, saleCents - costCents);
  return { version: 1, currency: 'usd', saleCents, costCents, profitCents, share, amountCents: Math.round(profitCents * share) };
}
export function validateMemberCompensation(value: MemberCompensation, saleCents: number) {
  if (!value || value.version !== 1 || value.currency !== 'usd' || value.saleCents !== saleCents || !Number.isFinite(value.share) || value.share < 0 || value.share > 1 ||
    !Number.isSafeInteger(value.costCents) || value.costCents < 0 || value.profitCents !== Math.max(0, saleCents - value.costCents) || value.amountCents !== Math.round(value.profitCents * value.share)) throw new Error('Frozen member compensation is invalid.');
  return value;
}
/** A checkout request is not evidence of settlement. Read the actual destination transfer. */
export async function reconcileMemberTransfer(stripe: Stripe, order: any) {
  const policy = validateMemberCompensation(order.memberCompensation, order.amountTotalCents);
  if (!policy.amountCents) return { status: 'not_applicable', amountCents: 0, transferId: null };
  if (!order.connectAccountId) return { status: 'pending', amountCents: 0, transferId: null };
  if (!order.stripePaymentIntentId) throw new Error('Payment intent is missing for transfer reconciliation.');
  const payment = await stripe.paymentIntents.retrieve(order.stripePaymentIntentId, { expand: ['latest_charge.transfer'] });
  const charge = typeof payment.latest_charge === 'object' ? payment.latest_charge : null;
  const transfer = charge && typeof charge.transfer === 'object' ? charge.transfer : null;
  const destination = transfer && (typeof transfer.destination === 'string' ? transfer.destination : transfer.destination?.id);
  const matched = payment.status === 'succeeded' && payment.amount_received === order.amountTotalCents && payment.currency === policy.currency &&
    charge?.paid === true && charge.amount_refunded === 0 && transfer?.amount === policy.amountCents && transfer.currency === policy.currency &&
    transfer.amount_reversed === 0 && destination === order.connectAccountId;
  return { status: matched ? 'transferred' : 'needs_review', amountCents: transfer ? transfer.amount - transfer.amount_reversed : 0,
    transferId: transfer?.id || null, checkedAt: new Date().toISOString() };
}
