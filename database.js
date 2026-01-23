const mongoose = require("mongoose");


// 🟢 1. PRITHU Database (Main App DB)
const prithuDB = mongoose.createConnection(process.env.PRITHU_DB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  autoIndex: true,
});

// 🟢 2. JOB Database (Separate Job System DB)
const jobDB = mongoose.createConnection(process.env.JOB_DB_URI, {
  maxPoolSize: 20,
  minPoolSize: 5,
  autoIndex: true,
});

// Connection logs
prithuDB.on("connected", () => console.log("✅ PRITHU DB connected"));
jobDB.on("connected", () => console.log("✅ JOB DB connected"));

prithuDB.on("error", (err) => console.error("❌ PRITHU DB Error:", err));
jobDB.on("error", (err) => console.error("❌ JOB DB Error:", err));

module.exports = { prithuDB, jobDB };
