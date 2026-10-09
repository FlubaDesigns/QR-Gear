import { describe, expect, it } from 'vitest';
import { database } from './composition-fixture';
import { saveBundle, readBundle, calculateBundle, quoteCartBundle } from '../product-bundles';
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

const cartRows = () => [
  { cartItemId: 'a', productId: 'army', productTitle: 'Army', quantity: 2, unitAmount: 4758 },
  { cartItemId: 'b', productId: 'lincoln', productTitle: 'Lincoln', quantity: 1, unitAmount: 4983 },
];
describe('bundle checkout quotes', () => {
  it.each([
    [{ pricingType: 'discount_percent', discountPercent: 10 }, 884],
    [{ pricingType: 'fixed_price', fixedPrice: 70 }, 1841],
    [{ pricingType: 'discount_amount', discountAmount: 8.85 }, 885],
  ])('applies saved pricing %j without discounting surcharges or extra quantities', async (pricing, discount) => {
    const f = seed(); const saved = await saveBundle(f.db, { ...input(), ...pricing });
    const quote = await quoteCartBundle(f.db, cartRows(), { bundleId: saved.id });
    expect(quote.subtotalCents).toBe(14499); expect(quote.amount).toBe(14499 - Number(discount));
    expect(quote.items.reduce((sum, item) => sum + item.lineTotalCents, 0)).toBe(quote.amount);
    expect(quote.items.reduce((sum, item) => sum + item.discountCents, 0)).toBe(discount);
    expect(quote.items.map(item => item.quantity)).toEqual([2, 1]); expect(quote.items[0].unitAmount).toBe(4758);
  });
  it('requires explicit selection and rejects missing quantities and paused offers', async () => {
    const f = seed(); const saved = await saveBundle(f.db, input());
    expect((await quoteCartBundle(f.db, cartRows())).amount).toBe(14499);
    await expect(quoteCartBundle(f.db, cartRows().slice(0, 1), { bundleId: saved.id })).rejects.toThrow('required');
    await saveBundle(f.db, { isActive: false }, saved.id);
    await expect(quoteCartBundle(f.db, cartRows(), { bundleId: saved.id })).rejects.toThrow('unavailable');
  });
  it('validates pick membership, count and active dates', async () => {
    const f = seed(); const saved = await saveBundle(f.db, { ...input(), bundleType: 'pick', minItems: 2, maxItems: 2 });
    for (const selectedItems of [[], ['foreign'], [saved.items[0].id, saved.items[0].id]])
      await expect(quoteCartBundle(f.db, cartRows(), { bundleId: saved.id, selectedItems })).rejects.toThrow();
    expect((await quoteCartBundle(f.db, cartRows(), { bundleId: saved.id, selectedItems: saved.items.map((item:any) => item.id) })).amount).toBe(13615);
    f.store.get('product_bundles/' + saved.id).endDate = '2000-01-01';
    await expect(quoteCartBundle(f.db, cartRows(), { bundleId: saved.id })).rejects.toThrow('unavailable');
  });
  it('preserves one-cent discounts across split cart rows', async () => {
    const f = seed(); const saved = await saveBundle(f.db, { ...input(), pricingType: 'discount_amount', discountAmount: 0.01,
      items: [{ catalogInstanceId: 'army', quantity: 2 }, { catalogInstanceId: 'lincoln', quantity: 1 }] });
    const rows = cartRows(); rows[0].quantity = 1; rows.push({ ...rows[0], cartItemId: 'c' });
    const quote = await quoteCartBundle(f.db, rows, { bundleId: saved.id });
    expect(quote.items.reduce((sum, item) => sum + item.discountCents, 0)).toBe(1);
    expect(quote.items.reduce((sum, item) => sum + item.lineTotalCents, 0)).toBe(14498);
  });
});
