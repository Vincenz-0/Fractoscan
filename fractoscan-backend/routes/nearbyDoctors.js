const express = require("express");
const Doctor = require("../models/Doctor");

const router = express.Router();
const DEFAULT_RADIUS_KM = 20;
const MAX_RADIUS_KM = 100;
const MAX_RESULTS = 20;

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const startLat = toRadians(lat1);
  const endLat = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function formatDistance(distanceKm) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

router.post("/", async (req, res) => {
  const lat = Number(req?.body?.lat);
  const lon = Number(req?.body?.lon);
  const requestedRadius = Number(req?.body?.radiusKm);
  const specialization =
    typeof req?.body?.specialization === "string" ? req.body.specialization.trim() : "";

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ error: "Invalid coordinates." });
  }

  const radiusKm = Number.isFinite(requestedRadius)
    ? Math.max(1, Math.min(MAX_RADIUS_KM, requestedRadius))
    : DEFAULT_RADIUS_KM;

  try {
    const filters = {};
    if (specialization) {
      filters.specialization = { $regex: specialization, $options: "i" };
    }

    const doctors = await Doctor.find(filters)
      .select(
        "doctor_id name specialization hospital_name role email phone latitude longitude city"
      )
      .lean();

    const enriched = doctors
      .filter(
        (doctor) =>
          Number.isFinite(doctor?.latitude) && Number.isFinite(doctor?.longitude)
      )
      .map((doctor) => {
        const distanceKm = calculateDistanceKm(
          lat,
          lon,
          doctor.latitude,
          doctor.longitude
        );
        const addressParts = [doctor.hospital_name, doctor.city].filter(
          (value) => typeof value === "string" && value.trim()
        );

        return {
          id: doctor.doctor_id || String(doctor?._id || ""),
          doctor_id: doctor.doctor_id,
          name: doctor.name,
          role: doctor.role || "doctor",
          specialization: doctor.specialization,
          hospital_name: doctor.hospital_name,
          email: doctor.email,
          phone: doctor.phone,
          city: doctor.city,
          address: addressParts.join(", "),
          lat: doctor.latitude,
          lon: doctor.longitude,
          distanceKm,
          distanceText: formatDistance(distanceKm)
        };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);

    const withinRadius = enriched
      .filter((doctor) => doctor.distanceKm <= radiusKm)
      .slice(0, MAX_RESULTS);
    const hasNearby = withinRadius.length > 0;
    const resultDoctors = hasNearby ? withinRadius : enriched.slice(0, MAX_RESULTS);

    return res.json({
      mode: hasNearby ? "within_radius" : "nearest",
      source: "doctor_database",
      radiusKm,
      doctors: resultDoctors
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch nearby doctors",
      details: error?.message || "Unknown error"
    });
  }
});

module.exports = router;
