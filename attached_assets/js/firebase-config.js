// js/firebase-config.js - Auto-configured for Kingdom Connects
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

let db, auth, storage;

// Fetch Firebase config from server (uses Replit secrets)
async function initializeFirebase() {
  try {
    const response = await fetch('/firebase-config.json');
    const firebaseConfig = await response.json();
    
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    storage = getStorage(app);
    
    console.log('✅ Firebase initialized successfully for Kingdom Connects');
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error);
    throw error;
  }
}

// Initialize immediately
await initializeFirebase();

export { db, auth, storage };
