import { memberProductOptions } from './member-product-options';
import { masterCatalogProduct } from '../../../shared/masterCatalog';
import { catalogToSelectItem } from '../../../shared/adapters/catalog.adapter';
import { storeProductReferences } from './store-product-references';
import { isValidMasterCatalogDocId } from '../../../shared/qrgCodes';

const fail = (message: string) => { throw Object.assign(new Error(message), { status: 400 }); };
async function parent(db: any, storeId: string) {
  if (storeId === 'member-products') return;
  const store = await db.collection('stores').doc(storeId).get();
  if (!store.exists) throw Object.assign(new Error('Store not found'), { status: 404 });
}
/** Saved lists contain only references; titles, prices and images come from the catalog adapter. */
export async function readStoreProducts(db: any, storeId: string, section?: string) {
  await parent(db, storeId);
  const { products: raw, catalog, catalogId, configured } = await storeProductReferences(db, storeId, section);
  const masters = await db.collection('master_catalog').get();
  const projected = masters.docs.filter((d: any) => d.data().isActive !== false && d.data().status !== 'archived').map((d: any) => masterCatalogProduct(d.id, d.data()));
  const pricing = (await db.collection('testSettings').doc('pricing').get()).data() || {};
  const providerSetting = (await db.collection('settings').doc('admin').get()).data()?.defaultFulfillmentProvider;
  const products = [];
  for (const reference of raw) {
    let id = reference.canonicalBlankKey;
    if (!id) {
      // Old beta lists are readable only when the supplier reference identifies exactly one QRG record.
      const provider = reference.fulfillmentProvider || reference.provider || 'printify';
      if (!Number.isFinite(Number(reference.blueprintId)) || Number(reference.blueprintId) <= 0) fail('An older selection is missing its product identity.');
      const matches = projected.filter((p: any) => Number(provider === 'printful' ? p.printfulId : p.blueprintId) === Number(reference.blueprintId));
      if (matches.length !== 1) fail('An older product selection cannot be matched to one QRG blank. Review the saved selection before replacing it.');
      id = matches[0].docId;
    }
    const master = projected.find((p: any) => p.docId === id);
    if (!master) fail(`Saved blank ${id} is missing or archived. Restore it before editing this list.`);
    if (catalog && !catalog.blankIds?.includes(id)) continue;
    const item = catalogToSelectItem(master, catalog?.blankDescriptions?.[id], catalog?.blankTitles?.[id], catalog?.blankImages?.[id], catalog?.blankColors?.[id]);
    const colors = reference.colors === undefined ? item.availableColors : item.availableColors.filter(c => reference.colors.includes(c.name));
    const sizes = reference.sizes === undefined ? item.availableSizes : item.availableSizes.filter(s => reference.sizes.includes(s));
    const source = masters.docs.find((d: any) => d.id === id).data();
    const options = memberProductOptions(source, { ...item, availableColors: colors, availableSizes: sizes }, providerSetting, pricing);
    const provider = options.provider;
    const { cost, retailPrice, memberEarnings } = options;
    products.push({ ...item, id, canonicalBlankKey: id, qrgBlankId: master.qrgBlankId,
      title: item.name, imageUrl: item.primaryImageUrl, 
      
      blueprintId: provider === 'printful' ? master.printfulId : master.blueprintId,
      printProviderId: master.printProviderId, 
      ...options, colors: options.availableColors, sizes: options.availableSizes, brand: item.manufacturer, effectiveDescription: item.description, selectedColors: reference.colors, selectedSizes: reference.sizes });
  }
  return { storeId, products, catalogId, catalogName: catalog?.name || null, configured };
}
export async function saveStoreProducts(db: any, storeId: string, products: unknown, catalogId?: unknown) {
  await parent(db, storeId);
  if (catalogId !== undefined && catalogId !== null && catalogId !== '') {
    if (typeof catalogId !== 'string' || !/^[a-zA-Z0-9_-]{1,150}$/.test(catalogId)) fail('Select a valid catalog');
    return db.runTransaction(async (tx: any) => {
      const catalog = await tx.get(db.collection('catalogs').doc(catalogId));
      if (!catalog.exists || !Array.isArray(catalog.data()?.blankIds)) fail('Select an existing catalog');
      tx.set(db.collection('storeAllowedProducts').doc(storeId), { storeId, catalogId, updatedAt: new Date().toISOString() });
      return { success: true, count: catalog.data().blankIds.length, catalogId };
    });
  }
  if (!Array.isArray(products)) fail('products must be an array');
  const refs: any[] = []; const seen = new Set<string>();
  for (const p of products as any[]) {
    if (!p || !isValidMasterCatalogDocId(p.canonicalBlankKey)) fail('Select a QRG blank');
    const id = p.canonicalBlankKey;
    if (seen.has(id)) fail('A blank can only appear once'); seen.add(id);
    const doc = await db.collection('master_catalog').doc(id).get();
    if (!doc.exists || doc.data().isActive === false || doc.data().status === 'archived') fail('Select an active QRG blank');
    const item = catalogToSelectItem(masterCatalogProduct(id, doc.data()));
    const ref: any = { canonicalBlankKey: id };
    for (const [key, allowed] of [['colors', item.availableColors.map(c => c.name)], ['sizes', item.availableSizes]] as const) {
      if (p[key] === undefined) continue;
      if (!Array.isArray(p[key]) || p[key].some((v: any) => typeof v !== 'string' || !allowed.includes(v))) fail(`Invalid ${key} for ${id}`);
      ref[key] = Array.from(new Set(p[key]));
    }
    refs.push(ref);
  }
  await db.collection('storeAllowedProducts').doc(storeId).set({ storeId, products: refs, updatedAt: new Date().toISOString() });
  return { success: true, count: refs.length };
}
export function registerStoreProductRoutes(app: any, prefix: string, auth: any, getDb: () => any) {
  const get = (id: (req: any) => string, section?: boolean) => async (req: any, res: any) => {
    try { res.json(await readStoreProducts(getDb(), id(req), section ? String(req.query.section || 'member') : undefined)); }
    catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
  };
  const post = (id: (req: any) => string) => async (req: any, res: any) => {
    try { res.json(await saveStoreProducts(getDb(), id(req), req.body.products, req.body.catalogId)); }
    catch (e: any) { res.status(e.status || 500).json({ error: e.message }); }
  };
  app.get(`${prefix}/admin/stores/:storeId/allowed-products`, auth, get(r => r.params.storeId));
  app.post(`${prefix}/admin/stores/:storeId/allowed-products`, auth, post(r => r.params.storeId));
  app.get(`${prefix}/stores/:storeId/allowed-products`, get(r => r.params.storeId));
  app.post(`${prefix}/stores/:storeId/allowed-products`, auth, post(r => r.params.storeId));
  app.get(`${prefix}/members/allowed-products`, get(() => 'member-products', true));
  app.post(`${prefix}/members/allowed-products`, auth, post(() => 'member-products'));
}

