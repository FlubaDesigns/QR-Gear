import { requireBuilderSnapshot } from '../../../shared/builderSnapshot';

/** Shared by the production and development route adapters. */
export async function readGeneratedBuild(db: any, session: any): Promise<Record<string, any>> {
  const packetId = session.generated?.packetId;
  if (!packetId) throw new Error('Session has no generated packet. Generate it before saving.');
  const doc = await db.collection('productPackets').doc(packetId).get();
  if (!doc.exists) throw new Error('Generated packet no longer exists. Generate it again.');
  const packet = doc.data();
  if (packet.buildSessionId !== session.id) throw new Error('Generated packet belongs to a different build session.');
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  if (snapshot.metadata.selectedProductDocId !== session.sourceMasterId) {
    throw new Error('Generated packet and build session reference different product blanks.');
  }
  return snapshot;
}

export async function existingBuildInstance(db: any, session: any): Promise<any | null> {
  if (!session.committedInstanceId) return null;
  const doc = await db.collection('admin_catalog_instances').doc(session.committedInstanceId).get();
  if (!doc.exists) throw new Error('The saved catalog item no longer exists. Start a new build.');
  const data = doc.data();
  if (data.sourceSessionId !== session.id || data.sourceMasterId !== session.sourceMasterId) {
    throw new Error('The saved catalog item belongs to a different build.');
  }
  return data;
}

/** Updating a saved item preserves its instance and QRG identity. */
export async function saveBuildInstance(db: any, session: any, data: Record<string, any>): Promise<any> {
  const collection = db.collection('admin_catalog_instances');
  if (!session.committedInstanceId) return collection.add(data);
  const ref = collection.doc(session.committedInstanceId);
  const { createdAt: _createdAt, ...updates } = data;
  await ref.update(updates);
  return ref;
}

/** Remove a packet and detach its current references in one transaction. Assets remain reusable. */
export async function deleteBuildPacket(db: any, packetId: string, now: any): Promise<void> {
  await db.runTransaction(async (txn: any) => {
    const packetRef = db.collection('productPackets').doc(packetId);
    const packet = await txn.get(packetRef);
    if (!packet.exists) throw new Error('Packet not found');
    const relations = [
      ['admin_build_sessions', 'generated.packetId', '=='],
      ['admin_catalog_instances', 'currentPacketId', '=='],
      ['assemblies', 'packetIds', 'array-contains'],
      ['productGraphics', 'packetId', '=='],
      ['productTemplates', 'packetId', '=='],
      ['storeProductLinks', 'packetId', '=='],
    ];
    const snapshots = await Promise.all(relations.map(([collection, field, op]) =>
      txn.get(db.collection(collection).where(field, op, packetId))));
    for (const doc of snapshots[0].docs) txn.update(doc.ref, {
      'generated.packetId': null, 'generated.artifactReady': false,
      'generated.previewImageUrl': null, 'generated.templateId': null, 'generated.graphicSetId': null,
      status: 'working', bldId: null, assemblyId: null, updatedAt: now,
    });
    for (const doc of snapshots[1].docs) txn.update(doc.ref, {
      currentPacketId: null, currentTemplateId: null, currentGraphicSetId: null,
      bldId: null, assemblyId: null, status: 'draft', isVisible: false, updatedAt: now,
    });
    for (const doc of snapshots[2].docs) txn.update(doc.ref, {
      packetIds: doc.data().packetIds.filter((id: string) => id !== packetId), updatedAt: now,
    });
    for (const snapshot of snapshots.slice(3)) for (const doc of snapshot.docs) txn.delete(doc.ref);
    txn.delete(packetRef);
  });
}
