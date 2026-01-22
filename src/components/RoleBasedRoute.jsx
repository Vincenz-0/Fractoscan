import { Navigate } from "react-router-dom";
import { useAuth } from "../AuthContext";

function RoleBasedRoute({ children, allowedRoles }) {
  const { user, loading } = useAuth();

  // Wait for auth check
  if (loading) {
    return <div>Loading...</div>;
  }

  // Check if user is authenticated
  const token = localStorage.getItem("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role
  if (allowedRoles && !allowedRoles.includes(user?.role)) {
    // Redirect to appropriate dashboard based on their actual role
    if (user?.role === "doctor") {
      return <Navigate to="/doctor-dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default RoleBasedRoute;
