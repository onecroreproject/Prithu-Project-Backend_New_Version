const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require("path");
const http = require("http");
require('dotenv').config();

const root = require('./roots/root');
const { scheduleFeedPosts } = require('./corn/feedCorn');
const { startWatcher } = require('./middlewares/referralMiddleware/refferalCodeWatcher');
const {initWebSocket} = require("./middlewares/webSocket");

const app = express();
const server = http.createServer(app);

// Initialize Socket.IO
const io = initWebSocket(server);

// CORS
const allowedOrigins = process.env.CLIENT_URL?.split(",") || ["http://localhost:5173"];
app.use(cors({
  origin: function(origin, callback) {
    console.log("🔍 Incoming Origin:", origin);
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) return callback(new Error("CORS not allowed"), false);
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS","PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use('/api', root);

// Cron jobs / watchers
scheduleFeedPosts();
startWatcher();

// MongoDB connection and server start
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    server.listen(process.env.SERVER_PORT, () => {
      console.log(`Server running on port ${process.env.SERVER_PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err);
  });
