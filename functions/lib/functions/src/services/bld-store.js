"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareBldDefinition = prepareBldDefinition;
exports.createBldDefinition = createBldDefinition;
exports.resolveBuilderBld = resolveBuilderBld;
exports.listBldDefinitions = listBldDefinitions;
exports.readBldDefinition = readBldDefinition;
const constants_1 = require("../constants");
const bldCodes_1 = require("../../../shared/bldCodes");
/** Prepare the canonical record; callers can include related links in the same transaction. */
async function prepareBldDefinition(db, tx, timestamp, input) {
    const error = (0, bldCodes_1.validateBldStructure)(input);
    if (error)
        throw new bldCodes_1.BldValidationError(error);
    const { context, layoutMode, instances } = input;
    const key = `${context}${layoutMode}`;
    const counter = db.collection(constants_1.BLD_COUNTERS_COLLECTION).doc(key);
    const current = (await tx.get(counter)).data()?.count ?? 0;
    if (!Number.isInteger(current) || current < 0)
        throw new bldCodes_1.BldValidationError(`Invalid BLD counter ${key}.`, 409);
    if (current >= bldCodes_1.BLD_MAX_SEQUENCE)
        throw new bldCodes_1.BldValidationError(`BLD ${key} has reached sequence ${bldCodes_1.BLD_MAX_SEQUENCE}.`, 409);
    const buildSequence = current + 1;
    const instanceCount = instances.length;
    const bldId = (0, bldCodes_1.formatBldId)(context, layoutMode, instanceCount, buildSequence);
    const ref = db.collection(constants_1.BLD_DEFINITIONS_COLLECTION).doc(bldId);
    if ((await tx.get(ref)).exists)
        throw new bldCodes_1.BldValidationError(`BLD ${bldId} already exists; check the ${key} counter.`, 409);
    const now = timestamp();
    const definition = { bldId, context, layoutMode, instanceCount, buildSequence, instances,
        name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : bldId,
        source: input.source === 'builder' ? 'builder' : 'admin', isActive: true, createdAt: now, updatedAt: now };
    return { definition, write: () => { tx.set(counter, { count: buildSequence, key, updatedAt: now }, { merge: true }); tx.create(ref, definition); } };
}
async function createBldDefinition(db, timestamp, input, packetId) {
    const error = (0, bldCodes_1.validateBldStructure)(input);
    if (error)
        throw new bldCodes_1.BldValidationError(error);
    return db.runTransaction(async (tx) => {
        const packetRef = packetId ? db.collection('productPackets').doc(packetId) : null;
        const packet = packetRef ? await tx.get(packetRef) : null;
        if (packetRef && !packet?.exists)
            throw new bldCodes_1.BldValidationError('Packet not found.', 404);
        const priorId = packet?.data()?.bldId;
        if (priorId) {
            const prior = (await tx.get(db.collection(constants_1.BLD_DEFINITIONS_COLLECTION).doc(priorId))).data();
            if (!prior || prior.isActive === false || (0, bldCodes_1.validateBldStructure)(prior) || prior.bldId !== priorId || !(0, bldCodes_1.sameBldStructure)(prior, input))
                throw new bldCodes_1.BldValidationError('Packet BLD differs from generated structure. Repair or regenerate the packet.', 409);
            return prior;
        }
        const prepared = await prepareBldDefinition(db, tx, timestamp, input);
        prepared.write();
        if (packetRef)
            tx.update(packetRef, { bldId: prepared.definition.bldId });
        return prepared.definition;
    });
}
/** Reuse a selected BLD when its structure is unchanged; edits create a new definition. */
async function resolveBuilderBld(db, now, working, packetId) {
    const structure = { context: 'S', layoutMode: (0, bldCodes_1.builderBldLayoutMode)(working.graphics?.content?.graphicLayoutMode), instances: (0, bldCodes_1.extractBldInstances)(working) };
    const selectedId = working.metadata?.selectedBldId;
    if (selectedId) {
        const selected = (await db.collection(constants_1.BLD_DEFINITIONS_COLLECTION).doc(selectedId).get()).data();
        if (!selected || selected.isActive === false || selected.bldId !== selectedId || (0, bldCodes_1.validateBldStructure)(selected))
            throw new bldCodes_1.BldValidationError('The selected BLD is missing, archived, or invalid.');
        if ((0, bldCodes_1.sameBldStructure)(selected, structure)) {
            if (packetId)
                await db.runTransaction(async (tx) => {
                    const ref = db.collection('productPackets').doc(packetId);
                    const packet = await tx.get(ref);
                    if (!packet.exists)
                        throw new bldCodes_1.BldValidationError('Packet not found.', 404);
                    if (packet.data()?.bldId && packet.data().bldId !== selectedId)
                        throw new bldCodes_1.BldValidationError('Packet already uses a different BLD. Generate a new packet.', 409);
                    tx.update(ref, { bldId: selectedId });
                });
            return selected;
        }
    }
    return createBldDefinition(db, now, { ...structure, source: 'builder' }, packetId);
}
function bldView(id, data) {
    return { ...data, id, createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? null,
        updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? null };
}
async function listBldDefinitions(db, context, layout) {
    const docs = await db.collection(constants_1.BLD_DEFINITIONS_COLLECTION).orderBy('createdAt', 'desc').get();
    return docs.docs.map(doc => ({ ...bldView(doc.id, doc.data()), validationError: (0, bldCodes_1.validateBldStructure)(doc.data()) || (doc.data().bldId !== doc.id ? 'BLD document identity does not match its stored ID.' : null) }))
        .filter((d) => (!context || d.context === context) && (!layout || d.layoutMode === layout));
}
async function readBldDefinition(db, id) {
    const doc = await db.collection(constants_1.BLD_DEFINITIONS_COLLECTION).doc(id).get();
    if (!doc.exists)
        throw new bldCodes_1.BldValidationError(`BLD not found: ${id}`, 404);
    const error = (0, bldCodes_1.validateBldStructure)(doc.data()) || (doc.data()?.bldId !== id ? 'BLD document identity does not match its stored ID.' : null);
    if (error)
        throw new bldCodes_1.BldValidationError(error, 409);
    return bldView(id, doc.data());
}
//# sourceMappingURL=bld-store.js.map