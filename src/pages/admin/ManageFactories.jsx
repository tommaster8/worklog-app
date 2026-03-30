import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, doc, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import AdminLayout from "../../components/AdminLayout";

export default function ManageFactories() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const snap = await getDocs(query(collection(db, "factories"), orderBy("name")));
    setItems(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() { setEditing(null); setName(""); setShowForm(true); }
  function openEdit(item) { setEditing(item); setName(item.name); setShowForm(true); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    if (editing) {
      await updateDoc(doc(db, "factories", editing.id), { name: name.trim() });
    } else {
      await addDoc(collection(db, "factories"), { name: name.trim(), active: true });
    }
    setShowForm(false);
    setSaving(false);
    load();
  }

  async function toggleActive(item) {
    await updateDoc(doc(db, "factories", item.id), { active: !item.active });
    load();
  }

  return (
    <AdminLayout title="ניהול מפעלים">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">רשימת מפעלים / אתרים</h2>
          <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors">
            + הוסף מפעל
          </button>
        </div>

        <div className="bg-white rounded-xl shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-400">טוען...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-gray-400">אין מפעלים עדיין</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map(item => (
                <div key={item.id} className={`px-4 py-3 flex items-center justify-between ${!item.active ? "opacity-50" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🏭</span>
                    <div>
                      <p className="font-medium text-gray-800">{item.name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {item.active ? "פעיל" : "לא פעיל"}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(item)} className="text-blue-600 hover:text-blue-800 text-sm px-2 py-1 hover:bg-blue-50 rounded-lg transition-colors">
                      ערוך
                    </button>
                    <button onClick={() => toggleActive(item)} className="text-gray-500 hover:text-gray-700 text-sm px-2 py-1 hover:bg-gray-100 rounded-lg transition-colors">
                      {item.active ? "השבת" : "הפעל"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h2 className="text-lg font-bold text-gray-800 mb-4">{editing ? "ערוך מפעל" : "הוסף מפעל"}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">שם המפעל / האתר *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="מפעל XYZ"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
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
