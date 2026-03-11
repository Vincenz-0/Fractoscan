import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import XrayUpload from "../components/XrayUpload";

const SCAN_HISTORY_STORAGE_KEY = "fractoscan_scan_history_v1";
const NEARBY_DOCTORS_API_URL = "http://127.0.0.1:5001/api/nearby-doctors";
const MESSAGES_API_URL = "http://127.0.0.1:5001/api/messages";

async function fetchNearbyDoctors(lat, lon) {
  const response = await fetch(NEARBY_DOCTORS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ lat, lon })
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error || "Failed to fetch nearby doctors");
  }

  const payload = await response.json();
  return {
    doctors: Array.isArray(payload?.doctors) ? payload.doctors : [],
    mode: payload?.mode === "nearest" ? "nearest" : "within_radius",
    radiusKm: typeof payload?.radiusKm === "number" ? payload.radiusKm : 20
  };
}

function getUserLocation() {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      resolve,
      reject,
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000
      }
    );
  });
}

function getDoctorId(doctor) {
  if (!doctor || typeof doctor !== "object") {
    return "";
  }
  const primary = typeof doctor.doctor_id === "string" ? doctor.doctor_id.trim() : "";
  if (primary) {
    return primary;
  }
  const fallback = typeof doctor.id === "string" ? doctor.id.trim() : "";
  return fallback;
}

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
  const [nearbyDoctors, setNearbyDoctors] = useState([]);
  const [nearbyDoctorsLoading, setNearbyDoctorsLoading] = useState(false);
  const [nearbyDoctorsError, setNearbyDoctorsError] = useState("");
  const [nearbyDoctorsInfo, setNearbyDoctorsInfo] = useState("");
  const [nearbyDoctorsRequested, setNearbyDoctorsRequested] = useState(false);
  const [nearbyLocation, setNearbyLocation] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [conversationMessages, setConversationMessages] = useState([]);
  const [conversationLoading, setConversationLoading] = useState(false);
  const [conversationSending, setConversationSending] = useState(false);
  const [conversationText, setConversationText] = useState("");
  const [conversationError, setConversationError] = useState("");
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
        medicalReport:
          result?.medicalReport && typeof result.medicalReport === "object"
            ? result.medicalReport
            : null,
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

  const selectedDoctorId = getDoctorId(selectedDoctor);

  const fetchConversationByDoctor = useCallback(async (doctorId, options = {}) => {
    const normalizedDoctorId = typeof doctorId === "string" ? doctorId.trim() : "";
    if (!normalizedDoctorId) {
      setConversationMessages([]);
      return;
    }

    if (!options.silent) {
      setConversationLoading(true);
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setConversationMessages([]);
        return;
      }

      const response = await fetch(
        `${MESSAGES_API_URL}/conversation?doctorId=${encodeURIComponent(normalizedDoctorId)}`,
        {
          headers: { "x-auth-token": token }
        }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to fetch conversation");
      }

      setConversationMessages(Array.isArray(payload?.messages) ? payload.messages : []);
      setConversationError("");
    } catch (error) {
      setConversationError(error?.message || "Could not load conversation");
      if (!options.silent) {
        setConversationMessages([]);
      }
    } finally {
      if (!options.silent) {
        setConversationLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedDoctorId) {
      setConversationMessages([]);
      return;
    }

    fetchConversationByDoctor(selectedDoctorId);
    const interval = setInterval(() => {
      fetchConversationByDoctor(selectedDoctorId, { silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchConversationByDoctor, selectedDoctorId]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  function handleSelectDoctor(doctor) {
    const doctorId = getDoctorId(doctor);
    if (!doctorId) {
      return;
    }

    setSelectedDoctor({
      ...doctor,
      id: doctorId,
      doctor_id: doctorId
    });
    setConversationText("");
    setConversationError("");
  }

  async function handleSendConversationMessage(e) {
    e.preventDefault();
    const text = conversationText.trim();

    if (!selectedDoctorId || !text) {
      return;
    }

    setConversationSending(true);
    setConversationError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`${MESSAGES_API_URL}/send`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-auth-token": token
        },
        body: JSON.stringify({
          doctorId: selectedDoctorId,
          text
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to send message");
      }

      setConversationText("");
      await fetchConversationByDoctor(selectedDoctorId, { silent: true });
    } catch (error) {
      setConversationError(error?.message || "Could not send message");
    } finally {
      setConversationSending(false);
    }
  }

  async function handleFindNearbyDoctors() {
    setNearbyDoctorsRequested(true);
    setNearbyDoctorsLoading(true);
    setNearbyDoctorsError("");
    setNearbyDoctorsInfo("");

    try {
      const location = await getUserLocation();
      const lat = location?.coords?.latitude;
      const lon = location?.coords?.longitude;
      if (typeof lat !== "number" || typeof lon !== "number") {
        throw new Error("Could not read your current location.");
      }

      setNearbyLocation({ lat, lon });
      const { doctors, mode, radiusKm } = await fetchNearbyDoctors(lat, lon);

      setNearbyDoctors(doctors);
      if (doctors.length === 0) {
        setNearbyDoctorsInfo(`No doctors found in the doctor database for this location.`);
      } else if (mode === "nearest") {
        setNearbyDoctorsInfo(
          `No doctors found within ${radiusKm} km. Showing nearest doctors from the database.`
        );
      } else {
        setNearbyDoctorsInfo(`Showing doctors within ${radiusKm} km from the database.`);
      }
    } catch (error) {
      if (error?.code === 1) {
        setNearbyDoctors([]);
        setNearbyDoctorsInfo("");
        setNearbyDoctorsError("Location permission denied. Please allow location access and try again.");
      } else if (error?.code === 2) {
        setNearbyDoctors([]);
        setNearbyDoctorsInfo("");
        setNearbyDoctorsError("Could not detect your location. Try again in an open area.");
      } else if (error?.code === 3) {
        setNearbyDoctors([]);
        setNearbyDoctorsInfo("");
        setNearbyDoctorsError("Location request timed out. Please try again.");
      } else {
        setNearbyDoctors([]);
        setNearbyDoctorsInfo("");
        setNearbyDoctorsError("Could not fetch nearby doctors right now. Please try again later.");
      }
    } finally {
      setNearbyDoctorsLoading(false);
    }
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
        <div className="dashboard-header-main">
          <p className="dashboard-kicker">Patient Workspace</p>
          <h1>🔍 FractoScan Dashboard</h1>
          <p className="subtitle">
            Upload and analyze X-rays for potential fractures with AI precision.
          </p>
          <div className="dashboard-header-tags">
            <span className="dashboard-tag">AI Live Analysis</span>
            <span className="dashboard-tag">Protected Session</span>
            <span className="dashboard-tag">Fast Report Export</span>
          </div>
        </div>
        <div className="dashboard-user-panel">
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

        <section className="card nearby-doctors-card">
          <div className="nearby-doctors-head">
            <div>
              <h2>🧭 Nearby Doctors</h2>
              <p className="subtitle">
                Click the button to use your location and list nearby doctors from our doctor database.
              </p>
            </div>
            <button
              type="button"
              className="btn primary nearby-doctors-btn"
              onClick={handleFindNearbyDoctors}
              disabled={nearbyDoctorsLoading}
            >
              {nearbyDoctorsLoading
                ? "Finding Nearby Doctors..."
                : nearbyDoctorsRequested
                  ? "Refresh Nearby Doctors"
                  : "Find Nearby Doctors"}
            </button>
          </div>

          {nearbyLocation && (
            <p className="nearby-location-note">
              Using location: {nearbyLocation.lat.toFixed(4)}, {nearbyLocation.lon.toFixed(4)}
            </p>
          )}

          {nearbyDoctorsInfo && <p className="nearby-doctors-info">{nearbyDoctorsInfo}</p>}

          {nearbyDoctorsError && <p className="nearby-doctors-error">{nearbyDoctorsError}</p>}

          {!nearbyDoctorsError && nearbyDoctorsRequested && !nearbyDoctorsLoading && nearbyDoctors.length === 0 && (
            <p className="nearby-doctors-empty">No nearby doctors to display right now.</p>
          )}

          {nearbyDoctors.length > 0 && (
            <ul className="nearby-doctors-list">
              {nearbyDoctors.map((doctor) => (
                <li key={doctor.id} className="nearby-doctor-item">
                  <div className="nearby-doctor-main">
                    <p className="nearby-doctor-name">{doctor.name}</p>
                    <p className="nearby-doctor-meta">
                      {doctor.address || "Address not available"} · {doctor.distanceText} away
                    </p>
                    {doctor.specialization && <p className="nearby-doctor-meta">{doctor.specialization}</p>}
                  </div>
                  <div className="nearby-doctor-actions">
                    <button
                      type="button"
                      className={`btn ${selectedDoctorId === getDoctorId(doctor) ? "secondary" : "primary"} small`}
                      onClick={() => handleSelectDoctor(doctor)}
                    >
                      {selectedDoctorId === getDoctorId(doctor) ? "Selected" : "Select Doctor"}
                    </button>
                    {doctor.phone && (
                      <a className="btn secondary small" href={`tel:${String(doctor.phone).replace(/\s+/g, "")}`}>
                        Call
                      </a>
                    )}
                    {doctor.email && (
                      <a className="btn secondary small" href={`mailto:${doctor.email}`}>
                        Email
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selectedDoctorId && (
            <div className="doctor-chat-panel">
              <div className="doctor-chat-head">
                <h3>💬 Chat with {selectedDoctor?.name || "Selected Doctor"}</h3>
                <p className="subtitle">
                  Send updates or questions directly to your selected doctor.
                </p>
              </div>

              {conversationError && <p className="nearby-doctors-error">{conversationError}</p>}

              <div className="chat-message-list">
                {conversationLoading ? (
                  <p className="chat-message-empty">Loading messages...</p>
                ) : conversationMessages.length === 0 ? (
                  <p className="chat-message-empty">No messages yet. Start the conversation.</p>
                ) : (
                  conversationMessages.map((message) => {
                    const isMine = message.senderRole === "patient";
                    return (
                      <div
                        key={message._id || `${message.createdAt}-${message.text}`}
                        className={`chat-message-bubble ${isMine ? "mine" : "theirs"}`}
                      >
                        <p>{message.text}</p>
                        <span className="chat-message-meta">
                          {isMine ? "You" : (selectedDoctor?.name || "Doctor")} • {formatDateTime(message.createdAt)}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              <form className="chat-compose-form" onSubmit={handleSendConversationMessage}>
                <input
                  className="chat-compose-input"
                  type="text"
                  maxLength={2000}
                  placeholder="Type your message for the doctor..."
                  value={conversationText}
                  onChange={(e) => setConversationText(e.target.value)}
                />
                <button className="btn primary" type="submit" disabled={conversationSending || !conversationText.trim()}>
                  {conversationSending ? "Sending..." : "Send Message"}
                </button>
              </form>
            </div>
          )}
        </section>

        <section className="dashboard-layout">
          <div className="dashboard-upload-column">
            <XrayUpload
              onAnalysisComplete={saveScan}
              patientContext={{
                patientId: user?._id || "",
                patientName: user?.name || "",
                patientEmail: user?.email || ""
              }}
            />
          </div>

          <section className="scans-section dashboard-scans-column">
            <details className="scan-history-group">
              <summary className="scan-history-group-summary">
                <span className="scan-history-group-title">📚 Previous Scans</span>
                <span className="scan-history-group-arrow" aria-hidden="true">
                  ▾
                </span>
              </summary>
              <div className="scan-history-group-content">
                <div className="scan-history-dropdown">
                  {scanHistory.length === 0 ? (
                    <p className="scan-history-empty">No scans yet. Upload an X-ray to start your history.</p>
                  ) : (
                    scanHistory.map((scan) => (
                      <details key={scan.id} className="scan-history-item">
                        <summary className="scan-history-summary">
                          <span className="scan-history-file">{scan.fileName || "Unknown file"}</span>
                          <span className="scan-history-date">{formatDateTime(scan.createdAt)}</span>
                          <span className={`result-badge ${scan.hasFracture ? "fracture" : "normal"}`}>
                            {scan.hasFracture ? "Fracture Detected" : "No Fracture"}
                          </span>
                          <span className="scan-history-arrow" aria-hidden="true">
                            ▾
                          </span>
                        </summary>
                        <div className="scan-history-content">
                          {scan.imageData ? (
                            <img className="scan-thumbnail" src={scan.imageData} alt={scan.fileName || "Scan"} />
                          ) : (
                            <span className="scan-history-na">No preview</span>
                          )}
                          <div className="scan-history-meta">
                            <p>
                              <strong>File:</strong> {scan.fileName || "Unknown file"}
                            </p>
                            <p>
                              <strong>Date:</strong> {formatDateTime(scan.createdAt)}
                            </p>
                            <p>
                              <strong>Confidence:</strong>{" "}
                              {typeof scan.confidence === "number" ? `${Math.round(scan.confidence)}%` : "N/A"}
                            </p>
                          </div>
                        </div>
                      </details>
                    ))
                  )}
                </div>
              </div>
            </details>
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
