import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import Dashboard from "./pages/Dashboard";
import DoctorDashboard from "./pages/DoctorDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleBasedRoute from "./components/RoleBasedRoute";
import ThemeToggle from "./components/ThemeToggle";

function App() {
  return (
    <>
      <ThemeToggle />
      <Routes>
        {/* ✅ Landing page FIRST */}
        <Route path="/" element={<LandingPage />} />

        {/* Auth pages */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Protected User Dashboard */}
        <Route
          path="/dashboard"
          element={
            <RoleBasedRoute allowedRoles={["user"]}>
              <Dashboard />
            </RoleBasedRoute>
          }
        />

        {/* Protected Doctor Dashboard */}
        <Route
          path="/doctor-dashboard"
          element={
            <RoleBasedRoute allowedRoles={["doctor", "admin"]}>
              <DoctorDashboard />
            </RoleBasedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
