import { validatePacketContent } from './assembly-store';
import { transactionReader } from './composition-validation';
import { destinationMetadata } from './build-destination';
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
  const instances = db.collection('admin_catalog_instances');
  const instanceRef = session.committedInstanceId ? instances.doc(session.committedInstanceId) : instances.doc();
  await db.runTransaction(async (tx: any) => {
    const sessionRef = db.collection('admin_build_sessions').doc(session.id);
    const savedSession = await tx.get(sessionRef);
    const packetRef = db.collection('productPackets').doc(data.currentPacketId);
    const packetDoc = await tx.get(packetRef);
    const assemblyDoc = await tx.get(db.collection('assemblies').doc(data.assemblyId));
    const existing = session.committedInstanceId ? await tx.get(instanceRef) : null;
    if (!savedSession.exists || !packetDoc.exists || !assemblyDoc.exists) throw new Error('The saved build chain is incomplete.');
    if (savedSession.data().generated?.packetId !== data.currentPacketId || packetDoc.data().buildSessionId !== session.id) throw new Error('Packet and saved build ownership disagree.');
    if (data.sourceMasterId !== packetDoc.data().builderSnapshot?.metadata?.selectedProductDocId) throw new Error('Catalog item and rendered product blank differ.');
    if (data.bldId !== packetDoc.data().bldId || data.assemblyId !== packetDoc.data().assemblyId || data.qrgBlankId !== assemblyDoc.data().qrgId) throw new Error('Catalog, packet and Assembly identities disagree.');
    if (existing && (!existing.exists || existing.data().sourceSessionId !== session.id)) throw new Error('Catalog item belongs to a different build.');
    // Validate the rendered candidate before atomically attaching its catalog owner.
    await validatePacketContent(transactionReader(db, tx), packetDoc.data(), assemblyDoc.data());
    const { createdAt, ...updates } = data;
    if (existing) tx.update(instanceRef, updates); else tx.create(instanceRef, data);
    tx.update(packetRef, { ownerType: 'admin', ownerInstanceId: instanceRef.id, sourceAdminInstanceId: instanceRef.id,
      bldId: data.bldId, assemblyId: data.assemblyId, updatedAt: data.updatedAt });
    tx.update(sessionRef, { status: 'committed', committedInstanceId: instanceRef.id, bldId: data.bldId, assemblyId: data.assemblyId,
      'working.metadata': { ...savedSession.data().working?.metadata, ...destinationMetadata(data as any) }, updatedAt: data.updatedAt });
  });
  return instanceRef;
}

/** A generated artifact becomes ready only after its saved rendering inputs are verified.
 * Both HTTP adapters use this path; regeneration cannot retain a previous schema chain.
 */
export async function saveGeneratedBuildArtifact(db: any, sessionId: string, packetFields: Record<string, any>, now: any) {
  return db.runTransaction(async (tx: any) => {
    const sessionRef = db.collection('admin_build_sessions').doc(sessionId);
    const sessionDoc = await tx.get(sessionRef);
    if (!sessionDoc.exists) throw new Error('Build session not found.');
    const session = sessionDoc.data();
    if (['committed', 'abandoned'].includes(session.status)) throw new Error(`Cannot generate an artifact for a ${session.status} session.`);
    const existingId = packetFields.existingPacketId || session.generated?.packetId;
    const packets = db.collection('productPackets');
    const ref = existingId ? packets.doc(existingId) : packets.doc();
    const existing = existingId ? await tx.get(ref) : null;
    if (existingId && !existing?.exists) throw new Error('Generated packet no longer exists. Generate a new packet.');
    const prior = existing?.data() || {};
    if (prior.buildSessionId && prior.buildSessionId !== sessionId) throw new Error('Packet belongs to a different build session.');
    const linking = !!packetFields.existingPacketId;
    const fields = linking ? prior : { ...packetFields };
    const snapshot = requireBuilderSnapshot(fields.builderSnapshot);
    if (snapshot.metadata.selectedProductDocId !== session.sourceMasterId) throw new Error('Generated packet and build session reference different product blanks.');
    if (!fields.compositeUrl || !fields.qrContent?.trim()) throw new Error('Generate the stored graphic and QR payload before saving.');
    const oldAsm = !linking && prior.assemblyId ? await tx.get(db.collection('assemblies').doc(prior.assemblyId)) : null;
    const catalog = !linking && existingId ? await tx.get(db.collection('admin_catalog_instances').where('currentPacketId', '==', existingId)) : null;
    if (!linking && (prior.status === 'published' || (catalog && !catalog.empty))) throw new Error('Generate a new packet to replace a saved product; its existing output is in use.');
    const packet = linking ? { ownerType: 'admin_build_session', buildSessionId: sessionId, sourceMasterId: session.sourceMasterId, updatedAt: now } : {
      ...fields, builderSnapshot: snapshot, ownerType: 'admin_build_session', buildSessionId: sessionId,
      sourceMasterId: session.sourceMasterId, sourceAdminInstanceId: null, bldId: null, assemblyId: null,
      backgroundGrfId: null, qrGrfId: null, compositeGrfId: null, landingSnapshotGrfId: null,
      headerGrfId: null, footerGrfId: null, placementGrfIds: {},
      createdAt: prior.createdAt || now, updatedAt: now,
    };
    if (oldAsm?.exists) tx.update(oldAsm.ref, { packetIds: (oldAsm.data().packetIds || []).filter((id: string) => id !== ref.id), updatedAt: now });
    if (existing?.exists) tx.update(ref, packet); else tx.create(ref, packet);
    tx.update(sessionRef, { 'generated.packetId': ref.id, 'generated.artifactReady': true,
      'generated.previewImageUrl': fields.previewImageUrl || null, status: 'artifact_ready', updatedAt: now, lastActiveAt: now });
    return ref.id;
  });
}
