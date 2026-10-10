import { memberProductOptions } from './member-product-options';
import { CATALOG_SECTIONS } from '../../../shared/catalogs';
import { isValidMasterCatalogDocId } from '../../../shared/qrgCodes';
import { masterCatalogProduct } from '../../../shared/masterCatalog';
import { catalogToSelectItem } from '../../../shared/adapters/catalog.adapter';

/** Member choices derive from QRG masters and saved catalog overrides in both runtimes. */
export async function catalogTierProducts(db: any, section: string) {
  if (!(CATALOG_SECTIONS as readonly string[]).includes(section)) {
    throw Object.assign(new Error('Invalid catalog section.'), { status: 400 });
  }
  const settings = db.collection('systemSettings');
  const [assignmentDoc, defaultsDoc] = await Promise.all([
    settings.doc('catalog-assignments').get(), settings.doc('catalog-defaults').get(),
  ]);
  const catalogId = assignmentDoc.data()?.[section] || defaultsDoc.data()?.defaultCatalogId || null;
  const empty = { hasTiers: false, catalogId, catalogName: '', tiers: {} as Record<string, Record<string, any>>, tierConfig: {} };
  if (!catalogId) return empty;
  const catalogDoc = await db.collection('catalogs').doc(catalogId).get();
  if (!catalogDoc.exists) return empty;
  const catalog = catalogDoc.data();
  const tierConfig = catalog.tierConfig || {};
  const pricing = (await db.collection('testSettings').doc('pricing').get()).data() || {};
  const providerSetting = (await db.collection('settings').doc('admin').get()).data()?.defaultFulfillmentProvider;
  const tiers: Record<string, Record<string, any>> = {};
  const unavailableBlankIds: string[] = [];
  for (const id of catalog.blankIds || []) {
    const tier = catalog.blankTiers?.[id];
    if (!['good', 'better', 'best'].includes(tier)) continue;
    if (!isValidMasterCatalogDocId(id)) { unavailableBlankIds.push(id); continue; }
    const doc = await db.collection('master_catalog').doc(id).get();
    const raw = doc.data();
    if (!doc.exists || raw.isActive === false || raw.status === 'archived') { unavailableBlankIds.push(id); continue; }
    const master = masterCatalogProduct(id, raw);
    const item = catalogToSelectItem(master, catalog.blankDescriptions?.[id], catalog.blankTitles?.[id], catalog.blankImages?.[id], catalog.blankColors?.[id]);
    const options = memberProductOptions(raw, item, providerSetting, pricing);
    const provider = options.provider;
    // Provider IDs are outbound lookup references; canonicalBlankKey is the identity.
    if (!provider) { unavailableBlankIds.push(id); continue; }
    const category = typeof raw.qrgCategory === 'string' && raw.qrgCategory ? raw.qrgCategory : 'Unclassified';
    const { cost, retailPrice, memberEarnings } = options;
    const config = tierConfig[tier] || {};
    tiers[category] ||= {};
    tiers[category][tier] ||= { tier, displayName: config.displayName || tier[0].toUpperCase() + tier.slice(1), description: config.description || '', tagline: config.tagline || '', products: [] };
    tiers[category][tier].products.push({
      blueprintId: provider === 'printful' ? master.printfulId : master.blueprintId,
      canonicalBlankKey: id, qrgBlankId: master.qrgBlankId, 
      title: item.name, providerTitle: item.providerTitle, adminCatalogTitle: item.adminCatalogTitle,
      description: item.description, effectiveDescription: item.description,
      providerDescription: item.providerDescription, adminCatalogDescription: item.adminCatalogDescription,
      brand: item.manufacturer, category, imageUrl: item.primaryImageUrl, images: item.images,
      
      ...options, colors: options.availableColors, sizes: options.availableSizes,
    });
  }
  return { hasTiers: Object.keys(tiers).length > 0, catalogId, catalogName: catalog.name, tiers, tierConfig, unavailableBlankIds };
}

