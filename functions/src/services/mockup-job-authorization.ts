import { createHash } from 'node:crypto';
import { db } from '../core';
import { ADMIN_USER_IDS } from '../middleware';
import { hasAdminAccess } from '../../../shared/adminAccess';

const targetFields = ['templateId', 'productId', 'instanceId', 'storeId', 'blueprintId', 'printProviderId', 'jobData', 'color', 'colorName', 'colorHex', 'placement', 'printMethod', 'qrSize', 'fulfillmentProvider'];
function sorted(value: any): any {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, sorted(value[key])]));
  return value;
}
export function mockupTargetHash(job: Record<string, any>): string {
  return createHash('sha256').update(JSON.stringify(sorted(Object.fromEntries(targetFields.filter(key => job[key] !== undefined).map(key => [key, job[key]]))))).digest('hex');
}

/** The old intake could write job fields, but never this server-only subrecord. */
export function writeAuthorizedMockupJob(batch: FirebaseFirestore.WriteBatch, ref: FirebaseFirestore.DocumentReference, job: Record<string, any>, uid: string): void {
  if (!uid) throw new Error('An authenticated administrator must authorize this job');
  batch.set(ref, job);
  batch.set(ref.collection('authorization').doc('v1'), { uid, targetHash: mockupTargetHash(job), authorizedAt: new Date().toISOString() });
}
export async function enqueueAuthorizedMockupJob(job: Record<string, any>, uid: string) {
  const ref = db.collection('mockup_jobs').doc();
  const batch = db.batch(); writeAuthorizedMockupJob(batch, ref, job, uid); await batch.commit(); return ref;
}
export async function assertAuthorizedMockupJob(tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference, job: Record<string, any>): Promise<void> {
  const proof = await tx.get(ref.collection('authorization').doc('v1'));
  const authorization = proof.data();
  if (!authorization?.uid || authorization.targetHash !== mockupTargetHash(job)) throw new Error('Mockup job is not authorized for this target. Regenerate it from the admin builder.');
  const user = await tx.get(db.collection('users').doc(authorization.uid));
  if (!hasAdminAccess(authorization.uid, user.data(), ADMIN_USER_IDS)) throw new Error('Mockup job administrator no longer has access');
}
export async function recheckMockupJob(ref: FirebaseFirestore.DocumentReference, expected: Record<string, any>): Promise<void> {
  await db.runTransaction(async tx => {
    const fresh = await tx.get(ref);
    if (!fresh.exists || mockupTargetHash(fresh.data()!) !== mockupTargetHash(expected)) throw new Error('Mockup target changed during processing');
    await assertAuthorizedMockupJob(tx, ref, fresh.data()!);
  });
}
