import { createHash } from 'crypto';
import { isDeepStrictEqual } from 'util';
import { db, admin } from '../core';
import { hasAutomaticPrintText, applyMasterPrintTextBackground } from '../../../shared/printTextColor';
import { requireBuilderSnapshot, packetBuildFields } from '../../../shared/builderSnapshot';
import { GRF_PACKET_SLOTS } from '../../../shared/GRF_engine';
import { dynamicsPrintSource } from './dynamics-order';
import { registerGrfAsset } from './grf-registrar';
import { renderSavedProductGraphic } from './product-graphic-renderer';
import { extractAssemblyMappings, validatePacketContent, validateComposition } from './assembly-store';
import { prepareAssemblyDefinition } from './assembly-records';
import { transactionReader } from './composition-validation';

/** A garment change resolves one immutable set of GRF files and static Assembly bindings.
 * Both storefront previews and checkout call this; funded orders only read their frozen copy.
 */
export async function resolvePacketColorArtwork(packetId: string, packet: any, master: any, colorName: string): Promise<Record<string, any>> {
  const saved = requireBuilderSnapshot(packet.builderSnapshot);
  if (!hasAutomaticPrintText(saved)) return packet;
  if (!Object.values(master.qrgVariants || {}).some((v: any) => v.colorLabel === colorName)) throw new Error('This color does not belong to the saved product.');
  const snapshot = applyMasterPrintTextBackground(saved, master, colorName);
  const projected = { ...packet, ...packetBuildFields(snapshot), selectedColor: colorName };
  const mappings = extractAssemblyMappings(snapshot, packet);
  if (isDeepStrictEqual(mappings, extractAssemblyMappings(saved, packet))) return projected;
  const sourceHash = dynamicsPrintSource(packet);
  const key = createHash('sha256').update(JSON.stringify({ sourceHash, colorName, snapshot })).digest('hex');
  const ref = db.collection('productPackets').doc(packetId);
  const apply = async (artwork: any) => {
    const value = { ...projected, ...artwork, builderSnapshot: snapshot };
    const asm = (await db.collection('assemblies').doc(value.assemblyId).get()).data();
    if (!asm?.packetIds?.includes(packetId)) throw new Error('Color artwork is not linked to its saved packet.');
    await validatePacketContent(db, value, asm);
    return value;
  };
  const existing = (await ref.get()).data()?.colorArtworks?.[key];
  if (existing) return apply(existing);
  const urls = { ...packet.placementGraphicUrls }, ids = { ...packet.placementGrfIds };
  for (const placement of snapshot.layoutConfig.selectedPlacements) {
    if (placement.startsWith('label_')) continue;
    const imageData = await renderSavedProductGraphic(snapshot, packet.qrContent, placement);
    const asset = await registerGrfAsset({ ...GRF_PACKET_SLOTS.qrComposite, imageData, mimeType: 'image/png', packetId, createdBy: 'product-color' });
    urls[placement] = asset.publicUrl; ids[placement] = asset.grfId;
  }
  const primary = snapshot.layoutConfig.selectedPlacements.find((p: string) => !p.startsWith('label_'));
  if (!primary) throw new Error('The product has no physical design placement.');
  const artwork = { placementGraphicUrls: urls, placementGrfIds: ids, compositeGrfId: ids[primary],
    compositeUrl: urls[primary], productGraphicUrl: urls[primary], colorName, colorArtworkKey: key };
  const committed = await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    if (!current || dynamicsPrintSource(current) !== sourceHash) throw new Error('This product changed while its color artwork was generated. Refresh and retry.');
    if (current.colorArtworks?.[key]) return current.colorArtworks[key];
    const input = { qrgId: packet.qrgBlankId, bldId: packet.bldId, mappings };
    await validateComposition(transactionReader(db, tx), input);
    const prepared = await prepareAssemblyDefinition(db, tx, () => admin.firestore.FieldValue.serverTimestamp(), {
      ...input, packetIds: [packetId], source: 'product_color', createdBy: 'system',
    });
    const result = { ...artwork, assemblyId: prepared.definition.assemblyId };
    prepared.write();
    tx.update(ref, { [`colorArtworks.${key}`]: result });
    return result;
  });
  return apply(committed);
}
