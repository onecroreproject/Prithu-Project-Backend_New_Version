const UserSubscription =require ("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel.js");
const { assignPlanToUser }=require( "../../middlewares/subcriptionMiddlewares/assignPlanToUserHelper.js");
const {activateSubscription}=require('../../middlewares/subcriptionMiddlewares/paymentHelper.js');
const User=require('../../models/userModels/userModel.js');
const {processReferral}=require('../../middlewares/referralMiddleware/referralCount.js');
const mongoose =require('mongoose');


exports.subscribePlan = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { planId, result } = req.body;
    const userId = req.Id || req.body.userId;

    if (!planId || !result || !userId)
      return res.status(400).json({ message: "userId, planId, result required" });

    const user = await User.findById(userId).session(session);
    if (!user) return res.status(404).json({ message: "User not found" });

    const plan = await SubscriptionPlan.findById(planId).session(session);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const existing = await UserSubscription.findOne({ userId, planId, isActive: true }).session(session);
    if (existing) return res.status(400).json({ message: "Already subscribed", subscription: existing });

    let subscription = await UserSubscription.findOne({ userId, planId }).session(session);
    if (!subscription) subscription = new UserSubscription({ userId, planId, paymentStatus: "pending" });

    const today = new Date();
    const durationMs = plan.durationDays ? plan.durationDays * 24*60*60*1000 : 30*24*60*60*1000;

    if (result === "success") {
      subscription.isActive = true;
      subscription.paymentStatus = "success";
      subscription.startDate = today;
      subscription.endDate = new Date(today.getTime() + durationMs);
      await subscription.save({ session });

      user.subscription = {
        isActive: true,
        planType: plan.name,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      };
      user.referralCodeIsValid = true;
      await user.save({ session });

      // Update parent referral safely
      if (user.referredByUserId) {
        const parent = await User.findById(user.referredByUserId).session(session);
        if (parent) {
          parent.referralCodeUsageCount = (parent.referralCodeUsageCount || 0) + 1;
          if (parent.referralCodeUsageCount >= (parent.referralCodeUsageLimit || 2)) {
            parent.referralCodeIsValid = false;
          }
          await parent.save({ session });
        }
      }
    } else {
      subscription.paymentStatus = result;
      await subscription.save({ session });
    }

    // Commit **once** here
    await session.commitTransaction();
    session.endSession();

    // Process referral tree after commit (no session required inside processReferral)
    if (result === "success") {
      await processReferral(userId);
    }

    const message = result === "success" ? "Subscription activated" : `Payment ${result}`;
    return res.status(result === "success" ? 200 : 202).json({ message, subscription });

  } catch (err) {
    try { await session.abortTransaction(); } catch(e) {}
    session.endSession();
    console.error("subscribePlan error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};




exports.cancelSubscription = async (req, res) => {
  const { subscriptionId } = req.body;
if (!subscriptionId) {
    return res.status(400).json({ message: "Subscription ID is required" });
  }
  const subscription = await UserSubscription.findById(subscriptionId);
  if(!subscription) return res.status(404).json({ message: "Subscription not found" });

  subscription.isActive = false;
  await subscription.save();
  res.status(200).json({ message: "Subscription cancelled" });
};




exports.getUserSubscriptionPlanWithId = async (req, res) => {
  const userId = req.Id || req.body.userId 
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  try {
    // Find the active subscription for the user
    const plan = await UserSubscription.findOne({ userId, isActive: true })
      .populate("planId") // optional: get plan details
      .populate("userId", "name email"); // optional: get user details

    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    res.status(200).json({ plan });
  } catch (error) {
    console.error("Error fetching user subscription:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.getAllSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find();
    res.status(200).json({ plans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
