require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const path = require("path");
const http = require("http");

const startCrons = require("./corn/index");
const { initSocket } = require("./middlewares/webSocket");
const { monitorMiddleware } = require("./middlewares/monitor");

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
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/media", express.static(path.join(__dirname, "media")));

app.use(monitorMiddleware);

//
// 🔥🔥🔥 OG SHARE ROUTE (MUST BE BEFORE /api)
//
app.get("/share/post/:feedId", sharePostOG);

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
