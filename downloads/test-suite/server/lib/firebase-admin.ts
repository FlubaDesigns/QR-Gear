import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import { getAuth, Auth } from 'firebase-admin/auth';

let db: Firestore | null = null;
let storageInstance: Storage | null = null;
let initialized = false;
let app: App | null = null;

export function initializeFirebase(): Firestore {
  if (initialized && db) {
    return db;
  }

  try {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      throw new Error('Firebase project ID not configured. Set VITE_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID environment variable.');
    }
    
    // Check if we have a service account key
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    const existingApps = getApps();
    
    if (existingApps.length === 0) {
      if (serviceAccountKey) {
        // Parse the service account JSON from environment variable
        let serviceAccount;
        try {
          serviceAccount = JSON.parse(serviceAccountKey);
        } catch (parseError) {
          console.error('[Firebase] Failed to parse service account key:', parseError);
          throw new Error('Invalid FIREBASE_SERVICE_ACCOUNT_KEY format - must be valid JSON');
        }
        
        app = initializeApp({
          credential: cert(serviceAccount),
          projectId,
        });
        console.log('[Firebase] Initialized with service account credentials for project:', projectId);
      } else {
        // Try to initialize with Application Default Credentials
        app = initializeApp({
          projectId,
        });
        console.log('[Firebase] Initialized with default credentials (limited access)');
      }
    } else {
      app = existingApps[0];
      console.log('[Firebase] Using existing app instance');
    }

    db = getFirestore();
    storageInstance = getStorage();
    initialized = true;
    
    console.log('[Firebase] Storage bucket:', getStorageBucketName());
    
    return db;
  } catch (error) {
    console.error('[Firebase] Initialization error:', error);
    throw error;
  }
}

export function getFirestoreDb(): Firestore {
  if (!db) {
    return initializeFirebase();
  }
  return db;
}

export function getFirebaseStorage(): Storage {
  if (!storageInstance) {
    initializeFirebase();
  }
  return storageInstance!;
}

export function getStorageBucket() {
  const storage = getFirebaseStorage();
  const bucketName = getStorageBucketName();
  return storage.bucket(bucketName);
}

export function getStorageBucketName(): string {
  return process.env.VITE_FIREBASE_STORAGE_BUCKET || 
         process.env.FIREBASE_STORAGE_BUCKET || 
         `${process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID}.firebasestorage.app`;
}

export function isFirebaseInitialized(): boolean {
  return initialized && db !== null;
}

export function getFirebaseAuth(): Auth {
  if (!initialized) {
    initializeFirebase();
  }
  return getAuth();
}

export async function verifyFirebaseToken(idToken: string) {
  try {
    const auth = getFirebaseAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('[Firebase Auth] Token verification failed:', error);
    return null;
  }
}
