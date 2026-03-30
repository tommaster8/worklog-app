/**
 * Seed script - runs against Firebase emulators to create initial data
 * Run: node seed.mjs
 * (Make sure emulators are running first: npm run emulators)
 */

import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator, collection, addDoc, setDoc, doc } from "firebase/firestore";
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "demo-key",
  projectId: "demo-worklog",
  authDomain: "demo-worklog.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

connectFirestoreEmulator(db, "localhost", 8080);
connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });

async function seed() {
  console.log("🌱 Starting seed...");

  // Create admin user
  try {
    const cred = await createUserWithEmailAndPassword(auth, "g.rubin.2012@gmail.com", "noy654");
    console.log("✅ Admin user created:", cred.user.email);
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      console.log("ℹ️  Admin user already exists");
    } else {
      console.error("❌ Auth error:", e.message);
    }
  }

  // Add sample factories
  const factories = ["מפעל אלפא", "מפעל בטא", "אתר גמא"];
  for (const name of factories) {
    await addDoc(collection(db, "factories"), { name, active: true });
    console.log("🏭 Factory:", name);
  }

  // Add sample projects
  const projects = ["פרויקט א'", "פרויקט ב'", "תחזוקה שוטפת"];
  for (const name of projects) {
    await addDoc(collection(db, "projects"), { name, active: true });
    console.log("📋 Project:", name);
  }

  // Add sample employees
  const employees = [
    { name: "אמין", phone: "0547515894" },
    { name: "ישראל ישראלי", phone: "0501234567" },
    { name: "משה כהן", phone: "0521234567" },
  ];
  for (const emp of employees) {
    await addDoc(collection(db, "employees"), { ...emp, active: true, createdAt: new Date() });
    console.log("👷 Employee:", emp.name, "-", emp.phone);
  }

  console.log("\n✅ Seed complete!");
  console.log("\n📋 Login details:");
  console.log("  Admin: admin@worklog.com / admin123456");
  console.log("  Employee test phones: 0501234567, 0521234567");

  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
