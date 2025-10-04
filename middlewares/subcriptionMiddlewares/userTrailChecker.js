const UserSubscription = require("../../models/subcriptionModels/userSubscreptionModel");
 
const SubscriptionPlan = require("../../models/subcriptionModels/subscriptionPlanModel");
 
async function hasUsedTrial(userId) {
 
  try {
 
    // 1. Find trial plan
 
    const trialPlan = await SubscriptionPlan.findOne({ planType: "trial" });
 
    if (!trialPlan) return null; // no trial plan defined in DB at all
 
    // 2. Find user's trial subscription
 
    const trialSubscription = await UserSubscription.findOne({
 
      userId,
 
      planId: trialPlan._id,
 
    });
 
 
    if (!trialSubscription) {
 
      return null; // user never had a trial
 
    }
 
    // 3. If subscription exists but not active
 
    if (!trialSubscription.isActive) {
 
      return false; // trial exists but deactivated
 
    }
 
    // 4. Check if expired (compare with today's 00:00)
 
    const now = new Date();
 
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
 
    if (trialSubscription.endDate <= todayMidnight) {
 
      return false; // expired
 
    }
 
    // 5. Still valid → calculate remaining days
 
    const msPerDay = 24 * 60 * 60 * 1000;
 
    const remainingDays = Math.ceil(
 
      (trialSubscription.endDate.getTime() - todayMidnight.getTime()) / msPerDay
 
    );
 
    return {
 
      status: true,
 
      remainingDays,
 
      isActive:trialSubscription.isActive,
 
    };
 
  } catch (err) {
 
    console.error("Error in hasUsedTrial:", err.message);
 
    return false; // fallback safe
 
  }
 
}
 
module.exports = hasUsedTrial;
 
 
 