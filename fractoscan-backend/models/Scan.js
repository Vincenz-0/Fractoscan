const mongoose = require("mongoose");

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
  createdAt: { type: Date, default: Date.now },
  reviewedBy: { type: String, index: true },
  reviewedAt: Date,
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
