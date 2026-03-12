const mongoose = require("mongoose");

const MedicalReportSchema = new mongoose.Schema(
  {
    reportId: String,
    reportTitle: String,
    facilityName: String,
    generatedAt: String,
    patientId: String,
    patientName: String,
    patientEmail: String,
    studyName: String,
    fileName: String,
    technique: String,
    outcome: String,
    confidencePercent: String,
    confidenceLevel: String,
    summary: String,
    findings: [String],
    impression: String,
    recommendations: [String],
    disclaimer: String,
    reportText: String
  },
  { _id: false }
);

const ScanSchema = new mongoose.Schema({
  patientId: { type: String, index: true },
  patientName: String,
  patientEmail: String,
  fileName: String,
  imageData: String,
  label: String,
  hasFracture: { type: Boolean, default: false },
  confidence: Number,
  detections: [
    {
      x1: Number,
      y1: Number,
      x2: Number,
      y2: Number,
      confidence: Number
    }
  ],
  medicalReport: {
    type: MedicalReportSchema,
    default: null
  },
  createdAt: { type: Date, default: Date.now },
  reviewedBy: { type: String, index: true },
  reviewedAt: Date,
  doctorNotes: { type: String, default: "", trim: true, maxlength: 4000 },
  doctorNotesAt: Date,
  doctorStatus: {
    type: String,
    enum: ["pending_review", "reviewed", "completed", "needs_followup"],
    default: "pending_review",
    index: true
  },
  statusUpdatedBy: { type: String, index: true },
  statusUpdatedAt: Date
});

module.exports = mongoose.model("Scan", ScanSchema);
