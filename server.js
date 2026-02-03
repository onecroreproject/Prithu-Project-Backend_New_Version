require("dotenv").config();
require("./Config/ffmpegConfig");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const startCrons = require("./corn/index");
const { initSocket } = require("./middlewares/webSocket");
const { monitorMiddleware } = require("./middlewares/monitor");
const { sharePostOG } = require("./controllers/feedControllers/userActionsFeedController");
const adminRoot = require("./roots/adminRoot");
const userRoot = require("./roots/userRoot");

// 🟢 MULTI-DB Connection
require("./database");

const app = express();
const server = http.createServer(app);
initSocket(server);

// 🟢 CORS
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",") : [];
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
        callback(null, true);
      } else {
        console.warn(`CORS blocked for origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());
app.use(cookieParser());

app.use("/logo", express.static(path.join(__dirname, "logo")));
// 🟢 Static files (IMPORTANT for OG images)
app.use("/media", express.static(path.join(__dirname, "media"), {
  setHeaders: (res, path) => {
    // Set proper cache headers for media files
    if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png') || path.endsWith('.webp')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
    }
  }
}));

app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res, path) => {
    // Allow CORS for images since they're used in OG tags
    if (path.match(/\.(jpg|jpeg|png|webp)$/)) {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
  }
}));

app.use(monitorMiddleware);

//
// 🔥🔥🔥 OG SHARE ROUTE (MUST BE BEFORE /api)
//
app.get("/share/post/:feedId", sharePostOG);

//
// 🟢 API ROUTES
//
app.use("/api", adminRoot);
app.use("/web/api", userRoot);


// 🟢 Cron
startCrons();

// 🟢 Start server
server.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
});
