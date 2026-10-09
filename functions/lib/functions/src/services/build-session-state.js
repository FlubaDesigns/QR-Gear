"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readGeneratedBuild = readGeneratedBuild;
exports.existingBuildInstance = existingBuildInstance;
exports.saveBuildInstance = saveBuildInstance;
exports.deleteBuildPacket = deleteBuildPacket;
exports.saveGeneratedBuildArtifact = saveGeneratedBuildArtifact;
const builderSnapshot_1 = require("../../../shared/builderSnapshot");
/** Shared by the production and development route adapters. */
async function readGeneratedBuild(db, session) {
    const packetId = session.generated?.packetId;
    if (!packetId)
        throw new Error('Session has no generated packet. Generate it before saving.');
    const doc = await db.collection('productPackets').doc(packetId).get();
    if (!doc.exists)
        throw new Error('Generated packet no longer exists. Generate it again.');
    const packet = doc.data();
    if (packet.buildSessionId !== session.id)
        throw new Error('Generated packet belongs to a different build session.');
    const snapshot = (0, builderSnapshot_1.requireBuilderSnapshot)(packet.builderSnapshot);
    if (snapshot.metadata.selectedProductDocId !== session.sourceMasterId) {
        throw new Error('Generated packet and build session reference different product blanks.');
    }
    return snapshot;
}
async function existingBuildInstance(db, session) {
    if (!session.committedInstanceId)
        return null;
    const doc = await db.collection('admin_catalog_instances').doc(session.committedInstanceId).get();
    if (!doc.exists)
        throw new Error('The saved catalog item no longer exists. Start a new build.');
    const data = doc.data();
    if (data.sourceSessionId !== session.id || data.sourceMasterId !== session.sourceMasterId) {
        throw new Error('The saved catalog item belongs to a different build.');
    }
    return data;
}
/** Updating a saved item preserves its instance and QRG identity. */
async function saveBuildInstance(db, session, data) {
    const collection = db.collection('admin_catalog_instances');
    if (!session.committedInstanceId)
        return collection.add(data);
    const ref = collection.doc(session.committedInstanceId);
    const { createdAt: _createdAt, ...updates } = data;
    await ref.update(updates);
    return ref;
}
/** Remove a packet and detach its current references in one transaction. Assets remain reusable. */
async function deleteBuildPacket(db, packetId, now) {
    await db.runTransaction(async (txn) => {
        const packetRef = db.collection('productPackets').doc(packetId);
        const packet = await txn.get(packetRef);
        if (!packet.exists)
            throw new Error('Packet not found');
        const relations = [
            ['admin_build_sessions', 'generated.packetId', '=='],
            ['admin_catalog_instances', 'currentPacketId', '=='],
            ['assemblies', 'packetIds', 'array-contains'],
            ['productGraphics', 'packetId', '=='],
            ['productTemplates', 'packetId', '=='],
            ['storeProductLinks', 'packetId', '=='],
        ];
        const snapshots = await Promise.all(relations.map(([collection, field, op]) => txn.get(db.collection(collection).where(field, op, packetId))));
        for (const doc of snapshots[0].docs)
            txn.update(doc.ref, {
                'generated.packetId': null, 'generated.artifactReady': false,
                'generated.previewImageUrl': null, 'generated.templateId': null, 'generated.graphicSetId': null,
                status: 'working', bldId: null, assemblyId: null, updatedAt: now,
            });
        for (const doc of snapshots[1].docs)
            txn.update(doc.ref, {
                currentPacketId: null, currentTemplateId: null, currentGraphicSetId: null,
                bldId: null, assemblyId: null, status: 'draft', isVisible: false, updatedAt: now,
            });
        for (const doc of snapshots[2].docs)
            txn.update(doc.ref, {
                packetIds: doc.data().packetIds.filter((id) => id !== packetId), updatedAt: now,
            });
        for (const snapshot of snapshots.slice(3))
            for (const doc of snapshot.docs)
                txn.delete(doc.ref);
        txn.delete(packetRef);
    });
}
/** A generated artifact becomes ready only after its saved rendering inputs are verified.
 * Both HTTP adapters use this path; regeneration cannot retain a previous schema chain.
 */
async function saveGeneratedBuildArtifact(db, sessionId, packetFields, now) {
    return db.runTransaction(async (tx) => {
        const sessionRef = db.collection('admin_build_sessions').doc(sessionId);
        const sessionDoc = await tx.get(sessionRef);
        if (!sessionDoc.exists)
            throw new Error('Build session not found.');
        const session = sessionDoc.data();
        if (['committed', 'abandoned'].includes(session.status))
            throw new Error(`Cannot generate an artifact for a ${session.status} session.`);
        const existingId = packetFields.existingPacketId || session.generated?.packetId;
        const ref = db.collection('productPackets').doc(existingId || undefined);
        const existing = existingId ? await tx.get(ref) : null;
        if (existingId && !existing?.exists)
            throw new Error('Generated packet no longer exists. Generate a new packet.');
        const prior = existing?.data() || {};
        if (prior.buildSessionId && prior.buildSessionId !== sessionId)
            throw new Error('Packet belongs to a different build session.');
        const linking = !!packetFields.existingPacketId;
        const fields = linking ? prior : { ...packetFields };
        const snapshot = (0, builderSnapshot_1.requireBuilderSnapshot)(fields.builderSnapshot);
        if (snapshot.metadata.selectedProductDocId !== session.sourceMasterId)
            throw new Error('Generated packet and build session reference different product blanks.');
        if (!fields.compositeUrl || !fields.qrContent?.trim())
            throw new Error('Generate the stored graphic and QR payload before saving.');
        const oldAsm = !linking && prior.assemblyId ? await tx.get(db.collection('assemblies').doc(prior.assemblyId)) : null;
        const catalog = !linking && existingId ? await tx.get(db.collection('admin_catalog_instances').where('currentPacketId', '==', existingId)) : null;
        if (!linking && (prior.status === 'published' || (catalog && !catalog.empty)))
            throw new Error('Generate a new packet to replace a saved product; its existing output is in use.');
        const packet = linking ? { ownerType: 'admin_build_session', buildSessionId: sessionId, sourceMasterId: session.sourceMasterId, updatedAt: now } : {
            ...fields, builderSnapshot: snapshot, ownerType: 'admin_build_session', buildSessionId: sessionId,
            sourceMasterId: session.sourceMasterId, sourceAdminInstanceId: null, bldId: null, assemblyId: null,
            backgroundGrfId: null, qrGrfId: null, compositeGrfId: null, landingSnapshotGrfId: null,
            headerGrfId: null, footerGrfId: null, placementGrfIds: {},
            createdAt: prior.createdAt || now, updatedAt: now,
        };
        if (oldAsm?.exists)
            tx.update(oldAsm.ref, { packetIds: (oldAsm.data().packetIds || []).filter((id) => id !== ref.id), updatedAt: now });
        if (existing?.exists)
            tx.update(ref, packet);
        else
            tx.create(ref, packet);
        tx.update(sessionRef, { 'generated.packetId': ref.id, 'generated.artifactReady': true,
            'generated.previewImageUrl': fields.previewImageUrl || null, status: 'artifact_ready', updatedAt: now, lastActiveAt: now });
        return ref.id;
    });
}
//# sourceMappingURL=build-session-state.js.map