const { randomUUID } = require("crypto");
const mongoose = require("mongoose");
const { logPerformance } = require("./logPerformace");

let totalApiCount = 0;
let totalDbCalls = 0;

// ✅ Attach MongoDB Command Monitor once (global)
if (mongoose.connection && !mongoose.connection.__monitorAttached) {
  mongoose.connection.on("commandStarted", (event) => {
    totalDbCalls++;
  });
  mongoose.connection.__monitorAttached = true;
}

function monitorMiddleware(req, res, next) {
  totalApiCount++;
  const reqId = randomUUID().slice(0, 8);
  const start = Date.now();
  const dbCallsBefore = totalDbCalls;

  res.on("finish", () => {
    const duration = Date.now() - start;
    const dbCalls = totalDbCalls - dbCallsBefore;
    const logLine = `🚀 [#${totalApiCount}] [${reqId}] ${req.method} ${req.originalUrl} → ${res.statusCode} | ⏱️ ${duration}ms | 💾 DB Calls: ${dbCalls}`;

    if (duration > 800 || dbCalls > 20) {
      console.warn("⚠️  SLOW/CHATTY:", logLine);
      logPerformance(logLine);
    } else {
      console.log(logLine);
    }
  });

  next();
}

module.exports = { monitorMiddleware };
