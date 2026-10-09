import { db, admin } from '../core';
import { allocateQrgInstanceRecord, type AllocateQrgInstanceOptions } from './qrg-instance-store';
export type { QrgContext, QrgInstanceIdentity, AllocateQrgInstanceOptions } from './qrg-instance-store';
export function allocateQrgInstance(opts: AllocateQrgInstanceOptions) {
  return allocateQrgInstanceRecord(db, () => admin.firestore.FieldValue.serverTimestamp(), opts);
}
