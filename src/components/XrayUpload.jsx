import React, { useState } from "react";
import ResultCard from "./ResultCard";

const API_URL = "http://localhost:5001/api/predict"; // Backend proxy to ML server

function XrayUpload() {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFileChange(e) {
    const selected = e.target.files[0];
    if (!selected) return;

    if (!selected.type.startsWith("image/")) {
      setError("Please upload a valid image file (X-ray).");
      setFile(null);
      setPreviewUrl("");
      return;
    }

    setError("");
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    setResult(null);
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
      setResult({
        label: data.prediction || "Unknown",
        confidence: typeof data.confidence === "number" ? data.confidence : null,
        hasFracture: data.has_fracture || false,
        detections: data.detections || []
      });
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
      <h2>🩻 Upload X-ray</h2>
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
            <img
              src={previewUrl}
              alt="X-ray preview"
              className="preview-image"
            />
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

      {result && <ResultCard result={result} previewUrl={previewUrl} />}
    </section>
  );
}

export default XrayUpload;
