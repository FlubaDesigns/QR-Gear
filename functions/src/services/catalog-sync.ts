import { randomUUID } from 'crypto';
import { isDeepStrictEqual } from 'util';

const protocol = 'request-v1';
const timestamp = (v: any) => v?.toDate?.()?.getTime() ?? Date.parse(v || '');
const error = (message: string, status = 409) => Object.assign(new Error(message), { status });

/** Public progress never exposes the saved work queue or lease token. */
export function catalogSyncProgress(id: string, data: any) {
  const { queue, lease, leaseUntil, ...progress } = data;
  return { ...progress, id, syncId: id, resumable: data.protocol === protocol,
    processed: data.cursor ?? 0, total: queue?.length ?? 0 };
}

/** Each request awaits its work. The existing history record is also the checkpoint. */
export async function advanceCatalogSync(db: any, provider: 'printful' | 'printify', input: any, deps: {
  list: () => Promise<any[]>;
  syncProduct: (product: any) => Promise<'added' | 'updated' | 'skipped'>;
  rebuild: () => Promise<any>;
}) {
  const syncType = provider === 'printful' ? 'printful' : 'smart';
  const collection = db.collection('catalogSyncs');
  if (!input?.syncId) {
    const rows = await collection.where('syncType', '==', syncType).get();
    const latest = rows.docs.sort((a: any, b: any) => timestamp(b.data().startedAt) - timestamp(a.data().startedAt))[0];
    if (latest?.data().protocol === protocol && ['running', 'failed'].includes(latest.data().status)) {
      return catalogSyncProgress(latest.id, { ...latest.data(), status: 'running', errorMessage: null });
    }
    const products = await deps.list();
    if (!Array.isArray(products) || !products.length || products.some(p => !Number.isSafeInteger(p.id) || p.id <= 0)) {
      throw error('Supplier returned an empty or invalid catalog. Nothing was imported.', 502);
    }
    // Keep only list fields the importer consumes; avoid the Firestore document limit.
    const queue = products.map(p => Object.fromEntries(['id', 'title', 'type', 'brand', 'model', 'image', 'variant_count', 'description', 'images']
      .filter(key => p[key] !== undefined).map(key => [key, p[key]])));
    if (Buffer.byteLength(JSON.stringify(queue)) > 850000) throw error('Supplier catalog exceeds the saved sync queue limit.', 502);
    const ref = collection.doc();
    return db.runTransaction(async (tx: any) => {
      // Query inside the transaction prevents simultaneous starts from creating two workers.
      const active = await tx.get(collection.where('status', '==', 'running'));
      for (const doc of active.docs) {
        const value = doc.data();
        if (value.protocol === protocol) {
          if (value.syncType !== syncType) throw error('Resume the other supplier sync before starting this one.');
          return catalogSyncProgress(doc.id, value);
        }
        if (Date.now() - timestamp(value.startedAt) < 30 * 60 * 1000) throw error('The earlier supplier sync is still within its timeout. Retry shortly.');
      }
      for (const doc of active.docs) tx.update(doc.ref, { status: 'failed', errorMessage: 'The previous background sync did not finish. Replaced by a resumable sync.' });
      const value = { protocol, syncType, status: 'running', queue, cursor: 0, phase: 'supplier',
        startedAt: new Date().toISOString(), summary: { [provider === 'printful' ? 'products' : 'blueprints']: { added: 0, updated: 0, skipped: 0, failed: 0, total: queue.length } } };
      tx.create(ref, value);
      return catalogSyncProgress(ref.id, value);
    });
  }
  if (typeof input.syncId !== 'string' || input.syncId.includes('/')) throw error('Invalid sync ID.', 400);
  const ref = collection.doc(input.syncId), lease = randomUUID();
  const job = await db.runTransaction(async (tx: any) => {
    const doc = await tx.get(ref), value = doc.data();
    if (!doc.exists) throw error('Sync not found.', 404);
    if (value.protocol !== protocol || value.syncType !== syncType) throw error('This sync cannot be resumed by this supplier.');
    if (value.status === 'completed' || value.leaseUntil > Date.now()) return { value, acquired: false };
    tx.update(ref, { lease, leaseUntil: Date.now() + 120000, status: 'running', errorMessage: null });
    return { value, acquired: true };
  });
  if (!job.acquired) return catalogSyncProgress(ref.id, job.value);
  const finish = async (updates: any) => db.runTransaction(async (tx: any) => {
    const current = (await tx.get(ref)).data();
    if (current.lease !== lease) throw error('Sync ownership changed. Refresh the status before continuing.');
    tx.update(ref, { ...updates, lease: null, leaseUntil: 0, updatedAt: new Date().toISOString() });
    return catalogSyncProgress(ref.id, { ...current, ...updates });
  });
  try {
    if (job.value.cursor === job.value.queue.length) {
      // Completion includes the QRG projection; the browser cannot skip this phase.
      const qrgSummary = await deps.rebuild();
      return await finish({ status: 'completed', phase: 'completed', qrgSummary, completedAt: new Date().toISOString(), errorMessage: null });
    }
    // One supplier request per step stays within Hosting's request window even on timeout.
    const result = await deps.syncProduct(job.value.queue[job.value.cursor]);
    const key = provider === 'printful' ? 'products' : 'blueprints';
    const summary = { ...job.value.summary, [key]: { ...job.value.summary[key], [result]: job.value.summary[key][result] + 1, failed: 0 } };
    const cursor = job.value.cursor + 1;
    return await finish({ status: 'running', cursor, summary, phase: cursor === job.value.queue.length ? 'rebuilding' : 'supplier', errorMessage: null });
  } catch (e: any) {
    console.error('[Catalog Sync] Step failed:', e.message);
    return finish({ status: 'failed', summary: { ...job.value.summary, [provider === 'printful' ? 'products' : 'blueprints']: { ...job.value.summary[provider === 'printful' ? 'products' : 'blueprints'], failed: 1 } }, errorMessage: `Sync stopped at product ${job.value.cursor + 1}: ${e.message}. Use Resume Sync to retry this step.` });
  }
}

/** Compare supplier-owned fields only, preserving admin-owned lookup metadata. */
export function catalogFieldsChanged(existing: any, incoming: any) {
  return !existing || Object.keys(incoming).some(key => !isDeepStrictEqual(existing[key], incoming[key]));
}
