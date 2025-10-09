const cron = require("node-cron");
const trendingQueue = require("../queue/treandingQueue");

// Run immediately on server start
(async () => {
  console.log("🔹 Running trending creators check on server start...");
  await trendingQueue.add({}, { jobId: "trendingCreator" });
})();

// Schedule every minute
cron.schedule("* * * * *", async () => {
  console.log("⏰ Cron triggered: trendingCreator");
  await trendingQueue.add({}, { jobId: "trendingCreator" });
});
