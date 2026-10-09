/** Bundles reference finished catalog instances, never supplier blanks. */
export class BundleError extends Error { constructor(message: string, public status = 400) { super(message); } }
const fail = (message: string): never => { throw new BundleError(message); };
const amount = (value: any, label: string, max = 1000000) => {
  if (value === '' || value == null || !['number', 'string'].includes(typeof value)) return fail(`${label} is required.`);
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > max) return fail(`${label} must be between 0 and ${max}.`);
  return n;
};
function validate(input: any) {
  if (typeof input.name !== 'string' || !input.name.trim()) fail('Bundle name is required.');
  if (!['fixed', 'pick'].includes(input.bundleType)) fail('Choose a supported bundle type.');
  const field = ({ discount_percent: 'discountPercent', fixed_price: 'fixedPrice', discount_amount: 'discountAmount' } as any)[input.pricingType];
  if (!field) fail('Choose a supported pricing type.');
  const value = amount(input[field], field, field === 'discountPercent' ? 100 : 1000000);
  if (!Array.isArray(input.items) || input.items.length < 2 || input.items.length > 100) fail('Choose between 2 and 100 finished products.');
  const ids = new Set<string>();
  const items = input.items.map((item: any, index: number) => {
    if (typeof item.catalogInstanceId !== 'string' || !item.catalogInstanceId || item.catalogInstanceId.includes('/')) fail('Each bundle item must reference a saved catalog product. Recreate legacy blank-based bundles.');
    if (ids.has(item.catalogInstanceId)) fail('A product can appear only once in a bundle.');
    ids.add(item.catalogInstanceId);
    const quantity = item.quantity ?? 1;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) fail('Item quantity must be between 1 and 100.');
    return { catalogInstanceId: item.catalogInstanceId, quantity, displayOrder: index, isRequired: input.bundleType === 'fixed' };
  });
  const minItems = input.bundleType === 'fixed' ? items.length : input.minItems;
  const maxItems = input.bundleType === 'fixed' ? items.length : input.maxItems;
  if (!Number.isInteger(minItems) || !Number.isInteger(maxItems) || minItems < 2 || maxItems < minItems || maxItems > items.length) fail('Pick limits must be between 2 and the number of available products.');
  if (input.isActive != null && typeof input.isActive !== 'boolean') fail('Bundle active state must be true or false.');
  return { name: input.name.trim(), description: typeof input.description === 'string' ? input.description.trim() : null,
    bundleType: input.bundleType, pricingType: input.pricingType, discountPercent: null, fixedPrice: null, discountAmount: null,
    [field]: String(value), minItems, maxItems, isActive: input.isActive ?? true,
    displayOrder: Number.isInteger(input.displayOrder) ? input.displayOrder : 0, items };
}
function requireProduct(doc: any) {
  const p = doc.data();
  if (!doc.exists || ['deleted', 'archived'].includes(p.status) || p.isVisible === false || !p.currentPacketId) fail(`Saved product ${doc.id} is unavailable.`);
  const price = p.resolved?.pricing?.customerPrice;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || !p.resolved?.title) fail(`Saved product ${doc.id} has no valid title or retail price.`);
  return { title: p.resolved.title, price };
}
export async function readBundle(db: any, id: string) {
  const doc = await db.collection('product_bundles').doc(id).get();
  if (!doc.exists) throw new BundleError('Bundle not found', 404);
  const items = await db.collection('bundle_items').where('bundleId', '==', id).get();
  return { ...doc.data(), id: doc.id, items: items.docs.map((d: any) => ({ ...d.data(), id: d.id })).sort((a: any, b: any) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)) };
}
export async function saveBundle(db: any, input: any, id?: string) {
  const ref = db.collection('product_bundles').doc(id);
  await db.runTransaction(async (tx: any) => {
    const prior = id ? await tx.get(ref) : null;
    if (id && !prior.exists) throw new BundleError('Bundle not found', 404);
    const old = id ? await tx.get(db.collection('bundle_items').where('bundleId', '==', id)) : { docs: [] };
    const validated = validate({ ...prior?.data(), items: old.docs.map((d: any) => d.data()), ...input });
    const products = await Promise.all(validated.items.map((item: any) => tx.get(db.collection('admin_catalog_instances').doc(item.catalogInstanceId))));
    products.forEach(requireProduct);
    const { items, ...data } = validated;
    const now = new Date().toISOString();
    tx.set(ref, { ...data, createdAt: prior?.data()?.createdAt ?? now, updatedAt: now });
    old.docs.forEach((d: any) => tx.delete(d.ref));
    items.forEach((item: any) => tx.set(db.collection('bundle_items').doc(), { ...item, bundleId: ref.id }));
  });
  return readBundle(db, ref.id);
}
export async function calculateBundle(db: any, id: string, selectedItems?: unknown) {
  const bundle = await readBundle(db, id);
  if (!bundle.isActive) throw new BundleError('Bundle is paused.', 409);
  const validated = validate(bundle);
  if (selectedItems !== undefined && (!Array.isArray(selectedItems) || new Set(selectedItems).size !== selectedItems.length || selectedItems.some((id: any) => !bundle.items.some((item: any) => item.id === id)))) fail('Selected bundle items are invalid.');
  if (bundle.bundleType === 'pick' && selectedItems === undefined) fail('Select the products for this bundle.');
  const items = bundle.items.filter((item: any) => selectedItems === undefined || (selectedItems as string[]).includes(item.id));
  if (items.length < validated.minItems || items.length > validated.maxItems) fail(`Choose ${validated.minItems} to ${validated.maxItems} products.`);
  const details = await Promise.all(items.map(async (item: any) => {
    const product = requireProduct(await db.collection('admin_catalog_instances').doc(item.catalogInstanceId).get());
    const cents = Math.round(product.price * 100) * item.quantity;
    return { itemId: item.id, catalogInstanceId: item.catalogInstanceId, name: product.title, unitPrice: product.price, quantity: item.quantity, discount: 0, subtotal: cents / 100 };
  }));
  const total = details.reduce((sum, item) => sum + Math.round(item.subtotal * 100), 0);
  let price = total;
  if (bundle.pricingType === 'fixed_price') price = Math.round(Number(bundle.fixedPrice) * 100);
  if (bundle.pricingType === 'discount_percent') price = Math.round(total * (1 - Number(bundle.discountPercent) / 100));
  if (bundle.pricingType === 'discount_amount') price = Math.max(0, total - Math.round(Number(bundle.discountAmount) * 100));
  return { bundleId: id, bundleName: bundle.name, originalPrice: total / 100, bundlePrice: price / 100,
    savings: Math.max(0, total - price) / 100, savingsPercent: total ? Math.max(0, total - price) / total * 100 : 0, items: details };
}
