import { useState, useEffect } from "react";
import {
  collection, getDocs, query, where, orderBy, updateDoc, doc, Timestamp
} from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";
import * as XLSX from "xlsx";

function formatHours(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

const getSecs = s => s.durationSeconds ?? (s.durationMinutes || 0) * 60;

// חישוב שכר לפי חוק שעות עבודה ומנוחה:
// 8 שעות ראשונות = 100%, שעות 9-10 = 125%, משעה 11 = 150%
function calcSalary(totalSeconds, hourlyRate) {
  if (!hourlyRate) return null;
  const hours = totalSeconds / 3600;
  const regular = Math.min(hours, 8);
  const overtime1 = Math.min(Math.max(hours - 8, 0), 2);
  const overtime2 = Math.max(hours - 10, 0);
  return regular * hourlyRate + overtime1 * hourlyRate * 1.25 + overtime2 * hourlyRate * 1.5;
}

function formatMoney(amount) {
  if (amount == null) return "—";
  return `₪${amount.toFixed(2)}`;
}

function tsToTime(ts) {
  if (!ts) return "—";
  return ts.toDate?.()?.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) || "—";
}

export default function Reports() {
  const [sessions, setSessions] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [factories, setFactories] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [filters, setFilters] = useState({
    dateFrom: monthStart,
    dateTo: today,
    employeeId: "",
    factoryId: "",
    projectId: "",
  });

  const [editingSession, setEditingSession] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const [empSnap, facSnap, projSnap] = await Promise.all([
        getDocs(query(collection(db, "employees"), orderBy("name"))),
        getDocs(query(collection(db, "factories"), orderBy("name"))),
        getDocs(query(collection(db, "projects"), orderBy("name"))),
      ]);
      setEmployees(empSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setFactories(facSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setProjects(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    load();
  }, []);

  async function loadSessions() {
    setLoading(true);
    const snap = await getDocs(query(
      collection(db, "workSessions"),
      where("endTime", "!=", null),
      orderBy("endTime", "desc")
    ));
    setSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { loadSessions(); }, []);

  const filtered = sessions.filter(s => {
    if (filters.dateFrom && s.date < filters.dateFrom) return false;
    if (filters.dateTo && s.date > filters.dateTo) return false;
    if (filters.employeeId && s.employeeId !== filters.employeeId) return false;
    if (filters.factoryId && s.factoryId !== filters.factoryId) return false;
    if (filters.projectId && s.projectId !== filters.projectId) return false;
    return true;
  });

  const totalMins = filtered.reduce((a, s) => a + (getSecs(s)), 0);

  const employeeMap = Object.fromEntries(employees.map(e => [e.id, e]));

  const totalSalary = filtered.reduce((sum, s) => {
    const rate = employeeMap[s.employeeId]?.hourlyRate;
    const salary = calcSalary(getSecs(s), rate);
    return salary != null ? sum + salary : sum;
  }, 0);
  const hasSalaryData = filtered.some(s => employeeMap[s.employeeId]?.hourlyRate);

  function exportExcel() {
    const data = filtered.map(s => {
      const rate = employeeMap[s.employeeId]?.hourlyRate;
      const salary = calcSalary(getSecs(s), rate);
      return {
        "שם עובד": s.employeeName || "",
        "תאריך": s.date || "",
        "שעת כניסה": tsToTime(s.startTime),
        "שעת יציאה": tsToTime(s.endTime),
        'סה"כ שעות': formatHours(getSecs(s)),
        "מחיר לשעה (₪)": rate ?? "",
        "שכר לתשלום (₪)": salary != null ? +salary.toFixed(2) : "",
        "מפעל": s.factoryName || "",
        "פרויקט": s.projectName || "",
        "תיאור": s.description || "",
      };
    });
    const ws = XLSX.utils.json_to_sheet(data, { header: ["שם עובד","תאריך","שעת כניסה","שעת יציאה",'סה"כ שעות',"מחיר לשעה (₪)","שכר לתשלום (₪)","מפעל","פרויקט","תיאור"] });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "שעות עבודה");
    XLSX.writeFile(wb, `דוח_שעות_${filters.dateFrom}_עד_${filters.dateTo}.xlsx`);
  }

  function openEdit(s) {
    setEditingSession(s);
    const startDate = s.startTime?.toDate?.();
    const endDate = s.endTime?.toDate?.();
    setEditForm({
      startDate: startDate ? startDate.toISOString().split("T")[0] : s.date,
      startTime: startDate ? startDate.toTimeString().slice(0, 5) : "",
      endDate: endDate ? endDate.toISOString().split("T")[0] : s.date,
      endTime: endDate ? endDate.toTimeString().slice(0, 5) : "",
      description: s.description || "",
      factoryId: s.factoryId || "",
      projectId: s.projectId || "",
    });
  }

  async function saveEdit(e) {
    e.preventDefault();
    setSaving(true);
    const startDt = new Date(`${editForm.startDate}T${editForm.startTime}`);
    const endDt = new Date(`${editForm.endDate}T${editForm.endTime}`);
    const durationSeconds = Math.max(0, Math.floor((endDt - startDt) / 1000));
    const factory = factories.find(f => f.id === editForm.factoryId);
    const project = projects.find(p => p.id === editForm.projectId);
    await updateDoc(doc(db, "workSessions", editingSession.id), {
      startTime: Timestamp.fromDate(startDt),
      endTime: Timestamp.fromDate(endDt),
      durationSeconds,
      factoryId: editForm.factoryId,
      factoryName: factory?.name || editingSession.factoryName,
      projectId: editForm.projectId,
      projectName: project?.name || editingSession.projectName,
      description: editForm.description,
      date: editForm.startDate,
    });
    setEditingSession(null);
    setSaving(false);
    loadSessions();
  }

  return (
    <AdminLayout title="דוחות שעות">
      <div className="space-y-4">
        {/* Filters */}
        <div className="bg-white rounded-xl shadow p-4 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">מתאריך</label>
            <input type="date" value={filters.dateFrom} onChange={e => setFilters(p => ({ ...p, dateFrom: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">עד תאריך</label>
            <input type="date" value={filters.dateTo} onChange={e => setFilters(p => ({ ...p, dateTo: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">עובד</label>
            <select value={filters.employeeId} onChange={e => setFilters(p => ({ ...p, employeeId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">כולם</option>
              {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">מפעל</label>
            <select value={filters.factoryId} onChange={e => setFilters(p => ({ ...p, factoryId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">כולם</option>
              {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">פרויקט</label>
            <select value={filters.projectId} onChange={e => setFilters(p => ({ ...p, projectId: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">כולם</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        </div>

        {/* Summary + Export */}
        <div className="flex items-center justify-between">
          <div className="flex gap-4 flex-wrap">
            <div className="bg-white rounded-xl shadow px-4 py-3">
              <p className="text-xs text-gray-500">רשומות</p>
              <p className="font-bold text-gray-800">{filtered.length}</p>
            </div>
            <div className="bg-white rounded-xl shadow px-4 py-3">
              <p className="text-xs text-gray-500">סה"כ שעות</p>
              <p className="font-bold text-blue-600">{formatHours(totalMins)}</p>
            </div>
            {hasSalaryData && (
              <div className="bg-white rounded-xl shadow px-4 py-3">
                <p className="text-xs text-gray-500">סה"כ שכר</p>
                <p className="font-bold text-green-600">{formatMoney(totalSalary)}</p>
              </div>
            )}
          </div>
          <button
            onClick={exportExcel}
            disabled={filtered.length === 0}
            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            📥 ייצוא Excel
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">טוען...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-400">אין רשומות לפי הסינון</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {["עובד", "תאריך", "כניסה", "יציאה", "שעות", "שכר", "מפעל", "פרויקט", ""].map(h => (
                      <th key={h} className="px-3 py-2 text-right text-xs font-medium text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors" title={s.description || ""}>
                      <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{s.employeeName}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.date}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{tsToTime(s.startTime)}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{tsToTime(s.endTime)}</td>
                      <td className="px-3 py-2 font-bold text-blue-600 whitespace-nowrap">{formatHours(getSecs(s))}</td>
                      <td className="px-3 py-2 font-medium text-green-600 whitespace-nowrap">
                        {formatMoney(calcSalary(getSecs(s), employeeMap[s.employeeId]?.hourlyRate))}
                      </td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.factoryName || "—"}</td>
                      <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{s.projectName || "—"}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => openEdit(s)} className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap">
                          ✏️ ערוך
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-1">עריכת רשומה</h2>
            <p className="text-gray-500 text-sm mb-4">{editingSession.employeeName}</p>
            <form onSubmit={saveEdit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">תאריך כניסה</label>
                  <input type="date" value={editForm.startDate} onChange={e => setEditForm(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">שעת כניסה</label>
                  <input type="time" value={editForm.startTime} onChange={e => setEditForm(p => ({ ...p, startTime: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">תאריך יציאה</label>
                  <input type="date" value={editForm.endDate} onChange={e => setEditForm(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">שעת יציאה</label>
                  <input type="time" value={editForm.endTime} onChange={e => setEditForm(p => ({ ...p, endTime: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">מפעל</label>
                <select value={editForm.factoryId} onChange={e => setEditForm(p => ({ ...p, factoryId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">פרויקט</label>
                <select value={editForm.projectId} onChange={e => setEditForm(p => ({ ...p, projectId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">—</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">תיאור</label>
                <textarea value={editForm.description} onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  rows={2} className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setEditingSession(null)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
                  ביטול
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white py-2.5 rounded-xl font-bold transition-colors">
                  {saving ? "שומר..." : "שמור"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
