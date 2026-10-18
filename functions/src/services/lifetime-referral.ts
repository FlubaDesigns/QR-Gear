import { createHash } from 'crypto';
import { db } from '../core';

/** Preserve the buyer's first saved relationship and freeze it once per order. */
export async function resolveLifetimeReferral(orderId: string, buyerEmail: string, candidateId?: string) {
  const buyerKey = buyerEmail.trim().toLowerCase();
  if (!buyerKey) return null;
  const relationshipRef = db.collection('referrals').doc(createHash('sha256').update(buyerKey).digest('hex'));
  const attributionRef = db.collection('referral_attributions').doc(orderId);
  return db.runTransaction(async tx => {
    const frozen = await tx.get(attributionRef);
    if (frozen.exists) return frozen.data()!;
    const canonical = await tx.get(relationshipRef);
    const old = await tx.get(db.collection('referrals').where('buyerKey', '==', buyerEmail));
    const normalized = buyerKey === buyerEmail ? old : await tx.get(db.collection('referrals').where('buyerKey', '==', buyerKey));
    const legacy = [...old.docs, ...normalized.docs].sort((a, b) => String(a.data().createdAt || '').localeCompare(String(b.data().createdAt || '')) || a.id.localeCompare(b.id))[0];
    const prior = canonical.exists ? canonical.data()! : legacy?.data();
    const referrerId = prior?.referrerId || candidateId || null;
    const sharePercent = prior?.profitSharePercent ?? 25;
    if (!Number.isFinite(sharePercent) || sharePercent < 0 || sharePercent > 100) throw new Error('Saved referral share needs reconciliation.');
    const attribution = { buyerKey, referrerId, sharePercent, relationshipId: canonical.exists ? canonical.id : legacy?.id || (referrerId ? relationshipRef.id : null), createdAt: new Date().toISOString() };
    if (!prior && referrerId) tx.create(relationshipRef, { buyerKey, referrerId, profitSharePercent: sharePercent, lifetime: true, createdAt: attribution.createdAt });
    tx.create(attributionRef, attribution);
    return attribution;
  });
}
