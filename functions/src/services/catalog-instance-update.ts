import { resolveInstance } from './instance-resolver';
import { transactionReader } from './composition-validation';
import { resolveBuildDestination, destinationMetadata } from './build-destination';

/** One catalog editor for both adapters; destination changes travel with the saved build. */
export async function updateCatalogInstance(db: any, id: string, body: Record<string, any>, now: any, actor: string) {
  return db.runTransaction(async (tx: any) => {
    const ref = db.collection('admin_catalog_instances').doc(id), doc = await tx.get(ref);
    if (!doc.exists) throw new Error('Catalog item not found.');
    const existing = doc.data();
    const overrides = { ...existing.overrides, ...body.overrides, ...(body.metadata !== undefined ? { metadata: body.metadata } : {}) };
    const resolved = resolveInstance(existing.baseSnapshot, overrides);
    const update: Record<string, any> = { overrides, resolved, version: (existing.version || 0) + 1, updatedAt: now, updatedBy: actor };
    for (const [field, allowed] of [['enabledColors', resolved.colors], ['enabledSizes', resolved.sizes]] as const) {
      if (body[field] === undefined) continue;
      if (!Array.isArray(body[field]) || body[field].some((v: unknown) => typeof v !== 'string' || !allowed.includes(v))) {
        throw Object.assign(new Error(`Invalid ${field}`), { status: 400 });
      }
      update[field] = Array.from(new Set(body[field]));
    }
    for (const field of ['status','customerPrice']) if (body[field] !== undefined) update[field] = body[field];
    let packet: any = null, session: any = null, links: any = null;
    if (body.folderUpdate) {
      const destination = await resolveBuildDestination(transactionReader(db, tx), body.folderUpdate);
      Object.assign(update, destination);
      if (existing.currentPacketId) packet = await tx.get(db.collection('productPackets').doc(existing.currentPacketId));
      if (existing.sourceSessionId) session = await tx.get(db.collection('admin_build_sessions').doc(existing.sourceSessionId));
      links = existing.currentPacketId ? await tx.get(db.collection('storeProductLinks').where('packetId', '==', existing.currentPacketId)) : null;
      if (packet && (!packet.exists || (packet.data().ownerInstanceId && packet.data().ownerInstanceId !== id))) throw new Error('Catalog item and packet ownership disagree.');
      if (session && (!session.exists || (session.data().committedInstanceId && session.data().committedInstanceId !== id))) throw new Error('Catalog item and saved build ownership disagree.');
      const metadata = destinationMetadata(destination);
      if (packet) tx.update(packet.ref, { ...destination,
        ...(packet.data().builderSnapshot ? { builderSnapshot: { ...packet.data().builderSnapshot, metadata: { ...packet.data().builderSnapshot.metadata, ...metadata } } } : {}), updatedAt: now });
      if (session) tx.update(session.ref, { 'working.metadata': { ...session.data().working?.metadata, ...metadata }, updatedAt: now });
      for (const link of links?.docs || []) tx.update(link.ref, { ...destination, channel: destination.channelId, collection: destination.collectionName, updatedAt: now });
    }
    tx.update(ref, update);
    return { success: true, instanceId: id, resolved, version: update.version };
  });
}
