require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const startCrons = require("./corn/index");
const { initSocket } = require("./middlewares/webSocket");
const { monitorMiddleware } = require("./middlewares/monitor");

const jobRoot = require("./roots/jobPostRoot");
const webRoot = require("./roots/webroot");
const root = require("./roots/root");

const app = express();
const server = http.createServer(app);
const io = initSocket(server);

// ✅ CORS: Allow all origins
app.use(
  cors({
    origin: true, // or origin: "*" for certain setups, but true is recommended with credentials
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);



// Middleware setup
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ✅ Add monitor middleware globally (after basic middleware)
app.use(monitorMiddleware);

// Routes
app.use("/web/job", jobRoot);
app.use("/api", root);
app.use("/web/api", webRoot);

 startCrons();

// ✅ MongoDB Connection (with tuning)
mongoose
  .connect(process.env.MONGODB_URI, {
    maxPoolSize: 20,
    minPoolSize: 5,
    socketTimeoutMS: 20000,
    serverSelectionTimeoutMS: 5000,
  })
  .then(() => {
    console.log("✅ MongoDB connected successfully");
    server.listen(process.env.PORT || 5000, () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
  });
