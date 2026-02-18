import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import XrayUpload from "../components/XrayUpload";

const SCAN_HISTORY_STORAGE_KEY = "fractoscan_scan_history_v1";

function getUserHistoryKey(user) {
  return user?._id || user?.email || null;
}

function normalizeConfidenceToPercent(confidence) {
  if (typeof confidence !== "number" || Number.isNaN(confidence)) {
    return null;
  }

  if (confidence >= 0 && confidence <= 1) {
    return confidence * 100;
  }

  if (confidence > 1 && confidence <= 100) {
    return confidence;
  }

  return null;
}

function isSameLocalDay(isoDate, date) {
  const scanDate = new Date(isoDate);
  return (
    scanDate.getFullYear() === date.getFullYear() &&
    scanDate.getMonth() === date.getMonth() &&
    scanDate.getDate() === date.getDate()
  );
}

function formatDateTime(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function Dashboard() {
  const { user, logout, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [scanHistory, setScanHistory] = useState([]);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: "",
    email: "",
    password: ""
  });
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    const userHistoryKey = getUserHistoryKey(user);
    if (!userHistoryKey) {
      setScanHistory([]);
      return;
    }

    try {
      const raw = localStorage.getItem(SCAN_HISTORY_STORAGE_KEY);
      const allHistory = raw ? JSON.parse(raw) : {};
      setScanHistory(Array.isArray(allHistory[userHistoryKey]) ? allHistory[userHistoryKey] : []);
    } catch {
      setScanHistory([]);
    }
  }, [user]);

  useEffect(() => {
    setProfileForm({
      name: user?.name || "",
      email: user?.email || "",
      password: ""
    });
  }, [user]);

  const saveScan = useCallback(
    (result) => {
      const userHistoryKey = getUserHistoryKey(user);
      if (!userHistoryKey) {
        return;
      }

      const scanRecord = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        createdAt: new Date().toISOString(),
        hasFracture: Boolean(result?.hasFracture),
        confidence: normalizeConfidenceToPercent(result?.confidence),
        label: result?.label || "Unknown",
        fileName: result?.fileName || "Unknown file",
        imageData: typeof result?.imageData === "string" ? result.imageData : "",
        patientEmail: user?.email || "",
        patientName: user?.name || "",
        patientId: user?._id || ""
      };

      setScanHistory((prevHistory) => {
        const nextHistory = [scanRecord, ...prevHistory];

        try {
          const raw = localStorage.getItem(SCAN_HISTORY_STORAGE_KEY);
          const allHistory = raw ? JSON.parse(raw) : {};
          allHistory[userHistoryKey] = nextHistory;
          localStorage.setItem(SCAN_HISTORY_STORAGE_KEY, JSON.stringify(allHistory));
        } catch {
          // Keep in-memory data even if storage fails.
        }

        return nextHistory;
      });
    },
    [user]
  );

  const statsData = useMemo(() => {
    const today = new Date();
    const todayScans = scanHistory.filter((scan) => isSameLocalDay(scan.createdAt, today)).length;
    const fracturePositives = scanHistory.filter((scan) => scan.hasFracture).length;
    const confidenceValues = scanHistory
      .map((scan) => scan.confidence)
      .filter((value) => typeof value === "number" && !Number.isNaN(value));

    const avgConfidence = confidenceValues.length
      ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length
      : 0;

    const highConfidenceRate = confidenceValues.length
      ? (confidenceValues.filter((value) => value >= 80).length / confidenceValues.length) * 100
      : 0;

    return {
      todayScans,
      fracturePositives,
      avgConfidence: Math.round(avgConfidence),
      highConfidenceRate: Math.round(highConfidenceRate)
    };
  }, [scanHistory]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");

    const trimmedName = profileForm.name.trim();
    const trimmedEmail = profileForm.email.trim();

    if (!trimmedName || !trimmedEmail) {
      setProfileError("Name and email are required.");
      return;
    }

    setProfileSaving(true);
    const result = await updateProfile({
      name: trimmedName,
      email: trimmedEmail,
      password: profileForm.password
    });
    setProfileSaving(false);

    if (!result.success) {
      setProfileError(result.message || "Failed to update profile");
      return;
    }

    setProfileSuccess("Profile updated successfully.");
    setProfileForm((prev) => ({ ...prev, password: "" }));
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
          <span className="user-email">👤 {user?._id || "Unknown ID"}</span>
          <button
            className="btn secondary small"
            onClick={() => setShowEditProfile(true)}
            aria-label="Edit profile"
            title="Edit profile"
          >
            ⚙
          </button>
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
            <p className="stat-caption">Across all completed scans</p>
          </div>
          <div className="stat-card">
            <h3>✅ High Confidence</h3>
            <p className="stat-number">{statsData.highConfidenceRate}%</p>
            <p className="stat-caption">Scans at 80%+ confidence</p>
          </div>
        </section>

        <section className="dashboard-layout">
          <div className="dashboard-upload-column">
            <XrayUpload onAnalysisComplete={saveScan} />
          </div>

          <section className="scans-section dashboard-scans-column">
            <h2>📚 Previous Scans</h2>
            <div className="scans-table">
              <table>
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>File</th>
                    <th>Date</th>
                    <th>Result</th>
                    <th>Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {scanHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5}>No scans yet. Upload an X-ray to start your history.</td>
                    </tr>
                  ) : (
                    scanHistory.map((scan) => (
                      <tr key={scan.id} className="scan-row analyzed">
                        <td>
                          {scan.imageData ? (
                            <img className="scan-thumbnail" src={scan.imageData} alt={scan.fileName || "Scan"} />
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td>{scan.fileName || "Unknown file"}</td>
                        <td>{formatDateTime(scan.createdAt)}</td>
                        <td>
                          <span className={`result-badge ${scan.hasFracture ? "fracture" : "normal"}`}>
                            {scan.hasFracture ? "Fracture Detected" : "No Fracture"}
                          </span>
                        </td>
                        <td className="confidence-score">
                          {typeof scan.confidence === "number" ? `${Math.round(scan.confidence)}%` : "N/A"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </section>
      </main>

      {showEditProfile && (
        <div className="profile-modal-backdrop" onClick={() => setShowEditProfile(false)}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Edit Profile</h3>
              <button className="modal-close-btn" onClick={() => setShowEditProfile(false)}>
                ✕
              </button>
            </div>

            <form className="profile-form" onSubmit={handleProfileSave}>
              <label>
                Name
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </label>

              <label>
                Email
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                  required
                />
              </label>

              <label>
                New Password (optional)
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Leave empty to keep current password"
                />
              </label>

              {profileError && <p className="profile-form-message error">{profileError}</p>}
              {profileSuccess && <p className="profile-form-message success">{profileSuccess}</p>}

              <div className="profile-form-actions">
                <button type="button" className="btn secondary" onClick={() => setShowEditProfile(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn primary" disabled={profileSaving}>
                  {profileSaving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
