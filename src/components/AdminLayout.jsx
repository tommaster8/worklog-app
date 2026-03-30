import { useNavigate, useLocation, Link } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";

const navItems = [
  { path: "/admin", label: "דשבורד", icon: "📊", exact: true },
  { path: "/admin/employees", label: "עובדים", icon: "👷" },
  { path: "/admin/factories", label: "מפעלים", icon: "🏭" },
  { path: "/admin/projects", label: "פרויקטים", icon: "📋" },
  { path: "/admin/reports", label: "דוחות", icon: "📈" },
  { path: "/admin/attendance", label: "נוכחות", icon: "📅" },
];

export default function AdminLayout({ children, title }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  async function handleLogout() {
    await signOut(auth);
    navigate("/admin/login");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <header className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between shadow">
        <h1 className="font-bold text-lg">{title}</h1>
        <button onClick={handleLogout} className="text-slate-300 hover:text-white text-sm">
          יציאה
        </button>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6">
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="bg-white border-t border-gray-200 px-2 py-2 sticky bottom-0">
        <div className="max-w-5xl mx-auto flex justify-around">
          {navItems.map(({ path, label, icon, exact }) => {
            const active = exact ? pathname === path : pathname.startsWith(path) && path !== "/admin";
            const isExactAdmin = path === "/admin" && pathname === "/admin";
            const isActive = path === "/admin" ? isExactAdmin : pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors ${isActive ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-gray-700"}`}
              >
                <span className="text-xl">{icon}</span>
                <span className="text-xs font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
