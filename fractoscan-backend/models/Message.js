const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  patientId: { type: String, required: true, index: true },
  patientName: { type: String, default: "" },
  patientEmail: { type: String, default: "" },
  doctorId: { type: String, required: true, index: true },
  doctorName: { type: String, default: "" },
  doctorEmail: { type: String, default: "" },
  senderId: { type: String, required: true },
  senderRole: { type: String, enum: ["patient", "doctor"], required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  createdAt: { type: Date, default: Date.now, index: true }
});

MessageSchema.index({ patientId: 1, doctorId: 1, createdAt: 1 });

module.exports = mongoose.model("Message", MessageSchema);
