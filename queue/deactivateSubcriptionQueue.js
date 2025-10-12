const Queue = require("bull");
const UserSubscription = require("../models/subcriptionModels/userSubscreptionModel");
const redisConfig = require("../Config/redisConfig");


const redisOptions = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: process.env.REDIS_PORT || 6379,
    };

const deactivateQueue = new Queue("feed-posts", { redis: redisOptions });

deactivateQueue.process(async (job) => {
  console.log("🔹 Running subscription deactivation job...", job.id);
  const now = new Date();
  const result = await UserSubscription.updateMany({ isActive: true, endDate: { $lt: now } }, { isActive: false });
  console.log(`✅ Deactivated ${result.modifiedCount || 0} expired subscriptions`);
});

deactivateQueue.on("completed", (job) => console.log(`✅ Job completed: ${job.id}`));
deactivateQueue.on("failed", (job, err) => console.error(`❌ Job failed: ${job.id}`, err));

module.exports = deactivateQueue;
