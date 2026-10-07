/** One BLD writer for production routes, builder commits, and the dev adapter.
 * Dependencies are injected so importing this service never initializes Firebase.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { BLD_DEFINITIONS_COLLECTION, BLD_COUNTERS_COLLECTION } from '../constants';
import { BldValidationError, BLD_MAX_SEQUENCE, formatBldId, validateBldStructure, builderBldLayoutMode, extractBldInstances, sameBldStructure } from '../../../shared/bldCodes';
import type { BldStructure } from '../../../shared/bldCodes';

/** Prepare the canonical record; callers can include related links in the same transaction. */
export async function prepareBldDefinition(db: any, tx: any, timestamp: () => unknown, input: Record<string, any>) {
  const error = validateBldStructure(input);
  if (error) throw new BldValidationError(error);
  const { context, layoutMode, instances } = input as BldStructure;
  const key = `${context}${layoutMode}`;
  const counter = db.collection(BLD_COUNTERS_COLLECTION).doc(key);
  const current = (await tx.get(counter)).data()?.count ?? 0;
  if (!Number.isInteger(current) || current < 0) throw new BldValidationError(`Invalid BLD counter ${key}.`, 409);
  if (current >= BLD_MAX_SEQUENCE) throw new BldValidationError(`BLD ${key} has reached sequence ${BLD_MAX_SEQUENCE}.`, 409);
  const buildSequence = current + 1;
  const instanceCount = instances.length;
  const bldId = formatBldId(context, layoutMode, instanceCount, buildSequence);
  const ref = db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId);
  if ((await tx.get(ref)).exists) throw new BldValidationError(`BLD ${bldId} already exists; check the ${key} counter.`, 409);
  const now = timestamp();
  const definition = { bldId, context, layoutMode, instanceCount, buildSequence, instances,
    name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : bldId,
    source: input.source === 'builder' ? 'builder' : 'admin', isActive: true, createdAt: now, updatedAt: now };
  return { definition, write: () => { tx.set(counter, { count: buildSequence, key, updatedAt: now }, { merge: true }); tx.create(ref, definition); } };
}

export async function createBldDefinition(db: Firestore, timestamp: () => unknown, input: Record<string, unknown>, packetId?: string) {
  const error = validateBldStructure(input);
  if (error) throw new BldValidationError(error);
  return db.runTransaction(async tx => {
    const packetRef = packetId ? db.collection('productPackets').doc(packetId) : null;
    const packet = packetRef ? await tx.get(packetRef) : null;
    if (packetRef && !packet?.exists) throw new BldValidationError('Packet not found.', 404);
    const priorId = packet?.data()?.bldId;
    if (priorId) {
      const prior = (await tx.get(db.collection(BLD_DEFINITIONS_COLLECTION).doc(priorId))).data();
      if (!prior || prior.isActive === false || validateBldStructure(prior) || prior.bldId !== priorId || !sameBldStructure(prior, input)) throw new BldValidationError('Packet BLD differs from generated structure. Repair or regenerate the packet.', 409);
      return prior as any;
    }
    const prepared = await prepareBldDefinition(db, tx, timestamp, input);
    prepared.write();
    if (packetRef) tx.update(packetRef, { bldId: prepared.definition.bldId });
    return prepared.definition;
  });
}

/** Reuse a selected BLD when its structure is unchanged; edits create a new definition. */
export async function resolveBuilderBld(db: Firestore, now: () => unknown, working: Record<string, any>, packetId?: string) {
  const structure = { context: 'S', layoutMode: builderBldLayoutMode(working.graphics?.content?.graphicLayoutMode), instances: extractBldInstances(working) };
  const selectedId = working.metadata?.selectedBldId;
  if (selectedId) {
    const selected = (await db.collection(BLD_DEFINITIONS_COLLECTION).doc(selectedId).get()).data();
    if (!selected || selected.isActive === false || selected.bldId !== selectedId || validateBldStructure(selected)) throw new BldValidationError('The selected BLD is missing, archived, or invalid.');
    if (sameBldStructure(selected, structure)) {
      if (packetId) await db.runTransaction(async tx => {
        const ref = db.collection('productPackets').doc(packetId);
        const packet = await tx.get(ref);
        if (!packet.exists) throw new BldValidationError('Packet not found.', 404);
        if (packet.data()?.bldId && packet.data()!.bldId !== selectedId) throw new BldValidationError('Packet already uses a different BLD. Generate a new packet.', 409);
        tx.update(ref, { bldId: selectedId });
      });
      return selected;
    }
  }
  return createBldDefinition(db, now, { ...structure, source: 'builder' }, packetId);
}

function bldView(id: string, data: Record<string, any>) {
  return { ...data, id, createdAt: data.createdAt?.toDate?.().toISOString() ?? data.createdAt ?? null,
    updatedAt: data.updatedAt?.toDate?.().toISOString() ?? data.updatedAt ?? null };
}
export async function listBldDefinitions(db: Firestore, context?: unknown, layout?: unknown) {
  const docs = await db.collection(BLD_DEFINITIONS_COLLECTION).orderBy('createdAt', 'desc').get();
  return docs.docs.map(doc => ({ ...bldView(doc.id, doc.data()), validationError: validateBldStructure(doc.data()) || (doc.data().bldId !== doc.id ? 'BLD document identity does not match its stored ID.' : null) }))
    .filter((d: any) => (!context || d.context === context) && (!layout || d.layoutMode === layout));
}
export async function readBldDefinition(db: Firestore, id: string) {
  const doc = await db.collection(BLD_DEFINITIONS_COLLECTION).doc(id).get();
  if (!doc.exists) throw new BldValidationError(`BLD not found: ${id}`, 404);
  const error = validateBldStructure(doc.data()) || (doc.data()?.bldId !== id ? 'BLD document identity does not match its stored ID.' : null);
  if (error) throw new BldValidationError(error, 409);
  return bldView(id, doc.data()!);
}
