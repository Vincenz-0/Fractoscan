const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const Message = require("../models/Message");
const Doctor = require("../models/Doctor");
const User = require("../models/User");

const router = express.Router();

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeId(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveDoctorId(doctor, fallbackId = "") {
  if (doctor?.doctor_id) {
    return doctor.doctor_id;
  }
  if (doctor?._id) {
    return String(doctor._id);
  }
  return fallbackId;
}

async function findDoctorByAnyId(rawId) {
  const doctorId = normalizeId(rawId);
  if (!doctorId) {
    return null;
  }

  const filters = [{ doctor_id: doctorId }];
  if (mongoose.Types.ObjectId.isValid(doctorId)) {
    filters.push({ _id: doctorId });
  }

  return Doctor.findOne({ $or: filters }).select("doctor_id name email").lean();
}

async function getDoctorIdentity(rawId) {
  const baseId = normalizeId(rawId);
  const doctorProfile = await findDoctorByAnyId(baseId);
  const ids = [baseId].filter(Boolean);

  const canonicalDoctorId = resolveDoctorId(doctorProfile);
  if (canonicalDoctorId && !ids.includes(canonicalDoctorId)) {
    ids.push(canonicalDoctorId);
  }

  if (doctorProfile?._id) {
    const objectId = String(doctorProfile._id);
    if (objectId && !ids.includes(objectId)) {
      ids.push(objectId);
    }
  }

  return {
    doctorProfile,
    ids
  };
}

router.get("/patient/conversations", auth, role("user"), async (req, res) => {
  try {
    const messages = await Message.find({ patientId: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    const grouped = new Map();
    messages.forEach((message) => {
      if (!grouped.has(message.doctorId)) {
        grouped.set(message.doctorId, {
          doctorId: message.doctorId,
          doctorName: message.doctorName || "Doctor",
          doctorEmail: message.doctorEmail || "",
          lastMessage: message.text || "",
          lastMessageAt: message.createdAt,
          lastSenderRole: message.senderRole
        });
      }
    });

    return res.json({ conversations: Array.from(grouped.values()) });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch patient conversations",
      details: error?.message || "Unknown error"
    });
  }
});

router.get("/doctor/conversations", auth, role("doctor", "admin"), async (req, res) => {
  try {
    const { ids: doctorIds } = await getDoctorIdentity(req.user.id);
    if (doctorIds.length === 0) {
      return res.json({ conversations: [] });
    }

    const messages = await Message.find({ doctorId: { $in: doctorIds } })
      .sort({ createdAt: -1 })
      .lean();

    const grouped = new Map();
    messages.forEach((message) => {
      if (!grouped.has(message.patientId)) {
        grouped.set(message.patientId, {
          patientId: message.patientId,
          patientName: message.patientName || "Patient",
          patientEmail: message.patientEmail || "",
          lastMessage: message.text || "",
          lastMessageAt: message.createdAt,
          lastSenderRole: message.senderRole
        });
      }
    });

    return res.json({ conversations: Array.from(grouped.values()) });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch doctor conversations",
      details: error?.message || "Unknown error"
    });
  }
});

router.get("/conversation", auth, async (req, res) => {
  try {
    if (req.user.role === "user") {
      const doctorId = normalizeId(req.query?.doctorId);
      if (!doctorId) {
        return res.status(400).json({ error: "doctorId is required" });
      }

      const messages = await Message.find({
        patientId: req.user.id,
        doctorId
      })
        .sort({ createdAt: 1 })
        .lean();

      return res.json({ messages });
    }

    if (req.user.role === "doctor" || req.user.role === "admin") {
      const patientId = normalizeId(req.query?.patientId);
      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }

      const { ids: doctorIds } = await getDoctorIdentity(req.user.id);
      if (doctorIds.length === 0) {
        return res.json({ messages: [] });
      }

      const messages = await Message.find({
        patientId,
        doctorId: { $in: doctorIds }
      })
        .sort({ createdAt: 1 })
        .lean();

      return res.json({ messages });
    }

    return res.status(403).json({ error: "Forbidden" });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch conversation",
      details: error?.message || "Unknown error"
    });
  }
});

router.post("/send", auth, async (req, res) => {
  try {
    const text = normalizeText(req.body?.text);
    if (!text) {
      return res.status(400).json({ error: "Message text is required" });
    }

    if (req.user.role === "user") {
      const doctorIdInput = normalizeId(req.body?.doctorId);
      if (!doctorIdInput) {
        return res.status(400).json({ error: "doctorId is required" });
      }

      const doctorProfile = await findDoctorByAnyId(doctorIdInput);
      if (!doctorProfile) {
        return res.status(404).json({ error: "Doctor not found" });
      }

      const patientProfile = await User.findById(req.user.id).select("name email").lean();
      const doctorId = resolveDoctorId(doctorProfile, doctorIdInput);

      const message = new Message({
        patientId: req.user.id,
        patientName: patientProfile?.name || "",
        patientEmail: patientProfile?.email || "",
        doctorId,
        doctorName: doctorProfile?.name || "Doctor",
        doctorEmail: doctorProfile?.email || "",
        senderId: req.user.id,
        senderRole: "patient",
        text
      });

      await message.save();
      return res.json(message);
    }

    if (req.user.role === "doctor" || req.user.role === "admin") {
      const patientId = normalizeId(req.body?.patientId);
      if (!patientId) {
        return res.status(400).json({ error: "patientId is required" });
      }

      const patientProfile = await User.findById(patientId).select("name email").lean();
      if (!patientProfile) {
        return res.status(404).json({ error: "Patient not found" });
      }

      const { doctorProfile, ids: doctorIds } = await getDoctorIdentity(req.user.id);
      const doctorId = resolveDoctorId(doctorProfile, doctorIds[0] || req.user.id);

      const message = new Message({
        patientId,
        patientName: patientProfile?.name || "",
        patientEmail: patientProfile?.email || "",
        doctorId,
        doctorName: doctorProfile?.name || "Doctor",
        doctorEmail: doctorProfile?.email || "",
        senderId: req.user.id,
        senderRole: "doctor",
        text
      });

      await message.save();
      return res.json(message);
    }

    return res.status(403).json({ error: "Forbidden" });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to send message",
      details: error?.message || "Unknown error"
    });
  }
});

module.exports = router;
