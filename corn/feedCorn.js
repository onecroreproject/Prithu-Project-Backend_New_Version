const cron = require("node-cron");
const feedQueue = require("../queue/feedPostQueue");

// Run immediately
(async () => {
  console.log("Running feed-posting check on server start...");
  await feedQueue.add({}, { jobId: `feedPostJob-${Date.now()}` });
})();

// Schedule every minute
cron.schedule("* * * * *", async () => {
  console.log("⏰ Cron triggered: feed-posts");
  await feedQueue.add({}, { jobId: `feedPostJob-${Date.now()}` });
});
