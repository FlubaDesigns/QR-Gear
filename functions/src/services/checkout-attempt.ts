import { createHash } from 'crypto';
import type Stripe from 'stripe';
import { db } from '../core';
import { assertLiveStripeObject } from './stripe-mode';

export interface CheckoutAttempt { id: string; requestHash: string; }
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function canonical(value: any): any {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, canonical(value[key])]));
  return value;
}
export function checkoutAttempt(scope: string, key: unknown, request: unknown): CheckoutAttempt {
  if (typeof key !== 'string' || !/^[A-Za-z0-9_-]{22,100}$/.test(key)) throw Object.assign(new Error('Reload checkout before continuing.'), { status: 400 });
  // Printful receives this order ID as external_id (maximum 32 characters).
  return { id: hash(`${scope}:${key}`).slice(0, 32), requestHash: hash(JSON.stringify(canonical(request))) };
}
export function assertCheckoutAttempt(order: any, attempt: CheckoutAttempt) {
  if (order.checkoutRequestHash !== attempt.requestHash) throw Object.assign(new Error('This checkout attempt belongs to a different selection. Review your order again.'), { status: 409 });
}

/** Freeze Stripe parameters before making the request, including the expiry.
 * A lost provider response can then be recovered using the same key and payload.
 * Never create again after Stripe's guaranteed idempotency window has elapsed.
 */
export async function createCheckoutSession(stripe: Stripe, collection: 'orders' | 'hosting_renewals', id: string, params: Stripe.Checkout.SessionCreateParams, orderUpdates: Record<string, unknown> = {}) {
  const ref = db.collection(collection).doc(id);
  const saved = await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record) throw new Error('Checkout order is unavailable.');
    if (record.stripeSessionId) return { sessionId: record.stripeSessionId, params: null };
    if (record.status !== 'awaiting_payment') throw Object.assign(new Error('This order cannot start another payment.'), { status: 409 });
    if (record.stripeCheckoutParams) {
      if (!Number.isFinite(record.stripeCheckoutStartedAt) || Date.now() - record.stripeCheckoutStartedAt >= 23 * 3600000) throw Object.assign(new Error('Checkout needs payment reconciliation before another attempt. Contact info@qrgear.com.'), { status: 409 });
      return { sessionId: null, params: record.stripeCheckoutParams };
    }
    const frozen = JSON.parse(JSON.stringify({ ...params, expires_at: Math.floor(Date.now() / 1000) + 23 * 3600 }));
    tx.update(ref, { ...orderUpdates, stripeCheckoutParams: frozen, stripeCheckoutStartedAt: Date.now() });
    return { sessionId: null, params: frozen };
  });
  const session = saved.sessionId ? await stripe.checkout.sessions.retrieve(saved.sessionId)
    : await stripe.checkout.sessions.create(saved.params!, { idempotencyKey: `checkout-${collection}-${id}` });
  assertLiveStripeObject(session);
  if (session.status === 'expired') throw Object.assign(new Error('This checkout expired. Review your order and start a new checkout.'), { status: 409, code: 'checkout_expired' });
  await db.runTransaction(async tx => {
    const record = (await tx.get(ref)).data();
    if (!record || (record.stripeSessionId && record.stripeSessionId !== session.id)) throw new Error('Checkout session needs reconciliation.');
    tx.update(ref, { stripeSessionId: session.id });
  });
  return session;
}
