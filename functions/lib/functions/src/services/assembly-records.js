"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareAssemblyDefinition = prepareAssemblyDefinition;
const assemblyCodes_1 = require("../../../shared/assemblyCodes");
const qrgCodes_1 = require("../../../shared/qrgCodes");
const bldCodes_1 = require("../../../shared/bldCodes");
/** The only Assembly allocator, shared by admin, builder, and explicit repairs. */
async function prepareAssemblyDefinition(db, tx, now, input) {
    if (input.name !== undefined && typeof input.name !== 'string')
        throw new Error('Assembly name must be text.');
    const error = (0, assemblyCodes_1.validateAssemblyMappings)(input.mappings);
    if (error)
        throw new Error(error);
    if (!(0, qrgCodes_1.isValidQrgBlankId)(input.qrgId) || !(0, bldCodes_1.isValidBldId)(input.bldId))
        throw new Error('Assembly requires valid QRG and BLD identities.');
    const counter = db.collection('asm_counters').doc(assemblyCodes_1.ASM_COUNTER_KEY);
    const count = (await tx.get(counter)).data()?.count ?? 0;
    if (!Number.isInteger(count) || count < 0 || count >= 999999)
        throw new Error('Invalid or exhausted Assembly counter.');
    const sequence = count + 1;
    const assemblyId = `ASM-${String(sequence).padStart(6, '0')}`;
    const ref = db.collection('assemblies').doc(assemblyId);
    if ((await tx.get(ref)).exists)
        throw new Error('Assembly counter points to an existing record.');
    const definition = { assemblyId, sequence, qrgId: input.qrgId, bldId: input.bldId, mappings: input.mappings,
        packetIds: input.packetIds || [], sourceSessionId: input.sourceSessionId || null,
        source: input.source || 'admin', name: typeof input.name === 'string' ? input.name.trim() : null,
        createdAt: now(), createdBy: input.createdBy || 'admin' };
    return { definition, write: () => { tx.set(counter, { count: sequence }, { merge: true }); tx.create(ref, definition); } };
}
//# sourceMappingURL=assembly-records.js.map