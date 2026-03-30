# worklog-app — מערכת ניהול שעות עבודה

## מה זה?
אפליקציית ווב לניהול שעות עבודה חודשיות לעסק משפחתי.
- **עובדים** נכנסים עם מספר טלפון בלבד, מתחילים/מסיימים יום עבודה, רואים סטטיסטיקות
- **אדמין** (אבא — g.rubin.2012@gmail.com) מנהל עובדים/מפעלים/פרויקטים, רואה דוחות ומייצא Excel

## הרצת סביבת פיתוח

**דורש 2 טרמינלים נפרדים:**

**טרמינל 1 — Firebase Emulators (Auth + Firestore):**
```bash
cd worklog-app
npm run emulators
```
ממתין עד שמופיע: `✔ All emulators ready!`
- Firestore: localhost:8080
- Auth: localhost:9099
- Emulator UI: http://localhost:4000

**טרמינל 2 — האפליקציה:**
```bash
cd worklog-app
npm run dev
```
- מחשב: http://localhost:5173
- טלפון (אותה רשת WiFi): http://192.168.0.100:5173

> **חשוב:** Java ו-Node.js הותקנו (Microsoft OpenJDK 21 + Node.js v24). Firebase CLI מותקן גלובלית.
> אם האמולטורים לא עולים — ודא ש-Java בנתיב: `C:/Program Files/Microsoft/jdk-21.0.10.7-hotspot/bin`

## פרטי כניסה (סביבת פיתוח)

| תפקיד | פרטים |
|-------|--------|
| אדמין | g.rubin.2012@gmail.com / noy654 |
| עובד — אמין (בלעדי) | 0547515894 |
| עובד — ישראל ישראלי | 0501234567 |
| עובד — משה כהן | 0521234567 |

## Stack טכנולוגי

| שכבה | טכנולוגיה |
|------|-----------|
| Frontend | React 19 + Vite 8 |
| Styling | TailwindCSS v4 |
| Database | Firebase Firestore (emulator בפיתוח) |
| Auth | Firebase Auth (emulator בפיתוח) |
| Export | SheetJS (xlsx) |

## מבנה Firestore

```
employees/    { name, phone, active }

factories/    { name, active }

projects/     {
  name, factoryId, factoryName,
  active,     ← true = פעיל
  completed,  ← true = הושלם
  future      ← true = עתידי (טרם התחיל)
}

workSessions/ {
  employeeId, employeeName, employeePhone,
  factoryId, factoryName,
  projectId, projectName,
  description,
  startTime (Timestamp), endTime (Timestamp | null),
  durationSeconds,   ← זמן בשניות (שדה עיקרי)
  durationMinutes,   ← legacy בלבד — getSecs() מטפל בתאימות לאחור
  date (YYYY-MM-DD)
}

absences/     {
  employeeId, employeeName,
  date (YYYY-MM-DD),
  type ("חופש" | "מחלה" | "אחר"),
  note (אופציונלי),
  createdAt (Timestamp)
}
```

## Routes

| נתיב | תיאור |
|------|-------|
| `/` | כניסת עובד (מספר טלפון) |
| `/dashboard` | לוח עובד — טיימר + היסטוריה |
| `/admin/login` | כניסת אדמין |
| `/admin` | דשבורד אדמין — סיכום שעות לפי חודש |
| `/admin/employees` | ניהול עובדים |
| `/admin/factories` | ניהול מפעלים |
| `/admin/projects` | ניהול פרויקטים + פילטר סטטוסים |
| `/admin/reports` | דוחות + ייצוא Excel + עריכת רשומות |
| `/admin/attendance` | לוח נוכחות חודשי + סימון היעדרויות |

## קבצים מרכזיים

```
src/
  firebase.js                    — הגדרת Firebase + חיבור לאמולטורים
  App.jsx                        — ניתוב + הגנת routes אדמין
  pages/
    EmployeeLogin.jsx             — זיהוי עובד לפי טלפון
    EmployeeDashboard.jsx         — טיימר, סיום יום, היסטוריה
    AdminLogin.jsx                — כניסת אדמין
    admin/
      AdminDashboard.jsx          — סיכום שעות לפי חודש
      ManageEmployees.jsx         — CRUD עובדים
      ManageFactories.jsx         — CRUD מפעלים
      ManageProjects.jsx          — CRUD פרויקטים + סטטוסים + פילטר
      Reports.jsx                 — סינון טווח תאריכים + ייצוא Excel + עריכה
      Attendance.jsx              — לוח נוכחות + סימון היעדרויות
  components/
    AdminLayout.jsx               — layout + ניווט תחתון לאדמין
firestore.rules                  — כללי אבטחה
vite.config.js                   — server.host: true לגישה מהטלפון
seed.mjs                         — יצירת נתוני דוגמה לאמולטור
```

## החלטות עיצוב חשובות

- **השבתה במקום מחיקה** — עובדים/מפעלים/פרויקטים מושבתים ולא נמחקים, לשמירת היסטוריה
- **פרויקט ← מפעל** — כל פרויקט שייך למפעל אחד. בסיום יום: בוחרים מפעל → רק הפרויקטים שלו
- **גישה מוגבלת לאמין בלבד** — רק מספר 0547515894 יכול להיכנס לצד העובדים. כל מספר אחר נחסם בלוגין.
- **סימון עובדים בסוף יום** — אמין מסיים יום ומסמן אילו עובדים עבדו איתו. המערכת יוצרת workSession לכל עובד שנסמן עם אותם נתונים (שעות, מפעל, פרויקט).
- **ללא Auth לעובדים** — עובדים מזדהים עם מספר טלפון בלבד (sessionStorage)
- **durationSeconds** — זמן נשמר בשניות למדויקות. `getSecs(s)` מטפל בתאימות לאחור עם `durationMinutes`
- **Firestore rules** — workSessions מאפשר create+update ללא auth; absences + שאר דורשים auth

## סטטוסי פרויקט

| סטטוס | active | completed | future | מופיע לעובד? |
|-------|--------|-----------|--------|--------------|
| פעיל  | true   | false     | false  | ✅ כן |
| עתידי | false  | false     | true   | ❌ לא |
| הושלם | false  | true      | false  | ❌ לא |
| לא פעיל | false | false   | false  | ❌ לא |

## פיצ'רים שנוספו

- **טווח תאריכים בדוחות** — dateFrom + dateTo במקום חודש בלבד
- **מניעת כפל sessions** — בדיקת Firestore לפני פתיחת session חדש
- **לוח נוכחות** — גריד חודשי עם צביעה לפי ימי עבודה/היעדרות
- **היעדרויות** — סימון חופש/מחלה/אחר על ימים בלוח הנוכחות
- **סטטוסי פרויקט** — פעיל / עתידי / הושלם / לא פעיל + פילטר tabs
- **גישה מטלפון** — vite.config.js מגדיר host:true, גישה דרך רשת מקומית (כתובת רשת: http://192.168.68.106:5173)

## מה עוד לא הושלם

- [ ] חיבור ל-Firebase אמיתי — כרגע הכל רץ רק באמולטור מקומי
- [ ] העלאה ל-Vercel/Firebase Hosting
