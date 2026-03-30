import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// For local development with emulators, use "demo-" prefix project ID
// For production, replace with your real Firebase config
const firebaseConfig = {
  apiKey: "demo-key",
  authDomain: "demo-worklog.firebaseapp.com",
  projectId: "demo-worklog",
  storageBucket: "demo-worklog.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Connect to emulators in development
if (import.meta.env.DEV) {
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
    connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  } catch {
    // Already connected
  }
}
