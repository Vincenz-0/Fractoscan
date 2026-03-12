console.log("STEP 3: server.js loaded");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const connectDB = require("./config/db");

connectDB();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
// const path = require("path");
const multer = require("multer");
const { buildMedicalReport } = require("./utils/medicalReport");

const app = express();

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());
app.use(express.urlencoded({ limit: "50mb", extended: true }));
app.use(cors());

app.use((req, res, next) => {
  console.log(`[Backend] ${req.method} ${req.url}`);
  next();
});

app.use("/api/auth", require("./routes/auth"));
app.use("/api/scans", require("./routes/scans"));
app.use("/api/nearby-doctors", require("./routes/nearbyDoctors"));
app.use("/api/doctors", require("./routes/doctors"));
app.use("/api/messages", require("./routes/messages"));
app.use("/api/review-requests", require("./routes/reviewRequests"));

app.get("/", (req, res) => {
  console.log("STEP 3: ROOT HIT");
  res.send("CORS OK");
});

// Prediction endpoint - forwards to ML model
app.post("/api/predict", upload.single("file"), async (req, res) => {
  try {
    console.log("[Backend] Received file upload request");
    
    if (!req.file) {
      console.error("[Backend] No file in request");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("[Backend] File received:", req.file.originalname, "Size:", req.file.size);

    // Create FormData to send to ML server
    const formData = new FormData();
    formData.append("file", req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    console.log("[Backend] Forwarding to ML server at http://127.0.0.1:5000/predict");
    
    // Forward request to ML server with timeout
    const mlResponse = await axios.post("http://127.0.0.1:5000/predict", formData, {
      headers: formData.getHeaders(),
      timeout: 60000
    });

    const medicalReport = buildMedicalReport({
      prediction: mlResponse?.data?.prediction,
      hasFracture: Boolean(mlResponse?.data?.has_fracture),
      confidence: mlResponse?.data?.confidence,
      detections: mlResponse?.data?.detections,
      fileName: req.file?.originalname,
      analyzedAt: new Date().toISOString(),
      patientId: typeof req.body?.patientId === "string" ? req.body.patientId : "",
      patientName: typeof req.body?.patientName === "string" ? req.body.patientName : "",
      patientEmail: typeof req.body?.patientEmail === "string" ? req.body.patientEmail : ""
    });

    const responsePayload = {
      ...mlResponse.data,
      medicalReport
    };

    console.log("[Backend] ML response received:", responsePayload);
    res.json(responsePayload);
  } catch (error) {
    console.error("[Backend] Prediction error:", error.message);
    console.error("[Backend] Error code:", error.code);
    
    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({ 
        error: "ML Server not running",
        details: "Cannot connect to ML server on http://127.0.0.1:5000. Please start the ML server."
      });
    }
    
    res.status(500).json({ 
      error: "Failed to process prediction",
      details: error.message 
    });
  }
});

app.listen(5001, "127.0.0.1", () => {
  console.log("STEP 3: LISTENING on port 5001");
});
