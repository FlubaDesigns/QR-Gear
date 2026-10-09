import { resolveBuildDestination } from './build-destination';
import { decodeLibraryImage } from './image-validation';
import { inspectGrfAsset } from '../../../shared/GRF_engine';
import { createHash } from 'crypto';
import { prepareAssemblyDefinition } from './assembly-records';
import { inspectComposition, transactionReader } from './composition-validation';
import { toProviderPlacement } from '../../../shared/placements';
import type { Firestore } from 'firebase-admin/firestore';
import { extractBuilderLayers, validateBldStructure, sameBldStructure, builderBldLayoutMode, extractBldInstances } from '../../../shared/bldCodes';
import { validateAssemblyMappings, isValidAssemblyId, type AssemblyMapping } from '../../../shared/assemblyCodes';
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
  const { issues, bld, assets } = await inspectComposition(db, input);
  if (issues.length) throw new Error(issues.join(' '));
  return { bld, assets };
}

export interface AutoAssemblyOptions {
  working: Record<string, any>; qrgId: string; bldId: string;
  sourceSessionId: string | null; packetId: string | null; grfIds?: Record<string, any>;
}
export async function createAutoAssembly(db: Firestore, now: () => unknown, opts: AutoAssemblyOptions) {
  const mappings = extractAssemblyMappings(opts.working, opts.grfIds);
  const packetRef = opts.packetId ? db.collection('productPackets').doc(opts.packetId) : null;
  return db.runTransaction(async tx => {
    await validateComposition(transactionReader(db, tx), { ...opts, mappings });
    const packetDoc = packetRef ? await tx.get(packetRef) : null;
    if (packetRef && !packetDoc?.exists) throw new Error('Packet not found.');
    if (packetDoc?.data()?.bldId && packetDoc.data()!.bldId !== opts.bldId) throw new Error('Packet and Assembly reference different BLDs.');
    const existingId = packetDoc?.data()?.assemblyId;
    if (existingId) {
      const existing = (await tx.get(db.collection('assemblies').doc(existingId))).data();
      if (!existing || existing.assemblyId !== existingId || !existing.packetIds?.includes(opts.packetId) || existing.bldId !== opts.bldId || existing.qrgId !== opts.qrgId || JSON.stringify(existing.mappings) !== JSON.stringify(mappings)) throw new Error('Packet already has a different Assembly. Generate a new packet for edited content.');
      return { assemblyId: existingId, sequence: existing.sequence, mappingCount: mappings.length };
    }
    const prepared = await prepareAssemblyDefinition(db, tx, now, { ...opts, mappings,
      packetIds: opts.packetId ? [opts.packetId] : [], source: 'auto_commit', createdBy: 'system' });
    prepared.write();
    const { assemblyId, sequence } = prepared.definition;
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
  if (asm.assemblyId !== packet.assemblyId) throw new Error('Assembly document identity does not match its stored ID.');
  const result = await validatePacketContent(db, packet, asm);
  if (packet.ownerType === 'admin' && packet.ownerInstanceId) {
    const instance = (await db.collection('admin_catalog_instances').doc(packet.ownerInstanceId).get()).data();
    if (!instance || instance.currentPacketId !== packetId) throw new Error('Catalog item is not connected to this packet.');
    if (instance.assemblyId !== packet.assemblyId || instance.bldId !== packet.bldId || instance.qrgBlankId !== asm.qrgId) throw new Error('Catalog item and packet schema identities disagree.');
    for (const key of ['storeId','channelId','collectionId','collectionName']) if ((instance[key] || null) !== (packet[key] || null)) throw new Error('Catalog item and packet destinations disagree.');
  }
  await resolveBuildDestination(db, packet);
  return result;
}

/** Check a candidate link before either side is written. */
export async function validatePacketContent(db: Firestore, packet: Record<string, any>, asm: Record<string, any>) {
  const { bld, assets } = await validateComposition(db, asm as any);
  const snapshot = requireBuilderSnapshot(packet.builderSnapshot);
  if (!sameBldStructure(bld, { context: 'S', layoutMode: builderBldLayoutMode(snapshot.graphics.content.graphicLayoutMode), instances: extractBldInstances(snapshot) })) throw new Error('Saved BLD differs from the rendered layout. Regenerate the packet.');
  const qrPayloadHash = createHash('sha256').update(String(packet.qrContent || '').trim()).digest('hex');
  if (assets[packet.qrGrfId]?.qrPayloadHash !== qrPayloadHash) throw new Error('QR payload differs from the registered graphic. Generate the packet again.');
  const expected = extractAssemblyMappings(snapshot, packet);
  if (JSON.stringify(expected) !== JSON.stringify(asm.mappings)) throw new Error('Assembly content differs from the generated packet. Regenerate it.');
  for (const layer of extractBuilderLayers(snapshot)) if (layer.imageUrl && layer.assetKey) {
    const asset = assets[packet[layer.assetKey]];
    let matches = [asset?.sourceUrl, asset?.publicUrl].includes(layer.imageUrl);
    if (!matches && layer.imageUrl.startsWith('data:') && asset?.contentHash) {
      // Registration gives an inline upload a permanent URL. Bind it to the
      // rendered bytes by hash instead of comparing two different URL forms.
      const { imageData } = decodeLibraryImage(layer.imageUrl, asset.mimeType);
      matches = createHash('sha256').update(Buffer.from(imageData, 'base64')).digest('hex') === asset.contentHash;
    }
    if (!matches) throw new Error(`Slot ${layer.instance.seq} file differs from the rendered image.`);
  }
  const composite = (await db.collection('grf_assets').doc(packet.compositeGrfId || '__missing__').get()).data();
  if (!composite || composite.isActive === false || inspectGrfAsset(composite).length || composite.grfId !== packet.compositeGrfId || composite.publicUrl !== packet.compositeUrl) throw new Error('Composite file is missing or differs from the registered GRF.');
  const source = (await db.collection('master_catalog').doc(snapshot.metadata.selectedProductDocId).get()).data();
  if (!source || source.qrgBlankId !== asm.qrgId) throw new Error('Product blank and Assembly QRG identity differ.');
  if (packet.sourceMasterId && packet.sourceMasterId !== snapshot.metadata.selectedProductDocId) throw new Error('Packet and rendered snapshot reference different product blanks.');
  if (packet.qrgBlankId && packet.qrgBlankId !== asm.qrgId) throw new Error('Packet and Assembly QRG identities differ.');
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
    if (!asset || asset.isActive === false || inspectGrfAsset(asset).length || asset.grfId !== grfId || asset.publicUrl !== imageUrl) throw new Error(`The registered graphic for ${placement} is missing or differs from the packet.`);
    const position = snapshot.layoutConfig.providerLayouts?.[placement]?.providerPlacementId || toProviderPlacement('printify', placement);
    if (output.some(p => p.position === position)) throw new Error(`More than one graphic targets ${position}. Choose one placement for that area.`);
    output.push({ position, imageUrl });
  }
  return output;
}
