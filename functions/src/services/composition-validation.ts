import { inspectGrfAsset } from '../../../shared/GRF_engine';
import { validateBldStructure, isValidBldId } from '../../../shared/bldCodes';
import { validateAssemblyMappings, isValidAssemblyId } from '../../../shared/assemblyCodes';
import { isValidQrgBlankId } from '../../../shared/qrgCodes';

/** Read-time diagnostics and write-time enforcement use this same inspection. */
export async function inspectComposition(db: any, input: any) {
  const issues: string[] = [];
  if (!isValidQrgBlankId(input.qrgId)) issues.push('Assembly requires a valid QRG blank identity.');
  if (!isValidBldId(input.bldId)) issues.push('The linked BLD ID does not follow the schema.');
  const bldDoc = typeof input.bldId === 'string' && input.bldId && !input.bldId.includes('/')
    ? await db.collection('bld_definitions').doc(input.bldId).get() : null;
  const bld = bldDoc?.data();
  if (!bldDoc?.exists) issues.push('Referenced BLD does not exist.');
  else {
    const error = validateBldStructure(bld);
    if (error) issues.push(error);
    if (bld.bldId !== input.bldId) issues.push('BLD document identity does not match its stored ID.');
    if (bld.isActive === false) issues.push('Referenced BLD is archived.');
  }
  const mappingError = validateAssemblyMappings(input.mappings, Array.isArray(bld?.instances) && bld.instances.every((s: any) => s && typeof s === 'object') ? bld.instances : undefined);
  if (mappingError) issues.push(mappingError);
  if (isValidQrgBlankId(input.qrgId)) {
    const masters = await db.collection('master_catalog').where('qrgBlankId', '==', input.qrgId).get();
    if (!masters.docs.some((d: any) => d.data().isActive !== false && d.data().status !== 'archived')) issues.push('QRG blank does not exist or is archived.');
  }
  const assets: Record<string, any> = {};
  const ids = Array.isArray(input.mappings) ? Array.from(new Set<string>(input.mappings.map((m: any) => m?.grfId).filter((id: any) => typeof id === 'string' && id && !id.includes('/')))) : [];
  for (const id of ids) {
    const doc = await db.collection('grf_assets').doc(id).get();
    const asset = doc.data();
    if (!doc.exists || asset?.isActive === false || !asset?.publicUrl || asset?.registrationState === 'pending') issues.push(`GRF ${id} is missing, archived, or unfinished.`);
    else {
      const errors = inspectGrfAsset(asset);
      if (asset.grfId !== id) errors.push('Document identity does not match the GRF ID.');
      issues.push(...errors.map(error => `GRF ${id}: ${error}`));
      if (!errors.length) assets[id] = asset;
    }
  }
  return { issues, bld, assets };
}

export async function inspectAssembly(db: any, id: string, data: any) {
  const result = await inspectComposition(db, data);
  if (!isValidAssemblyId(id) || data.assemblyId !== id) result.issues.unshift('Assembly identity does not follow the schema.');
  const forward = await db.collection('productPackets').where('assemblyId', '==', id).get();
  const forwardIds = forward.docs.map((d: any) => d.id);
  const reverseIds: string[] = Array.isArray(data.packetIds) ? data.packetIds : [];
  if (forwardIds.some((pid: string) => !reverseIds.includes(pid)) || reverseIds.some(pid => !forwardIds.includes(pid))) result.issues.push('Packet links disagree between the Assembly and its packets.');
  for (const packet of forward.docs) if (packet.data().bldId !== data.bldId) result.issues.push(`Packet ${packet.id} references a different BLD.`);
  return { ...data, id, validationErrors: result.issues, packetIds: Array.from(new Set([...reverseIds, ...forwardIds])) };
}

/** Validation reads participate in the same transaction as the reference updates. */
export function transactionReader(db: any, tx: any): any {
  return { collection: (name: string) => ({
    doc: (id: string) => ({ get: () => tx.get(db.collection(name).doc(id)) }),
    where: (field: string, op: string, value: unknown) => ({ get: () => tx.get(db.collection(name).where(field, op, value)) }),
  }) };
}

