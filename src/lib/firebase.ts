import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";
import { getMessaging, isSupported } from "firebase/messaging";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

declare global {
  interface Window {
    __govcareFirestoreEmulatorConnected?: boolean;
    __govcareAuthEmulatorConnected?: boolean;
    __govcareFunctionsEmulatorConnected?: boolean;
  }
}

export const hasFirebaseConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
export const firebaseApp = hasFirebaseConfig ? initializeApp(firebaseConfig) : null;

if (firebaseApp && import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY) {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = firebaseApp ? getAuth(firebaseApp) : null;
export const db = firebaseApp ? initializeFirestore(firebaseApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}) : null;
export const storage = firebaseApp ? getStorage(firebaseApp) : null;
export const functions = firebaseApp ? getFunctions(firebaseApp, import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1") : null;
export const messagingPromise = firebaseApp ? isSupported().then((supported) => (supported ? getMessaging(firebaseApp) : null)) : Promise.resolve(null);

const useEmulators = import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATORS === "true";

if (auth && useEmulators && !window.__govcareAuthEmulatorConnected) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  window.__govcareAuthEmulatorConnected = true;
}

if (functions && useEmulators && !window.__govcareFunctionsEmulatorConnected) {
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  window.__govcareFunctionsEmulatorConnected = true;
}

if (db && useEmulators && !window.__govcareFirestoreEmulatorConnected) {
  connectFirestoreEmulator(db, "127.0.0.1", 8081);
  window.__govcareFirestoreEmulatorConnected = true;
}
