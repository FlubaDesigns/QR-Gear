import { assertLiveStripeObject } from './stripe-mode';
import type Stripe from 'stripe';
import { db } from '../core';
import { QR_DYNAMICS_INSTANCES_COLLECTION } from '../constants';
import { readHostingTiers } from './hosting-tiers';
import { COMPOSE_HOSTING_YEARS, isComposeHostingCode } from '../../../shared/composeHosting';

/** Prices come only from Admin Pricing; initial included/free terms are not paid renewals. */
export async function hostingRenewalOptions() {
  return (await readHostingTiers(db)).filter(t => isComposeHostingCode(t.code) && t.price > 0).map(t => ({
    code: t.code, name: t.name, amountCents: Math.round(t.price * 100), currency: 'usd', durationYears: COMPOSE_HOSTING_YEARS[t.code],
  })).filter(t => Number.isSafeInteger(t.amountCents) && t.amountCents > 0);
}

/** Current identity wins; historical buyer records are compatibility-only. */
export async function readHostingInstance(instanceId: string) {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(instanceId)) throw Object.assign(new Error('Instance not found'), { status: 404 });
  const current = await db.collection(QR_DYNAMICS_INSTANCES_COLLECTION).doc(instanceId).get();
  if (current.exists) return { instance: current.data()!, legacy: false };
  const legacy = await db.collection('buyer_instances').doc(instanceId).get();
  if (!legacy.exists) throw Object.assign(new Error('Instance not found'), { status: 404 });
  return { instance: legacy.data()!, legacy: true };
}

/** Shared by the signed webhook and Stripe-retrieved browser return. */
export async function finalizeHostingRenewal(session: Stripe.Checkout.Session, expectedInstanceId?: string) {
  assertLiveStripeObject(session);
  const { renewalId, instanceId, type } = session.metadata || {};
  if (session.payment_status !== 'paid' || type !== 'hosting_renewal' || !renewalId || !instanceId ||
      (expectedInstanceId && expectedInstanceId !== instanceId)) throw new Error('Renewal payment has no matching frozen order. Historical payments require reconciliation.');
  const ref = db.collection('hosting_renewals').doc(renewalId);
  const receiptRef = db.collection('hosting_renewal_receipts').doc(session.id);
  const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  return db.runTransaction(async tx => {
    const renewal = (await tx.get(ref)).data();
    const collection = renewal?.instanceCollection ?? 'buyer_instances';
    if (!['buyer_instances', QR_DYNAMICS_INSTANCES_COLLECTION].includes(collection)) throw new Error('Renewal target needs reconciliation.');
    const instanceRef = db.collection(collection).doc(instanceId);
    const instance = (await tx.get(instanceRef)).data(), receipt = await tx.get(receiptRef);
    const projectionRef = db.collection('claimedInstances').doc(instanceId);
    const projection = collection === QR_DYNAMICS_INSTANCES_COLLECTION ? (await tx.get(projectionRef)).data() : null;
    const refund = paymentId ? (await tx.get(db.collection('paymentRefunds').doc(paymentId))).data() : null;
    if (!renewal || !instance || renewal.instanceId !== instanceId || renewal.amountCents !== session.amount_total || renewal.currency !== session.currency ||
        (renewal.stripeSessionId && renewal.stripeSessionId !== session.id) || !(renewal.version === 2 ? Number.isSafeInteger(renewal.durationYears) && renewal.durationYears > 0 : Number.isSafeInteger(renewal.durationDays) && renewal.durationDays > 0) || refund) throw new Error('Renewal payment does not match its saved terms.');
    if (receipt.exists) return { success: true, alreadyProcessed: true, instance: { id: instanceId, hostingExpiresAt: receipt.data()!.newExpirationDate }, newExpirationDate: receipt.data()!.newExpirationDate };
    if (renewal.status === 'applied') throw new Error('Renewal already consumed by another session.');
    const expiry = instance.hostingExpiresAt?.toDate?.() ?? (instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) : null);
    if (expiry && !Number.isFinite(expiry.getTime())) throw new Error('Current hosting expiry needs reconciliation.');
    if (collection === QR_DYNAMICS_INSTANCES_COLLECTION && (instance.status !== 'active' || instance.qrgBaseCode !== renewal.qrgBaseCode)) throw new Error('Renewal item identity needs reconciliation.');
    if (projection && (projection.dynamicsInstanceId !== instanceId || projection.ownerUserId !== instance.ownerId)) throw new Error('Claimed item projection needs reconciliation.');
    const extended = new Date(Math.max(Date.now(), expiry?.getTime() || 0));
    if (renewal.version === 2) extended.setUTCFullYear(extended.getUTCFullYear() + renewal.durationYears);
    else extended.setTime(extended.getTime() + renewal.durationDays * 86400000);
    const newExpirationDate = extended.toISOString();
    const now = new Date().toISOString();
    tx.update(instanceRef, { hostingExpiresAt: newExpirationDate, renewedAt: now, updatedAt: now });
    if (projection) tx.update(projectionRef, { hostingExpiresAt: newExpirationDate, updatedAt: now });
    tx.update(ref, { status: 'applied', stripeSessionId: session.id, paymentIntentId: paymentId || null, newExpirationDate, appliedAt: now });
    tx.create(receiptRef, { renewalId, instanceId, newExpirationDate, appliedAt: now });
    return { success: true, alreadyProcessed: false, instance: { id: instanceId, hostingExpiresAt: newExpirationDate }, newExpirationDate };
  });
}
