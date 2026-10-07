"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inspectComposition = inspectComposition;
exports.inspectAssembly = inspectAssembly;
exports.transactionReader = transactionReader;
const bldCodes_1 = require("../../../shared/bldCodes");
const assemblyCodes_1 = require("../../../shared/assemblyCodes");
const qrgCodes_1 = require("../../../shared/qrgCodes");
/** Read-time diagnostics and write-time enforcement use this same inspection. */
async function inspectComposition(db, input) {
    const issues = [];
    if (!(0, qrgCodes_1.isValidQrgBlankId)(input.qrgId))
        issues.push('Assembly requires a valid QRG blank identity.');
    if (!(0, bldCodes_1.isValidBldId)(input.bldId))
        issues.push('The linked BLD ID does not follow the schema.');
    const bldDoc = typeof input.bldId === 'string' && input.bldId && !input.bldId.includes('/')
        ? await db.collection('bld_definitions').doc(input.bldId).get() : null;
    const bld = bldDoc?.data();
    if (!bldDoc?.exists)
        issues.push('Referenced BLD does not exist.');
    else {
        const error = (0, bldCodes_1.validateBldStructure)(bld);
        if (error)
            issues.push(error);
        if (bld.bldId !== input.bldId)
            issues.push('BLD document identity does not match its stored ID.');
        if (bld.isActive === false)
            issues.push('Referenced BLD is archived.');
    }
    const mappingError = (0, assemblyCodes_1.validateAssemblyMappings)(input.mappings, Array.isArray(bld?.instances) && bld.instances.every((s) => s && typeof s === 'object') ? bld.instances : undefined);
    if (mappingError)
        issues.push(mappingError);
    if ((0, qrgCodes_1.isValidQrgBlankId)(input.qrgId)) {
        const masters = await db.collection('master_catalog').where('qrgBlankId', '==', input.qrgId).get();
        if (!masters.docs.some((d) => d.data().isActive !== false && d.data().status !== 'archived'))
            issues.push('QRG blank does not exist or is archived.');
    }
    const assets = {};
    const ids = Array.isArray(input.mappings) ? Array.from(new Set(input.mappings.map((m) => m?.grfId).filter((id) => typeof id === 'string' && id && !id.includes('/')))) : [];
    for (const id of ids) {
        const doc = await db.collection('grf_assets').doc(id).get();
        const asset = doc.data();
        if (!doc.exists || asset?.isActive === false || !asset?.publicUrl || asset?.registrationState === 'pending')
            issues.push(`GRF ${id} is missing, archived, or unfinished.`);
        else
            assets[id] = asset;
    }
    return { issues, bld, assets };
}
async function inspectAssembly(db, id, data) {
    const result = await inspectComposition(db, data);
    if (!(0, assemblyCodes_1.isValidAssemblyId)(id) || data.assemblyId !== id)
        result.issues.unshift('Assembly identity does not follow the schema.');
    const forward = await db.collection('productPackets').where('assemblyId', '==', id).get();
    const forwardIds = forward.docs.map((d) => d.id);
    const reverseIds = Array.isArray(data.packetIds) ? data.packetIds : [];
    if (forwardIds.some((pid) => !reverseIds.includes(pid)) || reverseIds.some(pid => !forwardIds.includes(pid)))
        result.issues.push('Packet links disagree between the Assembly and its packets.');
    for (const packet of forward.docs)
        if (packet.data().bldId !== data.bldId)
            result.issues.push(`Packet ${packet.id} references a different BLD.`);
    return { ...data, id, validationErrors: result.issues, packetIds: Array.from(new Set([...reverseIds, ...forwardIds])) };
}
/** Validation reads participate in the same transaction as the reference updates. */
function transactionReader(db, tx) {
    return { collection: (name) => ({
            doc: (id) => ({ get: () => tx.get(db.collection(name).doc(id)) }),
            where: (field, op, value) => ({ get: () => tx.get(db.collection(name).where(field, op, value)) }),
        }) };
}
//# sourceMappingURL=composition-validation.js.map