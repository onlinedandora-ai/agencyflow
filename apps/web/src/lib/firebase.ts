import { initializeApp, getApps, getApp, FirebaseError } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  type Auth,
} from "firebase/auth";

import { initializeAppCheck, ReCaptchaV3Provider, type AppCheck } from "firebase/app-check";

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
googleProvider.addScope("email");
googleProvider.addScope("profile");

export let appCheck: AppCheck | null = null;
if (typeof window !== "undefined" && app && process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY) {
  try {
    if (process.env.NODE_ENV !== "production") {
      // @ts-expect-error App Check debug mode for local testing
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
    }
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(process.env.NEXT_PUBLIC_FIREBASE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn("Firebase App Check failed to initialize:", err);
  }
}

export function getFirebaseErrorMessage(error: unknown): string {
  if (!error) return "An unexpected error occurred.";
  const fbErr = error as Partial<FirebaseError>;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "agencyflow-web";
  const consoleAuthUrl = `https://console.firebase.google.com/project/${projectId}/authentication`;

  switch (fbErr.code) {
    case "auth/configuration-not-found":
      return `Google Sign-in is not yet enabled for project "${projectId}". In Firebase Console, go to Authentication > Sign-in method, click Google, toggle Enable, select a support email, and click Save. (${consoleAuthUrl}/providers)`;
    case "auth/operation-not-allowed":
      return `This sign-in provider is disabled in Firebase Console. Please enable it under Authentication > Sign-in method. (${consoleAuthUrl}/providers)`;
    case "auth/unauthorized-domain": {
      const currentHost = typeof window !== "undefined" ? window.location.hostname : "this domain";
      return `Domain "${currentHost}" is not authorized. Please add "${currentHost}" in Firebase Console -> Authentication -> Settings -> Authorized domains. (${consoleAuthUrl}/settings)`;
    }
    case "auth/popup-blocked":
      return "Sign-in popup was blocked by your browser. Please allow popups for this site, or try again.";
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed before completing.";
    case "auth/cancelled-popup-request":
      return "Only one sign-in attempt can be active at a time.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Invalid email or password. Please verify your credentials.";
    case "auth/user-not-found":
      return "No account found with this email. Please sign up first.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Password is too weak. Please use at least 6 characters.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/network-request-failed":
      return "Network connection issue. Please check your internet connection.";
    default:
      return fbErr.message || "Authentication failed. Please try again.";
  }
}

export async function loginWithGoogle() {
  if (!auth) {
    throw new Error("Firebase is not yet configured. Please verify your environment variables.");
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return {
      user: result.user,
      idToken,
    };
  } catch (err: unknown) {
    const fbErr = err as Partial<FirebaseError>;
    if (fbErr.code === "auth/popup-blocked") {
      // Browser blocked popup — fallback to redirect
      await signInWithRedirect(auth, googleProvider);
      return null;
    }
    throw err;
  }
}

export async function checkGoogleRedirectResult() {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      const idToken = await result.user.getIdToken();
      return {
        user: result.user,
        idToken,
      };
    }
    return null;
  } catch (err) {
    throw err;
  }
}

export async function loginWithEmailFirebase(email: string, pass: string) {
  if (!auth) {
    throw new Error("Firebase is not yet configured. Please verify your environment variables.");
  }
  const result = await signInWithEmailAndPassword(auth, email, pass);
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
  };
}

export async function registerWithEmailFirebase(email: string, pass: string, displayName?: string) {
  if (!auth) {
    throw new Error("Firebase is not yet configured. Please verify your environment variables.");
  }
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName && result.user) {
    try {
      await updateProfile(result.user, { displayName });
    } catch {
      // Non-fatal if profile update fails
    }
  }
  const idToken = await result.user.getIdToken();
  return {
    user: result.user,
    idToken,
  };
}

export async function resetPasswordFirebase(email: string) {
  if (!auth) {
    throw new Error("Firebase is not yet configured. Please verify your environment variables.");
  }
  await sendPasswordResetEmail(auth, email);
}

export async function logoutFirebase() {
  if (auth) {
    await signOut(auth);
  }
}
