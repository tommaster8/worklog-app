import { useState, useEffect } from "react";
import {
  collection, getDocs, addDoc, updateDoc, deleteDoc,
  doc, query, where, Timestamp
} from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

const HE_DAYS = ["א'", "ב'", "ג'", "ד'", "ה'", "ו'", "ש'"];

const ABSENCE_TYPES = [
  { value: "חופש", label: "🌴 חופש" },
  { value: "מחלה", label: "🤒 מחלה" },
  { value: "אחר",  label: "📝 אחר" },
];

function absenceBg(type) {
  if (type === "חופש") return "bg-orange-50";
  if (type === "מחלה") return "bg-red-50";
  return "bg-purple-50";
}
function absenceText(type) {
  if (type === "חופש") return "text-orange-600";
  if (type === "מחלה") return "text-red-500";
  return "text-purple-500";
}
function absenceLabel(type) {
  if (type === "חופש") return "🌴";
  if (type === "מחלה") return "🤒";
  return "📝";
}

function formatHours(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  if (h === 0) return m > 0 ? `${m}ד'` : `${totalSeconds % 60}ש"`;
  return m > 0 ? `${h}:${String(m).padStart(2, "0")}` : `${h}ש'`;
}

const getSecs = s => s.durationSeconds ?? (s.durationMinutes || 0) * 60;

export default function Attendance() {
  const [employees, setEmployees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [allAbsences, setAllAbsences] = useState([]); // כל ההיעדרויות בחודש, ללא סינון
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedEmployee, setSelectedEmployee] = useState("");

  // Day popup
  const [dayPopup, setDayPopup] = useState(null); // { date }

  // Absence modal (from within day popup)
  const [absenceModal, setAbsenceModal] = useState(null); // { date, employeeId, existing }
  const [modalType, setModalType] = useState("חופש");
  const [modalNote, setModalNote] = useState("");
  const [saving, setSaving] = useState(false);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    getDocs(query(collection(db, "employees"), where("active", "==", true)))
      .then(s => {
        const list = s.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => a.name.localeCompare(b.name, "he"));
        setEmployees(list);
      });
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const snap = await getDocs(query(
        collection(db, "workSessions"),
        where("endTime", "!=", null)
      ));
      setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  async function loadAbsences() {
    const monthStart = `${selectedMonth}-01`;
    const [y, m] = selectedMonth.split("-").map(Number);
    const monthEnd = `${selectedMonth}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
    const snap = await getDocs(query(
      collection(db, "absences"),
      where("date", ">=", monthStart),
      where("date", "<=", monthEnd)
    ));
    setAllAbsences(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }

  useEffect(() => { loadAbsences(); }, [selectedMonth]);

  // Sessions filtered by month + optional employee (for calendar)
  const filtered = sessions.filter(s => {
    if (!s.date?.startsWith(selectedMonth)) return false;
    if (selectedEmployee && s.employeeId !== selectedEmployee) return false;
    return true;
  });

  // Absences filtered by optional employee (for calendar)
  const absences = selectedEmployee
    ? allAbsences.filter(a => a.employeeId === selectedEmployee)
    : allAbsences;

  // Map: date → { secs, count }
  const dayMap = {};
  filtered.forEach(s => {
    if (!dayMap[s.date]) dayMap[s.date] = { secs: 0, count: 0 };
    dayMap[s.date].secs += getSecs(s);
    dayMap[s.date].count += 1;
  });

  // Map: date → { id, type, note } (for calendar, filtered by selectedEmployee)
  const absenceMap = {};
  absences.forEach(a => {
    absenceMap[a.date] = { id: a.id, type: a.type, note: a.note || "", employeeId: a.employeeId };
  });

  // Calendar grid
  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfWeek = new Date(year, month - 1, 1).getDay();
  const cells = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const totalDaysWorked = Object.keys(dayMap).length;
  const totalSecs = Object.values(dayMap).reduce((a, v) => a + v.secs, 0);
  const totalAbsences = absences.length;

  // פתיחת פופאפ יום
  function openDayPopup(dateStr) {
    if (dateStr > today) return;
    setDayPopup({ date: dateStr });
  }

  // נתוני פופאפ יום — מקובץ לפי מפעל+פרויקט
  function getDayData(date) {
    const daySessions = sessions.filter(s => s.date === date && s.endTime != null);
    const dayAbsencesAll = allAbsences.filter(a => a.date === date);

    const workGroups = daySessions
      .filter(s => Array.isArray(s.coWorkers))
      .map(s => ({
        factoryName: s.factoryName || "—",
        projectName: s.projectName || "—",
        durationSecs: getSecs(s),
        description: s.description || "",
        workerNames: [
          employees.find(e => e.id === s.employeeId)?.name || s.employeeName || "—",
          ...(s.coWorkers || []),
        ].filter(Boolean),
      }));

    const workedIds = new Set(daySessions.map(s => s.employeeId));
    const didntWork = employees
      .filter(e => !workedIds.has(e.id))
      .map(e => ({ ...e, absence: dayAbsencesAll.find(a => a.employeeId === e.id) || null }));

    return { workGroups, didntWork };
  }

  // פתיחת מודל היעדרות
  function openAbsenceModal(date, employeeId, existing) {
    setModalType(existing?.type || "חופש");
    setModalNote(existing?.note || "");
    setAbsenceModal({ date, employeeId, existing: existing || null });
  }

  async function saveAbsence() {
    if (!absenceModal) return;
    setSaving(true);
    try {
      const emp = employees.find(e => e.id === absenceModal.employeeId);
      if (absenceModal.existing) {
        await updateDoc(doc(db, "absences", absenceModal.existing.id), {
          type: modalType, note: modalNote,
        });
      } else {
        await addDoc(collection(db, "absences"), {
          employeeId: absenceModal.employeeId,
          employeeName: emp?.name || "",
          date: absenceModal.date,
          type: modalType,
          note: modalNote,
          createdAt: Timestamp.now(),
        });
      }
      await loadAbsences();
      setAbsenceModal(null);
    } catch (err) {
      alert("שגיאה בשמירה: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAbsence() {
    if (!absenceModal?.existing) return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, "absences", absenceModal.existing.id));
      await loadAbsences();
      setAbsenceModal(null);
    } catch (err) {
      alert("שגיאה במחיקה: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout title="לוח נוכחות">
      <div className="space-y-4">
        {/* Controls */}
        <div className="bg-white rounded-xl shadow p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-gray-500 mb-1">חודש</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">עובד</label>
            <select
              value={selectedEmployee}
              onChange={e => setSelectedEmployee(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">כל העובדים</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">ימי עבודה</p>
            <p className="text-2xl font-bold text-green-600">{totalDaysWorked}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">סה"כ שעות</p>
            <p className="text-2xl font-bold text-blue-600">{formatHours(totalSecs)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-xs text-gray-500 mb-1">ימי היעדרות</p>
            <p className="text-2xl font-bold text-orange-500">{totalAbsences}</p>
          </div>
        </div>

        {/* Calendar */}
        <div className="bg-white rounded-xl shadow p-4">
          <div className="grid grid-cols-7 mb-2">
            {HE_DAYS.map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>
            ))}
          </div>

          {loading ? (
            <div className="text-center text-gray-400 py-8">טוען...</div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {cells.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />;
                const dateStr = `${selectedMonth}-${String(day).padStart(2, "0")}`;
                const data = dayMap[dateStr];
                const absence = absenceMap[dateStr];
                const isToday = dateStr === today;
                const isFuture = dateStr > today;

                let bg = "bg-gray-50";
                if (data) bg = "bg-green-50";
                else if (absence) bg = absenceBg(absence.type);

                return (
                  <div
                    key={dateStr}
                    onClick={() => openDayPopup(dateStr)}
                    className={`
                      rounded-lg p-1 min-h-[52px] flex flex-col items-center justify-start pt-1 text-center transition-colors
                      ${isToday ? "ring-2 ring-blue-400" : ""}
                      ${bg}
                      ${!isFuture ? "cursor-pointer hover:brightness-95" : ""}
                    `}
                  >
                    <span className={`text-xs font-bold ${isToday ? "text-blue-600" : data ? "text-green-700" : absence ? absenceText(absence.type) : "text-gray-400"}`}>
                      {day}
                    </span>
                    {data && (
                      <span className="text-xs text-green-600 font-medium leading-tight mt-0.5">
                        {formatHours(data.secs)}
                      </span>
                    )}
                    {absence && !data && (
                      <span className={`text-base leading-none mt-0.5 ${absenceText(absence.type)}`}>
                        {absenceLabel(absence.type)}
                      </span>
                    )}
                    {!data && !absence && !isFuture && (
                      <span className="text-gray-200 text-lg leading-none mt-0.5">–</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t border-gray-100">
            {[
              { color: "bg-green-100 ring-1 ring-green-300", label: "יום עבודה" },
              { color: "bg-orange-100 ring-1 ring-orange-300", label: "חופש" },
              { color: "bg-red-100 ring-1 ring-red-300", label: "מחלה" },
              { color: "bg-gray-100", label: "לא עבד" },
              { color: "bg-white ring-2 ring-blue-400", label: "היום" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Day Popup */}
      {dayPopup && (() => {
        const { workGroups, didntWork } = getDayData(dayPopup.date);
        return (
          <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
            <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[85vh] flex flex-col">
              <div className="p-5 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-gray-800">📅 {dayPopup.date}</h2>
                  <button onClick={() => setDayPopup(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
                </div>
              </div>

              <div className="overflow-y-auto flex-1 p-4 space-y-4">
                {/* עבדו */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">עבדו</p>
                  {workGroups.length === 0 ? (
                    <p className="text-sm text-gray-400">אף אחד לא עבד ביום זה</p>
                  ) : (
                    <div className="space-y-2">
                      {workGroups.map((g, i) => (
                        <div key={i} className="bg-green-50 rounded-xl p-3 space-y-1">
                          <p className="text-sm font-medium text-gray-800">✅ {g.workerNames.join(", ")}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                            <span>🏭 {g.factoryName}</span>
                            <span>📋 {g.projectName}</span>
                            <span className="text-green-600 font-bold">⏱ {formatHours(g.durationSecs)}</span>
                          </div>
                          {g.description && (
                            <p className="text-xs text-gray-500 mt-1 italic">"{g.description}"</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* לא עבדו */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">לא עבדו</p>
                  {didntWork.length === 0 ? (
                    <p className="text-sm text-gray-400">כולם עבדו היום</p>
                  ) : (
                    <div className="space-y-2">
                      {didntWork.map(emp => (
                        <div key={emp.id} className={`rounded-xl p-3 flex items-center justify-between ${emp.absence ? absenceBg(emp.absence.type) : "bg-gray-50"}`}>
                          <div>
                            <span className="font-medium text-gray-700 text-sm">
                              {emp.absence ? absenceLabel(emp.absence.type) : "❌"} {emp.name}
                            </span>
                            {emp.absence && (
                              <p className={`text-xs mt-0.5 ${absenceText(emp.absence.type)}`}>
                                {emp.absence.type}{emp.absence.note ? ` — ${emp.absence.note}` : ""}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => openAbsenceModal(dayPopup.date, emp.id, emp.absence)}
                            className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            {emp.absence ? "ערוך" : "+ סמן"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Absence Modal */}
      {absenceModal && (
        <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[60] px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1 text-center">
              {absenceModal.existing ? "עריכת היעדרות" : "סימון היעדרות"}
            </h2>
            <p className="text-sm text-gray-400 text-center mb-4">
              {employees.find(e => e.id === absenceModal.employeeId)?.name} — {absenceModal.date}
            </p>

            <div className="flex gap-2 mb-4">
              {ABSENCE_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setModalType(t.value)}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                    modalType === t.value
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">הערה (אופציונלי)</label>
              <textarea
                value={modalNote}
                onChange={e => setModalNote(e.target.value)}
                placeholder="למשל: חופשת משפחה, רופא..."
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

            <div className="flex gap-2">
              {absenceModal.existing && (
                <button
                  type="button"
                  onClick={deleteAbsence}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium border border-red-300 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  מחק
                </button>
              )}
              <button
                type="button"
                onClick={() => setAbsenceModal(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={saveAbsence}
                disabled={saving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                {saving ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
