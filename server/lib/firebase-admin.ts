import * as admin from 'firebase-admin';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let db: Firestore | null = null;
let initialized = false;

export function initializeFirebase(): Firestore {
  if (initialized && db) {
    return db;
  }

  try {
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
    
    if (!projectId) {
      throw new Error('Firebase project ID not configured. Set VITE_FIREBASE_PROJECT_ID or FIREBASE_PROJECT_ID');
    }

    // Check if we have a service account key
    const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccountKey) {
      // Parse the service account JSON from environment variable
      const serviceAccount = JSON.parse(serviceAccountKey);
      
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId,
        });
      }
      console.log('[Firebase] Initialized with service account credentials');
    } else {
      // Try to initialize with Application Default Credentials (for Cloud Functions, etc.)
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId,
        });
      }
      console.log('[Firebase] Initialized with default credentials (limited access)');
    }

    db = getFirestore();
    initialized = true;
    
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

export function isFirebaseInitialized(): boolean {
  return initialized && db !== null;
}

export { admin };
