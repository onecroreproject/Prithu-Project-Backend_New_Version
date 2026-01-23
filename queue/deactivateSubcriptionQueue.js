const UserSubscription = require("../models/subcriptionModels/userSubscreptionModel");
const createQueue =require("../queue.js")



const deactivateQueue = createQueue("deactivated-subscription")

deactivateQueue.process(async (job) => {
  console.log("🔹 Running subscription deactivation job...", job.id);
  const now = new Date();
  const result = await UserSubscription.updateMany({ isActive: true, endDate: { $lt: now } }, { isActive: false });
  console.log(`✅ Deactivated ${result.modifiedCount || 0} expired subscriptions`);
});

deactivateQueue.on("completed", (job) => console.log(`✅ Job completed: ${job.id}`));
deactivateQueue.on("failed", (job, err) => console.error(`❌ Job failed: ${job.id}`, err));

module.exports = deactivateQueue;
