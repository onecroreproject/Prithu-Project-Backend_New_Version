require("dotenv").config();

// Import all queues — this will automatically run `.process()` inside them
require("./queue/feedPostQueue");
require("./queue/deleteReportQueue");
require("./queue/deactivateSubcriptionQueue");
require("./queue/trendingQueue");

console.log("🚀 Worker started, waiting for jobs...");
