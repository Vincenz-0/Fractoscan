import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import XrayUpload from "../components/XrayUpload";

function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [statsData] = useState({
    todayScans: 12,
    fracturePositives: 4,
    avgConfidence: 93,
    successRate: 96
  });

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>🔍 FractoScan Dashboard</h1>
          <p className="subtitle">
            Upload and analyze X-rays for potential fractures with AI precision.
          </p>
        </div>
        <div className="user-info">
          <span className="user-email">👤 {user?.email}</span>
          <button className="btn secondary small" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="stats-row">
          <div className="stat-card">
            <h3>📊 Today's Scans</h3>
            <p className="stat-number">{statsData.todayScans}</p>
            <p className="stat-caption">Analysis completed</p>
          </div>
          <div className="stat-card">
            <h3>⚠️ Fractures Found</h3>
            <p className="stat-number">{statsData.fracturePositives}</p>
            <p className="stat-caption">Positive detections</p>
          </div>
          <div className="stat-card">
            <h3>🎯 Avg. Confidence</h3>
            <p className="stat-number">{statsData.avgConfidence}%</p>
            <p className="stat-caption">AI model accuracy</p>
          </div>
          <div className="stat-card">
            <h3>✅ Success Rate</h3>
            <p className="stat-number">{statsData.successRate}%</p>
            <p className="stat-caption">Detection accuracy</p>
          </div>
        </section>

        <XrayUpload />
      </main>
    </div>
  );
}

export default Dashboard;
