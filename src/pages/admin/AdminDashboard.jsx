import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

function formatHours(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, "0")}`;
}

const getSecs = s => s.durationSeconds ?? (s.durationMinutes || 0) * 60;

export default function AdminDashboard() {
  const [employees, setEmployees] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  useEffect(() => {
    async function load() {
      setLoading(true);
      const empSnap = await getDocs(query(collection(db, "employees"), where("active", "==", true)));
      const emps = empSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmployees(emps);

      const sesSnap = await getDocs(query(
        collection(db, "workSessions"),
        where("endTime", "!=", null),
        orderBy("endTime", "desc")
      ));
      setSessions(sesSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }
    load();
  }, []);

  const monthSessions = sessions.filter(s => s.date?.startsWith(selectedMonth));

  const empStats = employees.map(emp => {
    const empSessions = monthSessions.filter(s => s.employeeId === emp.id);
    const totalSecs = empSessions.reduce((a, s) => a + (getSecs(s)), 0);
    const days = new Set(empSessions.map(s => s.date)).size;
    return { ...emp, totalSecs, days };
  }).sort((a, b) => b.totalSecs - a.totalSecs);

  const totalMonthSecs = monthSessions.reduce((a, s) => a + (getSecs(s)), 0);
  const activeEmployees = empStats.filter(e => e.totalSecs > 0).length;

  const today = new Date().toISOString().split("T")[0];
  const todaySessions = sessions.filter(s => s.date === today);
  const workedTodayIds = new Set(todaySessions.map(s => s.employeeId));
  const workedToday = employees
    .filter(e => workedTodayIds.has(e.id))
    .map(e => {
      const s = todaySessions.find(s => s.employeeId === e.id);
      return { ...e, factoryName: s?.factoryName || "—" };
    });
  const didntWorkToday = employees.filter(e => !workedTodayIds.has(e.id));

  return (
    <AdminLayout title="ניהול שעות עבודה">
      <div className="space-y-6">
        {/* Month selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-600">חודש:</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-xs mb-1">סה"כ שעות בחודש</p>
            <p className="text-2xl font-bold text-blue-600">{formatHours(totalMonthSecs)}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4">
            <p className="text-gray-500 text-xs mb-1">עובדים פעילים</p>
            <p className="text-2xl font-bold text-green-600">{activeEmployees}</p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 col-span-2 sm:col-span-1">
            <p className="text-gray-500 text-xs mb-1">רשומות חודש</p>
            <p className="text-2xl font-bold text-purple-600">{monthSessions.length}</p>
          </div>

        </div>

        {/* Today's status */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">סטטוס היום — {today}</h2>
          </div>
          {loading ? (
            <div className="p-6 text-center text-gray-400">טוען...</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {workedToday.map(emp => (
                <div key={emp.id} className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-lg">✅</span>
                    <span className="font-medium text-gray-800">{emp.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">{emp.factoryName}</span>
                </div>
              ))}
              {didntWorkToday.map(emp => (
                <div key={emp.id} className="px-4 py-3 flex items-center justify-between opacity-50">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-300 text-lg">❌</span>
                    <span className="font-medium text-gray-500">{emp.name}</span>
                  </div>
                  <span className="text-sm text-gray-400">לא עבד</span>
                </div>
              ))}
              {employees.length === 0 && (
                <div className="p-6 text-center text-gray-400">אין עובדים פעילים</div>
              )}
            </div>
          )}
        </div>

        {/* Employee table */}
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">שעות לפי עובד</h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-gray-400">טוען...</div>
          ) : empStats.length === 0 ? (
            <div className="p-8 text-center text-gray-400">אין עובדים פעילים</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {empStats.map(emp => (
                <div key={emp.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-medium text-gray-800">{emp.name}</p>
                    <p className="text-gray-400 text-xs">{emp.phone} • {emp.days} ימי עבודה</p>
                  </div>
                  <div className="text-left">
                    <p className={`font-bold text-lg ${emp.totalSecs > 0 ? "text-blue-600" : "text-gray-300"}`}>
                      {formatHours(emp.totalSecs)}
                    </p>
                    <p className="text-gray-400 text-xs">שעות</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
