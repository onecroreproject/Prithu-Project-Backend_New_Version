require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");

const root = require("./roots/root");

// Import cron jobs (they schedule automatically)
require("./corn/feedCorn");
require("./corn/deleteReportedFileAutomatically");
require("./corn/deactivateExpireSubcription");
require("./corn/creatorTreandSet");

const app = express();

// CORS
const allowedOrigins = process.env.CLIENT_URL?.split(",") || ["http://localhost:5173"];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) return callback(new Error("CORS not allowed"), false);
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET","POST","PUT","DELETE","OPTIONS","PATCH"],
  allowedHeaders: ["Content-Type","Authorization"]
}));

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api", root);

// MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    app.listen(process.env.SERVER_PORT, () => {
      console.log(`🚀 Server running on port ${process.env.SERVER_PORT}`);
    });
  })
  .catch(err => console.error("❌ MongoDB connection error:", err));
