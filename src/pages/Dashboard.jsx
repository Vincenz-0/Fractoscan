import React from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import XrayUpload from "../components/XrayUpload";

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>FractoScan Dashboard</h1>
          <p className="subtitle">
            Upload and analyze X-rays for potential fractures.
          </p>
        </div>
        <div className="user-info">
          <span className="user-email">{user?.email}</span>
          <button className="btn secondary small" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="stats-row">
          <div className="stat-card">
            <h3>Today’s Scans</h3>
            <p className="stat-number">12</p>
            <p className="stat-caption">Demo value • can connect to backend</p>
          </div>
          <div className="stat-card">
            <h3>Fracture Positives</h3>
            <p className="stat-number">4</p>
          </div>
          <div className="stat-card">
            <h3>Avg. Confidence</h3>
            <p className="stat-number">93%</p>
          </div>
        </section>

        <XrayUpload />
      </main>
    </div>
  );
}

export default Dashboard;
