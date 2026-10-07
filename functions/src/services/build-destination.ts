/** A destination is resolved from stored IDs. Display names and paths are projections. */
export async function resolveBuildDestination(db: any, input: Record<string, any>) {
  const storeId = input.storeId || null, channelId = input.channelId || null;
  let store: any = null, channel: any = null, collection: any = null;
  if (storeId) {
    const primary = await db.collection('stores').doc(storeId).get();
    // The existing store API also recognizes partner-store parents.
    store = primary.exists ? primary.data() : (await db.collection('partnerStores').doc(storeId).get()).data();
    if (!store || store.isActive === false) throw new Error('Choose an active store.');
  }
  if (channelId) {
    channel = (await db.collection('storeChannels').doc(channelId).get()).data();
    if (!storeId || !channel || channel.isActive === false || channel.storeId !== storeId) throw new Error('The channel does not belong to the selected store.');
  }
  const collectionName = typeof input.collectionName === 'string' ? input.collectionName.trim() : '';
  if (input.collectionId) {
    const doc = await db.collection('dynamicsCollections').doc(input.collectionId).get();
    collection = doc.exists ? { ...doc.data(), id: doc.id } : null;
    if (!collection || collection.storeId !== storeId || collection.channelId !== channelId) throw new Error('The collection does not belong to the selected store and channel.');
  } else if (collectionName && channelId) {
    const candidates = await db.collection('dynamicsCollections').where('channelId', '==', channelId).get();
    const found = candidates.docs.find((d: any) => d.data().storeId === storeId && d.data().name === collectionName);
    if (found) collection = { ...found.data(), id: found.id };
  }
  if ((collection || collectionName) && !channelId) throw new Error('Choose a channel for this collection.');
  const destination = { storeId, storeName: store?.name || null, channelId, channelName: channel?.name || null,
    collectionId: collection?.id || null, collectionName: collection?.name || collectionName || null };
  return { ...destination, folderPath: [destination.storeName, destination.channelName, destination.collectionName].filter(Boolean).join(' / ') || null };
}
export function destinationMetadata(destination: Awaited<ReturnType<typeof resolveBuildDestination>>) {
  return {
    selectedStore: destination.storeId ? { id: destination.storeId, name: destination.storeName } : null,
    selectedChannel: destination.channelId ? { id: destination.channelId, name: destination.channelName } : null,
    selectedCollection: destination.collectionName ? { id: destination.collectionId, name: destination.collectionName } : null,
  };
}
