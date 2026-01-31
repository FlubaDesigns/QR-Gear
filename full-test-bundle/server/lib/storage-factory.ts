import type { IStorage } from '../storage';

export type StorageMode = 'postgres-only' | 'dual-write' | 'firestore-only';

export interface StorageFactory {
  getStorage(): IStorage;
  getMode(): StorageMode;
}

let currentMode: StorageMode = 'postgres-only';
let storageInstance: IStorage | null = null;

export function getStorageMode(): StorageMode {
  // Default to firestore-only for Firebase independence (no Replit dependencies)
  const envMode = (process.env.STORAGE_MODE || 'firestore-only') as StorageMode;
  if (['postgres-only', 'dual-write', 'firestore-only'].includes(envMode)) {
    return envMode;
  }
  return 'firestore-only';
}

export function setStorageMode(mode: StorageMode): void {
  if (mode !== currentMode) {
    currentMode = mode;
    storageInstance = null; // Force recreation
    console.log(`[StorageFactory] Mode changed to: ${mode}`);
  }
}

export async function createStorage(): Promise<IStorage> {
  if (storageInstance && getStorageMode() === currentMode) {
    return storageInstance;
  }
  
  currentMode = getStorageMode();
  console.log(`[StorageFactory] Creating storage with mode: ${currentMode}`);
  
  switch (currentMode) {
    case 'postgres-only': {
      // Import dynamically to avoid circular dependencies
      const { storage } = await import('../storage');
      storageInstance = storage;
      break;
    }
    
    case 'firestore-only': {
      const { FirestoreAdapter } = await import('./firestore-adapter');
      storageInstance = new FirestoreAdapter();
      break;
    }
    
    case 'dual-write': {
      const { storage } = await import('../storage');
      const { FirestoreAdapter } = await import('./firestore-adapter');
      const { DualWriteAdapter } = await import('./dual-write-adapter');
      const firestoreAdapter = new FirestoreAdapter();
      storageInstance = new DualWriteAdapter(storage, firestoreAdapter);
      break;
    }
    
    default:
      throw new Error(`Unknown storage mode: ${currentMode}`);
  }
  
  return storageInstance;
}

export function getStorageSync(): IStorage | null {
  return storageInstance;
}
