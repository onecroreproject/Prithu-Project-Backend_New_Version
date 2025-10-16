const deactivateQueue = require("../queue/deactivateSubcriptionQueue");
const deleteQueue = require("../queue/deleteReportQueue");
const feedQueue = require("../queue/feedPostQueue");
const trendingQueue = require("../queue/treandingQueue");
const dailyAnalyticsQueue = require("../queue/salesMetricksUpdate"); 

const cron = require("node-cron");

module.exports = () => {
  // Every day at midnight
  cron.schedule("0 0 * * *", () => {
    deactivateQueue.add({});
  });

  // Every day at 2 AM (example) — adjust as needed
  cron.schedule("0 2 * * *", () => {
    deleteQueue.add({});
  });

  // Every 15 minutes for scheduled feeds
  cron.schedule("*/15 * * * *", () => {
    feedQueue.add({});
  });

  // Every 6 hours for trending creators
  cron.schedule("0 */6 * * *", () => {
    trendingQueue.add({});
  });

  // Every day at midnight — daily analytics
  cron.schedule("* * * * *", () => {
    dailyAnalyticsQueue.add({});
  });

  console.log("✅ All cron jobs scheduled successfully");
};
