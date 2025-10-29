require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
 const startCrons = require("./corn/index");
const jobRoot=require("./roots/jobPostRoot");

const root = require("./roots/root");
const { initSocket } = require("./middlewares/webSocket");

// Import cron jobs (they schedule automatically)


const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// CORS
const allowedOrigins = process.env.CLIENT_URL?.split(",") || ["http://localhost:5173"];
app.use(cors({
  origin: function(origin, callback) {
    console.log(" Incoming Origin:", origin);
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) return callback(new Error("CORS not allowed"), false);
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/job",jobRoot);
app.use("/api", root);

//  startCrons()

// MongoDB connection and server start
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    server.listen(process.env.PORT || 5000, () => {
      console.log(` Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error(' MongoDB connection error:', err);
  });
