import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { buildMedicalReport, formatMedicalReportText } from "../utils/medicalReport";

const SCANS_API_URL = "http://127.0.0.1:5001/api/scans";
const PREDICT_API_URL = "http://localhost:5001/api/predict";
const MESSAGES_API_URL = "http://127.0.0.1:5001/api/messages";
const REVIEW_REQUESTS_API_URL = "http://127.0.0.1:5001/api/review-requests";

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
  const [analysisReport, setAnalysisReport] = useState(null);
  const [analysisReportGenerated, setAnalysisReportGenerated] = useState(false);
  const [messageConversations, setMessageConversations] = useState([]);
  const [messageConversationsLoading, setMessageConversationsLoading] = useState(false);
  const [reviewRequests, setReviewRequests] = useState([]);
  const [reviewRequestsLoading, setReviewRequestsLoading] = useState(false);
  const [reviewRequestsError, setReviewRequestsError] = useState("");
  const [activeReviewRequest, setActiveReviewRequest] = useState(null);
  const [reviewNotesDraft, setReviewNotesDraft] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [activePatientId, setActivePatientId] = useState("");
  const [activeConversationMessages, setActiveConversationMessages] = useState([]);
  const [activeConversationLoading, setActiveConversationLoading] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [messageError, setMessageError] = useState("");
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

      const res = await axios.get(`${SCANS_API_URL}/doctor/reviewed`, {
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

  const fetchMessageConversations = useCallback(async (options = {}) => {
    if (!options.silent) {
      setMessageConversationsLoading(true);
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setMessageConversations([]);
        setActivePatientId("");
        return;
      }

      const res = await axios.get(`${MESSAGES_API_URL}/doctor/conversations`, {
        headers: { "x-auth-token": token }
      });

      const conversations = Array.isArray(res.data?.conversations) ? res.data.conversations : [];
      setMessageConversations(conversations);
      setActivePatientId((current) => {
        if (current && conversations.some((conversation) => conversation.patientId === current)) {
          return current;
        }
        return conversations[0]?.patientId || "";
      });
      setMessageError("");
    } catch (error) {
      if (!options.silent) {
        setMessageConversations([]);
        setActivePatientId("");
      }
      setMessageError(error?.response?.data?.error || "Could not load patient messages");
    } finally {
      if (!options.silent) {
        setMessageConversationsLoading(false);
      }
    }
  }, []);

  const fetchConversationMessages = useCallback(async (patientId, options = {}) => {
    const query = typeof patientId === "string" ? patientId.trim() : "";
    if (!query) {
      setActiveConversationMessages([]);
      return;
    }

    if (!options.silent) {
      setActiveConversationLoading(true);
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setActiveConversationMessages([]);
        return;
      }

      const res = await axios.get(`${MESSAGES_API_URL}/conversation`, {
        params: { patientId: query },
        headers: { "x-auth-token": token }
      });

      setActiveConversationMessages(Array.isArray(res.data?.messages) ? res.data.messages : []);
      setMessageError("");
    } catch (error) {
      if (!options.silent) {
        setActiveConversationMessages([]);
      }
      setMessageError(error?.response?.data?.error || "Could not load this conversation");
    } finally {
      if (!options.silent) {
        setActiveConversationLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchMessageConversations();
    const interval = setInterval(() => {
      fetchMessageConversations({ silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchMessageConversations]);

  useEffect(() => {
    if (!activePatientId) {
      setActiveConversationMessages([]);
      return;
    }

    fetchConversationMessages(activePatientId);
    const interval = setInterval(() => {
      fetchConversationMessages(activePatientId, { silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [activePatientId, fetchConversationMessages]);

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

  const activePatientConversation = useMemo(
    () =>
      messageConversations.find((conversation) => conversation.patientId === activePatientId) || null,
    [activePatientId, messageConversations]
  );

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

  function withMedicalReport(scan, predictData = null) {
    const hasFracture =
      typeof scan?.hasFracture === "boolean"
        ? scan.hasFracture
        : Boolean(predictData?.has_fracture);
    const confidence =
      typeof scan?.confidence === "number"
        ? scan.confidence
        : typeof predictData?.confidence === "number"
          ? predictData.confidence
          : null;
    const detections =
      Array.isArray(scan?.detections) && scan.detections.length > 0
        ? scan.detections
        : Array.isArray(predictData?.detections)
          ? predictData.detections
          : [];
    const patientId = scan?.patientId || predictData?.medicalReport?.patientId || "";
    const patientName = scan?.patientName || predictData?.medicalReport?.patientName || "";
    const patientEmail = scan?.patientEmail || predictData?.medicalReport?.patientEmail || "";
    const hasFormalStoredReport =
      scan?.medicalReport &&
      typeof scan.medicalReport === "object" &&
      typeof scan.medicalReport.reportTitle === "string";
    const hasFormalPredictedReport =
      predictData?.medicalReport &&
      typeof predictData.medicalReport === "object" &&
      typeof predictData.medicalReport.reportTitle === "string";

    const medicalReport = hasFormalStoredReport
      ? scan.medicalReport
      : hasFormalPredictedReport
        ? predictData.medicalReport
        : null;

    return {
      ...scan,
      label: scan?.label || predictData?.prediction || "",
      hasFracture,
      confidence,
      detections,
      patientId,
      patientName,
      patientEmail,
      medicalReport
    };
  }

  async function handleOpenAnalysis(scan) {
    setAnalysisReport(null);
    setAnalysisReportGenerated(false);

    const detections = Array.isArray(scan?.detections) ? scan.detections : [];
    if (detections.length > 0) {
      setAnalysisPreview(withMedicalReport(scan));
      return;
    }

    if (!scan?.imageData) {
      setAnalysisPreview(withMedicalReport(scan));
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
      if (scan?.patientId) {
        formData.append("patientId", scan.patientId);
      }
      if (scan?.patientName) {
        formData.append("patientName", scan.patientName);
      }
      if (scan?.patientEmail) {
        formData.append("patientEmail", scan.patientEmail);
      }

      const predictResponse = await fetch(PREDICT_API_URL, {
        method: "POST",
        body: formData
      });

      if (!predictResponse.ok) {
        setAnalysisPreview(withMedicalReport(scan));
        return;
      }

      const predictData = await predictResponse.json();
      setAnalysisPreview(withMedicalReport(scan, predictData));
    } catch (error) {
      console.error("Analyze result preview error:", error);
      setAnalysisPreview(withMedicalReport(scan));
    } finally {
      setAnalysisLoading(false);
    }
  }

  function handleCloseAnalysis() {
    setAnalysisPreview(null);
    setAnalysisReport(null);
    setAnalysisReportGenerated(false);
    setActiveReviewRequest(null);
    setReviewNotesDraft("");
    setReviewSubmitting(false);
    setReviewSubmitError("");
  }

  function createAnalysisReport() {
    if (!analysisPreview) {
      return null;
    }

    const hasFormalReportShape =
      analysisPreview?.medicalReport &&
      typeof analysisPreview.medicalReport === "object" &&
      typeof analysisPreview.medicalReport.reportTitle === "string";

    if (hasFormalReportShape) {
      return analysisPreview.medicalReport;
    }

    return buildMedicalReport({
      hasFracture: analysisPreview?.hasFracture,
      confidence: analysisPreview?.confidence,
      detections: analysisPreview?.detections,
      fileName: analysisPreview?.fileName,
      patientId: analysisPreview?.patientId,
      patientName: analysisPreview?.patientName,
      patientEmail: analysisPreview?.patientEmail,
      generatedAt: analysisPreview?.createdAt || new Date().toISOString()
    });
  }

  function handleGenerateAnalysisReport() {
    const report = createAnalysisReport();
    if (!report) {
      return;
    }

    setAnalysisReport(report);
    setAnalysisReportGenerated(true);
  }

  function handleDownloadAnalysisReport() {
    if (!analysisPreview || !analysisReportGenerated || !analysisReport) {
      return;
    }

    const reportContent =
      typeof analysisReport?.reportText === "string" && analysisReport.reportText.trim()
        ? analysisReport.reportText
        : formatMedicalReportText(analysisReport);

    const blob = new Blob([reportContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const baseFileName = (analysisPreview?.fileName || "scan")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase();
    const safePatientId = (analysisReport?.patientId || "na")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `${safePatientId}-${baseFileName || "scan"}-medical-report-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const fetchReviewRequests = useCallback(async (options = {}) => {
    if (!options.silent) {
      setReviewRequestsLoading(true);
    }

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setReviewRequests([]);
        return;
      }

      const res = await axios.get(`${REVIEW_REQUESTS_API_URL}/doctor`, {
        params: { status: "pending_review" },
        headers: { "x-auth-token": token }
      });

      const requests = Array.isArray(res.data?.requests) ? res.data.requests : [];
      setReviewRequests(requests);
      setReviewRequestsError("");
    } catch (error) {
      if (!options.silent) {
        setReviewRequests([]);
      }
      setReviewRequestsError(error?.response?.data?.msg || "Could not load review requests");
    } finally {
      if (!options.silent) {
        setReviewRequestsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchReviewRequests();
    const interval = setInterval(() => {
      fetchReviewRequests({ silent: true });
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchReviewRequests]);

  async function handleOpenReviewRequest(requestId) {
    const query = typeof requestId === "string" ? requestId.trim() : "";
    if (!query) {
      return;
    }

    try {
      setAnalysisLoading(true);
      setReviewSubmitError("");

      const token = localStorage.getItem("token");
      if (!token) {
        return;
      }

      const res = await axios.get(`${REVIEW_REQUESTS_API_URL}/${query}`, {
        headers: { "x-auth-token": token }
      });

      const request = res.data?.request || null;
      const scan = res.data?.scan || null;
      if (!request || !scan) {
        return;
      }

      setActiveReviewRequest(request);
      setReviewNotesDraft("");

      const mergedScan = withMedicalReport(scan);
      setAnalysisPreview(mergedScan);

      const report = mergedScan?.medicalReport && typeof mergedScan.medicalReport === "object"
        ? mergedScan.medicalReport
        : null;
      if (report) {
        setAnalysisReport(report);
        setAnalysisReportGenerated(true);
      } else {
        setAnalysisReport(null);
        setAnalysisReportGenerated(false);
      }
    } catch (error) {
      const msg = error?.response?.data?.msg || "Could not open this review request";
      setReviewSubmitError(msg);
      setReviewRequestsError(msg);
    } finally {
      setAnalysisLoading(false);
    }
  }

  async function handleCompleteReviewRequest() {
    if (!activeReviewRequest?._id) {
      return;
    }

    try {
      setReviewSubmitting(true);
      setReviewSubmitError("");

      const token = localStorage.getItem("token");
      if (!token) {
        setReviewSubmitError("Not authenticated");
        return;
      }

      await axios.post(
        `${REVIEW_REQUESTS_API_URL}/${activeReviewRequest._id}/complete`,
        { doctorNotes: reviewNotesDraft },
        { headers: { "x-auth-token": token } }
      );

      await fetchReviewRequests({ silent: true });
      refreshScans();
      handleCloseAnalysis();
    } catch (error) {
      setReviewSubmitError(error?.response?.data?.msg || "Could not complete this review");
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    const text = messageDraft.trim();
    if (!activePatientId || !text) {
      return;
    }

    setMessageSending(true);
    setMessageError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Not authenticated");
      }

      await axios.post(
        `${MESSAGES_API_URL}/send`,
        {
          patientId: activePatientId,
          text
        },
        { headers: { "x-auth-token": token } }
      );

      setMessageDraft("");
      await fetchConversationMessages(activePatientId, { silent: true });
      await fetchMessageConversations({ silent: true });
    } catch (error) {
      setMessageError(error?.response?.data?.error || error?.message || "Could not send message");
    } finally {
      setMessageSending(false);
    }
  }

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="dashboard-header-main">
          <p className="dashboard-kicker">Clinical Console</p>
          <h1>👨‍⚕️ FractoScan Doctor Dashboard</h1>
          <p className="subtitle">
            Review and manage X-ray analyses with advanced AI insights.
          </p>
          <div className="dashboard-header-tags">
            <span className="dashboard-tag">Review Workflow</span>
            <span className="dashboard-tag">AI + Doctor Oversight</span>
            <span className="dashboard-tag">Live Patient Search</span>
          </div>
        </div>
        <div className="dashboard-user-panel">
          <div className="user-info">
            <span className="user-role">🩺 Dr. {user?.name}</span>
            <span className="user-email">📧 {user?.email}</span>
            <button className="btn secondary small" onClick={handleLogout}>
              Logout
            </button>
          </div>
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

        <section className="card review-requests-card">
          <h2>🛎️ Review Requests</h2>
          <p className="subtitle">
            Patients who selected you for review appear here.
          </p>

          {reviewRequestsError && <p className="nearby-doctors-error">{reviewRequestsError}</p>}

          {reviewRequestsLoading ? (
            <p className="nearby-doctors-info">Loading review requests...</p>
          ) : reviewRequests.length === 0 ? (
            <p className="nearby-doctors-empty">No pending review requests.</p>
          ) : (
            <ul className="nearby-doctors-list">
              {reviewRequests.map((request) => (
                <li key={request._id} className="nearby-doctor-item">
                  <div className="nearby-doctor-main">
                    <p className="nearby-doctor-name">
                      {request.patientName || request.patientId}
                    </p>
                    <p className="nearby-doctor-meta">
                      {request.scanFileName || "X-ray scan"} · {formatDateTime(request.scanCreatedAt)}
                    </p>
                    <p className="nearby-doctor-meta">
                      {request.scanHasFracture ? "Fracture Detected" : "No Fracture"} ·{" "}
                      {request.scanLabel || "N/A"}
                    </p>
                  </div>
                  <div className="nearby-doctor-actions">
                    <button
                      type="button"
                      className="btn primary small"
                      disabled={analysisLoading}
                      onClick={() => handleOpenReviewRequest(request._id)}
                    >
                      Review
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card doctor-chat-card">
          <h2>💬 Patient Communication</h2>
          <p className="subtitle">
            Review and respond when patients select you and send a message.
          </p>

          {messageError && <p className="nearby-doctors-error">{messageError}</p>}

          {messageConversationsLoading ? (
            <p className="nearby-doctors-info">Loading patient conversations...</p>
          ) : messageConversations.length === 0 ? (
            <p className="nearby-doctors-empty">No patient conversations yet.</p>
          ) : (
            <div className="doctor-chat-layout">
              <aside className="doctor-chat-thread-list">
                {messageConversations.map((conversation) => {
                  const isActive = conversation.patientId === activePatientId;
                  return (
                    <button
                      key={conversation.patientId}
                      type="button"
                      className={`doctor-chat-thread-btn ${isActive ? "active" : ""}`}
                      onClick={() => setActivePatientId(conversation.patientId)}
                    >
                      <span className="doctor-chat-thread-name">
                        {conversation.patientName || conversation.patientId}
                      </span>
                      <span className="doctor-chat-thread-preview">{conversation.lastMessage || "No message"}</span>
                      <span className="doctor-chat-thread-time">
                        {formatDateTime(conversation.lastMessageAt)}
                      </span>
                    </button>
                  );
                })}
              </aside>

              <div className="doctor-chat-window">
                {activePatientConversation && (
                  <p className="nearby-location-note">
                    Chatting with {activePatientConversation.patientName || activePatientConversation.patientId}
                  </p>
                )}

                <div className="chat-message-list">
                  {activeConversationLoading ? (
                    <p className="chat-message-empty">Loading conversation...</p>
                  ) : activeConversationMessages.length === 0 ? (
                    <p className="chat-message-empty">No messages yet in this conversation.</p>
                  ) : (
                    activeConversationMessages.map((message) => {
                      const isMine = message.senderRole === "doctor";
                      return (
                        <div
                          key={message._id || `${message.createdAt}-${message.text}`}
                          className={`chat-message-bubble ${isMine ? "mine" : "theirs"}`}
                        >
                          <p>{message.text}</p>
                          <span className="chat-message-meta">
                            {isMine ? "You" : (activePatientConversation?.patientName || "Patient")} •{" "}
                            {formatDateTime(message.createdAt)}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>

                <form className="chat-compose-form" onSubmit={handleSendMessage}>
                  <input
                    className="chat-compose-input"
                    type="text"
                    maxLength={2000}
                    placeholder="Reply to patient..."
                    value={messageDraft}
                    onChange={(e) => setMessageDraft(e.target.value)}
                    disabled={!activePatientId}
                  />
                  <button
                    className="btn primary"
                    type="submit"
                    disabled={messageSending || !activePatientId || !messageDraft.trim()}
                  >
                    {messageSending ? "Sending..." : "Send Reply"}
                  </button>
                </form>
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
          <h2>📊 Your Recent Patient Scans</h2>
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
            <div className="analysis-modal-body">
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
              <div className="report-gate">
                <div>
                  <p className="report-gate-title">Medical Report</p>
                  <p className="report-gate-subtitle">
                    Generate a formal report for this analyzed scan.
                  </p>
                </div>
                <div className="report-actions">
                  {!analysisReportGenerated ? (
                    <button
                      type="button"
                      className="btn primary generate-report-btn"
                      onClick={handleGenerateAnalysisReport}
                    >
                      Generate Medical Report
                    </button>
                  ) : (
                    <>
                      <span className="report-ready-pill">Report Generated</span>
                      <button
                        type="button"
                        className="btn secondary small"
                        onClick={handleDownloadAnalysisReport}
                      >
                        Download Report
                      </button>
                    </>
                  )}
                </div>
              </div>

              {analysisReportGenerated && analysisReport && (
                <div className="analysis-report report-document">
                  <h4>Preliminary Radiology Report</h4>
                  <div className="report-meta-grid">
                    <div className="report-meta-item">
                      <span className="report-heading">Report ID</span>
                      <p>{analysisReport.reportId || "N/A"}</p>
                    </div>
                    <div className="report-meta-item">
                      <span className="report-heading">Patient ID</span>
                      <p>{analysisReport.patientId || analysisPreview.patientId || "N/A"}</p>
                    </div>
                    <div className="report-meta-item">
                      <span className="report-heading">Patient Name</span>
                      <p>{analysisReport.patientName || analysisPreview.patientName || "N/A"}</p>
                    </div>
                    <div className="report-meta-item">
                      <span className="report-heading">Generated At</span>
                      <p>{analysisReport.generatedAt || "N/A"}</p>
                    </div>
                  </div>
                  <p className="report-summary">{analysisReport.summary}</p>
                  <p>
                    <strong>Impression:</strong> {analysisReport.impression}
                  </p>
                  <div className="report-block">
                    <span className="report-heading">Recommendations</span>
                    <ul className="report-list">
                      {(analysisReport.recommendations || []).map((recommendation, index) => (
                        <li key={`analysis-recommendation-${index}`}>{recommendation}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {activeReviewRequest && (
                <div className="doctor-review-panel">
                  <h4>Doctor Review Notes</h4>
                  <p className="subtitle">
                    Share your findings with the patient, then mark this review as done.
                  </p>
                  <textarea
                    className="doctor-review-textarea"
                    placeholder="Write your review notes..."
                    value={reviewNotesDraft}
                    onChange={(e) => setReviewNotesDraft(e.target.value)}
                    rows={5}
                  />
                  {reviewSubmitError && (
                    <p className="nearby-doctors-error">{reviewSubmitError}</p>
                  )}
                  <div className="doctor-review-actions">
                    <button
                      type="button"
                      className="btn primary"
                      onClick={handleCompleteReviewRequest}
                      disabled={reviewSubmitting}
                    >
                      {reviewSubmitting ? "Sending..." : "Done"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorDashboard;
