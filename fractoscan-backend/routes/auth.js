// STEP A: Imports
const auth = require("../middleware/auth");
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { check, validationResult } = require("express-validator");
const User = require("../models/User");

// STEP B: Initialize router  ✅ THIS WAS MISSING
const router = express.Router();

// STEP C: Test route (keep this)
router.get("/test", (req, res) => {
  res.json({ msg: "Auth route working" });
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    console.error("❌ Fetch user error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});

// STEP D: Register route
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
      let user = await User.findOne({ email });
      if (user) {
        return res.status(400).json({ msg: "User already exists" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const allowedRoles = ["user", "doctor"];
      const userRole = allowedRoles.includes(role) ? role : "user";

      user = new User({
                        name,
                        email,
                        password: hashedPassword,
                        role: userRole
                      });


      await user.save();

      const token = jwt.sign(
        { user: { id: user.id, role: user.role } },
        "secret",
        { expiresIn: "1h" }
      );

      res.json({ token });
    } catch (err) {
      res.status(500).json({ msg: "Server error" });
    }
  }
);




// STEP E: Login route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // 1. Find user in DB
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // 2. Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ msg: "Invalid credentials" });
    }

    // 3. Generate JWT
    const token = jwt.sign(
                          {user: { id: user.id, role: user.role } },
                          process.env.JWT_SECRET,
                          { expiresIn: "1h" }
                          );


    res.json({ token });

  } catch (err) {
    console.error("❌ Login error:", err.message);
    res.status(500).json({ msg: "Server error" });
  }
});
// STEP F: Export router  ✅ REQUIRED
module.exports = router;