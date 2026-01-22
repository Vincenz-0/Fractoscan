import React, { useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";

function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scans, setScans] = useState([
    {
      id: 1,
      patientName: "John Doe",
      date: "2025-01-15",
      status: "Analyzed",
      confidence: "92%",
      result: "Fracture Detected"
    },
    {
      id: 2,
      patientName: "Jane Smith",
      date: "2025-01-14",
      status: "Analyzed",
      confidence: "88%",
      result: "No Fracture"
    },
    {
      id: 3,
      patientName: "Mike Johnson",
      date: "2025-01-13",
      status: "Pending",
      confidence: "-",
      result: "Processing..."
    }
  ]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <h1>👨‍⚕️ FractoScan Doctor Dashboard</h1>
          <p className="subtitle">
            Review and manage X-ray analyses with advanced AI insights.
          </p>
        </div>
        <div className="user-info">
          <span className="user-role">🩺 Dr. {user?.name}</span>
          <span className="user-email">📧 {user?.email}</span>
          <button className="btn secondary small" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <section className="stats-row">
          <div className="stat-card">
            <h3>📁 Total Analyses</h3>
            <p className="stat-number">245</p>
            <p className="stat-caption">All time records</p>
          </div>
          <div className="stat-card">
            <h3>📅 This Month</h3>
            <p className="stat-number">38</p>
            <p className="stat-caption">January 2025</p>
          </div>
          <div className="stat-card">
            <h3>🎯 Avg. Accuracy</h3>
            <p className="stat-number">94%</p>
            <p className="stat-caption">AI confidence score</p>
          </div>
          <div className="stat-card">
            <h3>⏳ Pending Review</h3>
            <p className="stat-number">7</p>
            <p className="stat-caption">Awaiting approval</p>
          </div>
        </section>

        <section className="scans-section">
          <h2>📊 Recent Patient Scans</h2>
          <div className="scans-table">
            <table>
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>AI Confidence</th>
                  <th>Result</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {scans.map((scan) => (
                  <tr key={scan.id} className={`scan-row ${scan.status.toLowerCase()}`}>
                    <td>{scan.patientName}</td>
                    <td>{scan.date}</td>
                    <td>
                      <span className={`status-badge ${scan.status.toLowerCase()}`}>
                        {scan.status}
                      </span>
                    </td>
                    <td>{scan.confidence}</td>
                    <td>
                      <span className={`result-badge ${scan.result.includes("Fracture") ? "fracture" : "normal"}`}>
                        {scan.result}
                      </span>
                    </td>
                    <td>
                      <button className="action-btn">🔍 Review</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DoctorDashboard;
