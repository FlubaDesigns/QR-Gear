import type Stripe from 'stripe';
import { db } from '../core';

/** Shared by the signed webhook and Stripe-retrieved browser return. */
export async function finalizeHostingRenewal(session: Stripe.Checkout.Session, expectedInstanceId?: string) {
  const { renewalId, instanceId, type } = session.metadata || {};
  if (session.payment_status !== 'paid' || type !== 'hosting_renewal' || !renewalId || !instanceId ||
      (expectedInstanceId && expectedInstanceId !== instanceId)) throw new Error('Renewal payment has no matching frozen order. Historical payments require reconciliation.');
  const ref = db.collection('hosting_renewals').doc(renewalId), instanceRef = db.collection('buyer_instances').doc(instanceId);
  const receiptRef = db.collection('hosting_renewal_receipts').doc(session.id);
  const paymentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id;
  return db.runTransaction(async tx => {
    const renewal = (await tx.get(ref)).data(), instance = (await tx.get(instanceRef)).data(), receipt = await tx.get(receiptRef);
    const refund = paymentId ? (await tx.get(db.collection('paymentRefunds').doc(paymentId))).data() : null;
    if (!renewal || !instance || renewal.instanceId !== instanceId || renewal.amountCents !== session.amount_total || renewal.currency !== session.currency ||
        (renewal.stripeSessionId && renewal.stripeSessionId !== session.id) || !Number.isSafeInteger(renewal.durationDays) || renewal.durationDays <= 0 || refund) throw new Error('Renewal payment does not match its saved terms.');
    if (receipt.exists) return { success: true, alreadyProcessed: true, instance: { id: instanceId, hostingExpiresAt: receipt.data()!.newExpirationDate }, newExpirationDate: receipt.data()!.newExpirationDate };
    if (renewal.status === 'applied') throw new Error('Renewal already consumed by another session.');
    const expiry = instance.hostingExpiresAt?.toDate?.() ?? (instance.hostingExpiresAt ? new Date(instance.hostingExpiresAt) : null);
    if (expiry && !Number.isFinite(expiry.getTime())) throw new Error('Current hosting expiry needs reconciliation.');
    const newExpirationDate = new Date(Math.max(Date.now(), expiry?.getTime() || 0) + renewal.durationDays * 86400000).toISOString();
    const now = new Date().toISOString();
    tx.update(instanceRef, { hostingExpiresAt: newExpirationDate, renewedAt: now, updatedAt: now });
    tx.update(ref, { status: 'applied', stripeSessionId: session.id, paymentIntentId: paymentId || null, newExpirationDate, appliedAt: now });
    tx.create(receiptRef, { renewalId, instanceId, newExpirationDate, appliedAt: now });
    return { success: true, alreadyProcessed: false, instance: { id: instanceId, hostingExpiresAt: newExpirationDate }, newExpirationDate };
  });
}
