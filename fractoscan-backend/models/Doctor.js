const mongoose = require("mongoose");

const DoctorSchema = new mongoose.Schema(
  {
    doctor_id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    specialization: { type: String, required: true, default: "Orthopedic", trim: true },
    hospital_name: { type: String, required: true, trim: true },
    role: { type: String, required: true, default: "doctor", index: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true, default: "password" },
    phone: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true, index: true },
    longitude: { type: Number, required: true, index: true },
    city: { type: String, required: true, trim: true, index: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Doctor", DoctorSchema);
