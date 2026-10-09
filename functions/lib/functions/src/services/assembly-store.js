"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractAssemblyMappings = extractAssemblyMappings;
exports.validateComposition = validateComposition;
exports.createAutoAssembly = createAutoAssembly;
exports.validatePacketComposition = validatePacketComposition;
exports.validatePacketContent = validatePacketContent;
exports.packetPrintifyArtwork = packetPrintifyArtwork;
const crypto_1 = require("crypto");
const assembly_records_1 = require("./assembly-records");
const composition_validation_1 = require("./composition-validation");
const placements_1 = require("../../../shared/placements");
const bldCodes_1 = require("../../../shared/bldCodes");
const assemblyCodes_1 = require("../../../shared/assemblyCodes");
const builderSnapshot_1 = require("../../../shared/builderSnapshot");
function extractAssemblyMappings(working, grfIds = {}) {
    return (0, bldCodes_1.extractBuilderLayers)(working).map(({ instance, value, color, assetKey }) => {
        const { seq, type } = instance;
        if (assetKey) {
            if (!grfIds[assetKey])
                throw new Error(`Required BLD slot ${seq} (${type}) has no registered GRF file.`);
            return { seq, type, grfId: grfIds[assetKey] };
        }
        return { seq, type, value, ...(color ? { color } : {}) };
    });
}
async function validateComposition(db, input) {
    const { issues, bld, assets } = await (0, composition_validation_1.inspectComposition)(db, input);
    if (issues.length)
        throw new Error(issues.join(' '));
    return { bld, assets };
}
async function createAutoAssembly(db, now, opts) {
    const mappings = extractAssemblyMappings(opts.working, opts.grfIds);
    const packetRef = opts.packetId ? db.collection('productPackets').doc(opts.packetId) : null;
    return db.runTransaction(async (tx) => {
        await validateComposition((0, composition_validation_1.transactionReader)(db, tx), { ...opts, mappings });
        const packetDoc = packetRef ? await tx.get(packetRef) : null;
        if (packetRef && !packetDoc?.exists)
            throw new Error('Packet not found.');
        if (packetDoc?.data()?.bldId && packetDoc.data().bldId !== opts.bldId)
            throw new Error('Packet and Assembly reference different BLDs.');
        const existingId = packetDoc?.data()?.assemblyId;
        if (existingId) {
            const existing = (await tx.get(db.collection('assemblies').doc(existingId))).data();
            if (!existing || existing.assemblyId !== existingId || !existing.packetIds?.includes(opts.packetId) || existing.bldId !== opts.bldId || existing.qrgId !== opts.qrgId || JSON.stringify(existing.mappings) !== JSON.stringify(mappings))
                throw new Error('Packet already has a different Assembly. Generate a new packet for edited content.');
            return { assemblyId: existingId, sequence: existing.sequence, mappingCount: mappings.length };
        }
        const prepared = await (0, assembly_records_1.prepareAssemblyDefinition)(db, tx, now, { ...opts, mappings,
            packetIds: opts.packetId ? [opts.packetId] : [], source: 'auto_commit', createdBy: 'system' });
        prepared.write();
        const { assemblyId, sequence } = prepared.definition;
        if (packetRef)
            tx.update(packetRef, { assemblyId, bldId: opts.bldId });
        return { assemblyId, sequence, mappingCount: mappings.length };
    });
}
/** Shared by both publish adapters and packet status transitions. No provider I/O before this succeeds. */
async function validatePacketComposition(db, packetId, packet) {
    if (!(0, assemblyCodes_1.isValidAssemblyId)(packet.assemblyId || ''))
        throw new Error('Complete the saved Assembly before publishing.');
    const asm = (await db.collection('assemblies').doc(packet.assemblyId).get()).data();
    if (!asm || !asm.packetIds?.includes(packetId))
        throw new Error('Packet is not linked to its Assembly.');
    if (packet.bldId !== asm.bldId)
        throw new Error('Packet and Assembly reference different BLDs.');
    if (asm.assemblyId !== packet.assemblyId)
        throw new Error('Assembly document identity does not match its stored ID.');
    return validatePacketContent(db, packet, asm);
}
/** Check a candidate link before either side is written. */
async function validatePacketContent(db, packet, asm) {
    const { bld, assets } = await validateComposition(db, asm);
    const snapshot = (0, builderSnapshot_1.requireBuilderSnapshot)(packet.builderSnapshot);
    if (!(0, bldCodes_1.sameBldStructure)(bld, { context: 'S', layoutMode: (0, bldCodes_1.builderBldLayoutMode)(snapshot.graphics.content.graphicLayoutMode), instances: (0, bldCodes_1.extractBldInstances)(snapshot) }))
        throw new Error('Saved BLD differs from the rendered layout. Regenerate the packet.');
    const qrPayloadHash = (0, crypto_1.createHash)('sha256').update(String(packet.qrContent || '').trim()).digest('hex');
    if (assets[packet.qrGrfId]?.qrPayloadHash !== qrPayloadHash)
        throw new Error('QR payload differs from the registered graphic. Generate the packet again.');
    const expected = extractAssemblyMappings(snapshot, packet);
    if (JSON.stringify(expected) !== JSON.stringify(asm.mappings))
        throw new Error('Assembly content differs from the generated packet. Regenerate it.');
    for (const layer of (0, bldCodes_1.extractBuilderLayers)(snapshot))
        if (layer.imageUrl && layer.assetKey) {
            const asset = assets[packet[layer.assetKey]];
            if (![asset?.sourceUrl, asset?.publicUrl].includes(layer.imageUrl))
                throw new Error(`Slot ${layer.instance.seq} file differs from the rendered image.`);
        }
    const composite = (await db.collection('grf_assets').doc(packet.compositeGrfId || '__missing__').get()).data();
    if (!composite || composite.isActive === false || composite.publicUrl !== packet.compositeUrl)
        throw new Error('Composite file is missing or differs from the registered GRF.');
    const source = (await db.collection('master_catalog').doc(snapshot.metadata.selectedProductDocId).get()).data();
    if (!source || source.qrgBlankId !== asm.qrgId)
        throw new Error('Product blank and Assembly QRG identity differ.');
    return { assembly: asm, bld, compositeUrl: composite.publicUrl };
}
/** Resolve every chosen print location from saved inputs and registered output files. */
async function packetPrintifyArtwork(db, packet) {
    const snapshot = (0, builderSnapshot_1.requireBuilderSnapshot)(packet.builderSnapshot);
    const placements = snapshot.layoutConfig.selectedPlacements;
    if (!placements.length)
        throw new Error('Choose at least one print placement.');
    const output = [];
    for (let index = 0; index < placements.length; index++) {
        const placement = placements[index];
        const grfId = packet.placementGrfIds?.[placement] || (index === 0 ? packet.compositeGrfId : null);
        if (!grfId)
            throw new Error(`Generate the graphic for ${placement} before publishing.`);
        const asset = (await db.collection('grf_assets').doc(grfId).get()).data();
        const imageUrl = packet.placementGraphicUrls?.[placement] || (index === 0 ? packet.compositeUrl : null);
        if (!asset || asset.isActive === false || asset.publicUrl !== imageUrl)
            throw new Error(`The registered graphic for ${placement} is missing or differs from the packet.`);
        const position = snapshot.layoutConfig.providerLayouts?.[placement]?.providerPlacementId || (0, placements_1.toProviderPlacement)('printify', placement);
        if (output.some(p => p.position === position))
            throw new Error(`More than one graphic targets ${position}. Choose one placement for that area.`);
        output.push({ position, imageUrl });
    }
    return output;
}
//# sourceMappingURL=assembly-store.js.map