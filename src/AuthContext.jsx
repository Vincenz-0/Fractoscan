import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { email }

  useEffect(() => {
    const stored = localStorage.getItem("fractoscan_user");
    if (stored) {
      setUser(JSON.parse(stored));
    }
  }, []);

  function login(email) {
    const userData = { email };
    setUser(userData);
    localStorage.setItem("fractoscan_user", JSON.stringify(userData));
  }

  function logout() {
    setUser(null);
    localStorage.removeItem("fractoscan_user");
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
