require("dotenv").config();
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
const jobRoot = require("./roots/jobPostRoot");
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
  try {
    const response = await drive.files.get(
      { fileId: req.params.fileId, alt: "media" },
      { responseType: "stream" }
    );

    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "public, max-age=31536000");
    response.data.pipe(res);
  } catch (err) {
    console.error("Video stream error:", err.message);
    res.sendStatus(404);
  }
});


//
// 🟢 API ROUTES
//
app.use("/web/job", jobRoot);
app.use("/api", root);
app.use("/web/api", webRoot);

// 🟢 Cron
startCrons();

// 🟢 Start server
server.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});
