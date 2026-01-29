// /cron/index.js
const cron = require("node-cron");

// Queues
const deactivateQueue = require("../queue/deactivateSubscriptionQueue");
const deleteQueue = require("../queue/deleteReportQueue");
const feedQueue = require("../queue/feedPostQueue");
const trendingQueue = require("../queue/treandingQueue");
const dailyAnalyticsQueue = require("../queue/salesMetricksUpdate");
const notificationQueue = require("../queue/notificationQueue");

// NEW: hashtag trending queue (includes worker inside)
const hashtagTrendingQueue = require("../queue/hashTagTrendingQueue");

module.exports = ({ timezone = "Asia/Kolkata" } = {}) => {
  // Deactivate subscriptions — Midnight
  cron.schedule(
    "0 0 * * *",
    () => {
      deactivateQueue.add({});
    },
    { timezone }
  );

  // Cleanup old reports — 2 AM
  cron.schedule(
    "0 2 * * *",
    () => {
      deleteQueue.add({});
    },
    { timezone }
  );

  // Scheduled feeds — Every 15 minutes
  cron.schedule(
    "*/15 * * * *",
    () => {
      feedQueue.add({});
    },
    { timezone }
  );

  // Trending creators — Every 6 hours
  cron.schedule(
    "0 */6 * * *",
    () => {
      trendingQueue.add({});
    },
    { timezone }
  );

  cron.schedule(
    "*/5 * * * *",  // every 5 minutes
    () => {
      hashtagTrendingQueue.add({});
    },
    { timezone }
  );


  // Daily analytics — Midnight
  cron.schedule(
    "0 0 * * *",
    () => {
      dailyAnalyticsQueue.add({});
    },
    { timezone }
  );








  console.log("✅ All cron jobs scheduled successfully (timezone:", timezone, ")");
};








