// src/pages/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await login(email, password);

      if (result.success) {
        const role = result?.user?.role || user?.role;
        if (role === "doctor" || role === "admin") {
          navigate("/doctor-dashboard");
        } else {
          navigate("/dashboard");
        }
      } else {
        setError(result.message || "Invalid email or password.");
      }
    } catch (err) {
      setError("Server error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleGoogleLogin() {
    setError("Google login not implemented yet.");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-skull">
            <div className="skull-head">
              <div className="skull-eye"><div className="skull-fire"></div></div>
              <div className="skull-eye"><div className="skull-fire"></div></div>
              <div className="skull-nose"></div>
            </div>
            <div className="skull-jaw"></div>
          </div>
          <h1 className="auth-title">FractoScan</h1>
        </div>

        <p className="subtitle">
          Sign in to your account to continue
        </p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>

          {error && <div className="alert error">{error}</div>}

          <button
            type="submit"
            className="btn primary auth-btn"
            disabled={isLoading}
          >
            {isLoading ? "Signing In..." : "Login"}
          </button>
        </form>

        <div className="auth-separator">
          <span>OR</span>
        </div>

        <button className="btn google-btn" onClick={handleGoogleLogin}>
          Continue with Google
        </button>

        <div className="auth-footer">
          <p>
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
          <Link to="/" className="text-link back-link">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
