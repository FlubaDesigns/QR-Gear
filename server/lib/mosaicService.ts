import { getFirestoreDb } from './firebase-admin';

const MOSAICS_COLLECTION = 'site_programs';

export interface MosaicEntry {
  day: number;
  packetId?: string;
  title: string;
  description?: string;
  contentType?: 'image' | 'video' | 'text' | 'mixed';
  imageUrl?: string;
  videoUrl?: string;
  bodyText?: string;
}

export interface Mosaic {
  mosaicId: string;
  storeId: string;
  channelId?: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  scheduleType: 'day-sequence' | 'weekly' | 'custom';
  totalDays: number;
  entries: MosaicEntry[];
  status: 'draft' | 'published' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateMosaicInput {
  storeId: string;
  channelId?: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  scheduleType?: 'day-sequence' | 'weekly' | 'custom';
  entries?: MosaicEntry[];
}

export async function createMosaic(input: CreateMosaicInput): Promise<Mosaic> {
  const db = getFirestoreDb();
  const now = new Date();

  const data: Record<string, any> = {
    storeId: input.storeId,
    channelId: input.channelId || null,
    title: input.title,
    description: input.description || null,
    coverImageUrl: input.coverImageUrl || null,
    scheduleType: input.scheduleType || 'day-sequence',
    totalDays: input.entries?.length || 0,
    entries: input.entries || [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await db.collection(MOSAICS_COLLECTION).add(data);

  return {
    mosaicId: docRef.id,
    storeId: input.storeId,
    channelId: input.channelId,
    title: input.title,
    description: input.description,
    coverImageUrl: input.coverImageUrl,
    scheduleType: data.scheduleType,
    totalDays: data.totalDays,
    entries: data.entries,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
  };
}

function docToMosaic(doc: FirebaseFirestore.DocumentSnapshot): Mosaic {
  const data = doc.data()!;
  return {
    mosaicId: doc.id,
    storeId: data.storeId,
    channelId: data.channelId,
    title: data.title,
    description: data.description,
    coverImageUrl: data.coverImageUrl,
    scheduleType: data.scheduleType || 'day-sequence',
    totalDays: data.totalDays || 0,
    entries: data.entries || [],
    status: data.status || 'draft',
    createdAt: data.createdAt?.toDate?.() || new Date(data.createdAt),
    updatedAt: data.updatedAt?.toDate?.() || new Date(data.updatedAt),
  };
}

export async function getMosaic(mosaicId: string): Promise<Mosaic | null> {
  const db = getFirestoreDb();
  const doc = await db.collection(MOSAICS_COLLECTION).doc(mosaicId).get();
  if (!doc.exists) return null;
  return docToMosaic(doc);
}

export async function getMosaicsByStore(storeId: string): Promise<Mosaic[]> {
  const db = getFirestoreDb();
  const snapshot = await db.collection(MOSAICS_COLLECTION)
    .where('storeId', '==', storeId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return snapshot.docs.map(docToMosaic);
}

export async function updateMosaic(mosaicId: string, updates: Partial<CreateMosaicInput> & { status?: string }): Promise<boolean> {
  const db = getFirestoreDb();

  try {
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.coverImageUrl !== undefined) updateData.coverImageUrl = updates.coverImageUrl;
    if (updates.scheduleType !== undefined) updateData.scheduleType = updates.scheduleType;
    if (updates.channelId !== undefined) updateData.channelId = updates.channelId;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.entries !== undefined) {
      updateData.entries = updates.entries;
      updateData.totalDays = updates.entries.length;
    }

    await db.collection(MOSAICS_COLLECTION).doc(mosaicId).update(updateData);
    return true;
  } catch (error) {
    console.error('[MosaicService] Update error:', error);
    return false;
  }
}

export async function deleteMosaic(mosaicId: string): Promise<boolean> {
  const db = getFirestoreDb();

  try {
    await db.collection(MOSAICS_COLLECTION).doc(mosaicId).delete();
    return true;
  } catch (error) {
    console.error('[MosaicService] Delete error:', error);
    return false;
  }
}

export async function getMosaicMoments(mosaicId: string): Promise<{ mosaic: Mosaic; moments: MosaicEntry[] } | null> {
  const mosaic = await getMosaic(mosaicId);
  if (!mosaic) return null;

  return {
    mosaic,
    moments: mosaic.entries.sort((a, b) => a.day - b.day),
  };
}
