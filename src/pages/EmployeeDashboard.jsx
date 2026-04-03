import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  collection, query, where, getDocs, addDoc, updateDoc, doc,
  orderBy, Timestamp, onSnapshot
} from "firebase/firestore";
import { db } from "../firebase";

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHours(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h === 0 && m === 0) return s > 0 ? `${s}ש"` : `0ד'`;
  return `${h > 0 ? h + "ש' " : ""}${m}ד'`.trim();
}

const getSecs = s => s.durationSeconds ?? (s.durationMinutes || 0) * 60;

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function EmployeeDashboard() {
  const navigate = useNavigate();
  const employee = JSON.parse(sessionStorage.getItem("employee") || "null");

  const [activeSession, setActiveSession] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showEndForm, setShowEndForm] = useState(false);
  const [factories, setFactories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [tab, setTab] = useState("day");

  const [form, setForm] = useState({ factoryId: "", factoryName: "", projectId: "", projectName: "", description: "" });
  const [saving, setSaving] = useState(false);
  const [allEmployees, setAllEmployees] = useState([]);
  const [selectedWorkers, setSelectedWorkers] = useState([]);
  const [absencePopup, setAbsencePopup] = useState(null); // [{ emp, type, skip }]
  const [savingAbsences, setSavingAbsences] = useState(false);

  useEffect(() => {
    if (!employee) { navigate("/"); return; }
  }, []);

  // Load active session from Firestore
  useEffect(() => {
    if (!employee) return;
    const q = query(
      collection(db, "workSessions"),
      where("employeeId", "==", employee.id),
      where("endTime", "==", null)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const s = { id: snap.docs[0].id, ...snap.docs[0].data() };
        setActiveSession(s);
      } else {
        setActiveSession(null);
      }
    });
    return unsub;
  }, [employee?.id]);

  // Timer
  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    const start = activeSession.startTime?.toMillis?.() || Date.now();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  // Load factories and projects
  useEffect(() => {
    getDocs(query(collection(db, "factories"), where("active", "==", true)))
      .then(s => setFactories(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDocs(query(collection(db, "projects"), where("active", "==", true)))
      .then(s => setProjects(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDocs(query(collection(db, "employees"), where("active", "==", true)))
      .then(s => setAllEmployees(s.docs.map(d => ({ id: d.id, ...d.data() }))));
  }, []);

  // Load past sessions
  const loadSessions = useCallback(async () => {
    if (!employee) return;
    const q = query(
      collection(db, "workSessions"),
      where("employeeId", "==", employee.id)
    );
    const snap = await getDocs(q);
    const sorted = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(s => s.endTime != null)
      .sort((a, b) => (b.endTime?.toMillis?.() || 0) - (a.endTime?.toMillis?.() || 0));
    setSessions(sorted);
  }, [employee?.id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  async function startSession() {
    if (activeSession) return;
    // בדיקה כפולה ב-Firestore למניעת race condition / שני טאבים
    const existing = await getDocs(query(
      collection(db, "workSessions"),
      where("employeeId", "==", employee.id),
      where("endTime", "==", null)
    ));
    if (!existing.empty) return;
    const today = new Date().toISOString().split("T")[0];
    const docRef = await addDoc(collection(db, "workSessions"), {
      employeeId: employee.id,
      employeeName: employee.name,
      employeePhone: employee.phone,
      startTime: Timestamp.now(),
      endTime: null,
      date: today,
      factoryId: null, factoryName: null,
      projectId: null, projectName: null,
      description: "",
      durationSeconds: 0,
    });
  }

  async function endSession(e) {
    e.preventDefault();
    if (!activeSession || !form.factoryId || !form.projectId) return;
    setSaving(true);
    try {
      const endTime = Timestamp.now();
      const startMs = activeSession.startTime?.toMillis?.() || Date.now();
      const durationSeconds = Math.floor((endTime.toMillis() - startMs) / 1000);
      await updateDoc(doc(db, "workSessions", activeSession.id), {
        endTime,
        durationSeconds,
        factoryId: form.factoryId,
        factoryName: form.factoryName,
        projectId: form.projectId,
        projectName: form.projectName,
        description: form.description,
      });
      for (const worker of selectedWorkers) {
        await addDoc(collection(db, "workSessions"), {
          employeeId: worker.id,
          employeeName: worker.name,
          employeePhone: worker.phone,
          startTime: activeSession.startTime,
          endTime,
          date: activeSession.date,
          factoryId: form.factoryId,
          factoryName: form.factoryName,
          projectId: form.projectId,
          projectName: form.projectName,
          description: form.description,
          durationSeconds,
        });
      }
      setShowEndForm(false);
      setForm({ factoryId: "", factoryName: "", projectId: "", projectName: "", description: "" });

      // עובדים שלא עבדו — פתח פופאפ היעדרויות
      const didntWork = allEmployees.filter(e =>
        e.phone !== "0547515894" && !selectedWorkers.some(w => w.id === e.id)
      );
      setSelectedWorkers([]);
      if (didntWork.length > 0) {
        setAbsencePopup(didntWork.map(emp => ({ emp, type: "חופש", skip: false })));
      }
      loadSessions();
    } catch (err) {
      alert("שגיאה בשמירה: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveAbsences() {
    if (!absencePopup) return;
    setSavingAbsences(true);
    try {
      const date = new Date().toISOString().split("T")[0];
      for (const row of absencePopup) {
        if (row.skip) continue;
        await addDoc(collection(db, "absences"), {
          employeeId: row.emp.id,
          employeeName: row.emp.name,
          date,
          type: row.type,
          note: "",
          createdAt: Timestamp.now(),
        });
      }
      setAbsencePopup(null);
    } catch (err) {
      alert("שגיאה בשמירה: " + err.message);
    } finally {
      setSavingAbsences(false);
    }
  }

  // Statistics
  const today = new Date().toISOString().split("T")[0];
  const weekStart = getWeekStart(new Date());
  const monthStr = new Date().toISOString().slice(0, 7);

  const dayMins = sessions.filter(s => s.date === today).reduce((a, s) => a + (getSecs(s)), 0);
  const weekMins = sessions.filter(s => {
    const d = new Date(s.date);
    return d >= weekStart;
  }).reduce((a, s) => a + (getSecs(s)), 0);
  const monthMins = sessions.filter(s => s.date?.startsWith(monthStr)).reduce((a, s) => a + (getSecs(s)), 0);

  const filteredSessions = sessions.filter(s => {
    if (tab === "day") return s.date === today;
    if (tab === "week") return new Date(s.date) >= weekStart;
    return s.date?.startsWith(monthStr);
  });

  if (!employee) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <p className="text-blue-200 text-sm">שלום,</p>
            <h1 className="text-xl font-bold">{employee.name}</h1>
          </div>
          <button onClick={() => { sessionStorage.clear(); navigate("/"); }} className="text-blue-200 hover:text-white text-sm">
            יציאה
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Timer Card */}
        <div className="bg-white rounded-2xl shadow p-6 text-center">
          {activeSession ? (
            <>
              <p className="text-green-600 font-medium mb-1">⏱ עבודה פעילה</p>
              <div className="text-5xl font-mono font-bold text-gray-800 my-4">{formatDuration(elapsed)}</div>
              <p className="text-gray-500 text-sm mb-4">
                התחלה: {activeSession.startTime?.toDate?.()?.toLocaleTimeString("he-IL")}
              </p>
              <button
                onClick={() => setShowEndForm(true)}
                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-xl text-lg transition-colors"
              >
                סיים יום עבודה
              </button>
            </>
          ) : (
            <>
              <p className="text-gray-500 mb-4">לחץ להתחיל את יום העבודה</p>
              <button
                onClick={startSession}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-xl text-lg transition-colors"
              >
                התחל יום עבודה ▶
              </button>
            </>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "היום", value: formatHours(dayMins) },
            { label: "השבוע", value: formatHours(weekMins) },
            { label: "החודש", value: formatHours(monthMins) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl shadow p-3 text-center">
              <p className="text-gray-500 text-xs mb-1">{label}</p>
              <p className="font-bold text-gray-800 text-sm">{value || "0ש'"}</p>
            </div>
          ))}
        </div>

        {/* History */}
        <div className="bg-white rounded-2xl shadow p-4">
          <div className="flex gap-2 mb-4">
            {[["day", "היום"], ["week", "שבוע"], ["month", "חודש"]].map(([val, label]) => (
              <button
                key={val}
                onClick={() => setTab(val)}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${tab === val ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredSessions.length === 0 ? (
            <p className="text-gray-400 text-center py-4 text-sm">אין רשומות להצגה</p>
          ) : (
            <div className="space-y-3">
              {filteredSessions.map(s => (
                <div key={s.id} className="border border-gray-100 rounded-xl p-3">
                  <div className="flex justify-between items-start">
                    <div className="text-right">
                      <p className="font-medium text-gray-800 text-sm">{s.factoryName || "—"}</p>
                      <p className="text-gray-500 text-xs">{s.projectName || "—"}</p>
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-blue-600 text-sm">{formatHours(getSecs(s))}</p>
                      <p className="text-gray-400 text-xs">{s.date}</p>
                    </div>
                  </div>
                  {s.description && <p className="text-gray-500 text-xs mt-2 border-t pt-2">{s.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Absence Popup */}
      {absencePopup && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl max-h-[85vh] flex flex-col">
            <div className="p-5 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800 text-center">סימון היעדרויות</h2>
              <p className="text-sm text-gray-400 text-center mt-1">מי לא הגיע היום?</p>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {absencePopup.map((row, i) => (
                <div key={row.emp.id} className={`rounded-xl p-3 border transition-colors ${row.skip ? "border-gray-100 bg-gray-50 opacity-50" : "border-gray-200 bg-white"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-gray-800 text-sm">{row.emp.name}</span>
                    <label className="flex items-center gap-1 text-xs text-gray-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={row.skip}
                        onChange={e => setAbsencePopup(prev => prev.map((r, j) => j === i ? { ...r, skip: e.target.checked } : r))}
                      />
                      דלג
                    </label>
                  </div>
                  {!row.skip && (
                    <div className="flex gap-2">
                      {[
                        { value: "חופש", label: "🌴 חופש" },
                        { value: "מחלה", label: "🤒 מחלה" },
                        { value: "אחר",  label: "📝 אחר" },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setAbsencePopup(prev => prev.map((r, j) => j === i ? { ...r, type: opt.value } : r))}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            row.type === opt.value
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={() => setAbsencePopup(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                דלג על הכל
              </button>
              <button
                type="button"
                onClick={saveAbsences}
                disabled={savingAbsences}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2.5 rounded-xl text-sm font-bold transition-colors"
              >
                {savingAbsences ? "שומר..." : "שמור"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End Session Modal */}
      {showEndForm && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 px-4 pb-4 sm:pb-0">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4 text-center">סיום יום עבודה</h2>
            <form onSubmit={endSession} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מפעל / אתר *</label>
                <select
                  required
                  value={form.factoryId}
                  onChange={e => {
                    const f = factories.find(f => f.id === e.target.value);
                    setForm(prev => ({ ...prev, factoryId: e.target.value, factoryName: f?.name || "", projectId: "", projectName: "" }));
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">בחר מפעל</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">פרויקט *</label>
                <select
                  required
                  disabled={!form.factoryId}
                  value={form.projectId}
                  onChange={e => {
                    const p = projects.find(p => p.id === e.target.value);
                    setForm(prev => ({ ...prev, projectId: e.target.value, projectName: p?.name || "" }));
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">{form.factoryId ? "בחר פרויקט" : "בחר מפעל תחילה"}</option>
                  {projects.filter(p => p.factoryId === form.factoryId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">תיאור קצר (אופציונלי)</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="מה עשית היום?"
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">עובדים שעבדו איתך היום</label>
                <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2">
                  {allEmployees.filter(e => e.phone !== "0547515894").length === 0 ? (
                    <p className="text-gray-400 text-xs text-center py-2">אין עובדים פעילים</p>
                  ) : (
                    allEmployees.filter(e => e.phone !== "0547515894").map(emp => (
                      <label key={emp.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedWorkers.some(w => w.id === emp.id)}
                          onChange={e => {
                            setSelectedWorkers(prev =>
                              e.target.checked ? [...prev, emp] : prev.filter(w => w.id !== emp.id)
                            );
                          }}
                        />
                        <span className="text-sm text-gray-700">{emp.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowEndForm(false)}
                  className="flex-1 border border-gray-300 text-gray-600 py-3 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  {saving ? "שומר..." : "סיים"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
