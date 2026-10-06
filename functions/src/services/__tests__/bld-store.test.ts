import { describe, it, expect, vi } from 'vitest';
import { createBldDefinition } from '../bld-store';

function database(count = 0, collision = false) {
  const writes: Array<{ path: string; data: any }> = [];
  const tx = {
    get: vi.fn(async (ref: any) => ref.path.startsWith('bld_counters/')
      ? { exists: count !== 0, data: () => ({ count }) }
      : { exists: collision }),
    set: vi.fn((ref: any, data: any) => writes.push({ path: ref.path, data })),
    create: vi.fn((ref: any, data: any) => writes.push({ path: ref.path, data })),
  };
  const db = { collection: (name: string) => ({ doc: (id: string) => ({ path: `${name}/${id}` }) }), runTransaction: vi.fn(async fn => fn(tx)) };
  return { db: db as any, writes, tx };
}
const input = { context: 'S', layoutMode: 'Z', instances: [{ seq: '01', type: 'qrc' }] };

describe('single BLD save service', () => {
  it('writes the counter and complete flat definition in the same transaction', async () => {
    const { db, writes } = database(41);
    const record = await createBldDefinition(db, () => 'timestamp', { ...input, source: 'builder' });
    expect(record.bldId).toBe('BLD-SZ1-042');
    expect(writes.map(w => w.path)).toEqual(['bld_counters/SZ', 'bld_definitions/BLD-SZ1-042']);
    expect(record.instances).toEqual(input.instances);
    expect(record).not.toHaveProperty('qrgBlankId');
    expect(record).not.toHaveProperty('packetId');
  });

  it('manual and builder saves follow the same shape and counter branch', async () => {
    const a = database(4), b = database(4);
    const manual = await createBldDefinition(a.db, () => 'timestamp', { ...input, source: 'admin' });
    const builder = await createBldDefinition(b.db, () => 'timestamp', { ...input, source: 'builder' });
    expect({ ...manual, source: '' }).toEqual({ ...builder, source: '' });
  });

  it('does not allocate or write invalid structures', async () => {
    const { db, writes } = database();
    await expect(createBldDefinition(db, () => 'timestamp', { ...input, packetId: 'forbidden' })).rejects.toThrow('packetId');
    expect(db.runTransaction).not.toHaveBeenCalled();
    expect(writes).toHaveLength(0);
  });

  it.each([[999, false], [1000, false], [-1, false], [NaN, false], [1, true]])('never overflows, resets a corrupt counter, or overwrites an existing ID (%s, %s)', async (count, collision) => {
    const { db, writes } = database(count as number, collision as boolean);
    await expect(createBldDefinition(db, () => 'timestamp', input)).rejects.toThrow();
    expect(writes).toHaveLength(0);
  });
});
