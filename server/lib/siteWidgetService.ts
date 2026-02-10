import { getFirestoreDb } from './firebase-admin';

export interface SiteStore {
  storeId: string;
  ownerType: string;
  ownerId: string;
  name?: string;
  logoUrl?: string;
  theme?: string;
  createdAt: Date;
  updatedAt: Date;
}

const STORES_COLLECTION = 'site_stores';

export async function resolveOrCreateStore(ownerType: string, ownerId: string, metadata?: {
  name?: string;
  logoUrl?: string;
  theme?: string;
}): Promise<SiteStore> {
  const db = getFirestoreDb();
  const storeId = `${ownerType}:${ownerId}`;

  const existingSnapshot = await db.collection(STORES_COLLECTION)
    .where('storeId', '==', storeId)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    const doc = existingSnapshot.docs[0];
    const data = doc.data();

    if (metadata?.name || metadata?.logoUrl || metadata?.theme) {
      const updates: Record<string, any> = { updatedAt: new Date() };
      if (metadata.name) updates.name = metadata.name;
      if (metadata.logoUrl) updates.logoUrl = metadata.logoUrl;
      if (metadata.theme) updates.theme = metadata.theme;
      await db.collection(STORES_COLLECTION).doc(doc.id).update(updates);
    }

    return {
      storeId,
      ownerType: data.ownerType,
      ownerId: data.ownerId,
      name: metadata?.name || data.name,
      logoUrl: metadata?.logoUrl || data.logoUrl,
      theme: metadata?.theme || data.theme,
      createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
      updatedAt: new Date(),
    };
  }

  const now = new Date();
  const newData = {
    storeId,
    ownerType,
    ownerId,
    name: metadata?.name || null,
    logoUrl: metadata?.logoUrl || null,
    theme: metadata?.theme || null,
    createdAt: now,
    updatedAt: now,
  };

  await db.collection(STORES_COLLECTION).add(newData);

  return {
    storeId,
    ownerType,
    ownerId,
    name: metadata?.name,
    logoUrl: metadata?.logoUrl,
    theme: metadata?.theme,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getStore(storeId: string): Promise<SiteStore | null> {
  const db = getFirestoreDb();
  const snapshot = await db.collection(STORES_COLLECTION)
    .where('storeId', '==', storeId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data();

  return {
    storeId: data.storeId,
    ownerType: data.ownerType,
    ownerId: data.ownerId,
    name: data.name,
    logoUrl: data.logoUrl,
    theme: data.theme,
    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
  };
}

export async function ensureChannel(storeId: string, channelId: string, metadata?: {
  title?: string;
  description?: string;
}): Promise<{ channelId: string; storeId: string; title?: string }> {
  const db = getFirestoreDb();

  const existingSnapshot = await db.collection('site_channels')
    .where('storeId', '==', storeId)
    .where('channelId', '==', channelId)
    .limit(1)
    .get();

  if (!existingSnapshot.empty) {
    const data = existingSnapshot.docs[0].data();
    return {
      channelId,
      storeId,
      title: metadata?.title || data.title,
    };
  }

  const now = new Date();
  await db.collection('site_channels').add({
    storeId,
    channelId,
    title: metadata?.title || channelId,
    description: metadata?.description || null,
    visibility: 'public',
    createdAt: now,
    updatedAt: now,
  });

  return {
    channelId,
    storeId,
    title: metadata?.title || channelId,
  };
}
