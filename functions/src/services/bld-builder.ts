/** Production adapters; dev calls these same dependency-injected services. */
import { db, admin } from '../core';
import { resolveBuilderBld } from './bld-store';
import { createAutoAssembly, type AutoAssemblyOptions } from './assembly-store';
export { extractBldInstances } from '../../../shared/bldCodes';
export { extractAssemblyMappings } from './assembly-store';
export type { BldContext, BldLayoutMode, BldInstance } from '../../../shared/bldCodes';
export interface WriteBldOptions { working: Record<string, any>; packetId?: string }
export interface WriteBldResult { bldId: string; instanceCount: number; buildSequence: number }
export async function writeBldDefinition({ working, packetId }: WriteBldOptions): Promise<WriteBldResult> {
  const d = await resolveBuilderBld(db, () => admin.firestore.FieldValue.serverTimestamp(), working, packetId);
  return { bldId: d.bldId, instanceCount: d.instanceCount, buildSequence: d.buildSequence };
}
export function writeAutoAssembly(opts: AutoAssemblyOptions) {
  return createAutoAssembly(db, () => admin.firestore.FieldValue.serverTimestamp(), opts);
}
