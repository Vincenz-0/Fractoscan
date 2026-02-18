import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);

const API_BASE = "http://127.0.0.1:5001/api/auth";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user on refresh
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    axios
      .get(`${API_BASE}/me`, {
        headers: { "x-auth-token": token }
      })
      .then(res => setUser(res.data))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  // LOGIN (UPDATED WITH LOGGING)
  async function login(email, password) {
    try {
      const res = await axios.post(`${API_BASE}/login`, {
        email,
        password
      });

      console.log("Login response:", res.data);  // Temporary debug log

      if (!res.data?.token) {
        console.log("No token in login response");  // Temporary debug log
        return { success: false, message: "Invalid credentials" };
      }

      localStorage.setItem("token", res.data.token);

      if (res.data?.user) {
        setUser(res.data.user);
        return { success: true };
      }

      return { success: true };

    } catch (err) {
      console.error("Login error:", err.response?.status, err.response?.data);  // Temporary debug log
      return {
        success: false,
        message: err.response?.data?.msg || "Login failed"
      };
    }
  }

  // REGISTER (UPDATED: Succeed even if /user fetch fails, fetch later via useEffect)
  async function register(name, email, password,role) {
    try {
      const res = await axios.post(`${API_BASE}/register`, {
        name,
        email,
        password,
        role
      });

      console.log("Register response:", res.data);  // Temporary debug log

      // Check for token (adjust key if needed, e.g., res.data.accessToken)
      const token = res.data?.token || res.data?.accessToken;
      if (!token) {
        console.log("No token in response");  // Temporary debug log
        return {
          success: false,
          message: res.data?.msg || "Registration failed (no token returned)"
        };
      }

      localStorage.setItem("token", token);

      if (res.data?.user) {
        setUser(res.data.user);
        return { success: true };
      }

      return { success: true };

    } catch (err) {
      console.error("Register error:", err);  // Temporary debug log
      return {
        success: false,
        message: err.response?.data?.msg || "Registration failed"
      };
    }
  }

  async function updateProfile({ name, email, password }) {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        return { success: false, message: "Not authenticated" };
      }

      const payload = {
        name,
        email
      };

      if (password && password.trim()) {
        payload.password = password.trim();
      }

      const res = await axios.put(`${API_BASE}/me`, payload, {
        headers: { "x-auth-token": token }
      });

      setUser(res.data);
      return { success: true, user: res.data };
    } catch (err) {
      return {
        success: false,
        message: err.response?.data?.msg || "Failed to update profile"
      };
    }
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, register, updateProfile, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
