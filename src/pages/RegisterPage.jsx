import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");

  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();

    // ✅ PREVENT DOUBLE SUBMISSION (CRITICAL FIX)
    if (isLoading) return;

    setError("");
    setIsLoading(true);

    if (!name || !email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await register(name, email, password, role);

      console.log("Register result:", result);  // Temporary debug log

     if (result.success) {
  navigate("/login");

      } else {
        setError(result.message);
      }
    } catch (err) {
      setError("Server error. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }

  // ❌ Disabled until real Google OAuth is implemented
  function handleGoogleSignUp() {
    setError("Google sign-up not implemented yet.");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Skull with Fire Logo */}
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
          Create your account to get started
        </p>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field">
            <span>Full Name</span>
            <input
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>

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
                <span>Account Type</span>
                <select
                    value={role}
                      onChange={(e) => setRole(e.target.value)}
                      disabled={isLoading}
                >
                <option value="user">Patient / User</option>
                <option value="doctor">Doctor / Radiologist</option>
                </select>
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              placeholder="•••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
          </label>

          <label className="field">
            <span>Confirm Password</span>
            <input
              type="password"
              placeholder="•••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {isLoading ? "Registering..." : "Register"}
          </button>
        </form>

        <div className="auth-separator">
          <span>OR</span>
        </div>

        <button className="btn google-btn" onClick={handleGoogleSignUp}>
          Continue with Google
        </button>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Login here</Link>
          </p>
          <Link to="/" className="text-link back-link">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;