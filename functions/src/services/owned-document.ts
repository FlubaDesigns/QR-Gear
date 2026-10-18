import { db } from '../core';
import { ADMIN_USER_IDS } from '../middleware';
import { hasAdminAccess } from '../../../shared/adminAccess';

export async function readOwnedDocument(tx: FirebaseFirestore.Transaction, ref: FirebaseFirestore.DocumentReference, uid: string, ownerFields = ['userId']) {
  const doc = await tx.get(ref);
  if (!doc.exists) throw Object.assign(new Error('Record not found'), { status: 404 });
  const data = doc.data()!;
  const owner = ownerFields.map(field => data[field]).find(Boolean);
  if (owner !== uid) {
    const user = await tx.get(db.collection('users').doc(uid));
    if (!hasAdminAccess(uid, user.data(), ADMIN_USER_IDS)) throw Object.assign(new Error('Forbidden'), { status: 403 });
  }
  return doc;
}
