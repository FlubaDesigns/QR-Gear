import type { Firestore } from 'firebase-admin/firestore';
import { firestoreToDate, prepareForFirestore } from './firestore-adapter-helpers';
import type {
  Product, InsertProduct,
  CustomDesign, InsertCustomDesign,
  ProductCategory, InsertProductCategory,
  ProductCategoryAssignment, InsertProductCategoryAssignment,
  ProductVariant, InsertProductVariant,
  MasterProduct, InsertMasterProduct,
  ProductDesignVersion, InsertProductDesignVersion,
  LibraryAsset, InsertLibraryAsset,
  GraphicSet, InsertGraphicSet,
  TemplateCategory, InsertTemplateCategory,
} from '@shared/schema';

function docToProduct(doc: FirebaseFirestore.DocumentSnapshot): Product {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: firestoreToDate(data.createdAt),
    updatedAt: firestoreToDate(data.updatedAt),
  } as Product;
}

function docToCustomDesign(doc: FirebaseFirestore.DocumentSnapshot): CustomDesign {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: firestoreToDate(data.createdAt),
    updatedAt: firestoreToDate(data.updatedAt),
  } as CustomDesign;
}

function docToProductCategory(doc: FirebaseFirestore.DocumentSnapshot): ProductCategory {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as ProductCategory;
}

function docToProductVariant(doc: FirebaseFirestore.DocumentSnapshot): ProductVariant {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as unknown as ProductVariant;
}

function docToMasterProduct(doc: FirebaseFirestore.DocumentSnapshot): MasterProduct {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt), updatedAt: firestoreToDate(data.updatedAt) } as MasterProduct;
}

function docToDesignVersion(doc: FirebaseFirestore.DocumentSnapshot): ProductDesignVersion {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as ProductDesignVersion;
}

function docToLibraryAsset(doc: FirebaseFirestore.DocumentSnapshot): LibraryAsset {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as LibraryAsset;
}

function docToGraphicSet(doc: FirebaseFirestore.DocumentSnapshot): GraphicSet {
  const data = doc.data()!;
  return {
    ...data,
    id: doc.id,
    createdAt: firestoreToDate(data.createdAt),
    updatedAt: firestoreToDate(data.updatedAt),
  } as GraphicSet;
}

function docToTemplateCategory(doc: FirebaseFirestore.DocumentSnapshot): TemplateCategory {
  const data = doc.data()!;
  return { ...data, id: doc.id, createdAt: firestoreToDate(data.createdAt) } as TemplateCategory;
}

export async function getProduct(db: Firestore, id: string): Promise<Product | undefined> {
  const doc = await db.collection('products').doc(id).get();
  if (!doc.exists) return undefined;
  return docToProduct(doc);
}

export async function getAllProducts(db: Firestore): Promise<Product[]> {
  const snapshot = await db.collection('products').get();
  return snapshot.docs.map(doc => docToProduct(doc));
}

export async function getEnabledProducts(db: Firestore): Promise<Product[]> {
  const snapshot = await db.collection('products')
    .where('isEnabled', '==', true)
    .get();
  return snapshot.docs.map(doc => docToProduct(doc));
}

export async function createProduct(db: Firestore, product: InsertProduct): Promise<Product> {
  const productData = product as any;
  const docRef = db.collection('products').doc(productData.id);
  const now = new Date();
  const data = prepareForFirestore({
    ...productData,
    createdAt: productData.createdAt || now,
    updatedAt: productData.updatedAt || now,
  });
  await docRef.set(data, { merge: true });
  const doc = await docRef.get();
  return docToProduct(doc);
}

export async function updateProduct(db: Firestore, id: string, product: Partial<InsertProduct>): Promise<Product | undefined> {
  const docRef = db.collection('products').doc(id);
  const data = prepareForFirestore({ ...product as any, id });
  if (!data.updatedAt) {
    data.updatedAt = new Date();
  }
  await docRef.set(data, { merge: true });
  const updated = await docRef.get();
  return docToProduct(updated);
}

export async function deleteProduct(db: Firestore, id: string): Promise<void> {
  await db.collection('products').doc(id).delete();
}

export async function toggleProductEnabled(db: Firestore, id: string, enabled: boolean): Promise<Product | undefined> {
  return updateProduct(db, id, { isEnabled: enabled });
}

export async function getCustomDesign(db: Firestore, id: string): Promise<CustomDesign | undefined> {
  const doc = await db.collection('customDesigns').doc(id).get();
  if (!doc.exists) return undefined;
  return docToCustomDesign(doc);
}

export async function getCustomDesigns(db: Firestore): Promise<CustomDesign[]> {
  const snapshot = await db.collection('customDesigns').get();
  return snapshot.docs.map(doc => docToCustomDesign(doc));
}

export async function getCustomDesignsForLibrary(db: Firestore): Promise<CustomDesign[]> {
  const snapshot = await db.collection('customDesigns')
    .where('savedToLibrary', '==', true)
    .get();
  return snapshot.docs.map(doc => docToCustomDesign(doc));
}

export async function getCustomDesignsByStoreSegment(db: Firestore, storeType: string, storeName: string, segment?: string): Promise<CustomDesign[]> {
  let query = db.collection('customDesigns')
    .where('storeType', '==', storeType)
    .where('storeName', '==', storeName);
  if (segment) {
    query = query.where('segment', '==', segment);
  }
  const snapshot = await query.get();
  return snapshot.docs.map(doc => docToCustomDesign(doc));
}

export async function createCustomDesign(db: Firestore, design: InsertCustomDesign): Promise<CustomDesign> {
  const designData = design as any;
  const docRef = db.collection('customDesigns').doc(designData.id);
  const now = new Date();
  const data = prepareForFirestore({
    ...designData,
    createdAt: designData.createdAt || now,
    updatedAt: designData.updatedAt || now,
  });
  await docRef.set(data, { merge: true });
  const doc = await docRef.get();
  return docToCustomDesign(doc);
}

export async function updateCustomDesign(db: Firestore, id: string, design: Partial<InsertCustomDesign>): Promise<CustomDesign | undefined> {
  const docRef = db.collection('customDesigns').doc(id);
  const data = prepareForFirestore({ ...design as any, id });
  if (!data.updatedAt) {
    data.updatedAt = new Date();
  }
  await docRef.set(data, { merge: true });
  const updated = await docRef.get();
  return docToCustomDesign(updated);
}

export async function deleteCustomDesign(db: Firestore, id: string): Promise<void> {
  await db.collection('customDesigns').doc(id).delete();
}

export async function getProductCategories(db: Firestore): Promise<ProductCategory[]> {
  const snapshot = await db.collection('productCategories').get();
  return snapshot.docs.map(doc => docToProductCategory(doc));
}

export async function getActiveProductCategories(db: Firestore): Promise<ProductCategory[]> {
  const snapshot = await db.collection('productCategories').where('isActive', '==', true).get();
  return snapshot.docs.map(doc => docToProductCategory(doc));
}

export async function getProductCategoriesByTaxonomy(db: Firestore, taxonomyType: string): Promise<ProductCategory[]> {
  const snapshot = await db.collection('productCategories').where('taxonomyType', '==', taxonomyType).get();
  return snapshot.docs.map(doc => docToProductCategory(doc));
}

export async function getProductCategory(db: Firestore, id: string): Promise<ProductCategory | undefined> {
  const doc = await db.collection('productCategories').doc(id).get();
  if (!doc.exists) return undefined;
  return docToProductCategory(doc);
}

export async function createProductCategory(db: Firestore, category: InsertProductCategory): Promise<ProductCategory> {
  const docRef = db.collection('productCategories').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...category, id: docRef.id, createdAt: now });
  await docRef.set(data);
  return docToProductCategory(await docRef.get());
}

export async function updateProductCategory(db: Firestore, id: string, category: Partial<InsertProductCategory>): Promise<ProductCategory | undefined> {
  const docRef = db.collection('productCategories').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(category));
  return docToProductCategory(await docRef.get());
}

export async function deleteProductCategory(db: Firestore, id: string): Promise<void> {
  await db.collection('productCategories').doc(id).delete();
}

export async function getProductCategoryAssignments(db: Firestore, productId: string): Promise<ProductCategoryAssignment[]> {
  const snapshot = await db.collection('productCategoryAssignments').where('productId', '==', productId).get();
  return snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as ProductCategoryAssignment));
}

export async function getProductsByCategory(db: Firestore, categoryId: string): Promise<Product[]> {
  const assignments = await db.collection('productCategoryAssignments').where('categoryId', '==', categoryId).get();
  const productIds = assignments.docs.map(doc => doc.data().productId);
  if (productIds.length === 0) return [];
  const products: Product[] = [];
  for (const pid of productIds) {
    const p = await getProduct(db, pid);
    if (p) products.push(p);
  }
  return products;
}

export async function assignProductToCategory(db: Firestore, assignment: InsertProductCategoryAssignment): Promise<ProductCategoryAssignment> {
  const docRef = db.collection('productCategoryAssignments').doc();
  const data = prepareForFirestore({ ...assignment, id: docRef.id });
  await docRef.set(data);
  return { ...data, id: docRef.id } as ProductCategoryAssignment;
}

export async function removeProductFromCategory(db: Firestore, productId: string, categoryId: string): Promise<void> {
  const snapshot = await db.collection('productCategoryAssignments')
    .where('productId', '==', productId)
    .where('categoryId', '==', categoryId).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}

export async function syncProductCategories(db: Firestore, productId: string, categoryIds: string[]): Promise<void> {
  const existing = await db.collection('productCategoryAssignments').where('productId', '==', productId).get();
  const batch = db.batch();
  existing.docs.forEach(doc => batch.delete(doc.ref));
  for (const categoryId of categoryIds) {
    const docRef = db.collection('productCategoryAssignments').doc();
    batch.set(docRef, { id: docRef.id, productId, categoryId });
  }
  await batch.commit();
}

export async function getProductVariants(db: Firestore, productId: string): Promise<ProductVariant[]> {
  const snapshot = await db.collection('productVariants').where('productId', '==', productId).get();
  return snapshot.docs.map(doc => docToProductVariant(doc));
}

export async function upsertProductVariant(db: Firestore, variant: InsertProductVariant): Promise<ProductVariant> {
  const v = variant as any;
  const existingSnapshot = await db.collection('productVariants')
    .where('productId', '==', v.productId)
    .where('variantId', '==', v.variantId).limit(1).get();
  if (!existingSnapshot.empty) {
    const docRef = existingSnapshot.docs[0].ref;
    await docRef.update(prepareForFirestore({ ...v, updatedAt: new Date() }));
    return docToProductVariant(await docRef.get());
  }
  const docRef = db.collection('productVariants').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...v, id: docRef.id, createdAt: now, updatedAt: now });
  await docRef.set(data);
  return docToProductVariant(await docRef.get());
}

export async function toggleVariantEnabled(db: Firestore, id: string, enabled: boolean): Promise<ProductVariant | undefined> {
  const docRef = db.collection('productVariants').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update({ isEnabled: enabled, updatedAt: new Date() });
  return docToProductVariant(await docRef.get());
}

export async function getAllMasterProducts(db: Firestore): Promise<MasterProduct[]> {
  const snapshot = await db.collection('masterProducts').get();
  return snapshot.docs.map(doc => docToMasterProduct(doc));
}

export async function getMasterProduct(db: Firestore, id: string): Promise<MasterProduct | undefined> {
  const doc = await db.collection('masterProducts').doc(id).get();
  if (!doc.exists) return undefined;
  return docToMasterProduct(doc);
}

export async function createMasterProduct(db: Firestore, product: InsertMasterProduct): Promise<MasterProduct> {
  const docRef = db.collection('masterProducts').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...product, id: docRef.id, createdAt: now, updatedAt: now });
  await docRef.set(data);
  return docToMasterProduct(await docRef.get());
}

export async function updateMasterProduct(db: Firestore, id: string, product: Partial<InsertMasterProduct>): Promise<MasterProduct | undefined> {
  const docRef = db.collection('masterProducts').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore({ ...product, updatedAt: new Date() }));
  return docToMasterProduct(await docRef.get());
}

export async function deleteMasterProduct(db: Firestore, id: string): Promise<void> {
  await db.collection('masterProducts').doc(id).delete();
}

export async function getDesignVersions(db: Firestore, masterProductId: string): Promise<ProductDesignVersion[]> {
  const snapshot = await db.collection('designVersions').where('masterProductId', '==', masterProductId).get();
  return snapshot.docs.map(doc => docToDesignVersion(doc));
}

export async function getActiveDesignVersion(db: Firestore, masterProductId: string): Promise<ProductDesignVersion | undefined> {
  const snapshot = await db.collection('designVersions')
    .where('masterProductId', '==', masterProductId)
    .where('isActive', '==', true).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToDesignVersion(snapshot.docs[0]);
}

export async function createDesignVersion(db: Firestore, version: InsertProductDesignVersion): Promise<ProductDesignVersion> {
  const docRef = db.collection('designVersions').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...version, id: docRef.id, createdAt: now });
  await docRef.set(data);
  return docToDesignVersion(await docRef.get());
}

export async function updateDesignVersion(db: Firestore, id: string, version: Partial<InsertProductDesignVersion>): Promise<ProductDesignVersion | undefined> {
  const docRef = db.collection('designVersions').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(version));
  return docToDesignVersion(await docRef.get());
}

export async function getLibraryAsset(db: Firestore, id: string): Promise<LibraryAsset | undefined> {
  const doc = await db.collection('libraryAssets').doc(id).get();
  if (!doc.exists) return undefined;
  return docToLibraryAsset(doc);
}

export async function getLibraryAssetByUrl(db: Firestore, url: string): Promise<LibraryAsset | undefined> {
  const snapshot = await db.collection('libraryAssets').where('url', '==', url).limit(1).get();
  if (snapshot.empty) return undefined;
  return docToLibraryAsset(snapshot.docs[0]);
}

export async function getLibraryAssets(db: Firestore, filters?: { ownerType?: string; assetType?: string; mediaType?: string; userId?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
  let query = db.collection('libraryAssets') as FirebaseFirestore.Query;
  if (filters?.ownerType) query = query.where('ownerType', '==', filters.ownerType);
  if (filters?.assetType) query = query.where('assetType', '==', filters.assetType);
  if (filters?.mediaType) query = query.where('mediaType', '==', filters.mediaType);
  if (filters?.userId) query = query.where('userId', '==', filters.userId);
  if (filters?.category) query = query.where('category', '==', filters.category);
  const snapshot = await query.get();
  return snapshot.docs.map(doc => docToLibraryAsset(doc));
}

export async function getAdminLibraryAssets(db: Firestore, filters?: { assetType?: string; mediaType?: string; category?: string; season?: string; event?: string }): Promise<LibraryAsset[]> {
  return getLibraryAssets(db, { ...filters, ownerType: 'admin' });
}

export async function getUserLibraryAssets(db: Firestore, userId: string, filters?: { assetType?: string; mediaType?: string }): Promise<LibraryAsset[]> {
  return getLibraryAssets(db, { ...filters, userId, ownerType: 'user' });
}

export async function createLibraryAsset(db: Firestore, asset: InsertLibraryAsset): Promise<LibraryAsset> {
  const docRef = db.collection('libraryAssets').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...asset, id: docRef.id, createdAt: now, usageCount: 0 });
  await docRef.set(data);
  return docToLibraryAsset(await docRef.get());
}

export async function createLibraryAssetWithId(db: Firestore, id: string, asset: InsertLibraryAsset): Promise<LibraryAsset> {
  const docRef = db.collection('libraryAssets').doc(id);
  const now = new Date();
  const data = prepareForFirestore({ ...asset, id, createdAt: now, usageCount: 0 });
  await docRef.set(data);
  return docToLibraryAsset(await docRef.get());
}

export async function updateLibraryAsset(db: Firestore, id: string, asset: Partial<InsertLibraryAsset>): Promise<LibraryAsset | undefined> {
  const docRef = db.collection('libraryAssets').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(asset));
  return docToLibraryAsset(await docRef.get());
}

export async function deleteLibraryAsset(db: Firestore, id: string): Promise<void> {
  await db.collection('libraryAssets').doc(id).delete();
}

export async function incrementLibraryAssetUsage(db: Firestore, id: string): Promise<void> {
  const docRef = db.collection('libraryAssets').doc(id);
  const { FieldValue } = await import('firebase-admin/firestore');
  await docRef.update({ usageCount: FieldValue.increment(1) });
}

export async function getGraphicSets(db: Firestore): Promise<GraphicSet[]> {
  const snapshot = await db.collection('graphicSets')
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .get();
  return snapshot.docs.map(doc => docToGraphicSet(doc));
}

export async function getGraphicSet(db: Firestore, id: string): Promise<GraphicSet | undefined> {
  const doc = await db.collection('graphicSets').doc(id).get();
  if (!doc.exists) return undefined;
  return docToGraphicSet(doc);
}

export async function getGraphicSetsByCategory(db: Firestore, categoryId: string): Promise<GraphicSet[]> {
  const snapshot = await db.collection('graphicSets')
    .where('categoryId', '==', categoryId)
    .where('isActive', '==', true)
    .orderBy('createdAt', 'desc')
    .get();
  return snapshot.docs.map(doc => docToGraphicSet(doc));
}

export async function createGraphicSet(db: Firestore, graphicSet: InsertGraphicSet): Promise<GraphicSet> {
  const id = (graphicSet as any).id || db.collection('graphicSets').doc().id;
  const now = new Date();
  const data = prepareForFirestore({
    ...graphicSet,
    id,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('graphicSets').doc(id).set(data);
  const doc = await db.collection('graphicSets').doc(id).get();
  return docToGraphicSet(doc);
}

export async function updateGraphicSet(db: Firestore, id: string, graphicSet: Partial<InsertGraphicSet>): Promise<GraphicSet | undefined> {
  const docRef = db.collection('graphicSets').doc(id);
  const existing = await docRef.get();
  if (!existing.exists) return undefined;
  const data = prepareForFirestore({ ...graphicSet, updatedAt: new Date() });
  await docRef.update(data);
  const updated = await docRef.get();
  return docToGraphicSet(updated);
}

export async function deleteGraphicSet(db: Firestore, id: string): Promise<void> {
  await db.collection('graphicSets').doc(id).update({ isActive: false });
}

export async function incrementGraphicSetUsage(db: Firestore, id: string): Promise<void> {
  const docRef = db.collection('graphicSets').doc(id);
  const doc = await docRef.get();
  if (doc.exists) {
    const currentCount = doc.data()?.usageCount || 0;
    await docRef.update({ usageCount: currentCount + 1 });
  }
}

export async function getTemplateCategories(db: Firestore): Promise<TemplateCategory[]> {
  const snapshot = await db.collection('templateCategories').get();
  return snapshot.docs.map(doc => docToTemplateCategory(doc));
}

export async function getTemplateCategoriesByParent(db: Firestore, parentId: string | null): Promise<TemplateCategory[]> {
  let query = db.collection('templateCategories') as FirebaseFirestore.Query;
  if (parentId === null) {
    query = query.where('parentId', '==', null);
  } else {
    query = query.where('parentId', '==', parentId);
  }
  const snapshot = await query.get();
  return snapshot.docs.map(doc => docToTemplateCategory(doc));
}

export async function createTemplateCategory(db: Firestore, category: InsertTemplateCategory): Promise<TemplateCategory> {
  const docRef = db.collection('templateCategories').doc();
  const now = new Date();
  const data = prepareForFirestore({ ...category, id: docRef.id, createdAt: now });
  await docRef.set(data);
  return docToTemplateCategory(await docRef.get());
}

export async function updateTemplateCategory(db: Firestore, id: string, category: Partial<InsertTemplateCategory>): Promise<TemplateCategory | undefined> {
  const docRef = db.collection('templateCategories').doc(id);
  if (!(await docRef.get()).exists) return undefined;
  await docRef.update(prepareForFirestore(category));
  return docToTemplateCategory(await docRef.get());
}

export async function deleteTemplateCategory(db: Firestore, id: string): Promise<void> {
  await db.collection('templateCategories').doc(id).delete();
}
