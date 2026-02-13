import type { IStorage } from '../storage';

export type StorageMode = 'firestore-only';

export function getStorageMode(): StorageMode {
  return 'firestore-only';
}

export async function createStorage(): Promise<IStorage> {
  const { FirestoreAdapter } = await import('./firestore-adapter');
  return new FirestoreAdapter();
}
