require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const startCrons = require("./corn/index");
const jobRoot=require("./roots/jobPostRoot");
const webRoot=require("./roots/webroot");
const root = require("./roots/root");
const { initSocket } = require("./middlewares/webSocket");

// Import cron jobs (they schedule automatically)


const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initSocket(server);

// CORS
app.use(
  cors({
    origin: true, 
    credentials: true, // Allow cookies, authorization headers, etc.
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);


// Middleware
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/web/job",jobRoot);
app.use("/api", root);
app.use("/web/api", webRoot);

 startCrons()

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
