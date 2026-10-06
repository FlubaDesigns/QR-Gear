import { toProviderPlacement } from '../../../shared/placements';
import type { Firestore } from 'firebase-admin/firestore';
import { extractBuilderLayers, validateBldStructure, sameBldStructure, builderBldLayoutMode, extractBldInstances } from '../../../shared/bldCodes';
import { validateAssemblyMappings, isValidAssemblyId, type AssemblyMapping } from '../../../shared/assemblyCodes';
import { isValidQrgBlankId } from '../../../shared/qrgCodes';
import { requireBuilderSnapshot } from '../../../shared/builderSnapshot';

export function extractAssemblyMappings(working: Record<string, any>, grfIds: Record<string, any> = {}): AssemblyMapping[] {
  return extractBuilderLayers(working).map(({ instance, value, color, assetKey }) => {
    const { seq, type } = instance;
    if (assetKey) {
      if (!grfIds[assetKey]) throw new Error(`Required BLD slot ${seq} (${type}) has no registered GRF file.`);
      return { seq, type, grfId: grfIds[assetKey] };
    }
    return { seq, type, value, ...(color ? { color } : {}) };
  });
}

export async function validateComposition(db: Firestore, input: { bldId: string; qrgId: string; mappings: AssemblyMapping[] }) {
  if (!isValidQrgBlankId(input.qrgId)) throw new Error('Assembly requires a valid QRG blank identity.');
  if (!input.bldId) throw new Error('Assembly requires a BLD.');
  const [bldDoc, masters] = await Promise.all([
    db.collection('bld_definitions').doc(input.bldId).get(),
    db.collection('master_catalog').where('qrgBlankId', '==', input.qrgId).get(),
  ]);
  if (!masters.docs.some(d => d.data().isActive !== false && d.data().status !== 'archived')) throw new Error('QRG blank does not exist or is archived.');
  if (!bldDoc.exists) throw new Error('Referenced BLD does not exist.');
  const bld = bldDoc.data()!;
  const bldError = validateBldStructure(bld);
  if (bldError || bld.isActive === false) throw new Error(bldError || 'Referenced BLD is archived.');
  const mappingError = validateAssemblyMappings(input.mappings, bld.instances);
  if (mappingError) throw new Error(mappingError);
  const assets: Record<string, any> = {};
  for (const id of Array.from(new Set(input.mappings.map(m => m.grfId).filter(Boolean) as string[]))) {
    const doc = await db.collection('grf_assets').doc(id).get();
    const asset = doc.data();
    if (!doc.exists || asset?.isActive === false || !asset?.publicUrl || asset?.registrationState === 'pending') throw new Error(`GRF ${id} is missing, archived, or unfinished.`);
    assets[id] = asset;
  }
  return { bld, assets };
}

export interface AutoAssemblyOptions {
  working: Record<string, any>; qrgId: string; bldId: string;
  sourceSessionId: string | null; packetId: string | null; grfIds?: Record<string, any>;
}
export async function createAutoAssembly(db: Firestore, now: () => unknown, opts: AutoAssemblyOptions) {
  const mappings = extractAssemblyMappings(opts.working, opts.grfIds);
  await validateComposition(db, { ...opts, mappings });
  const counter = db.collection('asm_counters').doc('global');
  const packetRef = opts.packetId ? db.collection('productPackets').doc(opts.packetId) : null;
  return db.runTransaction(async tx => {
    const packetDoc = packetRef ? await tx.get(packetRef) : null;
    const existingId = packetDoc?.data()?.assemblyId;
    if (existingId) {
      const existing = (await tx.get(db.collection('assemblies').doc(existingId))).data();
      if (!existing || existing.bldId !== opts.bldId || existing.qrgId !== opts.qrgId || JSON.stringify(existing.mappings) !== JSON.stringify(mappings)) throw new Error('Packet already has a different Assembly. Generate a new packet for edited content.');
      return { assemblyId: existingId, sequence: existing.sequence, mappingCount: mappings.length };
    }
    const count = (await tx.get(counter)).data()?.count ?? 0;
    if (!Number.isInteger(count) || count < 0 || count >= 999999) throw new Error('Invalid or exhausted Assembly counter.');
    const sequence = count + 1;
    const assemblyId = `ASM-${String(sequence).padStart(6, '0')}`;
    const ref = db.collection('assemblies').doc(assemblyId);
    if ((await tx.get(ref)).exists) throw new Error('Assembly counter points to an existing record.');
    tx.set(counter, { count: sequence }, { merge: true });
    tx.create(ref, { assemblyId, sequence, qrgId: opts.qrgId, bldId: opts.bldId, mappings,
      packetIds: opts.packetId ? [opts.packetId] : [], sourceSessionId: opts.sourceSessionId,
      source: 'auto_commit', createdAt: now(), createdBy: 'system' });
    if (packetRef) tx.update(packetRef, { assemblyId, bldId: opts.bldId });
    return { assemblyId, sequence, mappingCount: mappings.length };
  });
}

/** Shared by both publish adapters and packet status transitions. No provider I/O before this succeeds. */
export async function validatePacketComposition(db: Firestore, packetId: string, packet: Record<string, any>) {
  if (!isValidAssemblyId(packet.assemblyId || '')) throw new Error('Complete the saved Assembly before publishing.');
  const asm = (await db.collection('assemblies').doc(packet.assemblyId).get()).data();
  if (!asm || !asm.packetIds?.includes(packetId)) throw new Error('Packet is not linked to its Assembly.');
  if (packet.bldId !== asm.bldId) throw new Error('Packet and Assembly reference different BLDs.');
  const { bld, assets } = await validateComposition(db, asm as any);
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  if (!sameBldStructure(bld, { context: 'S', layoutMode: builderBldLayoutMode(snapshot.graphics.content.graphicLayoutMode), instances: extractBldInstances(snapshot) })) throw new Error('Saved BLD differs from the rendered layout. Regenerate the packet.');
  const expected = extractAssemblyMappings(snapshot, packet);
  if (JSON.stringify(expected) !== JSON.stringify(asm.mappings)) throw new Error('Assembly content differs from the generated packet. Regenerate it.');
  for (const layer of extractBuilderLayers(snapshot)) if (layer.imageUrl && layer.assetKey) {
    const asset = assets[packet[layer.assetKey]];
    if (![asset?.sourceUrl, asset?.publicUrl].includes(layer.imageUrl)) throw new Error(`Slot ${layer.instance.seq} file differs from the rendered image.`);
  }
  const composite = (await db.collection('grf_assets').doc(packet.compositeGrfId || '__missing__').get()).data();
  if (!composite || composite.isActive === false || composite.publicUrl !== packet.compositeUrl) throw new Error('Composite file is missing or differs from the registered GRF.');
  const source = (await db.collection('master_catalog').doc(snapshot.metadata.selectedProductDocId).get()).data();
  if (!source || source.qrgBlankId !== asm.qrgId) throw new Error('Product blank and Assembly QRG identity differ.');
  return { assembly: asm, bld, compositeUrl: composite.publicUrl };
}

/** Resolve every chosen print location from saved inputs and registered output files. */
export async function packetPrintifyArtwork(db: Firestore, packet: Record<string, any>) {
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  const placements: string[] = snapshot.layoutConfig.selectedPlacements;
  if (!placements.length) throw new Error('Choose at least one print placement.');
  const output: Array<{ position: string; imageUrl: string }> = [];
  for (let index = 0; index < placements.length; index++) {
    const placement = placements[index];
    const grfId = packet.placementGrfIds?.[placement] || (index === 0 ? packet.compositeGrfId : null);
    if (!grfId) throw new Error(`Generate the graphic for ${placement} before publishing.`);
    const asset = (await db.collection('grf_assets').doc(grfId).get()).data();
    const imageUrl = packet.placementGraphicUrls?.[placement] || (index === 0 ? packet.compositeUrl : null);
    if (!asset || asset.isActive === false || asset.publicUrl !== imageUrl) throw new Error(`The registered graphic for ${placement} is missing or differs from the packet.`);
    const position = snapshot.layoutConfig.providerLayouts?.[placement]?.providerPlacementId || toProviderPlacement('printify', placement);
    if (output.some(p => p.position === position)) throw new Error(`More than one graphic targets ${position}. Choose one placement for that area.`);
    output.push({ position, imageUrl });
  }
  return output;
}
