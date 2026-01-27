require("dotenv").config();
require("./Config/ffmpegConfig");
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");
const { google } = require("googleapis");
const startCrons = require("./corn/index");
const { initSocket } = require("./middlewares/webSocket");
const { monitorMiddleware } = require("./middlewares/monitor");
const { oAuth2Client } = require("./middlewares/services/googleDriveMedia/googleDriverAuth");
const { sharePostOG } = require("./controllers/feedControllers/userActionsFeedController");
const webRoot = require("./roots/webroot");
const root = require("./roots/root");

// 🟢 MULTI-DB Connection
require("./database");

const app = express();
const server = http.createServer(app);
initSocket(server);

// 🟢 CORS
app.use(
  cors({
    origin: true,
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
    if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png')) {
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



const drive = google.drive({
  version: "v3",
  auth: oAuth2Client,
});

app.get("/media/:fileId", async (req, res) => {
  console.log("📥 Media request:", req.params.fileId);

  try {
    const fileId = req.params.fileId;

    // 🔑 Token validity check (indirect)
    console.log("🔐 Checking Google token...");

    const meta = await drive.files.get({
      fileId,
      fields: "size, mimeType, name",
    });

    // ✅ If this line runs → token is VALID
    console.log("✅ Google token is VALID");

    const fileSize = Number(meta.data.size || 0);
    const mimeType = meta.data.mimeType || "application/octet-stream";

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000");

    const range = req.headers.range;

    if (range && fileSize) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize) {
        res.status(416).setHeader("Content-Range", `bytes */${fileSize}`);
        return res.end();
      }

      res.status(206);
      res.setHeader("Content-Range", `bytes ${start}-${end}/${fileSize}`);
      res.setHeader("Content-Length", end - start + 1);

      const driveStream = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "stream", headers: { Range: `bytes=${start}-${end}` } }
      );

      return driveStream.data.pipe(res);
    }

    const driveStream = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "stream" }
    );

    return driveStream.data.pipe(res);

  } catch (err) {
    // ❌ If we are here → token is INVALID (or revoked)
    if (err.message && err.message.includes("invalid_grant")) {
      console.error("❌ Google token is INVALID (invalid_grant)");
    } else {
      console.error("❌ Media stream error:", err.message);
    }

    return res.sendStatus(404);
  }
});



//
// 🟢 API ROUTES
//
app.use("/api", root);
app.use("/web/api", webRoot);

// 🟢 Cron
startCrons();

// 🟢 Start server
server.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
