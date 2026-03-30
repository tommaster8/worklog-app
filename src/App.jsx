import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";

import EmployeeLogin from "./pages/EmployeeLogin";
import EmployeeDashboard from "./pages/EmployeeDashboard";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageEmployees from "./pages/admin/ManageEmployees";
import ManageFactories from "./pages/admin/ManageFactories";
import ManageProjects from "./pages/admin/ManageProjects";
import Reports from "./pages/admin/Reports";
import Attendance from "./pages/admin/Attendance";

function ProtectedAdminRoute({ user, children }) {
  if (user === undefined) return <div className="flex items-center justify-center min-h-screen text-gray-500">טוען...</div>;
  if (!user) return <Navigate to="/admin/login" replace />;
  return children;
}

export default function App() {
  const [adminUser, setAdminUser] = useState(undefined);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAdminUser(u || null));
    return unsub;
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Employee routes */}
        <Route path="/" element={<EmployeeLogin />} />
        <Route path="/dashboard" element={<EmployeeDashboard />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={
          <ProtectedAdminRoute user={adminUser}>
            <AdminDashboard />
          </ProtectedAdminRoute>
        } />
        <Route path="/admin/employees" element={
          <ProtectedAdminRoute user={adminUser}>
            <ManageEmployees />
          </ProtectedAdminRoute>
        } />
        <Route path="/admin/factories" element={
          <ProtectedAdminRoute user={adminUser}>
            <ManageFactories />
          </ProtectedAdminRoute>
        } />
        <Route path="/admin/projects" element={
          <ProtectedAdminRoute user={adminUser}>
            <ManageProjects />
          </ProtectedAdminRoute>
        } />
        <Route path="/admin/reports" element={
          <ProtectedAdminRoute user={adminUser}>
            <Reports />
          </ProtectedAdminRoute>
        } />
        <Route path="/admin/attendance" element={
          <ProtectedAdminRoute user={adminUser}>
            <Attendance />
          </ProtectedAdminRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
