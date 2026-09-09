import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId
);

const app = !getApps().length
  ? isFirebaseConfigured
    ? initializeApp(firebaseConfig)
    : null
  : getApp();

export const auth: Auth | null = app ? getAuth(app) : null;
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function loginWithGoogle() {
  if (!auth) {
    throw new Error("Firebase is not yet configured. Please set your Firebase environment variables in .env.local.");
  }
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
  };
}

export async function loginWithEmailFirebase(email: string, pass: string) {
  if (!auth) {
    throw new Error("Firebase is not yet configured. Please set your Firebase environment variables in .env.local.");
  }
  const result = await signInWithEmailAndPassword(auth, email, pass);
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
  };
}

export async function registerWithEmailFirebase(email: string, pass: string) {
  if (!auth) {
    throw new Error("Firebase is not yet configured. Please set your Firebase environment variables in .env.local.");
  }
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
  };
}

export async function logoutFirebase() {
  if (auth) {
    await signOut(auth);
  }
}
