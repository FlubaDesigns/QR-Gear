import { createStore, createStoreChannel, deleteStore, deleteStoreChannel } from './store-channels';
import { MOSAIC_TEMPLATES_COLLECTION } from '../constants';

export const isActiveStoreRecord = (d: any) => !!d && d.isVisible !== false && d.isActive !== false && !['deleted', 'archived'].includes(d.status);
export async function listStoreChannels(db: any, storeId?: string) {
  const query = db.collection('storeChannels');
  const snapshot = await (storeId ? query.where('storeId', '==', storeId) : query).get();
  const parents = new Map<string, any>();
  await Promise.all(Array.from(new Set<string>(snapshot.docs.map((d: any) => d.data().storeId).filter(Boolean))).map(async id => {
    let doc = await db.collection('stores').doc(id).get();
    if (!doc.exists) doc = await db.collection('partnerStores').doc(id).get();
    parents.set(id, { name: doc.exists ? doc.data().name || id : '(orphaned)', exists: doc.exists });
  }));
  const instancesQuery = db.collection('admin_catalog_instances');
  const instances = await (storeId ? instancesQuery.where('storeId','==',storeId) : instancesQuery).get();
  const counts = new Map<string,number>();
  for (const doc of instances.docs) {
    const item=doc.data();
    if(isActiveStoreRecord(item)&&item.storeId&&item.channelId){const key=`${item.storeId}/${item.channelId}`;counts.set(key,(counts.get(key)||0)+1);}
  }
  return snapshot.docs.map((doc: any) => {
    const d = doc.data(), parent = parents.get(d.storeId);
    return { ...d, id: doc.id, productCount: counts.get(`${d.storeId}/${doc.id}`) || 0, storeName: parent?.name || '(orphaned)', storeExists: parent?.exists === true };
  }).sort((a: any, b: any) => a.storeName.localeCompare(b.storeName) || (a.name || '').localeCompare(b.name || ''));
}
async function collectionSources(db: any, storeId: string, channelId: string) {
  return Promise.all([
    db.collection('admin_catalog_instances').where('storeId', '==', storeId).where('channelId', '==', channelId).get(),
    db.collection('storeProductLinks').where('storeId', '==', storeId).where('channel', '==', channelId).get(),
    db.collection(MOSAIC_TEMPLATES_COLLECTION).where('storeId', '==', storeId).where('channelId', '==', channelId).get(),
  ]);
}
export async function listStoreCollections(db: any, storeId: string, channelId: string) {
  const sources = await collectionSources(db, storeId, channelId);
  const fields = ['collectionName', 'collection', 'name'];
  const names = new Set<string>();
  sources.forEach((snap, i) => snap.docs.forEach((doc: any) => {
    const data = doc.data(); if (isActiveStoreRecord(data) && data[fields[i]]) names.add(data[fields[i]]);
  }));
  const collections = Array.from(names).sort();
  return { success: true, collections, count: collections.length };
}
export async function deleteStoreCollection(db: any, storeId: string, channelId: string, name: string, now: any) {
  const sources = await collectionSources(db, storeId, channelId);
  const fields = ['collectionName', 'collection', 'name'];
  const docs = sources.flatMap((snap, i) => snap.docs.filter((doc: any) => doc.data()[fields[i]] === name));
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + 500)) batch.update(doc.ref, { isVisible: false, isActive: false, status: 'deleted', deletedAt: now });
    await batch.commit();
  }
  return { success: true, deleted: docs.length };
}
/** The same admin routes run in Functions and the development adapter. */
export function registerStoreAdminRoutes(app: any, prefix: string, auth: any, getDb: () => any, timestamp: () => any) {
  const handler = (fn: (db: any, req: any) => Promise<any>) => async (req: any, res: any) => {
    try { res.json(await fn(getDb(), req)); }
    catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
  };
  app.post(`${prefix}/admin/stores`, auth, handler((db, req) => createStore(db, req.body)));
  app.delete(`${prefix}/admin/stores/:storeId`, auth, handler((db, req) => deleteStore(db, timestamp, req.params.storeId)));
  app.get(`${prefix}/admin/channels`, auth, handler(db => listStoreChannels(db)));
  app.get(`${prefix}/admin/stores/:storeId/channels`, auth, handler((db, req) => listStoreChannels(db, req.params.storeId)));
  app.post(`${prefix}/admin/stores/:storeId/channels`, auth, handler((db, req) => createStoreChannel(db, req.params.storeId, req.body)));
  app.delete(`${prefix}/admin/stores/:storeId/channels/:channelId`, auth, handler((db, req) => deleteStoreChannel(db, timestamp, req.params.storeId, req.params.channelId)));
  app.delete(`${prefix}/admin/channels/:channelId`, auth, handler(async (db, req) => {
    const doc = await db.collection('storeChannels').doc(req.params.channelId).get();
    if (!doc.exists) throw Object.assign(new Error('Channel not found'), { status: 404 });
    return deleteStoreChannel(db, timestamp, doc.data().storeId, doc.id);
  }));
  app.get(`${prefix}/admin/stores/:storeId/channels/:channelId/collections`, auth, handler((db, req) => listStoreCollections(db, req.params.storeId, req.params.channelId)));
  app.delete(`${prefix}/admin/stores/:storeId/channels/:channelId/collections/:collectionName`, auth, handler((db, req) => deleteStoreCollection(db, req.params.storeId, req.params.channelId, req.params.collectionName, timestamp())));
}
