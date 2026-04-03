# worklog-app — מערכת ניהול שעות עבודה

## מה זה?
אפליקציית ווב לניהול שעות עבודה חודשיות לעסק משפחתי.
- **אמין בלבד** — נכנס עם מספר 0547515894, מתחיל/מסיים יום, בסוף יום מסמן אילו עובדים עבדו איתו
- **אדמין** (אבא — g.rubin.2012@gmail.com) מנהל עובדים/מפעלים/פרויקטים, רואה דוחות ומייצא Excel

## פריסה (Production)

- **GitHub:** https://github.com/tommaster8/worklog-app
- **Vercel:** מחובר לגיטהאב — כל `git push` מפעיל בנייה אוטומטית
- **Firebase:** worklog-prod-9133d (Firestore + Auth)

זרימה: קבצים מקומיים → `git push` → GitHub → Vercel (בנייה אוטומטית) → אפליקציה חיה

## הרצת סביבת פיתוח

**דורש 2 טרמינלים נפרדים:**

**טרמינל 1 — Firebase Emulators:**
```bash
cd worklog-app
npm run emulators
```
ממתין עד: `✔ All emulators ready!`

**טרמינל 2 — האפליקציה:**
```bash
cd worklog-app
npm run dev
```
- מחשב: http://localhost:5173
- טלפון (אותה רשת): http://192.168.68.106:5173

> **חשוב:** Java ו-Node.js הותקנו (Microsoft OpenJDK 21 + Node.js v24). Firebase CLI מותקן גלובלית.
> אם האמולטורים לא עולים — ודא Java בנתיב: `C:/Program Files/Microsoft/jdk-21.0.10.7-hotspot/bin`

## פרטי כניסה

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
| Database | Firebase Firestore (production: worklog-prod-9133d) |
| Auth | Firebase Auth |
| Export | SheetJS (xlsx) |
| Hosting | Vercel (מחובר ל-GitHub) |

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
| `/admin` | דשבורד אדמין — סיכום חודשי + סטטוס היום |
| `/admin/employees` | ניהול עובדים |
| `/admin/factories` | ניהול מפעלים |
| `/admin/projects` | ניהול פרויקטים + פילטר סטטוסים |
| `/admin/reports` | דוחות + ייצוא Excel + עריכת רשומות |
| `/admin/attendance` | לוח נוכחות חודשי + פופאפ יום + סימון היעדרויות |

## קבצים מרכזיים

```
src/
  firebase.js                    — הגדרת Firebase (production config)
  App.jsx                        — ניתוב + הגנת routes אדמין
  pages/
    EmployeeLogin.jsx             — כניסה לפי טלפון (מוגבל ל-0547515894 בלבד)
    EmployeeDashboard.jsx         — טיימר, סיום יום + סימון עובדים, היסטוריה
    AdminLogin.jsx                — כניסת אדמין
    admin/
      AdminDashboard.jsx          — סיכום חודשי + סטטוס היום (מקובץ לפי מפעל/פרויקט)
      ManageEmployees.jsx         — CRUD עובדים
      ManageFactories.jsx         — CRUD מפעלים
      ManageProjects.jsx          — CRUD פרויקטים + סטטוסים + פילטר
      Reports.jsx                 — סינון + ייצוא Excel + עריכה + tooltip תיאור
      Attendance.jsx              — לוח נוכחות + פופאפ יום (מי עבד/לא) + היעדרויות
  components/
    AdminLayout.jsx               — layout + ניווט תחתון לאדמין
firestore.rules                  — כללי אבטחה (production)
vercel.json                      — rewrites לתמיכה ב-React Router
seed.mjs                         — נתוני דוגמה לאמולטור
seed-prod.mjs                    — נתוני אתחול ל-Firebase production
```

## החלטות עיצוב חשובות

- **גישה מוגבלת לאמין בלבד** — רק 0547515894 יכול להיכנס לצד העובדים
- **סימון עובדים בסוף יום** — אמין מסמן מי עבד איתו → workSession נוצר לכל עובד עם אותם שעות/מפעל/פרויקט
- **שעות לא מוכפלות** — בדשבורד ובפופאפ: שעות מוצגות פעם אחת (לא כפול מספר העובדים)
- **קיבוץ לפי מפעל+פרויקט** — בסטטוס היום ובפופאפ נוכחות: עובדים מוצגים בשורה אחת עם פסיקים
- **סינון client-side** — כל שאילתות Firestore ללא orderBy מורכב (למניעת דרישת composite index)
- **השבתה במקום מחיקה** — עובדים/מפעלים/פרויקטים מושבתים ולא נמחקים
- **ללא Auth לעובדים** — זיהוי לפי טלפון בלבד (sessionStorage)
- **durationSeconds** — `getSecs(s)` מטפל בתאימות לאחור עם `durationMinutes`

## סטטוסי פרויקט

| סטטוס | active | completed | future | מופיע לעובד? |
|-------|--------|-----------|--------|--------------|
| פעיל  | true   | false     | false  | ✅ כן |
| עתידי | false  | false     | true   | ❌ לא |
| הושלם | false  | true      | false  | ❌ לא |
| לא פעיל | false | false   | false  | ❌ לא |

## פיצ'רים עיקריים

- **סטטוס היום** — בדשבורד אדמין: מי עבד (שמות, מפעל, פרויקט, שעות) ומי לא
- **פופאפ יום בנוכחות** — לחיצה על כל יום בלוח → פופאפ עם כל העובדים + אפשרות סימון היעדרות
- **tooltip תיאור בדוחות** — ריחוף מעל שורה מציג את תיאור העבודה
- **ייצוא Excel** — דוחות עם פילטר תאריכים
- **לוח נוכחות** — גריד חודשי עם צביעה לפי עבד/חופש/מחלה
