import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../firebase";

export default function EmployeeLogin() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length < 9) {
      setError("אנא הזן מספר טלפון תקין");
      return;
    }
    if (cleaned !== "0547515894") {
      setError("גישה מורשית לאמין בלבד");
      return;
    }
    setLoading(true);
    try {
      const q = query(collection(db, "employees"), where("phone", "==", cleaned), where("active", "==", true));
      const snap = await getDocs(q);
      if (snap.empty) {
        setError("מספר הטלפון לא נמצא במערכת. פנה למנהל.");
      } else {
        const emp = { id: snap.docs[0].id, ...snap.docs[0].data() };
        sessionStorage.setItem("employee", JSON.stringify(emp));
        navigate("/dashboard");
      }
    } catch {
      setError("שגיאה בהתחברות. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">⏱️</div>
          <h1 className="text-2xl font-bold text-gray-800">מערכת שעות עבודה</h1>
          <p className="text-gray-500 text-sm mt-1">הזן מספר טלפון להתחברות</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">מספר טלפון</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="050-0000000"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
              inputMode="numeric"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm rounded-lg px-4 py-3 text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !phone}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-3 rounded-xl text-lg transition-colors"
          >
            {loading ? "מחפש..." : "כניסה"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/admin/login" className="text-xs text-gray-400 hover:text-gray-600">
            כניסת מנהל
          </a>
        </div>
      </div>
    </div>
  );
}
