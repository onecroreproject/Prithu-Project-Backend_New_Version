const Queue = require("bull");
const UserSubscription = require("../models/subcriptionModels/userSubscreptionModel");

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
};

const deactivateQueue = new Queue("deactivate-subscriptions", { redis: redisConfig });

deactivateQueue.process(async () => {
  console.log("🔹 Running subscription deactivation job...");
  const now = new Date();
  const result = await UserSubscription.updateMany({ isActive: true, endDate: { $lt: now } }, { isActive: false });
  console.log(`✅ Deactivated ${result.modifiedCount || 0} expired subscriptions`);
});

module.exports = deactivateQueue;
