const cron = require("node-cron");
const deactivateQueue = require("../queue/deactivateSubcriptionQueue");

// Run immediately
(async () => {
  console.log("Running subscription deactivation immediately on server start...");
  await deactivateQueue.add({}, { jobId: `deactivateSubscriptions-${Date.now()}` });
})();

// Schedule every minute
cron.schedule("* * * * *", async () => {
  console.log("Scheduling subscription deactivation job...");
  await deactivateQueue.add({}, { jobId: `deactivateSubscriptions-${Date.now()}` });
});
