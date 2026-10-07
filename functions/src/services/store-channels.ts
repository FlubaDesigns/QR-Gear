/** Shared operations for the existing admin and public-path store routes. */
import type { Firestore } from 'firebase-admin/firestore';
import { isStoreRole } from '../../../shared/storeRoles';

export class StoreChannelError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
function slug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}
function nameAndSlug(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new StoreChannelError(`${label} name is required`);
  const id = slug(value);
  if (!/[a-z0-9]/.test(id)) throw new StoreChannelError(`${label} name must contain a letter or number`);
  return { name: value.trim(), id };
}
export async function createStore(db: Firestore, input: Record<string, any>) {
  const { name, id } = nameAndSlug(input.name, 'Store');
  if (!isStoreRole(input.roleType)) throw new StoreChannelError('Valid roleType is required');
  const data: Record<string, any> = { name, roleType: input.roleType, isActive: true, channelCount: 0, createdAt: new Date().toISOString() };
  if (input.roleType === 'marketplace') {
    data.marketplaceConfig = {
      platform: input.platform || '', apiKeyRef: input.apiKeyRef || '', shopId: input.shopId || '', shopName: input.shopName || '',
      feePercent: typeof input.feePercent === 'number' ? input.feePercent : 0,
      syncEnabled: input.syncEnabled === true, apiKeyConfigured: false,
    };
  }
  const ref = db.collection('stores').doc(id);
  await db.runTransaction(async tx => {
    if ((await tx.get(ref)).exists) throw new StoreChannelError('A store with that name already exists', 409);
    tx.create(ref, data);
  });
  return { id, ...data };
}
export async function createStoreChannel(db: Firestore, storeId: string, input: Record<string, any>) {
  const { name, id: nameSlug } = nameAndSlug(input.name, 'Channel');
  const data = { name, storeId, isActive: true, productCount: 0, createdAt: new Date().toISOString() };
  const id = await db.runTransaction(async tx => {
    let storeRef = db.collection('stores').doc(storeId);
    let store = await tx.get(storeRef);
    // Match the existing by-id route: older Store Builder parents live in partnerStores.
    if (!store.exists) { storeRef = db.collection('partnerStores').doc(storeId); store = await tx.get(storeRef); }
    if (!store.exists) throw new StoreChannelError('Store not found', 404);
    const channels = await tx.get(db.collection('storeChannels').where('storeId', '==', storeId));
    const legacyRef = db.collection('storeChannels').doc(nameSlug);
    const legacy = await tx.get(legacyRef);
    // Preserve traditional IDs whenever free; scope only a cross-store name collision.
    const ref = legacy.exists ? db.collection('storeChannels').doc(`${storeId}--${nameSlug}`) : legacyRef;
    const target = legacy.exists ? await tx.get(ref) : legacy;
    if (target.exists || channels.docs.some(doc => slug(doc.data().name || '') === nameSlug)) {
      throw new StoreChannelError('A channel with that name already exists in this store', 409);
    }
    tx.create(ref, data);
    tx.update(storeRef, { channelCount: channels.size + 1 });
    return ref.id;
  });
  return { id, ...data };
}

type WriteOp = { ref: FirebaseFirestore.DocumentReference; data?: Record<string, any> };
async function commitChunks(db: Firestore, operations: WriteOp[]) {
  for (let i = 0; i < operations.length; i += 500) {
    const batch = db.batch();
    for (const op of operations.slice(i, i + 500)) {
      if (op.data) batch.update(op.ref, op.data); else batch.delete(op.ref);
    }
    await batch.commit();
  }
}
export async function deleteStoreChannel(db: Firestore, timestamp: () => unknown, storeId: string, channelId: string) {
  const ref = db.collection('storeChannels').doc(channelId);
  const channel = await ref.get();
  if (!channel.exists) throw new StoreChannelError('Channel not found', 404);
  if (channel.data()!.storeId !== storeId) throw new StoreChannelError('Channel does not belong to this store', 409);
  const instances = await db.collection('admin_catalog_instances').where('storeId', '==', storeId).where('channelId', '==', channelId).get();
  const deletedAt = timestamp();
  await commitChunks(db, [
    ...instances.docs.map(doc => ({ ref: doc.ref, data: { isVisible: false, status: 'deleted', deletedAt } })),
    { ref },
  ]);
  // Recount rather than decrementing older stores whose counter was never maintained.
  await db.runTransaction(async tx => {
    let storeRef = db.collection('stores').doc(storeId);
    let store = await tx.get(storeRef);
    if (!store.exists) { storeRef = db.collection('partnerStores').doc(storeId); store = await tx.get(storeRef); }
    const remaining = await tx.get(db.collection('storeChannels').where('storeId', '==', storeId));
    if (store.exists) tx.update(storeRef, { channelCount: remaining.size });
  });
  return { success: true, archivedInstances: instances.size };
}
export async function deleteStore(db: Firestore, timestamp: () => unknown, storeId: string) {
  const storeRef = db.collection('stores').doc(storeId);
  if (!(await storeRef.get()).exists) throw new StoreChannelError('Store not found', 404);
  const [instances, channels] = await Promise.all([
    db.collection('admin_catalog_instances').where('storeId', '==', storeId).get(),
    db.collection('storeChannels').where('storeId', '==', storeId).get(),
  ]);
  const deletedAt = timestamp();
  await commitChunks(db, [
    ...instances.docs.map(doc => ({ ref: doc.ref, data: { isVisible: false, status: 'deleted', deletedAt } })),
    ...channels.docs.map(doc => ({ ref: doc.ref })), { ref: storeRef },
  ]);
  return { success: true, deletedStoreId: storeId, deletedChannels: channels.size, archivedInstances: instances.size };
}
