import React, { useEffect, useRef } from "react";

function ResultCard({ result, previewUrl, inline = false }) {
  const canvasRef = useRef(null);

  const isFractured =
    result.label && result.label.toLowerCase().includes("fract");

  const confidencePercent =
    typeof result.confidence === "number"
      ? (result.confidence * 100).toFixed(1)
      : null;

  const hasDetections = result.detections && result.detections.length > 0;

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
        const confidence = (detection.confidence * 100).toFixed(1);

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
    ? `result-inline ${isFractured ? "fractured" : "normal"}`
    : `result-card ${isFractured ? "fractured" : "normal"}`;

  return (
    <div className={rootClassName}>
      <h3>✨ AI Assessment Report</h3>

      <div className="result-content">
        <div className="result-item">
          <span className="result-label">Prediction:</span>
          <span className={`result-value ${isFractured ? "text-fractured" : "text-normal"}`}>
            {isFractured ? "⚠️ Fracture Detected" : "✅ No Fracture Detected"}
          </span>
        </div>

        {confidencePercent && (
          <div className="result-item">
            <span className="result-label">Confidence Level:</span>
            <div className="confidence-container">
              <span className="result-confidence-value">{confidencePercent}%</span>
              <div className="confidence-bar">
                <div
                  className={`confidence-fill ${isFractured ? "fill-high" : "fill-medium"}`}
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

        {/* Fallback when fracture detected but specific location not identified */}
        {previewUrl && isFractured && !hasDetections && (
          <div className="result-item">
            <div className="no-detection-message">
              <h4>⚠️ Fracture Detected - Location Analysis</h4>
              <p>
                A fracture has been detected in this X-ray (confidence: {confidencePercent}%), 
                but the AI could not pinpoint the exact location. 
                The fracture may be subtle or at the image edges.
              </p>
            </div>
            <span className="result-label">📊 Original X-ray Image:</span>
            <div className="fracture-warning-overlay">
              <img
                src={previewUrl}
                alt="X-ray with detected fracture"
                className="preview-image"
                style={{ marginTop: "0" }}
              />
            </div>
          </div>
        )}

        {/* Show image for normal cases */}
        {previewUrl && !isFractured && (
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

      <p className="disclaimer">
        <strong>⚕️ Medical Notice:</strong> This is a decision-support tool only. 
        Final diagnosis must be confirmed by a qualified medical professional.
      </p>
    </div>
  );
}

export default ResultCard;
