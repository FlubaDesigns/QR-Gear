import { getFirestoreDb } from './firebase-admin';
import { PLATFORM_STORE_ID, CHANNEL_ITEMS_COLLECTION } from './constants';

export { PLATFORM_STORE_ID };

export interface ChannelItem {
  itemId: string;
  storeId: string;
  channelId: string;
  packetId: string;
  title: string;
  description?: string;
  previewImageUrl?: string;
  shareUrl: string;
  price?: number;
  isActive: boolean;
  sortOrder: number;
  collectionId?: string;
  shareImageSquareUrl?: string;
  shareImageLinkUrl?: string;
  shareImageStoryUrl?: string;
  shareCaption?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ChannelItemInput {
  storeId?: string;
  channelId: string;
  packetId: string;
  title: string;
  description?: string;
  previewImageUrl?: string;
  price?: number;
  collectionId?: string;
  sortOrder?: number;
  shareImageSquareUrl?: string;
  shareImageLinkUrl?: string;
  shareImageStoryUrl?: string;
  shareCaption?: string;
}

export function deriveChannelId(entityType: string, entityId: string): string {
  return `${entityType}_${entityId}`;
}

export function generateShareCaption(title: string, description?: string, shareUrl?: string): string {
  const baseUrl = process.env.VITE_BASE_URL || 'https://qrgear-c1ffd.web.app';
  const fullUrl = shareUrl?.startsWith('http') ? shareUrl : `${baseUrl}${shareUrl || ''}`;
  
  let caption = `Check this out!\n${title}`;
  if (description) {
    caption += `\n\n${description.slice(0, 100)}${description.length > 100 ? '...' : ''}`;
  }
  caption += `\n\n${fullUrl}`;
  
  return caption;
}

export async function getChannelItems(options: {
  storeId: string;
  channelId: string;
  limit?: number;
  includeInactive?: boolean;
}): Promise<ChannelItem[]> {
  const db = getFirestoreDb();
  const { storeId, channelId, limit = 12, includeInactive = false } = options;
  
  let query = db.collection(CHANNEL_ITEMS_COLLECTION)
    .where('storeId', '==', storeId)
    .where('channelId', '==', channelId);
  
  if (!includeInactive) {
    query = query.where('isActive', '==', true);
  }
  
  const snapshot = await query
    .orderBy('sortOrder', 'asc')
    .limit(limit)
    .get();
  
  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      itemId: doc.id,
      storeId: data.storeId,
      channelId: data.channelId,
      packetId: data.packetId,
      title: data.title,
      description: data.description,
      previewImageUrl: data.previewImageUrl,
      shareUrl: data.shareUrl || `/p/${data.packetId}`,
      price: data.price,
      isActive: data.isActive,
      sortOrder: data.sortOrder || 0,
      collectionId: data.collectionId,
      shareImageSquareUrl: data.shareImageSquareUrl,
      shareImageLinkUrl: data.shareImageLinkUrl,
      shareImageStoryUrl: data.shareImageStoryUrl,
      shareCaption: data.shareCaption,
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
    };
  });
}

export async function getChannelItem(itemId: string): Promise<ChannelItem | null> {
  const db = getFirestoreDb();
  const doc = await db.collection(CHANNEL_ITEMS_COLLECTION).doc(itemId).get();
  
  if (!doc.exists) {
    return null;
  }
  
  const data = doc.data()!;
  return {
    itemId: doc.id,
    storeId: data.storeId,
    channelId: data.channelId,
    packetId: data.packetId,
    title: data.title,
    description: data.description,
    previewImageUrl: data.previewImageUrl,
    shareUrl: data.shareUrl || `/p/${data.packetId}`,
    price: data.price,
    isActive: data.isActive,
    sortOrder: data.sortOrder || 0,
    collectionId: data.collectionId,
    shareImageSquareUrl: data.shareImageSquareUrl,
    shareImageLinkUrl: data.shareImageLinkUrl,
    shareImageStoryUrl: data.shareImageStoryUrl,
    shareCaption: data.shareCaption,
    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
  };
}

export async function upsertChannelItem(input: ChannelItemInput & { storeId: string }): Promise<ChannelItem> {
  const db = getFirestoreDb();
  const now = new Date();
  const storeId = input.storeId;
  const collectionValue = input.collectionId || null;
  
  const existingQuery = await db.collection(CHANNEL_ITEMS_COLLECTION)
    .where('storeId', '==', storeId)
    .where('channelId', '==', input.channelId)
    .where('packetId', '==', input.packetId)
    .limit(1)
    .get();
  
  const shareUrl = `/p/${input.packetId}`;
  
  if (!existingQuery.empty) {
    const existingDoc = existingQuery.docs[0];
    const existingData = existingDoc.data();
    const shareCaption = input.shareCaption || generateShareCaption(input.title, input.description, shareUrl);
    
    const updateData: Record<string, any> = {
      title: input.title,
      description: input.description || null,
      previewImageUrl: input.previewImageUrl || null,
      shareUrl,
      price: input.price || null,
      collectionId: collectionValue,
      sortOrder: input.sortOrder ?? existingData.sortOrder ?? 0,
      shareCaption,
      isActive: true,
      updatedAt: now,
    };
    
    if (input.shareImageSquareUrl) updateData.shareImageSquareUrl = input.shareImageSquareUrl;
    if (input.shareImageLinkUrl) updateData.shareImageLinkUrl = input.shareImageLinkUrl;
    if (input.shareImageStoryUrl) updateData.shareImageStoryUrl = input.shareImageStoryUrl;
    
    await db.collection(CHANNEL_ITEMS_COLLECTION).doc(existingDoc.id).update(updateData);
    
    return {
      itemId: existingDoc.id,
      storeId,
      channelId: input.channelId,
      packetId: input.packetId,
      title: input.title,
      description: input.description,
      previewImageUrl: input.previewImageUrl,
      shareUrl,
      price: input.price,
      isActive: true,
      sortOrder: input.sortOrder ?? existingData.sortOrder ?? 0,
      collectionId: collectionValue || undefined,
      shareImageSquareUrl: input.shareImageSquareUrl || existingData.shareImageSquareUrl,
      shareImageLinkUrl: input.shareImageLinkUrl || existingData.shareImageLinkUrl,
      shareImageStoryUrl: input.shareImageStoryUrl || existingData.shareImageStoryUrl,
      shareCaption,
      createdAt: existingData.createdAt?.toDate?.() || now,
      updatedAt: now,
    };
  }
  
  const countSnapshot = await db.collection(CHANNEL_ITEMS_COLLECTION)
    .where('storeId', '==', storeId)
    .where('channelId', '==', input.channelId)
    .count()
    .get();
  const existingCount = countSnapshot.data().count;
  const shareCaption = input.shareCaption || generateShareCaption(input.title, input.description, shareUrl);
  
  const newData: Record<string, any> = {
    storeId,
    channelId: input.channelId,
    packetId: input.packetId,
    title: input.title,
    description: input.description || null,
    previewImageUrl: input.previewImageUrl || null,
    shareUrl,
    shareCaption,
    price: input.price || null,
    isActive: true,
    sortOrder: input.sortOrder ?? existingCount,
    collectionId: collectionValue,
    createdAt: now,
    updatedAt: now,
  };
  
  if (input.shareImageSquareUrl) newData.shareImageSquareUrl = input.shareImageSquareUrl;
  if (input.shareImageLinkUrl) newData.shareImageLinkUrl = input.shareImageLinkUrl;
  if (input.shareImageStoryUrl) newData.shareImageStoryUrl = input.shareImageStoryUrl;
  
  const docRef = await db.collection(CHANNEL_ITEMS_COLLECTION).add(newData);
  
  return {
    itemId: docRef.id,
    storeId,
    channelId: input.channelId,
    packetId: input.packetId,
    title: input.title,
    description: input.description,
    previewImageUrl: input.previewImageUrl,
    shareUrl,
    price: input.price,
    isActive: true,
    sortOrder: newData.sortOrder as number,
    collectionId: collectionValue || undefined,
    shareImageSquareUrl: input.shareImageSquareUrl,
    shareImageLinkUrl: input.shareImageLinkUrl,
    shareImageStoryUrl: input.shareImageStoryUrl,
    shareCaption,
    createdAt: now,
    updatedAt: now,
  };
}

export async function deactivateChannelItem(itemId: string): Promise<boolean> {
  return setChannelItemActive(itemId, false);
}

export async function setChannelItemActive(itemId: string, isActive: boolean): Promise<boolean> {
  const db = getFirestoreDb();
  
  try {
    await db.collection(CHANNEL_ITEMS_COLLECTION).doc(itemId).update({
      isActive,
      updatedAt: new Date(),
    });
    return true;
  } catch (error) {
    console.error('[ChannelItems] Set active error:', error);
    return false;
  }
}

export async function updateChannelItemOrder(itemId: string, sortOrder: number): Promise<boolean> {
  const db = getFirestoreDb();
  
  try {
    await db.collection(CHANNEL_ITEMS_COLLECTION).doc(itemId).update({
      sortOrder,
      updatedAt: new Date(),
    });
    return true;
  } catch (error) {
    console.error('[ChannelItems] Update order error:', error);
    return false;
  }
}
