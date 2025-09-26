const UserSubscription = require("../../models/subcriptionModels/userSubscreptionModel");
const SubscriptionPlan = require("../../models/subcriptionModels/subscriptionPlanModel");

async function hasUsedTrial(userId) {
  // Check if the user already has a trial subscription
  const trialSubscription = await UserSubscription.findOne({
    userId,
    planId: await SubscriptionPlan.findOne({ planType: "trial" }),
  });

  return trialSubscription.isActive; // true if already used
}

module.exports = hasUsedTrial;