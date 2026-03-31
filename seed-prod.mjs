/**
 * Seed script for PRODUCTION Firebase
 * Run: node seed-prod.mjs
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCiHe702cM96FUfMHRLpV1oEDdvR3MIODg",
  authDomain: "worklog-prod-9133d.firebaseapp.com",
  projectId: "worklog-prod-9133d",
  storageBucket: "worklog-prod-9133d.firebasestorage.app",
  messagingSenderId: "867573316659",
  appId: "1:867573316659:web:894288cd37cb937404f746",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function seed() {
  console.log("🌱 מוסיף נתונים ל-Firebase אמיתי...");

  // יצירת אדמין
  try {
    await createUserWithEmailAndPassword(auth, "g.rubin.2012@gmail.com", "noy654");
    console.log("✅ אדמין נוצר: g.rubin.2012@gmail.com");
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      console.log("ℹ️  אדמין כבר קיים");
    } else {
      console.error("❌ שגיאה:", e.message);
    }
  }

  // הוספת אמין
  await addDoc(collection(db, "employees"), { name: "אמין", phone: "0547515894", active: true });
  console.log("👷 עובד נוסף: אמין - 0547515894");

  // הוספת מפעל לדוגמה
  const factoryRef = await addDoc(collection(db, "factories"), { name: "מפעל ראשי", active: true });
  console.log("🏭 מפעל נוסף: מפעל ראשי");

  // הוספת פרויקט לדוגמה
  await addDoc(collection(db, "projects"), {
    name: "פרויקט כללי",
    factoryId: factoryRef.id,
    factoryName: "מפעל ראשי",
    active: true,
    completed: false,
    future: false,
  });
  console.log("📋 פרויקט נוסף: פרויקט כללי");

  console.log("\n✅ סיום! האפליקציה מוכנה לשימוש.");
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
