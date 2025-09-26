const UserSubscription =require ("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel.js");

async function checkActiveSubscription(userId) {
  const now = new Date();
  
  // Find active subscription
  const activeSub = await UserSubscription.findOne({
    userId,
    isActive: true,
    endDate: { $gte: now }
  });

  if (!activeSub) {
    return { hasActive: false, message: "No active subscription" };
  }
  // Manually fetch plan details
  const subPlan = await SubscriptionPlan.findById(activeSub.planId);

  if (!subPlan) {
    return { hasActive: true, planType: null, subscription: activeSub, warning: "Plan not found" };
  }

  return { 
    hasActive: true, 
    planType: subPlan.planType,   // trial | basic | premium
    subscription: {
      ...activeSub.toObject(),
      plan: subPlan               // attach plan details
    }
  };
}

module.exports = checkActiveSubscription;