const cron = require("node-cron");

// Queues
const deactivateQueue = require("../queue/deactivateSubscriptionQueue");
const deleteQueue = require("../queue/deleteReportQueue");
const feedQueue = require("../queue/feedPostQueue");
const trendingQueue = require("../queue/treandingQueue");
const dailyAnalyticsQueue = require("../queue/salesMetricksUpdate");
const notificationQueue = require("../queue/notificationQueue");
const hashtagTrendingQueue = require("../queue/hashTagTrendingQueue");
const cleanupInactiveSessions = require("../scripts/sessionCleanup");

// Registry to track tasks for Admin UI
const taskRegistry = [
  {
    id: "deactivate_subscriptions",
    name: "Deactivate Subscriptions",
    schedule: "0 0 * * *",
    description: "Processes subscription deactivations (Midnight)",
    action: () => deactivateQueue.add({})
  },
  {
    id: "cleanup_reports",
    name: "Cleanup Reports",
    schedule: "0 2 * * *",
    description: "Deletes old reports (2 AM)",
    action: () => deleteQueue.add({})
  },
  {
    id: "scheduled_feeds",
    name: "Scheduled Feeds",
    schedule: "*/15 * * * *",
    description: "Processes scheduled feed posts (Every 15 mins)",
    action: () => feedQueue.add({})
  },
  {
    id: "trending_creators",
    name: "Trending Creators",
    schedule: "0 */6 * * *",
    description: "Updates trending rankings (Every 6 hours)",
    action: () => trendingQueue.add({})
  },
  {
    id: "hashtag_trending",
    name: "Hashtag Trending",
    schedule: "*/5 * * * *",
    description: "Calculates trending hashtags (Every 5 mins)",
    action: () => hashtagTrendingQueue.add({})
  },
  {
    id: "daily_analytics",
    name: "Daily Analytics",
    schedule: "0 0 * * *",
    description: "Updates sales and user metrics (Midnight)",
    action: () => dailyAnalyticsQueue.add({})
  },
  {
    id: "session_cleanup",
    name: "Session Cleanup",
    schedule: "*/15 * * * *",
    description: "Cleans up inactive admin sessions (Every 15 mins)",
    action: () => cleanupInactiveSessions()
  }
];

const scheduledTasks = {};

const startCrons = ({ timezone = "Asia/Kolkata" } = {}) => {
  taskRegistry.forEach(task => {
    scheduledTasks[task.id] = cron.schedule(
      task.schedule,
      () => {
        console.log(`[CRON] Starting task: ${task.name}`);
        task.action();
      },
      { timezone }
    );
  });

  console.log("✅ All cron jobs scheduled successfully (timezone:", timezone, ")");
};

module.exports = startCrons;
module.exports.taskRegistry = taskRegistry;
module.exports.triggerTaskManually = async (taskId) => {
  const task = taskRegistry.find(t => t.id === taskId);
  if (!task) throw new Error("Task not found");
  console.log(`[MANUAL] Triggering task: ${task.name}`);
  return await task.action();
};








