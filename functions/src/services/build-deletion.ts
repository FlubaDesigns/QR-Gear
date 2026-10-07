import { BUILD_TARGETS, type BuildTarget } from '../../../shared/buildLifecycle';
import { createHash } from 'node:crypto';
import { isValidGrfId, parseGrfId } from '../../../shared/GRF_engine';

const JOBS = 'asset_deletions';
// Only records that belong to a product build are cascaded. Collections, stores,
// catalog blanks, website content and orders are never deletion targets.
const BUILD_RECORDS = new Set(['assemblies', 'productPackets', 'admin_build_sessions', 'admin_catalog_instances',
  'member_library_instances', 'productTemplates', 'productGraphics', 'storeProductLinks', 'mockup_jobs', 'admin_build_shelf', 'memberPackets']);
// These schema records are flat. Avoid a subcollection RPC per supplier variant.
const FLAT_RECORDS = new Set([...Array.from(BUILD_RECORDS), 'grf_assets', 'master_catalog', 'admin_images',
  'printfulCatalog', 'printful_catalog', 'printful_products', 'printful_variants', 'printifyPrintProviders',
  'printify_blueprints', 'printify_catalog', 'printify_printful_mapping', 'printify_providers', 'printify_variants',
  'grf_counters', 'asm_counters', 'qrg_counters', 'print_placements', 'mockup_cache']);
const LINK = /^(packetIds?|currentPacketId|assemblyId|buildSessionId|sourceSessionId|sessionId|committedInstanceId|sourceAdminInstanceId|sourceMemberInstanceId|ownerInstanceId|instanceId|currentTemplateId|templateId|currentGraphicSetId|graphicSetId)$/;
type RecordDoc = { path: string; id: string; collection: string; data: Record<string, any>; ref?: any };
function validateTarget(target: BuildTarget) {
  if (!target || !Object.prototype.hasOwnProperty.call(BUILD_TARGETS, target.kind) || typeof target.id !== 'string' || !target.id || target.id.includes('/') || (target.kind === 'graphics' && !isValidGrfId(target.id))) throw new DeleteError('Invalid deletion target.');
}
class DeleteError extends Error { constructor(message: string, public status = 400) { super(message); } }
function strings(value: any, field = '', linksOnly = false): string[] {
  if (typeof value === 'string') return !linksOnly || LINK.test(field) ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(v => strings(v, field, linksOnly));
  if (value && Object.getPrototypeOf(value) === Object.prototype) return Object.entries(value).flatMap(([key, v]) => strings(v, key, linksOnly));
  return [];
}
export function ownedStoragePath(value: string, bucket: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    if (url.hostname === 'storage.googleapis.com' && url.pathname.startsWith(`/${bucket}/`)) return decodeURIComponent(url.pathname.slice(bucket.length + 2));
    if (url.hostname === 'firebasestorage.googleapis.com' && url.pathname.startsWith(`/v0/b/${bucket}/o/`)) return decodeURIComponent(url.pathname.split('/o/')[1]);
  } catch { /* Plain storage paths are handled only through explicit storagePath fields. */ }
  return null;
}
function files(record: RecordDoc, bucket: string): string[] {
  const paths = strings(record.data).flatMap(v => [v, ...(v.match(/https:\/\/[^\s"'<>\)]+/g) || [])]).map(v => ownedStoragePath(v, bucket)).filter((v): v is string => !!v);
  if (record.collection === 'grf_assets' && typeof record.data.storagePath === 'string' && !record.data.storagePath.includes('://')) paths.push(record.data.storagePath);
  return paths;
}
function tokens(record: RecordDoc, bucket: string) {
  return new Set([...strings(record.data), ...files(record, bucket)]);
}

/** Discover references from actual saved records, including website subcollections.
 * Unrecognized record types can protect shared assets but cannot be cascaded. */
async function readRecords(db: any, read: (ref: any) => Promise<any> = ref => ref.get()): Promise<RecordDoc[]> {
  const result: RecordDoc[] = [];
  const visit = async (collection: any): Promise<void> => {
    if (collection.id === JOBS) return;
    const snapshot = await read(collection);
    for (const doc of snapshot.docs) {
      result.push({ path: doc.ref.path, id: doc.id, collection: collection.id, data: doc.data(), ref: doc.ref });
      if (!FLAT_RECORDS.has(collection.id)) for (const child of await doc.ref.listCollections()) await visit(child);
    }
  };
  for (const collection of await db.listCollections()) await visit(collection);
  return result;
}
export function planBuildDeletion(records: RecordDoc[], target: BuildTarget, bucket: string) {
  const root = records.find(r => r.path === `${BUILD_TARGETS[target.kind]}/${target.id}`);
  if (!root) throw new DeleteError('Item not found.', 404);
  const assets = records.filter(r => r.collection === 'grf_assets');
  const roots = new Set(target.kind === 'graphics' ? [target.id] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const asset of assets) if (roots.has(asset.data.sourceGrfId) && !roots.has(asset.id)) { roots.add(asset.id); changed = true; }
  }
  const rootTokens = new Set<string>();
  for (const asset of assets.filter(a => roots.has(a.id))) {
    rootTokens.add(asset.id);
    // A Background record may share the original's file. Only its explicit ID
    // cascades uses; deleting the original/crop/output also follows URL uses.
    if (!asset.data.sourceGrfId || parseGrfId(asset.id).purpose !== '3') {
      for (const value of [...files(asset, bucket), asset.data.publicUrl].filter(Boolean)) rootTokens.add(value);
    }
  }
  const builds = records.filter(r => BUILD_RECORDS.has(r.collection));
  const removed = new Set(builds.filter(r => r.path === root.path || Array.from(tokens(r, bucket)).some(t => rootTokens.has(t))).map(r => r.path));
  changed = true;
  while (changed) {
    changed = false;
    const selected = builds.filter(r => removed.has(r.path));
    const ids = new Set(selected.map(r => r.id));
    const linkedIds = new Set(selected.flatMap(r => strings(r.data, '', true)));
    for (const record of builds) if (!removed.has(record.path) && (linkedIds.has(record.id) || strings(record.data, '', true).some(id => ids.has(id)))) {
      removed.add(record.path); changed = true;
    }
  }
  // A surviving website/order can reference a whole packet instead of a file.
  // Preserve that connected build too; never leave such a reference dangling.
  const protectedIds = new Set(records.filter(r => !BUILD_RECORDS.has(r.collection) && !['grf_assets','bld_definitions'].includes(r.collection))
    .flatMap(r => strings(r.data, '', true)));
  let protecting = true;
  while (protecting) {
    protecting = false;
    for (const record of builds) {
      const links = strings(record.data, '', true);
      if (protectedIds.has(record.id) || links.some(id => protectedIds.has(id))) {
        for (const id of [record.id, ...links]) if (!protectedIds.has(id)) { protectedIds.add(id); protecting = true; }
      }
    }
  }
  for (const record of builds) if (protectedIds.has(record.id)) removed.delete(record.path);
  const buildIds = new Set(builds.filter(r => removed.has(r.path)).map(r => r.id));
  const usedIds = new Set(builds.filter(r => removed.has(r.path)).flatMap(r => strings(r.data)));
  const candidates = new Set(assets.filter(a => roots.has(a.id) || buildIds.has(a.data.packetId) || buildIds.has(a.data.sourceSessionId) ||
    (isValidGrfId(a.id) && parseGrfId(a.id).assetClass === '2' && usedIds.has(a.id))).map(a => a.path));
  // Retain any candidate still referenced by a surviving record, then retain its
  // own dependencies. This includes references by URL, not just GRF identity.
  changed = true;
  while (changed) {
    changed = false;
    const survivors = records.filter(r => !removed.has(r.path) && !candidates.has(r.path));
    for (const asset of assets.filter(a => candidates.has(a.path))) {
      const identity = new Set([asset.id, asset.data.publicUrl, ...files(asset, bucket)].filter(Boolean));
      if (survivors.some(r => Array.from(tokens(r, bucket)).some(t => identity.has(t)))) {
        candidates.delete(asset.path); changed = true;
      }
    }
  }
  for (const path of Array.from(candidates)) removed.add(path);
  // Builder-created structural definitions are owned outputs; manual definitions remain reusable.
  const bldIds = new Set(builds.filter(r => removed.has(r.path)).map(r => r.data.bldId).filter(Boolean));
  for (const record of records.filter(r => r.collection === 'bld_definitions' && bldIds.has(r.id) && r.data.source === 'builder')) {
    if (!records.some(r => r.path !== record.path && !removed.has(r.path) && strings(r.data).includes(record.id))) removed.add(record.path);
  }
  for (const record of records) if (Array.from(removed).some(path => record.path.startsWith(path + '/'))) removed.add(record.path);
  const deleted = records.filter(r => removed.has(r.path));
  const survivors = records.filter(r => !removed.has(r.path));
  const keptFiles = new Set(survivors.flatMap(r => files(r, bucket)));
  const filePaths = Array.from(new Set(deleted.flatMap(r => files(r, bucket)))).filter(path => !keptFiles.has(path)).sort();
  const retained = assets.filter(a => roots.has(a.id) && !removed.has(a.path)).map(a => ({ id: a.id, name: a.data.name || a.id }));
  const targets = deleted.map(r => ({ path: r.path, id: r.id, kind: r.collection, name: r.data.name || r.data.productName || r.data.draftName || r.id }));
  const token = createHash('sha256').update(JSON.stringify({ target, targets: targets.sort((a,b) => a.path.localeCompare(b.path)), filePaths, retained,
    versions: deleted.map(r => [r.path, r.data]).sort(([a], [b]) => String(a).localeCompare(String(b))) })).digest('hex');
  return { token, targets, retained, filePaths, buildCount: deleted.filter(r => ['productPackets','assemblies'].includes(r.collection)).length };
}
export function createBuildDeletion({ db, bucket, now }: { db: any; bucket: () => any; now: () => any }) {
  const preview = async (target: BuildTarget) => {
    validateTarget(target);
    const plan = planBuildDeletion(await readRecords(db), target, bucket().name);
    const { filePaths, ...summary } = plan;
    return { ...summary, fileCount: filePaths.length };
  };
  const finish = async (operationId: string) => {
    if (!/^[a-f0-9]{64}$/.test(operationId)) throw new DeleteError('Invalid cleanup identity.');
    const ref = db.collection(JOBS).doc(operationId), doc = await ref.get();
    if (!doc.exists) throw new DeleteError('Cleanup not found.', 404);
    const job = doc.data();
    const survivors = await readRecords(db);
    const kept = new Set(survivors.flatMap(r => files(r, bucket().name)));
    const pending: string[] = [];
    for (const path of job.files) {
      if (kept.has(path)) continue;
      try { await bucket().file(path).delete({ ignoreNotFound: true }); }
      catch { pending.push(path); }
    }
    await ref.set({ ...job, files: pending, status: pending.length ? 'pending' : 'complete', updatedAt: now() });
    return { success: !pending.length, operationId, cleanupPending: pending.length > 0, remainingFiles: pending.length };
  };
  const remove = async (target: BuildTarget, expected: string) => {
    validateTarget(target);
    if (!/^[a-f0-9]{64}$/.test(expected || '')) throw new DeleteError('Review the deletion warning before confirming.');
    const jobRef = db.collection(JOBS).doc(expected);
    await db.runTransaction(async (tx: any) => {
      const previous = await tx.get(jobRef);
      if (previous.exists) { if (previous.data().target.kind !== target.kind || previous.data().target.id !== target.id) throw new DeleteError('Cleanup identity mismatch.'); return; }
      const records = await readRecords(db, ref => tx.get(ref));
      const plan = planBuildDeletion(records, target, bucket().name);
      if (plan.token !== expected) throw new DeleteError('Uses changed. Review the updated deletion warning.', 409);
      for (const target of plan.targets) tx.delete(db.doc(target.path));
      // A shared GRF can outlive the build that originally generated it.
      const deletedIds = new Set(plan.targets.map(t => t.id));
      for (const asset of records.filter(r => r.collection === 'grf_assets' && !plan.targets.some(t => t.path === r.path))) {
        const patch: Record<string, null> = {};
        for (const field of ['packetId', 'relatedPacketId', 'sourceSessionId']) if (deletedIds.has(asset.data[field])) patch[field] = null;
        if (Object.keys(patch).length) tx.update(asset.ref, patch);
      }
      tx.set(jobRef, { target, files: plan.filePaths, status: 'pending', createdAt: now() });
    });
    return finish(expected);
  };
  const pending = async () => (await db.collection(JOBS).where('status', '==', 'pending').get()).docs.map((doc: any) => ({ operationId: doc.id, target: doc.data().target, remainingFiles: doc.data().files.length }));
  return { preview, remove, finish, pending };
}
