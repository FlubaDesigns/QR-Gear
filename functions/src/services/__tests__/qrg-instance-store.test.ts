import { describe, it, expect } from 'vitest';
import { database } from './composition-fixture';
import { allocateQrgInstanceRecord } from '../qrg-instance-store';
describe('shared QRG allocator', () => {
  it('uses one canonical identity and seven-digit variant suffix', async () => {
    const f = database();
    const first = await allocateQrgInstanceRecord(f.db, () => 'now', { qrgBlankId: '11111', context: 'I', sizeLabel: 'L', colorLabel: 'Black' });
    expect(first.qrgBaseCode).toBe('QRG-11111-I-000001'); expect(first.variantCode).toMatch(/^\d{7}$/);
    expect((await allocateQrgInstanceRecord(f.db, () => 'now', { qrgBlankId: '11111', context: 'I' })).instanceNumber).toBe('000002');
  });
  it.each([-1, 999999, 'bad'])('rejects corrupt or exhausted counters without resetting them: %s', async count => {
    const f = database({ 'qrg_counters/11111_I': { lastInstanceNumber: count } });
    await expect(allocateQrgInstanceRecord(f.db, () => 'now', { qrgBlankId: '11111', context: 'I' })).rejects.toThrow('counter');
    expect(f.store.get('qrg_counters/11111_I').lastInstanceNumber).toBe(count);
  });
});
