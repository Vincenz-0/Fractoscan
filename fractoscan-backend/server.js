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
const ML_PREDICT_URL =
  typeof process.env.ML_PREDICT_URL === "string" && process.env.ML_PREDICT_URL.trim()
    ? process.env.ML_PREDICT_URL.trim()
    : "http://127.0.0.1:5000/predict";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getMlBaseUrl(predictUrl) {
  try {
    const url = new URL(predictUrl);
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

const ML_BASE_URL = getMlBaseUrl(ML_PREDICT_URL);

function isRetryableMlError(error) {
  const status = error?.response?.status;
  if (typeof status === "number" && [502, 503, 504].includes(status)) return true;

  const code = error?.code;
  return typeof code === "string" && ["ECONNRESET", "ETIMEDOUT", "ECONNABORTED"].includes(code);
}

async function waitForMlWarmup() {
  if (!ML_BASE_URL) return false;

  const maxMs = Number(process.env.ML_WARMUP_MAX_MS) > 0 ? Number(process.env.ML_WARMUP_MAX_MS) : 60000;
  const intervalMs =
    Number(process.env.ML_WARMUP_INTERVAL_MS) > 0 ? Number(process.env.ML_WARMUP_INTERVAL_MS) : 4000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < maxMs) {
    try {
      const resp = await axios.get(ML_BASE_URL, { timeout: 10000 });
      if (resp && typeof resp.status === "number" && resp.status >= 200 && resp.status < 500) {
        console.log("[Backend] ML warmup ok:", resp.status);
        return true;
      }
    } catch (warmErr) {
      const warmStatus = warmErr?.response?.status;
      console.warn("[Backend] ML warmup retry:", warmStatus || warmErr?.code || warmErr?.message);
    }

    await sleep(intervalMs);
  }

  return false;
}

async function callMlPredict(file) {
  const timeout = Number(process.env.ML_TIMEOUT_MS) > 0 ? Number(process.env.ML_TIMEOUT_MS) : 180000;
  const maxAttempts = Number(process.env.ML_RETRY_ATTEMPTS) > 0 ? Number(process.env.ML_RETRY_ATTEMPTS) : 2;

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const formData = new FormData();
    formData.append("file", file.buffer, {
      filename: file.originalname,
      contentType: file.mimetype
    });

    try {
      if (attempt > 1) {
        console.log(`[Backend] Retrying ML request (${attempt}/${maxAttempts})`);
      }

      return await axios.post(ML_PREDICT_URL, formData, {
        headers: formData.getHeaders(),
        timeout
      });
    } catch (err) {
      lastError = err;
      if (!isRetryableMlError(err) || attempt === maxAttempts) {
        break;
      }

      console.warn(
        "[Backend] ML gateway error. Waiting for ML to wake up before retrying:",
        err?.response?.status || err?.code || err?.message
      );
      await waitForMlWarmup();
      await sleep(2000);
    }
  }

  throw lastError;
}

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
    console.log(`[Backend] Forwarding to ML server at ${ML_PREDICT_URL}`);
    
    const mlResponse = await callMlPredict(req.file);

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
    const errorMessage = error?.message || "Unknown error";
    console.error("[Backend] Prediction error:", errorMessage);
    console.error("[Backend] Error code:", error?.code);
    console.error("[Backend] Error status:", error?.response?.status);
    if (error?.response?.data) {
      console.error("[Backend] Error response:", error.response.data);
    }
    
    if (error.code === "ECONNREFUSED") {
      return res.status(503).json({ 
        error: "ML Server not running",
        details: "Cannot connect to ML server. Please verify that the ML service is running and ML_PREDICT_URL is configured."
      });
    }

    const mlStatus = typeof error?.response?.status === "number" ? error.response.status : null;
    const mlData = error?.response?.data;
    let mlDetails = "";
    if (typeof mlData === "string" && mlData.trim()) {
      mlDetails = mlData.trim();
    } else if (mlData && typeof mlData === "object" && typeof mlData.error === "string") {
      mlDetails = mlData.error.trim();
    } else if (mlData != null) {
      try {
        mlDetails = JSON.stringify(mlData);
      } catch {
        mlDetails = "";
      }
    }
    
    res.status(500).json({ 
      error: "Failed to process prediction",
      details: mlStatus ? `ML ${mlStatus}${mlDetails ? `: ${mlDetails}` : ""}` : errorMessage
    });
  }
});

const PORT = Number(process.env.PORT) || 5001;
const HOST = typeof process.env.HOST === "string" && process.env.HOST.trim() ? process.env.HOST.trim() : "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`STEP 3: LISTENING on port ${PORT}`);
});
