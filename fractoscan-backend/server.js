console.log("STEP 3: server.js loaded");
require("dotenv").config();
const connectDB = require("./config/db");

connectDB();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(express.json());
app.use(cors());

app.use("/api/auth", require("./routes/auth"));

app.get("/", (req, res) => {
  console.log("STEP 3: ROOT HIT");
  res.send("CORS OK");
});

app.listen(5001, "127.0.0.1", () => {
  console.log("STEP 3: LISTENING");
});
