import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

export default function ManageEmployees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "" });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "employees"), orderBy("name")));
    setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", phone: "" });
    setShowForm(true);
  }

  function openEdit(emp) {
    setEditing(emp);
    setForm({ name: emp.name, phone: emp.phone });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const cleaned = form.phone.replace(/\D/g, "");
    const data = { name: form.name.trim(), phone: cleaned, active: true };
    if (editing) {
      await updateDoc(doc(db, "employees", editing.id), data);
    } else {
      await addDoc(collection(db, "employees"), { ...data, createdAt: new Date() });
    }
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function toggleActive(emp) {
    await updateDoc(doc(db, "employees", emp.id), { active: !emp.active });
    load();
  }

  return (
    <AdminLayout title="ניהול עובדים">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">רשימת עובדים</h2>
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + הוסף עובד
          </button>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">טוען...</div>
          ) : employees.length === 0 ? (
            <div className="p-8 text-center text-gray-400">אין עובדים עדיין</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {employees.map(emp => (
                <div key={emp.id} className={`px-4 py-3 flex items-center justify-between ${!emp.active ? "opacity-50" : ""}`}>
                  <div>
                    <p className="font-medium text-gray-800">{emp.name}</p>
                    <p className="text-gray-400 text-sm">{emp.phone}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${emp.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {emp.active ? "פעיל" : "לא פעיל"}
                    </span>
                    <button onClick={() => openEdit(emp)} className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors">
                      ערוך
                    </button>
                    <button onClick={() => toggleActive(emp)} className="text-gray-500 hover:text-gray-700 text-sm px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors">
                      {emp.active ? "השבת" : "הפעל"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editing ? "ערוך עובד" : "הוסף עובד"}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם מלא *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="ישראל ישראלי"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מספר טלפון *</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="0501234567"
                  inputMode="numeric"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl font-medium hover:bg-gray-50 transition-colors">
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
