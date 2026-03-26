import React, { useEffect, useRef, useState } from "react";
import { buildMedicalReport, formatMedicalReportText } from "../utils/medicalReport";

function ResultCard({ result, previewUrl, inline = false }) {
  const canvasRef = useRef(null);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [generatedReport, setGeneratedReport] = useState(null);

  const confidencePercent =
    typeof result.confidence === "number"
      ? (result.confidence * 100).toFixed(1)
      : null;

  const hasDetections = Array.isArray(result?.detections) && result.detections.length > 0;
  const hasFracture = hasDetections;

  useEffect(() => {
    setReportGenerated(false);
    setGeneratedReport(null);
  }, [result]);

  function createMedicalReport() {
    const hasFormalReportShape =
      result?.medicalReport &&
      typeof result.medicalReport === "object" &&
      typeof result.medicalReport.reportTitle === "string";

    if (hasFormalReportShape) {
      return result.medicalReport;
    }

    return buildMedicalReport({
      hasFracture,
      confidence: result?.confidence,
      detections: result?.detections,
      fileName: result?.fileName,
      patientId: result?.patientId,
      patientName: result?.patientName,
      patientEmail: result?.patientEmail,
      generatedAt: result?.medicalReport?.generatedAt || new Date().toISOString()
    });
  }

  function handleGenerateReport() {
    const report = createMedicalReport();
    setGeneratedReport(report);
    setReportGenerated(true);
  }

  function handleDownloadReport() {
    if (!reportGenerated || !generatedReport) {
      return;
    }

    const reportContent =
      typeof generatedReport?.reportText === "string" && generatedReport.reportText.trim()
        ? generatedReport.reportText
        : formatMedicalReportText(generatedReport);

    const blob = new Blob([reportContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const safeFileName = (result?.fileName || "xray")
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase();
    const safePatientId = (generatedReport?.patientId || "na")
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase();
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = url;
    link.download = `${safePatientId}-${safeFileName || "xray"}-medical-report-${timestamp}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  // Draw bounding boxes on the image
  useEffect(() => {
    if (!previewUrl || !canvasRef.current || !hasDetections) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;

      // Draw the image
      ctx.drawImage(img, 0, 0);

      // Draw bounding boxes
      result.detections.forEach((detection, idx) => {
        const x1 = detection.x1;
        const y1 = detection.y1;
        const x2 = detection.x2;
        const y2 = detection.y2;
        const confidence =
          typeof detection.confidence === "number"
            ? (detection.confidence * 100).toFixed(1)
            : "N/A";

        // Draw red rectangle
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 3;
        ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

        // Draw label background
        ctx.fillStyle = "#ff6b6b";
        ctx.fillRect(x1, y1 - 30, 200, 25);

        // Draw text
        ctx.fillStyle = "#fff";
        ctx.font = "bold 14px Arial";
        ctx.fillText(`Fracture #${idx + 1} (${confidence}%)`, x1 + 5, y1 - 10);
      });
    };

    img.src = previewUrl;
  }, [previewUrl, hasDetections, result.detections]);

  const rootClassName = inline
    ? `result-inline ${hasFracture ? "fractured" : "normal"}`
    : `result-card ${hasFracture ? "fractured" : "normal"}`;

  return (
    <div className={rootClassName}>
      <h3>📋 Preliminary Radiology Report</h3>

      <div className="result-content">
        <div className="result-item">
          <span className="result-label">Prediction:</span>
          <span className={`result-value ${hasFracture ? "text-fractured" : "text-normal"}`}>
            {hasFracture ? "⚠️ Fracture Detected" : "✅ No Fracture Detected"}
          </span>
        </div>

        {confidencePercent && (
          <div className="result-item">
            <span className="result-label">Confidence Level:</span>
            <div className="confidence-container">
              <span className="result-confidence-value">{confidencePercent}%</span>
              <div className="confidence-bar">
                <div
                  className={`confidence-fill ${hasFracture ? "fill-high" : "fill-medium"}`}
                  style={{ width: `${confidencePercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Display annotated image with bounding boxes */}
        {previewUrl && hasDetections && (
          <div className="result-item">
            <span className="result-label">📍 Detected Fracture Location:</span>
            <canvas
              ref={canvasRef}
              className="annotated-image"
              style={{ maxWidth: "100%", marginTop: "1rem", borderRadius: "8px", border: "2px solid #ff6b6b" }}
            />
            <div className="detections-list">
              {result.detections.map((detection, idx) => (
                <div key={idx} className="detection-item">
                  <span className="detection-badge">
                    🎯 Fracture #{idx + 1} - {(detection.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Show image for normal cases */}
        {previewUrl && !hasFracture && (
          <div className="result-item">
            <span className="result-label">📊 Analyzed X-ray Image:</span>
            <img
              src={previewUrl}
              alt="X-ray analysis"
              style={{ maxWidth: "100%", marginTop: "1rem", borderRadius: "8px", border: "1px solid var(--border-color)" }}
            />
          </div>
        )}
      </div>

      <div className="report-gate">
        <div>
          <p className="report-gate-title">Medical Report</p>
          <p className="report-gate-subtitle">
            Generate a formal AI-assisted radiology report for this analysis.
          </p>
        </div>
        <div className="report-actions">
          {!reportGenerated ? (
            <button type="button" className="btn primary generate-report-btn" onClick={handleGenerateReport}>
              Generate Medical Report
            </button>
          ) : (
            <>
              <span className="report-ready-pill">Report Generated</span>
              <button type="button" className="btn secondary small" onClick={handleDownloadReport}>
                Download Report
              </button>
            </>
          )}
        </div>
      </div>

      {reportGenerated && generatedReport && (
        <div className="result-item medical-report-panel report-document">
          <span className="result-label">🧾 Preliminary Radiology Report</span>
          <div className="report-meta-grid">
            <div className="report-meta-item">
              <span className="report-heading">Report ID</span>
              <p>{generatedReport.reportId || "N/A"}</p>
            </div>
            <div className="report-meta-item">
              <span className="report-heading">Patient ID</span>
              <p>{generatedReport.patientId || "N/A"}</p>
            </div>
            <div className="report-meta-item">
              <span className="report-heading">Patient Name</span>
              <p>{generatedReport.patientName || "N/A"}</p>
            </div>
            <div className="report-meta-item">
              <span className="report-heading">Generated At</span>
              <p>{generatedReport.generatedAt || "N/A"}</p>
            </div>
            <div className="report-meta-item">
              <span className="report-heading">Study</span>
              <p>{generatedReport.studyName || "N/A"}</p>
            </div>
            <div className="report-meta-item">
              <span className="report-heading">Image File</span>
              <p>{generatedReport.fileName || result?.fileName || "N/A"}</p>
            </div>
          </div>
          <div className="report-block">
            <span className="report-heading">Clinical Summary</span>
            <p className="report-summary">{generatedReport.summary}</p>
          </div>
          <div className="report-block">
            <span className="report-heading">Findings</span>
            <ul className="report-list">
              {(generatedReport.findings || []).map((finding, index) => (
                <li key={`finding-${index}`}>{finding}</li>
              ))}
            </ul>
          </div>
          <div className="report-block">
            <span className="report-heading">Impression</span>
            <p>{generatedReport.impression}</p>
          </div>
          <div className="report-block">
            <span className="report-heading">Recommendations</span>
            <ul className="report-list">
              {(generatedReport.recommendations || []).map((recommendation, index) => (
                <li key={`recommendation-${index}`}>{recommendation}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="disclaimer">
        <strong>⚕️ Medical Notice:</strong> This is a decision-support tool only. 
        Final diagnosis must be confirmed by a qualified medical professional.
      </p>
    </div>
  );
}

export default ResultCard;
