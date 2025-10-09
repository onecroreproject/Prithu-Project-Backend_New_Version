const cron = require("node-cron");
const deleteQueue = require("../queue/deleteReportQueue");

// Run immediately on server start
(async () => {
  console.log("Running report cleanup immediately on server start...");
  await deleteQueue.add({}, { jobId: "deleteReportedFiles" });
})();

// Schedule daily at midnight
cron.schedule("0 0 * * *", async () => {
  console.log("Scheduling daily report cleanup...");
  await deleteQueue.add({}, { jobId: "deleteReportedFiles" });
});
