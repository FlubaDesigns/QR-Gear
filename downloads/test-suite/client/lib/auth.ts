/**
 * Authentication Hook (Firebase Stub)
 * 
 * This is a placeholder for Firebase Authentication.
 * Replace with actual Firebase auth when ready.
 * 
 * To integrate Firebase:
 * 1. Install: npm install firebase
 * 2. Initialize Firebase app in this file
 * 3. Replace stub logic with firebase.auth()
 * 4. Update User interface with Firebase user properties
 */

import { useState, useEffect } from "react";

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Replace with Firebase auth state listener
    // firebase.auth().onAuthStateChanged((firebaseUser) => {
    //   if (firebaseUser) {
    //     setUser({
    //       uid: firebaseUser.uid,
    //       email: firebaseUser.email,
    //       displayName: firebaseUser.displayName,
    //       photoURL: firebaseUser.photoURL,
    //     });
    //   } else {
    //     setUser(null);
    //   }
    //   setLoading(false);
    // });

    // Stub: Provide default demo user for development
    const demoUser = localStorage.getItem("demo-user");
    if (demoUser) {
      setUser(JSON.parse(demoUser));
    } else {
      // Auto-login as demo user for development
      const defaultDemoUser: User = {
        uid: "demo-user-123",
        email: "demo@qrgear.com",
        displayName: "Demo User",
        photoURL: null,
      };
      localStorage.setItem("demo-user", JSON.stringify(defaultDemoUser));
      setUser(defaultDemoUser);
    }
    setLoading(false);
  }, []);

  const signIn = async (email: string, password: string) => {
    // TODO: Replace with Firebase signInWithEmailAndPassword
    // await firebase.auth().signInWithEmailAndPassword(email, password);
    
    // Stub implementation
    const demoUser: User = {
      uid: "demo-user-123",
      email: email,
      displayName: email.split("@")[0],
      photoURL: null,
    };
    localStorage.setItem("demo-user", JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const signOut = async () => {
    // TODO: Replace with Firebase signOut
    // await firebase.auth().signOut();
    
    // Stub implementation
    localStorage.removeItem("demo-user");
    setUser(null);
  };

  return { user, loading, signIn, signOut };
}
