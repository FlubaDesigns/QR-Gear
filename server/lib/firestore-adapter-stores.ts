import type { Firestore } from 'firebase-admin/firestore';
import { firestoreToDate, firestoreToDateNullable, prepareForFirestore } from './firestore-adapter-helpers';
import { getProduct } from './firestore-adapter-products';
import type {
  Product,
  PartnerStore, InsertPartnerStore,
  PartnerStoreProduct, InsertPartnerStoreProduct,
  ChannelConfig, InsertChannelConfig,
  ChannelPublishState, InsertChannelPublishState,
  PrintifyBlueprint, InsertPrintifyBlueprint,
  PrintifyPrintProvider, InsertPrintifyPrintProvider,
  PrintifyCatalogSync, InsertPrintifyCatalogSync,
  PrintifyCostSync, InsertPrintifyCostSync,
} from '@shared/schema';

function docToPartnerStore(doc: FirebaseFirestore.DocumentSnapshot): PartnerStore {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as PartnerStore;
}

function docToPartnerStoreProduct(doc: FirebaseFirestore.DocumentSnapshot): PartnerStoreProduct {
  const data = doc.data()!;
  return { ...data, id: doc.id, addedAt: firestoreToDate(data.addedAt) } as unknown as PartnerStoreProduct;
}

function docToChannelConfig(doc: FirebaseFirestore.DocumentSnapshot): ChannelConfig {
  const data = doc.data()!;
  return { ...data, channelType: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as ChannelConfig;
}

function docToPublishState(doc: FirebaseFirestore.DocumentSnapshot): ChannelPublishState {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), publishedAt: firestoreToDateNullable(data.publishedAt), updatedAt: firestoreToDate(data.updatedAt), lastSyncedAt: firestoreToDateNullable(data.lastSyncedAt) } as unknown as ChannelPublishState;
}

function docToPrintifyBlueprint(doc: FirebaseFirestore.DocumentSnapshot): PrintifyBlueprint {
  const data = doc.data()!;
  return { ...data, id: parseInt(doc.id), createdAt: firestoreToDate(data.createdAt), lastSyncedAt: firestoreToDate(data.syncedAt || data.lastSyncedAt) } as unknown as PrintifyBlueprint;
}

function docToPrintifyPrintProvider(doc: FirebaseFirestore.DocumentSnapshot): PrintifyPrintProvider {
  const data = doc.data()!;
  return { ...data, id: doc.id, lastSyncedAt: firestoreToDate(data.syncedAt || data.lastSyncedAt), costsFetchedAt: firestoreToDateNullable(data.costSyncedAt || data.costsFetchedAt) } as unknown as PrintifyPrintProvider;
}

function docToCatalogSync(doc: FirebaseFirestore.DocumentSnapshot): PrintifyCatalogSync {
  const data = doc.data()!;
  return { ...data, id: doc.id, startedAt: firestoreToDate(data.startedAt), completedAt: firestoreToDateNullable(data.completedAt) } as PrintifyCatalogSync;
}

function docToCostSync(doc: FirebaseFirestore.DocumentSnapshot): PrintifyCostSync {
  const data = doc.data()!;
  return { ...data, id: doc.id, startedAt: firestoreToDate(data.startedAt), completedAt: firestoreToDateNullable(data.completedAt) } as PrintifyCostSync;
}

export async function getPartnerStores(db: Firestore): Promise<PartnerStore[]> {
  const snapshot = await db.collection('partnerStores').get();
  return snapshot.docs.map(doc => docToPartnerStore(doc));
}

export async function getPartnerStore(db: Firestore, id: string): Promise<PartnerStore | undefined> {
  const doc = await db.collection('partnerStores').doc(id).get();
  if (!doc.exists) return undefined;
  return docToPartnerStore(doc);
}

export async function getPartnerStoreBySlug(db: Firestore, slug: string): Promise<PartnerStore | undefined> {
  const snapshot = await db.collection('partnerStores').where('slug', '==', slug).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToPartnerStore(snapshot.docs[0]);
}

export async function createPartnerStore(db: Firestore, store: InsertPartnerStore): Promise<PartnerStore> {
  const docRef = db.collection('partnerStores').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...store, id: docRef.id, createdAt: now, updatedAt: now });
  await docRef.set(data);
  return docToPartnerStore(await docRef.get());
}

export async function updatePartnerStore(db: Firestore, id: string, store: Partial<InsertPartnerStore>): Promise<PartnerStore | undefined> {
  const docRef = db.collection('partnerStores').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore({ ...store, updatedAt: new Date() }));
  return docToPartnerStore(await docRef.get());
}

export async function deletePartnerStore(db: Firestore, id: string): Promise<void> {
  await db.collection('partnerStores').doc(id).delete();
}

export async function getPartnerStoreProducts(db: Firestore, partnerStoreId: string): Promise<PartnerStoreProduct[]> {
  const snapshot = await db.collection('partnerStoreProducts').where('partnerStoreId', '==', partnerStoreId).get();
  return snapshot.docs.map(doc => docToPartnerStoreProduct(doc));
}

export async function getPartnerStoreProduct(db: Firestore, partnerStoreId: string, productId: string): Promise<PartnerStoreProduct | undefined> {
  const snapshot = await db.collection('partnerStoreProducts')
    .where('partnerStoreId', '==', partnerStoreId)
    .where('productId', '==', productId).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToPartnerStoreProduct(snapshot.docs[0]);
}

export async function getProductsForStore(db: Firestore, storeSlug: string, segment?: string): Promise<Product[]> {
  const store = await getPartnerStoreBySlug(db, storeSlug);
  if (!store) return [];
  let query = db.collection('partnerStoreProducts').where('partnerStoreId', '==', store.id);
  if (segment) query = query.where('segment', '==', segment);
  const snapshot = await query.get();
  const productIds = snapshot.docs.map(doc => doc.data().productId);
  const products: Product[] = [];
  for (const pid of productIds) {
    const p = await getProduct(db, pid);
    if (p) products.push(p);
  }
  return products;
}

export async function addPartnerStoreProduct(db: Firestore, product: InsertPartnerStoreProduct): Promise<PartnerStoreProduct> {
  const docRef = db.collection('partnerStoreProducts').doc();
  const data = prepareForFirestore({ ...product, id: docRef.id, addedAt: new Date() });
  await docRef.set(data);
  return docToPartnerStoreProduct(await docRef.get());
}

export async function updatePartnerStoreProduct(db: Firestore, id: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
  const docRef = db.collection('partnerStoreProducts').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(product));
  return docToPartnerStoreProduct(await docRef.get());
}

export async function updatePartnerStoreProductByIds(db: Firestore, partnerStoreId: string, productId: string, product: Partial<InsertPartnerStoreProduct>): Promise<PartnerStoreProduct | undefined> {
  const existing = await getPartnerStoreProduct(db, partnerStoreId, productId);
  if (!existing) return undefined;
  return updatePartnerStoreProduct(db, existing.id, product);
}

export async function removePartnerStoreProduct(db: Firestore, id: string): Promise<void> {
  await db.collection('partnerStoreProducts').doc(id).delete();
}

export async function syncPartnerStoreProducts(db: Firestore, partnerStoreId: string, productIds: string[]): Promise<void> {
  const existing = await db.collection('partnerStoreProducts').where('partnerStoreId', '==', partnerStoreId).get();
  const batch = db.batch();
  existing.docs.forEach(doc => batch.delete(doc.ref));
  for (const productId of productIds) {
    const docRef = db.collection('partnerStoreProducts').doc();
    batch.set(docRef, { id: docRef.id, partnerStoreId, productId, addedAt: new Date() });
  }
  await batch.commit();
}

export async function getPrintifyBlueprints(db: Firestore): Promise<PrintifyBlueprint[]> {
  const snapshot = await db.collection('printifyBlueprints').get();
  return snapshot.docs.map(doc => docToPrintifyBlueprint(doc));
}

export async function getPrintifyBlueprint(db: Firestore, id: number): Promise<PrintifyBlueprint | undefined> {
  const doc = await db.collection('printifyBlueprints').doc(String(id)).get();
  if (!doc.exists) return undefined;
  return docToPrintifyBlueprint(doc);
}

export async function upsertPrintifyBlueprint(db: Firestore, blueprint: InsertPrintifyBlueprint): Promise<PrintifyBlueprint> {
  const docRef = db.collection('printifyBlueprints').doc(String(blueprint.id));
  const now = new Date();
  const data = prepareForFirestore({ ...blueprint, syncedAt: now });
  await docRef.set(data, { merge: true });
  return docToPrintifyBlueprint(await docRef.get());
}

export async function deletePrintifyBlueprint(db: Firestore, id: number): Promise<void> {
  await db.collection('printifyBlueprints').doc(String(id)).delete();
}

export async function clearPrintifyBlueprints(db: Firestore): Promise<void> {
  const snapshot = await db.collection('printifyBlueprints').get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

export async function getAllPrintifyProviders(db: Firestore): Promise<PrintifyPrintProvider[]> {
  const snapshot = await db.collection('printifyPrintProviders').get();
  return snapshot.docs.map(doc => docToPrintifyPrintProvider(doc));
}

export async function getPrintifyPrintProviders(db: Firestore, blueprintId: number): Promise<PrintifyPrintProvider[]> {
  const snapshot = await db.collection('printifyPrintProviders').where('blueprintId', '==', blueprintId).get();
  return snapshot.docs.map(doc => docToPrintifyPrintProvider(doc));
}

export async function getPrintifyPrintProvider(db: Firestore, blueprintId: number, providerId: number): Promise<PrintifyPrintProvider | undefined> {
  const docId = `${blueprintId}_${providerId}`;
  const doc = await db.collection('printifyPrintProviders').doc(docId).get();
  if (!doc.exists) return undefined;
  return docToPrintifyPrintProvider(doc);
}

export async function upsertPrintifyPrintProvider(db: Firestore, provider: InsertPrintifyPrintProvider): Promise<PrintifyPrintProvider> {
  const docId = `${provider.blueprintId}_${provider.providerId}`;
  const docRef = db.collection('printifyPrintProviders').doc(docId);
  const now = new Date();
  const data = prepareForFirestore({ ...provider, syncedAt: now });
  await docRef.set(data, { merge: true });
  return docToPrintifyPrintProvider(await docRef.get());
}

export async function updatePrintifyProviderCosts(db: Firestore, blueprintId: number, providerId: number, costs: { minCost: number; maxCost: number; placeholderProductId?: string; availableColors?: any[]; availableSizes?: string[] }): Promise<PrintifyPrintProvider | undefined> {
  const docId = `${blueprintId}_${providerId}`;
  const docRef = db.collection('printifyPrintProviders').doc(docId);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore({ ...costs, costSyncedAt: new Date() }));
  return docToPrintifyPrintProvider(await docRef.get());
}

export async function updateProductPricesByProvider(db: Firestore, blueprintId: number, providerId: number, basePrice: string): Promise<number> {
  const snapshot = await db.collection('products')
    .where('blueprintId', '==', blueprintId)
    .where('printProviderId', '==', providerId).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.update(doc.ref, { basePrice }));
  await batch.commit();
  return snapshot.size;
}

export async function deletePrintifyPrintProvidersByBlueprint(db: Firestore, blueprintId: number): Promise<void> {
  const snapshot = await db.collection('printifyPrintProviders').where('blueprintId', '==', blueprintId).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

export async function clearPrintifyPrintProviders(db: Firestore): Promise<void> {
  const snapshot = await db.collection('printifyPrintProviders').get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

export async function getAllPrintfulProducts(db: Firestore): Promise<any[]> {
  const snapshot = await db.collection('printful_products').get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: parseInt(doc.id) }));
}

export async function getAllPrintfulVariants(db: Firestore): Promise<any[]> {
  const snapshot = await db.collection('printful_variants').get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: parseInt(doc.id) }));
}

export async function createCatalogSync(db: Firestore, sync: InsertPrintifyCatalogSync): Promise<PrintifyCatalogSync> {
  const docRef = db.collection('catalogSyncs').doc();
  const data = prepareForFirestore({ ...sync, id: docRef.id, startedAt: new Date() });
  await docRef.set(data);
  return docToCatalogSync(await docRef.get());
}

export async function updateCatalogSync(db: Firestore, id: string, sync: Partial<InsertPrintifyCatalogSync>): Promise<PrintifyCatalogSync | undefined> {
  const docRef = db.collection('catalogSyncs').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(sync));
  return docToCatalogSync(await docRef.get());
}

export async function getLatestCatalogSync(db: Firestore): Promise<PrintifyCatalogSync | undefined> {
  const snapshot = await db.collection('catalogSyncs').orderBy('startedAt', 'desc').limit(1).get();
  if (snapshot.empty) return undefined;
  return docToCatalogSync(snapshot.docs[0]);
}

export async function getCatalogSyncHistory(db: Firestore): Promise<PrintifyCatalogSync[]> {
  const snapshot = await db.collection('catalogSyncs').orderBy('startedAt', 'desc').limit(50).get();
  return snapshot.docs.map(doc => docToCatalogSync(doc));
}

export async function createCostSync(db: Firestore, sync: InsertPrintifyCostSync): Promise<PrintifyCostSync> {
  const docRef = db.collection('costSyncs').doc();
  const data = prepareForFirestore({ ...sync, id: docRef.id, startedAt: new Date() });
  await docRef.set(data);
  return docToCostSync(await docRef.get());
}

export async function updateCostSync(db: Firestore, id: string, sync: Partial<InsertPrintifyCostSync>): Promise<PrintifyCostSync | undefined> {
  const docRef = db.collection('costSyncs').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(sync));
  return docToCostSync(await docRef.get());
}

export async function getLatestCostSync(db: Firestore): Promise<PrintifyCostSync | undefined> {
  const snapshot = await db.collection('costSyncs').orderBy('startedAt', 'desc').limit(1).get();
  if (snapshot.empty) return undefined;
  return docToCostSync(snapshot.docs[0]);
}

export async function getActiveCostSync(db: Firestore): Promise<PrintifyCostSync | undefined> {
  const snapshot = await db.collection('costSyncs').where('status', '==', 'running').limit(1).get();
  if (snapshot.empty) return undefined;
  return docToCostSync(snapshot.docs[0]);
}

export async function getCostSyncHistory(db: Firestore): Promise<PrintifyCostSync[]> {
  const snapshot = await db.collection('costSyncs').orderBy('startedAt', 'desc').limit(50).get();
  return snapshot.docs.map(doc => docToCostSync(doc));
}

export async function getProviderCostStats(db: Firestore): Promise<{ total: number; withCosts: number; stale: number }> {
  const providers = await getAllPrintifyProviders(db);
  const staleDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return {
    total: providers.length,
    withCosts: providers.filter(p => p.minCost !== null).length,
    stale: providers.filter(p => p.costsFetchedAt && new Date(p.costsFetchedAt) < staleDate).length
  };
}

export async function getAllChannelConfigs(db: Firestore): Promise<ChannelConfig[]> {
  const snapshot = await db.collection('channelConfigs').get();
  return snapshot.docs.map(doc => docToChannelConfig(doc));
}

export async function getChannelConfig(db: Firestore, channelType: string): Promise<ChannelConfig | undefined> {
  const doc = await db.collection('channelConfigs').doc(channelType).get();
  if (!doc.exists) return undefined;
  return docToChannelConfig(doc);
}

export async function createChannelConfig(db: Firestore, config: InsertChannelConfig): Promise<ChannelConfig> {
  const docRef = db.collection('channelConfigs').doc(config.channelType);
  const now = new Date();
  const data = prepareForFirestore({ ...config, createdAt: now, updatedAt: now });
  await docRef.set(data);
  return docToChannelConfig(await docRef.get());
}

export async function updateChannelConfig(db: Firestore, channelType: string, config: Partial<InsertChannelConfig>): Promise<ChannelConfig | undefined> {
  const docRef = db.collection('channelConfigs').doc(channelType);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore({ ...config, updatedAt: new Date() }));
  return docToChannelConfig(await docRef.get());
}

export async function getPublishStates(db: Firestore, masterProductId: string): Promise<ChannelPublishState[]> {
  const snapshot = await db.collection('publishStates').where('masterProductId', '==', masterProductId).get();
  return snapshot.docs.map(doc => docToPublishState(doc));
}

export async function getPublishState(db: Firestore, masterProductId: string, channelType: string): Promise<ChannelPublishState | undefined> {
  const docId = `${masterProductId}_${channelType}`;
  const doc = await db.collection('publishStates').doc(docId).get();
  if (!doc.exists) return undefined;
  return docToPublishState(doc);
}

export async function upsertPublishState(db: Firestore, state: InsertChannelPublishState): Promise<ChannelPublishState> {
  const docId = `${state.masterProductId}_${state.channelType}`;
  const docRef = db.collection('publishStates').doc(docId);
  const now = new Date();
  const data = prepareForFirestore({ ...state, updatedAt: now });
  await docRef.set(data, { merge: true });
  return docToPublishState(await docRef.get());
}
