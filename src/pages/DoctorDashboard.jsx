import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const SCANS_API_URL = "http://127.0.0.1:5001/api/scans";
const PREDICT_API_URL = "http://localhost:5001/api/predict";

function getDoctorStatus(scan) {
  if (scan?.doctorStatus) {
    return scan.doctorStatus;
  }
  return scan?.reviewedAt ? "reviewed" : "pending_review";
}

function getStatusLabel(status) {
  switch (status) {
    case "pending_review":
      return "Pending Review";
    case "reviewed":
      return "Reviewed";
    case "completed":
      return "Completed";
    case "needs_followup":
      return "Needs Follow-up";
    default:
      return "Unknown";
  }
}

function getStatusClass(status) {
  if (status === "pending_review") {
    return "pending";
  }
  if (status === "needs_followup") {
    return "error";
  }
  return "analyzed";
}

function formatConfidence(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const normalized = value <= 1 ? value * 100 : value;
    return `${Math.round(Math.max(0, Math.min(100, normalized)))}%`;
  }

  if (typeof value === "string" && value.trim()) {
    if (value.includes("%")) {
      return value.trim();
    }
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const normalized = parsed <= 1 ? parsed * 100 : parsed;
      return `${Math.round(Math.max(0, Math.min(100, normalized)))}%`;
    }
  }

  return "N/A";
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

function DoctorDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [scans, setScans] = useState([]);
  const [patientScans, setPatientScans] = useState([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchId, setSearchId] = useState("");
  const [xrayPreview, setXrayPreview] = useState("");
  const [analysisPreview, setAnalysisPreview] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const analysisCanvasRef = useRef(null);

  const fetchPatientScansById = useCallback(async (patientId) => {
    const query = patientId.trim();
    if (!query) {
      setPatientScans([]);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setPatientScans([]);
        return;
      }

      const res = await axios.get(`${SCANS_API_URL}/patient/${query}`, {
        headers: { "x-auth-token": token }
      });

      setPatientScans(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Patient search error:", err);
      setPatientScans([]);
    }
  }, []);

  const refreshScans = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setScans([]);
        return;
      }

      const res = await axios.get(`${SCANS_API_URL}/doctor/all`, {
        headers: { "x-auth-token": token }
      });

      const entries = Array.isArray(res.data) ? res.data : [];
      setScans(entries);
    } catch {
      setScans([]);
    }
  }, []);

  useEffect(() => {
    refreshScans();

    const handleVisibility = () => {
      if (!document.hidden) {
        refreshScans();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(refreshScans, 5000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [refreshScans]);

  useEffect(() => {
    const detections = Array.isArray(analysisPreview?.detections)
      ? analysisPreview.detections
      : [];
    const imageData = analysisPreview?.imageData;
    if (!analysisCanvasRef.current || !imageData || detections.length === 0) {
      return;
    }

    const canvas = analysisCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      canvas.width = image.width;
      canvas.height = image.height;

      ctx.drawImage(image, 0, 0);

      detections.forEach((detection, index) => {
        const x1 = Number(detection?.x1);
        const y1 = Number(detection?.y1);
        const x2 = Number(detection?.x2);
        const y2 = Number(detection?.y2);
        if (![x1, y1, x2, y2].every((value) => Number.isFinite(value))) {
          return;
        }

        const boxWidth = Math.max(0, x2 - x1);
        const boxHeight = Math.max(0, y2 - y1);
        const detConfidence = formatConfidence(detection?.confidence);

        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, boxWidth, boxHeight);

        ctx.fillStyle = "#ff6b6b";
        ctx.fillRect(x1, Math.max(0, y1 - 28), 220, 22);
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 12px Arial";
        ctx.fillText(`Fracture #${index + 1} (${detConfidence})`, x1 + 6, Math.max(14, y1 - 12));
      });
    };
    image.src = imageData;
  }, [analysisPreview]);

  const statsData = useMemo(() => {
    const source = searchId ? patientScans : scans;
    const total = source.length;
    const now = new Date();
    const monthScans = source.filter((scan) => {
      const date = new Date(scan.createdAt);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;

    return {
      total,
      monthScans,
      pending: source.filter((scan) => getDoctorStatus(scan) === "pending_review").length
    };
  }, [scans, patientScans, searchId]);

  const filteredScans = useMemo(() => {
    if (!searchId.trim()) {
      return scans;
    }
    return patientScans;
  }, [scans, patientScans, searchId]);

  const patientReport = useMemo(() => {
    if (!searchId.trim()) {
      return null;
    }

    if (filteredScans.length === 0) {
      return {
        id: searchId.trim(),
        total: 0,
        fractureCount: 0,
        lastScan: "N/A"
      };
    }

    const fractureCount = filteredScans.filter((scan) => scan.hasFracture).length;

    return {
      id: searchId.trim(),
      total: filteredScans.length,
      fractureCount,
      lastScan: formatDateTime(filteredScans[0]?.createdAt) || "N/A"
    };
  }, [filteredScans, searchId]);

  async function handleSearchSubmit() {
    const query = searchInput.trim();
    setSearchId(query);
    fetchPatientScansById(query);
  }

  function handleSearchClear() {
    setSearchInput("");
    setSearchId("");
    setPatientScans([]);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleOpenXray(imageData) {
    if (!imageData) {
      return;
    }
    setXrayPreview(imageData);
  }

  function handleCloseXray() {
    setXrayPreview("");
  }

  async function handleOpenAnalysis(scan) {
    const detections = Array.isArray(scan?.detections) ? scan.detections : [];
    if (detections.length > 0) {
      setAnalysisPreview(scan);
      return;
    }

    if (!scan?.imageData) {
      setAnalysisPreview(scan);
      return;
    }

    try {
      setAnalysisLoading(true);
      const imageResponse = await fetch(scan.imageData);
      const imageBlob = await imageResponse.blob();
      const formData = new FormData();
      formData.append(
        "file",
        imageBlob,
        scan.fileName || `scan-${scan._id || scan.id || Date.now()}.png`
      );

      const predictResponse = await fetch(PREDICT_API_URL, {
        method: "POST",
        body: formData
      });

      if (!predictResponse.ok) {
        setAnalysisPreview(scan);
        return;
      }

      const predictData = await predictResponse.json();
      setAnalysisPreview({
        ...scan,
        label: scan.label || predictData.prediction || "",
        hasFracture:
          typeof scan.hasFracture === "boolean"
            ? scan.hasFracture
            : Boolean(predictData.has_fracture),
        confidence:
          typeof scan.confidence === "number"
            ? scan.confidence
            : typeof predictData.confidence === "number"
              ? predictData.confidence
              : null,
        detections: Array.isArray(predictData.detections) ? predictData.detections : []
      });
    } catch (error) {
      console.error("Analyze result preview error:", error);
      setAnalysisPreview(scan);
    } finally {
      setAnalysisLoading(false);
    }
  }

  function handleCloseAnalysis() {
    setAnalysisPreview(null);
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
        <section className="card">
          <h2>🔎 Find Patient Report</h2>
          <p className="subtitle">Search by patient ID to view their report.</p>
          <div className="button-row">
            <input
              type="text"
              placeholder="Patient ID"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="profile-input"
            />
            <button className="btn primary" type="button" onClick={handleSearchSubmit}>
              Search
            </button>
            <button className="btn secondary" type="button" onClick={handleSearchClear}>
              Clear
            </button>
          </div>
          {patientReport && (
            <div className="result-inline">
              <div className="result-item">
                <span className="result-label">Patient ID:</span>
                <span className="result-value">{patientReport.id}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Total Scans:</span>
                <span className="result-value">{patientReport.total}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Fractures Detected:</span>
                <span className="result-value">{patientReport.fractureCount}</span>
              </div>
              <div className="result-item">
                <span className="result-label">Most Recent Scan:</span>
                <span className="result-value">{patientReport.lastScan}</span>
              </div>
            </div>
          )}
        </section>

        <section className="stats-row">
          <div className="stat-card">
            <h3>📁 Total Analyses</h3>
            <p className="stat-number">{statsData.total}</p>
            <p className="stat-caption">All time records</p>
          </div>
          <div className="stat-card">
            <h3>📅 This Month</h3>
            <p className="stat-number">{statsData.monthScans}</p>
            <p className="stat-caption">Current month</p>
          </div>
          <div className="stat-card">
            <h3>⏳ Pending Review</h3>
            <p className="stat-number">{statsData.pending}</p>
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
                  <th>X-ray</th>
                  <th>Analyzed X-ray</th>
                  <th>Status</th>
                  <th>AI Confidence</th>
                  <th>Analyzed Result</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredScans.length === 0 ? (
                  <tr>
                    <td colSpan={8}>No scans yet.</td>
                  </tr>
                ) : (
                  filteredScans.map((scan) => {
                    const status = getDoctorStatus(scan);
                    const statusClass = getStatusClass(status);

                    return (
                    <tr key={scan._id || scan.id} className={`scan-row ${statusClass}`}>
                      <td>{scan.patientName || scan.patientId}</td>
                      <td>{formatDateTime(scan.createdAt)}</td>
                      <td>
                        {scan.imageData ? (
                          <div className="button-row">
                            <img
                              src={scan.imageData}
                              alt={scan.fileName || "Patient X-ray"}
                              className="scan-thumbnail"
                            />
                            <button
                              className="action-btn"
                              type="button"
                              onClick={() => handleOpenXray(scan.imageData)}
                            >
                              View X-ray
                            </button>
                          </div>
                        ) : (
                          "N/A"
                        )}
                      </td>
                      <td>
                        <button
                          className="action-btn"
                          type="button"
                          disabled={analysisLoading}
                          onClick={() => handleOpenAnalysis(scan)}
                        >
                          {analysisLoading ? "Analyzing..." : "View AI Result"}
                        </button>
                      </td>
                      <td>
                        <span className={`status-badge ${statusClass}`}>{getStatusLabel(status)}</span>
                      </td>
                      <td>
                        {formatConfidence(scan.confidence)}
                      </td>
                      <td>{scan.label || "N/A"}</td>
                      <td>
                        <span className={`result-badge ${scan.hasFracture ? "fracture" : "normal"}`}>
                          {scan.hasFracture ? "Fracture Detected" : "No Fracture"}
                        </span>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
      {xrayPreview && (
        <div className="profile-modal-backdrop" onClick={handleCloseXray}>
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Patient X-ray</h3>
              <button className="modal-close-btn" type="button" onClick={handleCloseXray}>
                ✕
              </button>
            </div>
            <img src={xrayPreview} alt="Patient X-ray" className="xray-modal-image" />
          </div>
        </div>
      )}
      {analysisPreview && (
        <div className="profile-modal-backdrop" onClick={handleCloseAnalysis}>
          <div className="profile-modal analysis-modal" onClick={(e) => e.stopPropagation()}>
            <div className="profile-modal-header">
              <h3>Analyzed X-ray</h3>
              <button className="modal-close-btn" type="button" onClick={handleCloseAnalysis}>
                ✕
              </button>
            </div>
            {!analysisPreview.imageData ? (
              <p className="subtitle">No X-ray image available.</p>
            ) : Array.isArray(analysisPreview.detections) &&
              analysisPreview.detections.length > 0 ? (
              <canvas ref={analysisCanvasRef} className="xray-modal-image annotated-canvas" />
            ) : (
              <div>
                <img src={analysisPreview.imageData} alt="Analyzed X-ray" className="xray-modal-image" />
                <p className="subtitle" style={{ marginTop: "0.75rem" }}>
                  Bounding box not available for this scan.
                </p>
              </div>
            )}
            <div className="analysis-grid">
              <div className="analysis-item">
                <span className="analysis-label">AI Result</span>
                <span className="analysis-value">{analysisPreview.label || "N/A"}</span>
              </div>
              <div className="analysis-item">
                <span className="analysis-label">Confidence</span>
                <span className="analysis-value">{formatConfidence(analysisPreview.confidence)}</span>
              </div>
              <div className="analysis-item">
                <span className="analysis-label">Outcome</span>
                <span className="analysis-value">
                  {analysisPreview.hasFracture ? "Fracture Detected" : "No Fracture"}
                </span>
              </div>
              <div className="analysis-item">
                <span className="analysis-label">Scan Time</span>
                <span className="analysis-value">{formatDateTime(analysisPreview.createdAt)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorDashboard;
