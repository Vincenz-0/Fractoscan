import React, { useState } from "react";
import ResultCard from "./ResultCard";
import axios from "axios";

const API_URL = "http://localhost:5001/api/predict"; // Backend proxy to ML server
const SCANS_API_URL = "http://127.0.0.1:5001/api/scans";

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function XrayUpload({ onAnalysisComplete, patientContext }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please upload a valid image file (X-ray).");
      setFile(null);
      setPreviewUrl("");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(selected);
      setError("");
      setFile(selected);
      setPreviewUrl(dataUrl);
      setResult(null);
    } catch {
      setError("Could not read this image. Please try another file.");
      setFile(null);
      setPreviewUrl("");
      setResult(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError("Please select an X-ray image first.");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (patientContext?.patientId) {
        formData.append("patientId", patientContext.patientId);
      }
      if (patientContext?.patientName) {
        formData.append("patientName", patientContext.patientName);
      }
      if (patientContext?.patientEmail) {
        formData.append("patientEmail", patientContext.patientEmail);
      }

      const response = await fetch(API_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process X-ray");
      }

      const data = await response.json();
      // Handle the response from ML model
      const parsedResult = {
        label: data.prediction || "Unknown",
        confidence: typeof data.confidence === "number" ? data.confidence : null,
        hasFracture: data.has_fracture || false,
        detections: data.detections || [],
        fileName: file?.name || "Unknown file",
        patientId: patientContext?.patientId || "",
        patientName: patientContext?.patientName || "",
        patientEmail: patientContext?.patientEmail || "",
        medicalReport:
          data.medicalReport && typeof data.medicalReport === "object"
            ? data.medicalReport
            : null
      };

      setResult(parsedResult);
      if (typeof onAnalysisComplete === "function") {
        onAnalysisComplete({
          ...parsedResult,
          fileName: file?.name || "Unknown file",
          imageData: previewUrl || ""
        });
      }

      try {
        const token = localStorage.getItem("token");
        if (token) {
          await axios.post(
            SCANS_API_URL,
            {
              fileName: file?.name || "",
              imageData: previewUrl || "",
              label: parsedResult.label,
              hasFracture: parsedResult.hasFracture,
              confidence: parsedResult.confidence,
              detections: parsedResult.detections || [],
              medicalReport: parsedResult.medicalReport
            },
            { headers: { "x-auth-token": token } }
          );
        }
      } catch (saveErr) {
        console.error("Failed to save scan:", saveErr);
      }
    } catch (err) {
      console.error("Error:", err);
      setError(err.message || "Failed to analyze X-ray. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setFile(null);
    setPreviewUrl("");
    setResult(null);
    setError("");
  }

  return (
    <section className="card">
      <h2 className="upload-heading">
        <span className="upload-heading-icon" aria-hidden="true">
          <svg viewBox="0 0 64 64" className="upload-heading-icon-svg">
            <defs>
              <linearGradient id="boneFill" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
            </defs>
            <circle cx="14" cy="20" r="7" fill="url(#boneFill)" />
            <circle cx="20" cy="14" r="7" fill="url(#boneFill)" />
            <circle cx="44" cy="50" r="7" fill="url(#boneFill)" />
            <circle cx="50" cy="44" r="7" fill="url(#boneFill)" />
            <rect x="18" y="24" width="28" height="16" rx="8" fill="url(#boneFill)" />
            <rect x="17" y="23" width="30" height="18" rx="9" fill="none" stroke="#64748b" strokeWidth="2" />
            <circle cx="14" cy="20" r="7" fill="none" stroke="#64748b" strokeWidth="2" />
            <circle cx="20" cy="14" r="7" fill="none" stroke="#64748b" strokeWidth="2" />
            <circle cx="44" cy="50" r="7" fill="none" stroke="#64748b" strokeWidth="2" />
            <circle cx="50" cy="44" r="7" fill="none" stroke="#64748b" strokeWidth="2" />
          </svg>
        </span>
        <span className="upload-heading-text">Upload X-ray</span>
      </h2>
      <p className="subtitle">
        Upload a bone X-ray image to check for possible fractures using AI.
      </p>

      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="file-input-label">
          <span>📁 Select X-ray Image</span>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            hidden
          />
        </label>

        {file && (
          <p className="file-name">
            ✓ Selected: <strong>{file.name}</strong>
          </p>
        )}

        {previewUrl && (
          <div className="preview-container">
            {result ? (
              <ResultCard result={result} previewUrl={previewUrl} inline />
            ) : (
              <img
                src={previewUrl}
                alt="X-ray preview"
                className="preview-image"
              />
            )}
          </div>
        )}

        <div className="button-row">
          <button type="submit" className="btn primary" disabled={loading}>
            {loading ? "🔄 Analyzing..." : "▶️ Analyze X-ray"}
          </button>
          <button
            type="button"
            className="btn secondary"
            onClick={handleClear}
          >
            🔄 Clear
          </button>
        </div>
      </form>

      {error && <div className="alert error">⚠️ {error}</div>}

      {/* Result is rendered inside the preview area to avoid extra scrolling. */}
    </section>
  );
}

export default XrayUpload;
