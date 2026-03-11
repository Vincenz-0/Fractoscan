const auth = require("../middleware/auth");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const { MongoClient, ObjectId } = require("mongodb");
const User = require("../models/User");
const Doctor = require("../models/Doctor");

const router = express.Router();
const JWT_EXPIRES_IN = "1h";

let doctorClientPromise = null;
let doctorCollectionCache = null;

function normalizeEmail(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function signAuthToken(id, role) {
  return jwt.sign({ user: { id, role } }, process.env.JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

function buildAuthUser(payload) {
  return {
    _id: payload.id,
    name: payload.name || "",
    email: payload.email || "",
    role: payload.role || "user",
    ...(payload.specialization ? { specialization: payload.specialization } : {}),
    ...(payload.hospital_name ? { hospital_name: payload.hospital_name } : {}),
    ...(payload.city ? { city: payload.city } : {}),
    ...(payload.phone ? { phone: payload.phone } : {})
  };
}

function normalizeDoctorRecord(doctor, fallbackEmail = "") {
  if (!doctor) {
    return null;
  }

  return {
    id: doctor.doctor_id || String(doctor._id || ""),
    name: doctor.name || "Doctor",
    email: normalizeEmail(doctor.email || fallbackEmail),
    role: doctor.role || "doctor",
    password: typeof doctor.password === "string" ? doctor.password : "",
    specialization: doctor.specialization || "Orthopedic",
    hospital_name: doctor.hospital_name || "",
    city: doctor.city || "",
    phone: doctor.phone || ""
  };
}

async function getExternalDoctorCollection() {
  if (!process.env.DOCTOR_MONGO_URI) {
    return null;
  }

  if (doctorCollectionCache) {
    return doctorCollectionCache;
  }

  if (!doctorClientPromise) {
    const client = new MongoClient(process.env.DOCTOR_MONGO_URI, {
      serverSelectionTimeoutMS: 5000
    });
    doctorClientPromise = client.connect();
  }

  const client = await doctorClientPromise;
  const db = process.env.DOCTOR_DB_NAME ? client.db(process.env.DOCTOR_DB_NAME) : client.db();
  doctorCollectionCache = db.collection(process.env.DOCTOR_COLLECTION || "doctors");
  return doctorCollectionCache;
}

async function findDoctorByEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return null;
  }

  const emailRegex = new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i");

  try {
    const externalCollection = await getExternalDoctorCollection();
    if (externalCollection) {
      const externalDoctor = await externalCollection.findOne({ email: emailRegex });
      if (externalDoctor) {
        return normalizeDoctorRecord(externalDoctor, normalizedEmail);
      }
    }
  } catch (error) {
    console.warn("⚠️ External doctor DB lookup failed, falling back to local model:", error.message);
  }

  const localDoctor = await Doctor.findOne({ email: emailRegex }).lean();
  return normalizeDoctorRecord(localDoctor, normalizedEmail);
}

async function findDoctorById(doctorId) {
  if (!doctorId) {
    return null;
  }

  const filters = [{ doctor_id: String(doctorId) }];
  if (ObjectId.isValid(doctorId)) {
    filters.push({ _id: new ObjectId(doctorId) });
  }

  try {
    const externalCollection = await getExternalDoctorCollection();
    if (externalCollection) {
      const externalDoctor = await externalCollection.findOne({ $or: filters });
      if (externalDoctor) {
        return normalizeDoctorRecord(externalDoctor);
      }
    }
  } catch (error) {
    console.warn("⚠️ External doctor DB fetch by ID failed, falling back to local model:", error.message);
  }

  const localDoctor = await Doctor.findOne({ $or: filters }).lean();
  return normalizeDoctorRecord(localDoctor);
}

router.get("/test", (req, res) => {
  res.json({ msg: "Auth route working" });
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (user) {
      return res.json(user);
    }

    if (req.user.role === "doctor" || req.user.role === "admin") {
      const doctor = await findDoctorById(req.user.id);
      if (doctor) {
        return res.json(buildAuthUser(doctor));
      }
    }

    return res.status(404).json({ msg: "User not found" });
  } catch (err) {
    console.error("❌ Fetch user error:", err.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.put("/me", auth, async (req, res) => {
  try {
    if (req.user.role !== "user") {
      return res.status(403).json({ msg: "Profile update is available only for user accounts" });
    }

    const { name, email, password } = req.body;
    const updates = {};

    if (typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }

    if (typeof email === "string" && email.trim()) {
      const normalizedEmail = normalizeEmail(email);
      const existingUser = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: req.user.id }
      });

      if (existingUser) {
        return res.status(400).json({ msg: "Email already in use" });
      }

      updates.email = normalizedEmail;
    }

    if (typeof password === "string" && password.trim()) {
      if (password.trim().length < 6) {
        return res.status(400).json({ msg: "Password must be 6+ chars" });
      }
      updates.password = await bcrypt.hash(password.trim(), 10);
    }

    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true }).select("-password");
    return res.json(user);
  } catch (err) {
    console.error("❌ Update user error:", err.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

router.post(
  "/register",
  [
    check("email", "Valid email required").isEmail(),
    check("password", "Password must be 6+ chars").isLength({ min: 6 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ msg: errors.array()[0].msg });
    }

    const { name, email, password, role } = req.body;

    try {
      const normalizedEmail = normalizeEmail(email);
      let user = await User.findOne({ email: normalizedEmail });
      if (user) {
        return res.status(400).json({ msg: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const allowedRoles = ["user", "doctor"];
      const userRole = allowedRoles.includes(role) ? role : "user";

      user = new User({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role: userRole
      });

      await user.save();

      const token = signAuthToken(user.id, user.role);

      return res.json({
        token,
        user: {
          _id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        }
      });
    } catch (err) {
      return res.status(500).json({ msg: "Server error" });
    }
  }
);

router.post("/login", async (req, res) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === "string" ? req.body.password : "";

  if (!normalizedEmail || !password) {
    return res.status(400).json({ msg: "Email and password are required" });
  }

  try {
    const emailRegex = new RegExp(`^${escapeRegex(normalizedEmail)}$`, "i");

    const user = await User.findOne({ email: emailRegex });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (isMatch) {
        const token = signAuthToken(user.id, user.role);
        return res.json({
          token,
          user: {
            _id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
          }
        });
      }
    }

    const doctor = await findDoctorByEmail(normalizedEmail);
    if (!doctor) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const storedPassword = String(doctor.password || "");
    const isDoctorPasswordHashed = storedPassword.startsWith("$2a$") || storedPassword.startsWith("$2b$");
    const doctorPasswordMatch = isDoctorPasswordHashed
      ? await bcrypt.compare(password, storedPassword)
      : password === storedPassword;

    if (!doctorPasswordMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    const token = signAuthToken(doctor.id, doctor.role || "doctor");
    return res.json({
      token,
      user: buildAuthUser(doctor)
    });
  } catch (err) {
    console.error("❌ Login error:", err.message);
    return res.status(500).json({ msg: "Server error" });
  }
});

module.exports = router;
