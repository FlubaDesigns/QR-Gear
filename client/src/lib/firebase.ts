import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

if (!projectId || !apiKey || !appId) {
  console.error("Firebase configuration missing. Required: VITE_FIREBASE_PROJECT_ID, VITE_FIREBASE_API_KEY, VITE_FIREBASE_APP_ID");
}

const firebaseConfig = {
  apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${projectId}.firebaseapp.com`,
  projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${projectId}.appspot.com`,
  appId,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export default app;
