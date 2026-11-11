import { CATALOG_SECTIONS } from '../../../shared/catalogs';
const fail = (message: string): never => { throw Object.assign(new Error(message), { status: 409 }); };
/** One source for store choices: a live catalog reference, or the existing explicit list. */
export async function storeProductReferences(db: any, storeId: string, section?: string) {
  if (section && !(CATALOG_SECTIONS as readonly string[]).includes(section)) fail('Invalid catalog section');
  const saved = await db.collection('storeAllowedProducts').doc(storeId).get();
  const selection = saved.data() || {};
  let catalogId = selection.catalogId || null;
  if (!catalogId && section) {
    const assignment = await db.collection('systemSettings').doc('catalog-assignments').get();
    catalogId = assignment.data()?.[section] || null;
  }
  let catalog: any = null;
  if (catalogId) {
    const doc = await db.collection('catalogs').doc(catalogId).get();
    if (!doc.exists || !Array.isArray(doc.data()?.blankIds)) fail('The assigned catalog is missing. Select a catalog in Blanks.');
    catalog = doc.data();
  }
  const fromCatalog = (catalog?.blankIds || []).map((canonicalBlankKey: string) => ({ canonicalBlankKey }));
  const raw = selection.catalogId ? fromCatalog : saved.exists ? selection.products || [] : fromCatalog;
  if (!Array.isArray(raw)) fail('Review the saved store product choices.');
  const products = raw.filter((r: any) => !catalog || catalog.blankIds.includes(r.canonicalBlankKey)).map((r: any) => {
    const colors = catalog?.blankColors?.[r.canonicalBlankKey];
    if (colors !== undefined && (!Array.isArray(colors) || colors.some((c: any) => !c || typeof c.name !== 'string'))) fail('Review the assigned catalog color choices.');
    return colors === undefined ? r : { ...r, colors: colors.map((c: any) => c.name).filter((c: string) => r.colors === undefined || r.colors.includes(c)) };
  });
  return { products, catalog, catalogId: selection.catalogId || null, configured: saved.exists };
}
