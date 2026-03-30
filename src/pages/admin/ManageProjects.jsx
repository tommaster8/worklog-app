import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy, where } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

function getStatus(item) {
  if (item.active) return "active";
  if (item.future) return "future";
  if (item.completed) return "completed";
  return "inactive";
}

const STATUS_TABS = [
  { key: "all",      label: "הכל" },
  { key: "active",   label: "פעיל" },
  { key: "future",   label: "עתידי" },
  { key: "completed",label: "הושלם" },
  { key: "inactive", label: "לא פעיל" },
];

export default function ManageProjects() {
  const [items, setItems] = useState([]);
  const [factories, setFactories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: "", factoryId: "", factoryName: "", initialStatus: "active" });
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  async function load() {
    setLoading(true);
    const [projSnap, facSnap] = await Promise.all([
      getDocs(query(collection(db, "projects"), orderBy("name"))),
      getDocs(query(collection(db, "factories"), where("active", "==", true))),
    ]);
    setItems(projSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setFactories(facSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: "", factoryId: "", factoryName: "", initialStatus: "active" });
    setShowForm(true);
  }

  function openEdit(item) {
    setEditing(item);
    setForm({ name: item.name, factoryId: item.factoryId || "", factoryName: item.factoryName || "", initialStatus: "active" });
    setShowForm(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const data = { name: form.name.trim(), factoryId: form.factoryId, factoryName: form.factoryName };
    if (editing) {
      await updateDoc(doc(db, "projects", editing.id), data);
    } else {
      const isFuture = form.initialStatus === "future";
      await addDoc(collection(db, "projects"), {
        ...data,
        active: !isFuture,
        future: isFuture,
        completed: false,
      });
    }
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function toggleActive(item) {
    await updateDoc(doc(db, "projects", item.id), { active: true, completed: false, future: false });
    load();
  }

  async function toggleInactive(item) {
    await updateDoc(doc(db, "projects", item.id), { active: false, completed: false, future: false });
    load();
  }

  async function markCompleted(item) {
    await updateDoc(doc(db, "projects", item.id), { active: false, completed: true, future: false });
    load();
  }

  // Filter items by status
  const filteredItems = statusFilter === "all"
    ? items
    : items.filter(p => getStatus(p) === statusFilter);

  // Group by factory
  const grouped = factories.map(f => ({
    factory: f,
    projects: filteredItems.filter(p => p.factoryId === f.id),
  }));
  const unassigned = filteredItems.filter(p => !p.factoryId);

  const hasResults = grouped.some(g => g.projects.length > 0) || unassigned.length > 0;

  return (
    <AdminLayout title="ניהול פרויקטים">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">רשימת פרויקטים</h2>
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + הוסף פרויקט
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="bg-white rounded-xl shadow p-1 flex gap-1 overflow-x-auto">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? "bg-blue-600 text-white"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">טוען...</div>
        ) : !hasResults ? (
          <div className="bg-white rounded-xl shadow p-8 text-center text-gray-400">
            {items.length === 0 ? "אין פרויקטים עדיין" : "אין פרויקטים בסטטוס זה"}
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.filter(g => g.projects.length > 0).map(({ factory, projects }) => (
              <div key={factory.id} className="bg-white rounded-xl shadow overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex items-center gap-2">
                  <span>🏭</span>
                  <span className="font-semibold text-gray-700 text-sm">{factory.name}</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {projects.map(item => (
                    <ProjectRow key={item.id} item={item} onEdit={openEdit} onActivate={toggleActive} onDeactivate={toggleInactive} onComplete={markCompleted} />
                  ))}
                </div>
              </div>
            ))}
            {unassigned.length > 0 && (
              <div className="bg-white rounded-xl shadow overflow-hidden">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                  <span className="font-semibold text-gray-500 text-sm">ללא מפעל</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {unassigned.map(item => (
                    <ProjectRow key={item.id} item={item} onEdit={openEdit} onActivate={toggleActive} onDeactivate={toggleInactive} onComplete={markCompleted} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editing ? "ערוך פרויקט" : "הוסף פרויקט"}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם הפרויקט *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="פרויקט ABC"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">מפעל משויך *</label>
                <select
                  required
                  value={form.factoryId}
                  onChange={e => {
                    const f = factories.find(f => f.id === e.target.value);
                    setForm(p => ({ ...p, factoryId: e.target.value, factoryName: f?.name || "" }));
                  }}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">בחר מפעל</option>
                  {factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">סטטוס התחלתי</label>
                  <div className="flex gap-2">
                    {[{ value: "active", label: "✅ פעיל" }, { value: "future", label: "🔮 עתידי" }].map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setForm(p => ({ ...p, initialStatus: opt.value }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                          form.initialStatus === opt.value
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
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

function ProjectRow({ item, onEdit, onActivate, onDeactivate, onComplete }) {
  const status = getStatus(item);

  const badgeMap = {
    active:   { label: "פעיל",    cls: "bg-green-100 text-green-700" },
    future:   { label: "עתידי",   cls: "bg-purple-100 text-purple-700" },
    completed:{ label: "✔ הושלם", cls: "bg-blue-100 text-blue-700" },
    inactive: { label: "לא פעיל", cls: "bg-gray-100 text-gray-500" },
  };
  const opacityMap = { active: "", future: "opacity-80", completed: "opacity-70", inactive: "opacity-50" };
  const iconMap = { active: "📋", future: "🔮", completed: "✅", inactive: "📋" };

  const { label, cls } = badgeMap[status];

  return (
    <div className={`px-4 py-3 flex items-center justify-between ${opacityMap[status]}`}>
      <div className="flex items-center gap-3">
        <span className="text-xl">{iconMap[status]}</span>
        <div>
          <p className="font-medium text-gray-800">{item.name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
        </div>
      </div>
      <div className="flex gap-2 flex-wrap justify-end">
        <button onClick={() => onEdit(item)} className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors">
          ערוך
        </button>
        {status === "active" && (
          <>
            <button onClick={() => onComplete(item)} className="text-blue-500 hover:text-blue-700 text-sm px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors">
              הושלם
            </button>
            <button onClick={() => onDeactivate(item)} className="text-gray-500 hover:text-gray-700 text-sm px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors">
              השבת
            </button>
          </>
        )}
        {status !== "active" && (
          <button onClick={() => onActivate(item)} className="text-green-600 hover:text-green-800 text-sm px-2 py-1 hover:bg-green-50 rounded-lg transition-colors">
            הפעל
          </button>
        )}
      </div>
    </div>
  );
}
