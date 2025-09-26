const UserSubscription =require ("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel.js");
const hasUsedTrial =require('../../middlewares/subcriptionMiddlewares/userTrailChecker');

async function activateTrialPlan(userId) {
  // Check if user already used trial
  const trialPlan = await SubscriptionPlan.findOne({ planType: "trial", isActive: true });
  if (!trialPlan) throw new Error("Trial plan is not available");


const usedTrial = await hasUsedTrial(userId);
  
if (usedTrial) {
  if (usedTrial) {
    throw new Error("You are already in the trial plan.");
  } else {
    throw new Error("You already used your trial plan.");
  }
}

  const alreadyUsed = await UserSubscription.findOne({
    userId,
    planId: trialPlan._id,
  });

  if (alreadyUsed) {
    throw new Error("You have already used your trial plan");
  }

  // Create new subscription
  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + trialPlan.durationDays); // 3 days trial

  const newSubscription = new UserSubscription({
    userId,
    planId: trialPlan._id,
    startDate,
    endDate,
    paymentStatus: "success", // free trial considered success
    isActive: true,
    limitsUsed: {},
  });

  await newSubscription.save();
  return newSubscription;
}
module.exports = activateTrialPlan;