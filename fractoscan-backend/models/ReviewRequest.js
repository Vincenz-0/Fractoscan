const mongoose = require("mongoose");

const ReviewRequestSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, default: "" },
  patientEmail: { type: String, default: "" },
  doctorId: { type: String, required: true, index: true },
  doctorName: { type: String, default: "" },
  doctorEmail: { type: String, default: "" },
  scanId: { type: String, required: true, index: true },
  scanCreatedAt: { type: Date, required: true },
  scanFileName: { type: String, default: "" },
  scanLabel: { type: String, default: "" },
  scanHasFracture: { type: Boolean, default: false },
  scanConfidence: { type: Number, default: null },
  status: {
    type: String,
    enum: ["pending_review", "reviewed"],
    default: "pending_review",
    index: true
  },
  doctorNotes: { type: String, default: "", trim: true, maxlength: 4000 },
  reviewedBy: { type: String, default: "" },
  reviewedAt: Date,
  createdAt: { type: Date, default: Date.now, index: true }
});

ReviewRequestSchema.index({ patientId: 1, doctorId: 1, scanId: 1, status: 1 });

module.exports = mongoose.model("ReviewRequest", ReviewRequestSchema);

