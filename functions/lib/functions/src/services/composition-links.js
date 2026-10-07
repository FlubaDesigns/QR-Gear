"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updatePacketWithComposition = updatePacketWithComposition;
const composition_validation_1 = require("./composition-validation");
const assembly_store_1 = require("./assembly-store");
/** One packet update and one atomic, bidirectional relationship change for both adapters. */
async function updatePacketWithComposition(db, packetId, updates, now) {
    return db.runTransaction(async (tx) => {
        const ref = db.collection('productPackets').doc(packetId);
        const doc = await tx.get(ref);
        if (!doc.exists)
            throw new Error('Packet not found.');
        const old = doc.data();
        const next = { ...old, ...updates };
        const reader = (0, composition_validation_1.transactionReader)(db, tx);
        const changing = 'assemblyId' in updates && updates.assemblyId !== old.assemblyId;
        let oldAsm = null, newAsm = null;
        const related = changing ? await Promise.all([
            tx.get(db.collection('admin_build_sessions').where('generated.packetId', '==', packetId)),
            tx.get(db.collection('admin_catalog_instances').where('currentPacketId', '==', packetId)),
        ]) : [];
        if (changing) {
            if (old.assemblyId)
                oldAsm = await tx.get(db.collection('assemblies').doc(old.assemblyId));
            if (next.assemblyId) {
                newAsm = await tx.get(db.collection('assemblies').doc(next.assemblyId));
                if (!newAsm.exists)
                    throw new Error('Referenced Assembly does not exist.');
                next.bldId = newAsm.data().bldId;
                await (0, assembly_store_1.validatePacketContent)(reader, next, newAsm.data());
            }
            else
                next.bldId = null;
            if ((next.status === 'published' || old.status === 'published') && !next.assemblyId)
                throw new Error('A published packet must retain a valid Assembly.');
        }
        else if (next.assemblyId && ('assemblyId' in updates || 'bldId' in updates || 'builderSnapshot' in updates || next.status === 'published' || old.status === 'published')) {
            await (0, assembly_store_1.validatePacketComposition)(reader, packetId, next);
        }
        else if ('bldId' in updates && updates.bldId !== old.bldId)
            throw new Error('Set the BLD through a matching Assembly.');
        if (changing) {
            if (oldAsm?.exists)
                tx.update(oldAsm.ref, { packetIds: (oldAsm.data().packetIds || []).filter((id) => id !== packetId), updatedAt: now });
            if (newAsm?.exists)
                tx.update(newAsm.ref, { packetIds: Array.from(new Set([...(newAsm.data().packetIds || []), packetId])), updatedAt: now });
            for (const snap of related)
                for (const linked of snap.docs)
                    tx.update(linked.ref, { assemblyId: next.assemblyId || null, bldId: next.bldId, updatedAt: now });
        }
        tx.update(ref, { ...updates, ...(changing ? { bldId: next.bldId } : {}), updatedAt: now });
    });
}
//# sourceMappingURL=composition-links.js.map