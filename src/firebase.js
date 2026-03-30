import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// For local development with emulators, use "demo-" prefix project ID
// For production, replace with your real Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCiHe702cM96FUfMHRLpV1oEDdvR3MIODg",
  authDomain: "worklog-prod-9133d.firebaseapp.com",
  projectId: "worklog-prod-9133d",
  storageBucket: "worklog-prod-9133d.firebasestorage.app",
  messagingSenderId: "867573316659",
  appId: "1:867573316659:web:894288cd37cb937404f746",
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
