import { getFirestoreDb } from "./firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export function getDb() {
  return getFirestoreDb();
}

export async function fsGet(collection: string, id: string): Promise<any | null> {
  const doc = await getDb().collection(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function fsGetAll(collection: string, orderByField?: string, direction: 'asc' | 'desc' = 'asc'): Promise<any[]> {
  let query: FirebaseFirestore.Query = getDb().collection(collection);
  if (orderByField) {
    query = query.orderBy(orderByField, direction);
  }
  const snap = await query.get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function fsQuery(collection: string, filters: Array<[string, FirebaseFirestore.WhereFilterOp, any]>, orderByField?: string, direction: 'asc' | 'desc' = 'asc', limitCount?: number): Promise<any[]> {
  let query: FirebaseFirestore.Query = getDb().collection(collection);
  for (const [field, op, value] of filters) {
    query = query.where(field, op, value);
  }
  if (orderByField) {
    query = query.orderBy(orderByField, direction);
  }
  if (limitCount) {
    query = query.limit(limitCount);
  }
  const snap = await query.get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function fsQueryOne(collection: string, filters: Array<[string, FirebaseFirestore.WhereFilterOp, any]>): Promise<any | null> {
  const results = await fsQuery(collection, filters, undefined, 'asc', 1);
  return results.length > 0 ? results[0] : null;
}

export async function fsInsert(collection: string, data: any, customId?: string): Promise<any> {
  const now = new Date().toISOString();
  const docData = { ...data, createdAt: data.createdAt || now, updatedAt: now };
  if (customId) {
    await getDb().collection(collection).doc(customId).set(docData);
    return { id: customId, ...docData };
  } else {
    const ref = await getDb().collection(collection).add(docData);
    return { id: ref.id, ...docData };
  }
}

export async function fsUpdate(collection: string, id: string, data: any): Promise<any> {
  const updateData = { ...data, updatedAt: new Date().toISOString() };
  await getDb().collection(collection).doc(id).update(updateData);
  const updated = await fsGet(collection, id);
  return updated;
}

export async function fsUpsert(collection: string, id: string, data: any): Promise<any> {
  const now = new Date().toISOString();
  const docData = { ...data, updatedAt: now };
  await getDb().collection(collection).doc(id).set(docData, { merge: true });
  return { id, ...docData };
}

export async function fsDelete(collection: string, id: string): Promise<void> {
  await getDb().collection(collection).doc(id).delete();
}

export async function fsDeleteWhere(collection: string, filters: Array<[string, FirebaseFirestore.WhereFilterOp, any]>): Promise<number> {
  const docs = await fsQuery(collection, filters);
  const db = getDb();
  const batch = db.batch();
  docs.forEach(doc => batch.delete(db.collection(collection).doc(doc.id)));
  if (docs.length > 0) await batch.commit();
  return docs.length;
}

export async function fsCount(collection: string, filters?: Array<[string, FirebaseFirestore.WhereFilterOp, any]>): Promise<number> {
  let query: FirebaseFirestore.Query = getDb().collection(collection);
  if (filters) {
    for (const [field, op, value] of filters) {
      query = query.where(field, op, value);
    }
  }
  const snap = await query.count().get();
  return snap.data().count;
}

export async function fsBatchInsert(collection: string, items: any[]): Promise<any[]> {
  const db = getDb();
  const results: any[] = [];
  const batchSize = 400;
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const batch = db.batch();
    for (const item of chunk) {
      const now = new Date().toISOString();
      const docData = { ...item, createdAt: item.createdAt || now, updatedAt: now };
      const id = item.id || db.collection(collection).doc().id;
      const ref = db.collection(collection).doc(String(id));
      batch.set(ref, docData);
      results.push({ id, ...docData });
    }
    await batch.commit();
  }
  return results;
}

export { FieldValue };
