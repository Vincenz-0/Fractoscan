const express = require("express");
const Doctor = require("../models/Doctor");

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const city = typeof req.query?.city === "string" ? req.query.city.trim() : "";
    const specialization =
      typeof req.query?.specialization === "string" ? req.query.specialization.trim() : "";

    const filters = {};
    if (city) {
      filters.city = { $regex: new RegExp(`^${city}$`, "i") };
    }
    if (specialization) {
      filters.specialization = { $regex: specialization, $options: "i" };
    }

    const doctors = await Doctor.find(filters)
      .sort({ doctor_id: 1 })
      .select(
        "doctor_id name specialization hospital_name role email password phone latitude longitude city createdAt updatedAt"
      )
      .lean();

    return res.json({
      count: doctors.length,
      doctors
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch doctors",
      details: error?.message || "Unknown error"
    });
  }
});

module.exports = router;
