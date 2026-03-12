const express = require("express");
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const Doctor = require("../models/Doctor");
const ReviewRequest = require("../models/ReviewRequest");
const Scan = require("../models/Scan");
const User = require("../models/User");

const router = express.Router();

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

function normalizeStatus(value, fallback) {
  if (value === "pending_review" || value === "reviewed") {
    return value;
  }
  return fallback;
}

async function buildReviewRequest({ patientId, doctorIdInput, scan }) {
  const doctorProfile = await findDoctorByAnyId(doctorIdInput);
  if (!doctorProfile) {
    return { error: { status: 404, msg: "Doctor not found" } };
  }

  const doctorId = resolveDoctorId(doctorProfile, doctorIdInput);
  const scanId = String(scan?._id || "");
  if (!scanId) {
    return { error: { status: 500, msg: "Scan ID missing" } };
  }

  const existing = await ReviewRequest.findOne({
    patientId,
    doctorId,
    scanId,
    status: "pending_review"
  }).lean();

  if (existing) {
    return { request: existing };
  }

  const patientProfile = await User.findById(patientId).select("name email").lean();

  const request = new ReviewRequest({
    patientId,
    patientName: patientProfile?.name || "",
    patientEmail: patientProfile?.email || "",
    doctorId,
    doctorName: doctorProfile?.name || "Doctor",
    doctorEmail: doctorProfile?.email || "",
    scanId,
    scanCreatedAt: scan?.createdAt ? new Date(scan.createdAt) : new Date(),
    scanFileName: scan?.fileName || "",
    scanLabel: scan?.label || "",
    scanHasFracture: Boolean(scan?.hasFracture),
    scanConfidence: typeof scan?.confidence === "number" ? scan.confidence : null,
    status: "pending_review"
  });

  await request.save();
  return { request };
}

router.post("/", auth, role("user"), async (req, res) => {
  try {
    const doctorId = normalizeId(req.body?.doctorId);
    const scanId = normalizeId(req.body?.scanId);
    if (!doctorId || !scanId) {
      return res.status(400).json({ msg: "doctorId and scanId are required" });
    }

    const scan = await Scan.findById(scanId).lean();
    if (!scan) {
      return res.status(404).json({ msg: "Scan not found" });
    }

    if (scan.patientId !== req.user.id) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    if (scan.reviewedBy || scan.doctorStatus !== "pending_review") {
      return res.status(400).json({ msg: "This scan has already been reviewed" });
    }

    const { request, error } = await buildReviewRequest({
      patientId: req.user.id,
      doctorIdInput: doctorId,
      scan
    });
    if (error) {
      return res.status(error.status).json({ msg: error.msg });
    }

    return res.json(request);
  } catch (error) {
    console.error("❌ Create review request error:", error.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.post("/latest", auth, role("user"), async (req, res) => {
  try {
    const doctorId = normalizeId(req.body?.doctorId);
    if (!doctorId) {
      return res.status(400).json({ msg: "doctorId is required" });
    }

    const scan = await Scan.findOne({ patientId: req.user.id, doctorStatus: "pending_review" })
      .sort({ createdAt: -1 })
      .lean();

    if (!scan) {
      return res.status(400).json({ msg: "No pending scans found for this patient" });
    }

    const { request, error } = await buildReviewRequest({
      patientId: req.user.id,
      doctorIdInput: doctorId,
      scan
    });
    if (error) {
      return res.status(error.status).json({ msg: error.msg });
    }

    return res.json(request);
  } catch (error) {
    console.error("❌ Create latest review request error:", error.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.get("/doctor", auth, role("doctor", "admin"), async (req, res) => {
  try {
    const { ids: doctorIds } = await getDoctorIdentity(req.user.id);
    if (doctorIds.length === 0) {
      return res.json({ requests: [] });
    }

    const status = normalizeStatus(req.query?.status, "pending_review");
    const query = { doctorId: { $in: doctorIds } };
    if (status) {
      query.status = status;
    }

    const requests = await ReviewRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ requests });
  } catch (error) {
    console.error("❌ Fetch doctor review requests error:", error.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.get("/patient", auth, role("user"), async (req, res) => {
  try {
    const status = normalizeStatus(req.query?.status, null);
    const query = { patientId: req.user.id };
    if (status) {
      query.status = status;
    }

    const requests = await ReviewRequest.find(query)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({ requests });
  } catch (error) {
    console.error("❌ Fetch patient review requests error:", error.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.get("/:id", auth, role("doctor", "admin"), async (req, res) => {
  try {
    const request = await ReviewRequest.findById(req.params.id).lean();
    if (!request) {
      return res.status(404).json({ msg: "Review request not found" });
    }

    const { ids: doctorIds } = await getDoctorIdentity(req.user.id);
    if (!doctorIds.includes(request.doctorId)) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    const scan = await Scan.findById(request.scanId).lean();
    if (!scan) {
      return res.status(404).json({ msg: "Scan not found" });
    }

    if (scan.patientId !== request.patientId) {
      return res.status(400).json({ msg: "Review request is out of sync with scan record" });
    }

    return res.json({ request, scan });
  } catch (error) {
    console.error("❌ Fetch review request detail error:", error.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.post("/:id/complete", auth, role("doctor", "admin"), async (req, res) => {
  try {
    const doctorNotes =
      typeof req.body?.doctorNotes === "string" ? req.body.doctorNotes.trim() : "";

    const request = await ReviewRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ msg: "Review request not found" });
    }

    const { ids: doctorIds } = await getDoctorIdentity(req.user.id);
    if (!doctorIds.includes(request.doctorId)) {
      return res.status(403).json({ msg: "Forbidden" });
    }

    if (request.status === "reviewed") {
      return res.status(400).json({ msg: "This review request is already completed" });
    }

    const scan = await Scan.findById(request.scanId);
    if (!scan) {
      return res.status(404).json({ msg: "Scan not found" });
    }

    if (scan.patientId !== request.patientId) {
      return res.status(400).json({ msg: "Review request is out of sync with scan record" });
    }

    if (scan.reviewedBy && scan.reviewedBy !== req.user.id) {
      return res.status(403).json({ msg: "This scan has already been reviewed by another doctor" });
    }

    const now = new Date();
    scan.reviewedBy = req.user.id;
    scan.reviewedAt = now;
    scan.doctorNotes = doctorNotes;
    scan.doctorNotesAt = now;
    if (!scan.doctorStatus || scan.doctorStatus === "pending_review") {
      scan.doctorStatus = "reviewed";
    }
    await scan.save();

    request.status = "reviewed";
    request.reviewedBy = req.user.id;
    request.reviewedAt = now;
    request.doctorNotes = doctorNotes;
    await request.save();

    return res.json({ request });
  } catch (error) {
    console.error("❌ Complete review request error:", error.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
