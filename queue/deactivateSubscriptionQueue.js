const UserSubscription = require("../models/subscriptionModels/userSubscriptionModel");
const createQueue = require("../queue.js");

const deactivateQueue = createQueue("deactivated-subscription");

deactivateQueue.process(async (job) => {
    console.log("🔹 Running subscription deactivation job...", job.id);
    const now = new Date();

    // 1. Find all expired subscriptions that are currently active
    const expired = await UserSubscription.find({
        isActive: true,
        endDate: { $lt: now }
    }).select("userId").lean();

    if (expired.length === 0) {
        console.log("✅ No expired subscriptions found to deactivate.");
        return;
    }

    const userIds = expired.map(s => s.userId);
    const subIds = expired.map(s => s._id);

    // 2. Clear isActive in UserSubscription collection
    await UserSubscription.updateMany(
        { _id: { $in: subIds } },
        { $set: { isActive: false } }
    );

    // 3. Clear isActive in User collection (sub-document)
    const User = require("../models/userModels/userModel");
    await User.updateMany(
        { _id: { $in: userIds } },
        { $set: { "subscription.isActive": false } }
    );

    console.log(`✅ Deactivated ${expired.length} expired subscriptions for users:`, userIds);
});

deactivateQueue.on("completed", (job) => console.log(`✅ Job completed: ${job.id}`));
deactivateQueue.on("failed", (job, err) => console.error(`❌ Job failed: ${job.id}`, err));

module.exports = deactivateQueue;
