/** One BLD writer for production routes, builder commits, and the dev adapter.
 * Dependencies are injected so importing this service never initializes Firebase.
 */
import type { Firestore } from 'firebase-admin/firestore';
import { BLD_DEFINITIONS_COLLECTION, BLD_COUNTERS_COLLECTION } from '../constants';
import { BldValidationError, BLD_MAX_SEQUENCE, formatBldId, validateBldStructure } from '../../../shared/bldCodes';
import type { BldStructure } from '../../../shared/bldCodes';

export async function createBldDefinition(db: Firestore, timestamp: () => unknown, input: Record<string, unknown>) {
  const error = validateBldStructure(input);
  if (error) throw new BldValidationError(error);
  const { context, layoutMode, instances } = input as unknown as BldStructure;
  const key = `${context}${layoutMode}`;
  const counter = db.collection(BLD_COUNTERS_COLLECTION).doc(key);
  return db.runTransaction(async tx => {
    const snapshot = await tx.get(counter);
    const current = snapshot.exists ? snapshot.data()!.count : 0;
    if (!Number.isInteger(current) || current < 0) throw new BldValidationError(`Invalid BLD counter ${key}.`, 409);
    if (current >= BLD_MAX_SEQUENCE) throw new BldValidationError(`BLD ${key} has reached sequence ${BLD_MAX_SEQUENCE}; the current format cannot allocate another ID.`, 409);
    const buildSequence = current + 1;
    const instanceCount = instances.length;
    const bldId = formatBldId(context, layoutMode, instanceCount, buildSequence);
    const ref = db.collection(BLD_DEFINITIONS_COLLECTION).doc(bldId);
    const existing = await tx.get(ref);
    if (existing.exists) throw new BldValidationError(`BLD ${bldId} already exists; check the ${key} counter.`, 409);
    const now = timestamp();
    const definition = {
      bldId, context, layoutMode, instanceCount, buildSequence, instances,
      name: typeof input.name === 'string' && input.name.trim() ? input.name.trim() : bldId,
      source: input.source === 'builder' ? 'builder' : 'admin',
      isActive: true, createdAt: now, updatedAt: now,
    };
    tx.set(counter, { count: buildSequence, key, updatedAt: now }, { merge: true });
    tx.create(ref, definition);
    return definition;
  });
}
