import { getFirestoreDb } from './firebase-admin';

export interface ProgramEntry {
  day: number;
  packetId?: string;
  title: string;
  description?: string;
  contentType?: 'image' | 'video' | 'text' | 'mixed';
  imageUrl?: string;
  videoUrl?: string;
  bodyText?: string;
}

export interface SiteProgram {
  programId: string;
  storeId: string;
  channelId?: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  scheduleType: 'day-sequence' | 'weekly' | 'custom';
  totalDays: number;
  entries: ProgramEntry[];
  status: 'draft' | 'published' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProgramInput {
  storeId: string;
  channelId?: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  scheduleType?: 'day-sequence' | 'weekly' | 'custom';
  entries?: ProgramEntry[];
}

const COLLECTION = 'site_programs';

export async function createProgram(input: CreateProgramInput): Promise<SiteProgram> {
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

  const docRef = await db.collection(COLLECTION).add(data);

  return {
    programId: docRef.id,
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

export async function getProgram(programId: string): Promise<SiteProgram | null> {
  const db = getFirestoreDb();
  const doc = await db.collection(COLLECTION).doc(programId).get();

  if (!doc.exists) return null;

  const data = doc.data()!;
  return {
    programId: doc.id,
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

export async function getProgramsByStore(storeId: string): Promise<SiteProgram[]> {
  const db = getFirestoreDb();
  const snapshot = await db.collection(COLLECTION)
    .where('storeId', '==', storeId)
    .orderBy('createdAt', 'desc')
    .limit(50)
    .get();

  return snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      programId: doc.id,
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
  });
}

export async function updateProgram(programId: string, updates: Partial<CreateProgramInput> & { status?: string }): Promise<boolean> {
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

    await db.collection(COLLECTION).doc(programId).update(updateData);
    return true;
  } catch (error) {
    console.error('[ProgramService] Update error:', error);
    return false;
  }
}

export async function deleteProgram(programId: string): Promise<boolean> {
  const db = getFirestoreDb();

  try {
    await db.collection(COLLECTION).doc(programId).delete();
    return true;
  } catch (error) {
    console.error('[ProgramService] Delete error:', error);
    return false;
  }
}

export async function getProgramMoments(programId: string): Promise<{ program: SiteProgram; moments: ProgramEntry[] } | null> {
  const program = await getProgram(programId);
  if (!program) return null;

  return {
    program,
    moments: program.entries.sort((a, b) => a.day - b.day),
  };
}
