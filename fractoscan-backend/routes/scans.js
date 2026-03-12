const express = require("express");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const User = require("../models/User");
const Scan = require("../models/Scan");
const { buildMedicalReport } = require("../utils/medicalReport");

const router = express.Router();
const MANUAL_STATUSES = ["completed", "needs_followup"];

router.post("/", auth, role("user"), async (req, res) => {
  try {
    const { fileName, imageData, label, hasFracture, confidence, detections } = req.body;

    const user = await User.findById(req.user.id).select("name email");
    if (!user) {
      return res.status(404).json({ msg: "User not found" });
    }

    const normalizedDetections = Array.isArray(detections)
      ? detections
          .map((detection) => ({
            x1: Number(detection?.x1),
            y1: Number(detection?.y1),
            x2: Number(detection?.x2),
            y2: Number(detection?.y2),
            confidence: Number(detection?.confidence)
          }))
          .filter((detection) =>
            [detection.x1, detection.y1, detection.x2, detection.y2].every((value) =>
              Number.isFinite(value)
            )
          )
      : [];

    const generatedMedicalReport = buildMedicalReport({
      prediction: label || "",
      hasFracture: Boolean(hasFracture),
      confidence,
      detections: normalizedDetections,
      fileName: fileName || "",
      analyzedAt: new Date().toISOString(),
      patientId: user.id,
      patientName: user.name || "",
      patientEmail: user.email || ""
    });

    const scan = new Scan({
      patientId: user.id,
      patientName: user.name || "",
      patientEmail: user.email || "",
      fileName: fileName || "",
      imageData: imageData || "",
      label: label || "",
      hasFracture: Boolean(hasFracture),
      confidence: typeof confidence === "number" ? confidence : null,
      detections: normalizedDetections,
      medicalReport: generatedMedicalReport,
      doctorStatus: "pending_review"
    });

    await scan.save();
    res.json(scan);
  } catch (err) {
    console.error("❌ Save scan error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/patient/:patientId", auth, role("doctor"), async (req, res) => {
  try {
    const scans = await Scan.find({ patientId: req.params.patientId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(scans);
  } catch (err) {
    console.error("❌ Fetch patient scans error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/doctor/reviewed", auth, role("doctor"), async (req, res) => {
  try {
    const scans = await Scan.find({ reviewedBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(scans);
  } catch (err) {
    console.error("❌ Fetch reviewed scans error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.get("/doctor/all", auth, role("doctor"), async (req, res) => {
  try {
    const scans = await Scan.find({ reviewedBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json(scans);
  } catch (err) {
    console.error("❌ Fetch doctor scans error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.post("/:id/review", auth, role("doctor"), async (req, res) => {
  try {
    const scan = await Scan.findById(req.params.id);
    if (!scan) {
      return res.status(404).json({ msg: "Scan not found" });
    }

    if (scan.reviewedBy && scan.reviewedBy !== req.user.id) {
      return res.status(403).json({
        msg: "This scan has already been reviewed by another doctor"
      });
    }

    scan.reviewedBy = req.user.id;
    scan.reviewedAt = new Date();
    if (!scan.doctorStatus || scan.doctorStatus === "pending_review") {
      scan.doctorStatus = "reviewed";
    }
    await scan.save();

    res.json(scan);
  } catch (err) {
    console.error("❌ Review scan error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

router.patch("/:id/status", auth, role("doctor"), async (req, res) => {
  try {
    const { doctorStatus } = req.body;
    if (!MANUAL_STATUSES.includes(doctorStatus)) {
      return res.status(400).json({
        msg: `Invalid doctorStatus. Allowed: ${MANUAL_STATUSES.join(", ")}`
      });
    }

    const scan = await Scan.findById(req.params.id);
    if (!scan) {
      return res.status(404).json({ msg: "Scan not found" });
    }

    if (!scan.reviewedAt || !scan.reviewedBy) {
      return res.status(400).json({
        msg: "Doctor review is required before manual status update"
      });
    }

    if (scan.reviewedBy !== req.user.id) {
      return res.status(403).json({
        msg: "Only the reviewing doctor can update this status"
      });
    }

    scan.doctorStatus = doctorStatus;
    scan.statusUpdatedBy = req.user.id;
    scan.statusUpdatedAt = new Date();
    await scan.save();

    res.json(scan);
  } catch (err) {
    console.error("❌ Update scan status error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
