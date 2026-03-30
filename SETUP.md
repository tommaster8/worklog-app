# הגדרת המערכת - מדריך התחלה

## שלב 1: יצירת פרויקט Firebase

1. גש ל-[https://console.firebase.google.com](https://console.firebase.google.com)
2. לחץ **"Create project"** → הזן שם (למשל `worklog-business`)
3. בתוך הפרויקט, לחץ **"Web"** (סמל </>) → הוסף אפליקציה
4. העתק את ה-**firebaseConfig** שמופיע

## שלב 2: עדכון הקונפיגורציה

פתח את הקובץ `src/firebase.js` והחלף את הערכים:

```js
const firebaseConfig = {
  apiKey: "...",          // ← שים כאן את הערכים מ-Firebase
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "...",
};
```

## שלב 3: הגדרת Firestore

1. ב-Firebase Console → **Firestore Database** → **Create database**
2. בחר **"Start in production mode"**
3. בחר אזור (europe-west1 מומלץ)
4. עבור לטאב **Rules** → הדבק את תוכן קובץ `firestore.rules`

## שלב 4: יצירת חשבון אדמין

1. ב-Firebase Console → **Authentication** → **Sign-in method**
2. הפעל **Email/Password**
3. עבור לטאב **Users** → **Add user**
4. הזן: אימייל וסיסמה עבור אבא (למשל `admin@worklog.com`)

## שלב 5: הרצה מקומית

```bash
cd worklog-app
npm run dev
```

האתר יפתח בכתובת: http://localhost:5173

## שלב 6: העלאה לאינטרנט (Vercel)

1. צור חשבון ב-[vercel.com](https://vercel.com)
2. חבר לחשבון GitHub שלך
3. העלה את תיקיית `worklog-app` לריפוזיטורי GitHub
4. ב-Vercel → **New Project** → בחר את הריפוזיטורי
5. לחץ **Deploy** - האתר יהיה חי תוך דקה!

## איך להשתמש

### עובדים
- כנס לאתר → הזן מספר טלפון
- לחץ "התחל יום עבודה" להתחיל
- לחץ "סיים יום עבודה" בסוף היום → בחר מפעל + פרויקט + תיאור

### אדמין
- כנס ל-`/admin/login` → הזן אימייל + סיסמה
- ניהול עובדים: `/admin/employees`
- ניהול מפעלים: `/admin/factories`
- ניהול פרויקטים: `/admin/projects`
- דוחות + ייצוא: `/admin/reports`
