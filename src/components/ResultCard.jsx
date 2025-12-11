import React from "react";

function ResultCard({ result }) {
  const isFractured =
    result.label && result.label.toLowerCase().includes("fract");

  const confidencePercent =
    typeof result.confidence === "number"
      ? (result.confidence * 100).toFixed(1)
      : null;

  return (
    <div className={`result-card ${isFractured ? "fractured" : "normal"}`}>
      <h3>AI Assessment</h3>

      <p className="result-label">
        Prediction:{" "}
        <span className={isFractured ? "text-fractured" : "text-normal"}>
          {isFractured ? "Fractured" : "Not Fractured"}
        </span>
      </p>

      {confidencePercent && (
        <p className="result-confidence">
          Confidence: <strong>{confidencePercent}%</strong>
        </p>
      )}

      <p className="disclaimer">
        *This is a decision-support tool. Final diagnosis must be confirmed by a
        qualified doctor.
      </p>
    </div>
  );
}

export default ResultCard;
