import { describe, expect, it } from 'vitest';
import { database } from './composition-fixture';
import { saveBundle, readBundle, calculateBundle } from '../product-bundles';
const seed = () => database({
  'admin_catalog_instances/army': { status: 'active', currentPacketId: 'a', resolved: { title: 'Army', pricing: { customerPrice: 43.58 } } },
  'admin_catalog_instances/lincoln': { status: 'active', currentPacketId: 'l', resolved: { title: 'Lincoln Memorial', pricing: { customerPrice: 44.83 } } },
  'master_catalog/blank': { retailPrice: 1 },
});
const input = () => ({ name: 'USA pair', bundleType: 'fixed', pricingType: 'discount_percent', discountPercent: '10', items: [{ catalogInstanceId: 'army', quantity: 1 }, { catalogInstanceId: 'lincoln', quantity: 1 }] });
describe('finished product bundles', () => {
  it('saves and reloads complete items and calculates saved retail prices to cents', async () => {
    const f = seed(); const saved = await saveBundle(f.db, input());
    expect(saved.displayOrder).toBe(0); expect((await readBundle(f.db, saved.id)).items).toHaveLength(2);
    expect(await calculateBundle(f.db, saved.id)).toMatchObject({ originalPrice: 88.41, bundlePrice: 79.57, savings: 8.84, items: [expect.objectContaining({ name: 'Army', unitPrice: 43.58 }), expect.objectContaining({ name: 'Lincoln Memorial' })] });
    f.store.get('admin_catalog_instances/army').resolved.pricing.customerPrice = 50;
    expect((await calculateBundle(f.db, saved.id)).originalPrice).toBe(94.83);
  });
  it('rejects blank IDs, missing products and invalid amounts without partial writes', async () => {
    const f = seed(); const before = structuredClone(f.store);
    for (const body of [ { ...input(), discountPercent: 'NaN' }, { ...input(), discountPercent: 101 }, { ...input(), items: [{ masterProductId: 'blank' }, { catalogInstanceId: 'army' }] }, { ...input(), items: [{ catalogInstanceId: 'missing' }, { catalogInstanceId: 'army' }] } ]) {
      await expect(saveBundle(f.db, body)).rejects.toThrow(); expect(f.store).toEqual(before);
    }
  });
  it('rejects inactive products and preserves the bundle on failed edits', async () => {
    const f = seed(); const saved = await saveBundle(f.db, input());
    await expect(saveBundle(f.db, { name: '' }, saved.id)).rejects.toThrow('name');
    expect((await readBundle(f.db, saved.id)).name).toBe('USA pair');
    f.store.get('admin_catalog_instances/army').status = 'archived';
    await expect(calculateBundle(f.db, saved.id)).rejects.toThrow('unavailable');
  });
  it('enforces fixed membership and pick counts, rejects foreign or repeated selections', async () => {
    const f = seed(); let saved = await saveBundle(f.db, input());
    await expect(calculateBundle(f.db, saved.id, [saved.items[0].id])).rejects.toThrow('Choose');
    saved = await saveBundle(f.db, { ...input(), bundleType: 'pick', minItems: 2, maxItems: 2 });
    await expect(calculateBundle(f.db, saved.id)).rejects.toThrow('Select');
    await expect(calculateBundle(f.db, saved.id, ['foreign'])).rejects.toThrow('invalid');
    await expect(calculateBundle(f.db, saved.id, [saved.items[0].id, saved.items[0].id])).rejects.toThrow('invalid');
    expect((await calculateBundle(f.db, saved.id, saved.items.map((x:any) => x.id))).bundlePrice).toBe(79.57);
  });
  it('caps amount-off savings at the subtotal and accepts explicit zero', async () => {
    const f = seed(); const saved = await saveBundle(f.db, { ...input(), pricingType: 'discount_amount', discountAmount: '100' });
    expect(await calculateBundle(f.db, saved.id)).toMatchObject({ bundlePrice: 0, savings: 88.41, savingsPercent: 100 });
    await saveBundle(f.db, { pricingType: 'fixed_price', fixedPrice: '0' }, saved.id);
    expect((await calculateBundle(f.db, saved.id)).bundlePrice).toBe(0);
    await saveBundle(f.db, { isActive: false }, saved.id);
    await expect(calculateBundle(f.db, saved.id)).rejects.toThrow('paused');
  });
});
