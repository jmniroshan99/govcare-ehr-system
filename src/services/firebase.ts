// Stable service-layer entry point. Firebase initialization remains centralized
// in lib/firebase.ts so the application never initializes duplicate SDK apps.
export {
  auth,
  db,
  firebaseApp,
  functions,
  hasFirebaseConfig,
  messagingPromise,
  storage,
} from "../lib/firebase";
