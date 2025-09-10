const UserSubscription =require("../../models/subcriptionModels/userSubscreptionModel");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel");
const { assignPlanToUser } = require("../../middlewares/subcriptionMiddlewares/assignPlanToUserHelper"); 

exports.processPayment = async (userId, subscriptionId, paymentResult) => {
  let subscription = null;
  console.log({ userId, subscriptionId, paymentResult });
  // 1️⃣ Find subscription by ID if provided
  if (subscriptionId) {
    subscription = await UserSubscription.findById(subscriptionId);
  }

  // 2️⃣ If subscription doesn’t exist, assign a new plan
  if (!subscription) {
    subscription = await assignPlanToUser(userId, subscriptionId);
  }

  if (!subscription) throw new Error("Subscription could not be created or found");

  // 3️⃣ Handle payment result
  if (paymentResult === "success") {
    subscription.isActive = true;
    subscription.paymentStatus = "success";

    // Optional: extend if already active
    const today = new Date();
    if (today < subscription.endDate) {
      const plan = await SubscriptionPlan.findById(subscription.planId);
      subscription.endDate = new Date(subscription.endDate.setDate(subscription.endDate.getDate() + plan.durationDays));
    }
  } 
  else if (paymentResult === "failed") {
    subscription.isActive = false;
    subscription.paymentStatus = "failed";
  } 
  else {
    subscription.paymentStatus = "pending";
  }

  await subscription.save();

  return subscription;
};

