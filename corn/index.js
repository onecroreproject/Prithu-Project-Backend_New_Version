// /cron/index.js
const cron = require("node-cron");

// Queues (create-only)
const deactivateQueue = require("../queue/deactivateSubcriptionQueue");
const deleteQueue = require("../queue/deleteReportQueue");
const feedQueue = require("../queue/feedPostQueue");
const trendingQueue = require("../queue/treandingQueue");            // existing trending creators queue
const dailyAnalyticsQueue = require("../queue/salesMetricksUpdate");

// NEW: hashtag trending queue (create-only)
const hashtagTrendingQueue = require("../queue/hashTagTrendingQueue");



// NEW: require the hashtag trending worker so it will process jobs
require("../queueWorker/hasTagWorker");

module.exports = ({ timezone = "Asia/Kolkata" } = {}) => {
  // Every day at midnight (00:00) — deactivate subscriptions
  cron.schedule(
    "0 0 * * *",
    () => {
      deactivateQueue.add({});
    },
    { timezone }
  );

  // Every day at 2 AM — cleanup old reports
  cron.schedule(
    "0 2 * * *",
    () => {
      deleteQueue.add({});
    },
    { timezone }
  );

  // Every 15 minutes — process scheduled feeds
  cron.schedule(
    "*/15 * * * *",
    () => {
      feedQueue.add({});
    },
    { timezone }
  );

  // Every 6 hours — trending creators (existing)
  cron.schedule(
    "0 */6 * * *",
    () => {
      trendingQueue.add({});
    },
    { timezone }
  );

  // NEW: Every 10 minutes — sync hashtag counters → trending
  // (keeps Redis counters small and provides near real-time trending)
  cron.schedule(
    "*/10 * * * *",
    () => {
      hashtagTrendingQueue.add({});
    },
    { timezone }
  );

  // Daily analytics — run at midnight (fixed from previous every-minute cron)
  cron.schedule(
    "0 0 * * *",
    () => {
      dailyAnalyticsQueue.add({});
    },
    { timezone }
  );

  console.log("✅ All cron jobs scheduled successfully (timezone:", timezone, ")");
};
