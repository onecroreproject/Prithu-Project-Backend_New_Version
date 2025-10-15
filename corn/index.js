const deactivateQueue = require("../queue/deactivateSubcriptionQueue");
const deleteQueue = require("../queue/deleteReportQueue");
const feedQueue = require("../queue/feedPostQueue");
const trendingQueue = require("../queue/treandingQueue");

const cron = require("node-cron");

module.exports = () => {
  // Every day at midnight
  cron.schedule("0 0 * * *", () => {
    deactivateQueue.add({});
  });

  // Every 2 hours
  cron.schedule("0 0 * * *", () => {
    deleteQueue.add({});
  });

  // Every 15 mins for scheduled feeds
  cron.schedule("* * * * *", () => {
    feedQueue.add({});
  });

  // Every 6 hours
  cron.schedule("0 0 * * *", () => {
    trendingQueue.add({});
  });

  console.log("✅ All cron jobs scheduled successfully");
};
