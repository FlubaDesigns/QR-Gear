/** One listing/filter policy for Catalog, Unplaced Items and both HTTP adapters. */
export async function listCatalogInstances(db: any, filters: Record<string, any>) {
  let query = db.collection('admin_catalog_instances');
  for (const field of ['storeId', 'catalogId', 'sourceMasterId', 'status']) if (filters[field]) query = query.where(field, '==', filters[field]);
  const snapshot = await query.get();
  const instances = snapshot.docs.map((doc: any) => {
    const data = doc.data();
    return { ...data, id: doc.id, createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || null };
  }).filter((item: any) => {
    if (!filters.status && (['deleted', 'archived'].includes(item.status) || item.isVisible === false)) return false;
    if (filters.unplaced === 'true' && item.storeId && item.channelId) return false;
    if (filters.channelId && item.channelId !== filters.channelId) return false;
    if (filters.collectionName && item.collectionName !== filters.collectionName) return false;
    if (filters.folderPath && !filters.channelId && !filters.collectionName && item.folderPath !== filters.folderPath) return false;
    return true;
  });
  instances.sort((a: any, b: any) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
  return { success: true, instances, count: instances.length };
}
