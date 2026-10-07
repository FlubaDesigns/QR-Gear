import { transactionReader } from './composition-validation';
import { validatePacketContent, validatePacketComposition } from './assembly-store';

/** One packet update and one atomic, bidirectional relationship change for both adapters. */
export async function updatePacketWithComposition(db: any, packetId: string, updates: any, now: any) {
  return db.runTransaction(async (tx: any) => {
    const ref = db.collection('productPackets').doc(packetId);
    const doc = await tx.get(ref);
    if (!doc.exists) throw new Error('Packet not found.');
    const old = doc.data();
    const next = { ...old, ...updates };
    const reader = transactionReader(db, tx);
    const changing = 'assemblyId' in updates && updates.assemblyId !== old.assemblyId;
    let oldAsm: any = null, newAsm: any = null;
    const related = changing ? await Promise.all([
      tx.get(db.collection('admin_build_sessions').where('generated.packetId', '==', packetId)),
      tx.get(db.collection('admin_catalog_instances').where('currentPacketId', '==', packetId)),
    ]) : [];
    if (changing) {
      if (old.assemblyId) oldAsm = await tx.get(db.collection('assemblies').doc(old.assemblyId));
      if (next.assemblyId) {
        newAsm = await tx.get(db.collection('assemblies').doc(next.assemblyId));
        if (!newAsm.exists) throw new Error('Referenced Assembly does not exist.');
        next.bldId = newAsm.data().bldId;
        await validatePacketContent(reader, next, newAsm.data());
      } else next.bldId = null;
      if ((next.status === 'published' || old.status === 'published') && !next.assemblyId) throw new Error('A published packet must retain a valid Assembly.');
    } else if (next.assemblyId && ('assemblyId' in updates || 'bldId' in updates || 'builderSnapshot' in updates || next.status === 'published' || old.status === 'published')) {
      await validatePacketComposition(reader, packetId, next);
    } else if ('bldId' in updates && updates.bldId !== old.bldId) throw new Error('Set the BLD through a matching Assembly.');
    if (changing) {
      if (oldAsm?.exists) tx.update(oldAsm.ref, { packetIds: (oldAsm.data().packetIds || []).filter((id: string) => id !== packetId), updatedAt: now });
      if (newAsm?.exists) tx.update(newAsm.ref, { packetIds: Array.from(new Set([...(newAsm.data().packetIds || []), packetId])), updatedAt: now });
      for (const snap of related) for (const linked of snap.docs) tx.update(linked.ref, { assemblyId: next.assemblyId || null, bldId: next.bldId, updatedAt: now });
    }
    tx.update(ref, { ...updates, ...(changing ? { bldId: next.bldId } : {}), updatedAt: now });
  });
}
