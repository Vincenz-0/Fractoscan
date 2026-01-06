// src/components/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  // ⏳ Wait for auth check
  if (loading) {
    return <div>Loading...</div>;
  }

  // ✅ Token-based protection (FIX)
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;