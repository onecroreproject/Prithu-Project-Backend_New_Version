const UserSubscription =require ("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel.js");
const User=require('../../models/userModels/userModel.js');
const {processReferral}=require('../../middlewares/referralMiddleware/referralCount.js');
const mongoose =require('mongoose');
const activateTrialPlan = require('../../middlewares/subcriptionMiddlewares/activateTrailPlan');
const checkActiveSubscription=require('../../middlewares/subcriptionMiddlewares/checkActiveSubcription.js');
const razorpay = require("../../middlewares/helper/razorPayConfig.js");
const sendMail = require("../../utils/sendMail.js");



exports.subscribePlan = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const { planId, result, razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
    const userId = req.Id || req.body.userId;

    if (!planId || !userId)
      return res.status(400).json({ message: "userId, planId required" });

    const user = await User.findById(userId).session(session);
    if (!user) return res.status(404).json({ message: "User not found" });

    const plan = await SubscriptionPlan.findById(planId).session(session);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // 🔍 Check existing subscription
    let existing = await UserSubscription.findOne({ userId, planId, isActive: true }).session(session);
    if (existing) {
      const now = new Date();

   if (existing.endDate && existing.endDate > now) {
  // Active and valid → send notification
  await sendMail({
    to: user.email,
    subject: "Active Subscription Notice",
    text: `You already have an active subscription until ${existing.endDate.toDateString()}.`,
    html: `<p>You already have an active subscription until <b>${existing.endDate.toDateString()}</b>.</p>`
  });

  await session.commitTransaction();
  session.endSession();

  return res.status(400).json({
    message: `You already have an active subscription until ${existing.endDate.toDateString()}`,
    subscription: existing
  });
} else {
  // Expired → mark inactive and delete
  existing.isActive = false;
  await existing.save({ session });

  await UserSubscription.deleteOne({ _id: existing._id }).session(session);
  // continue to allow creating new subscription
}
    }
    // Find or create subscription object
    let subscription = await UserSubscription.findOne({ userId, planId }).session(session);
    if (!subscription) subscription = new UserSubscription({ userId, planId, paymentStatus: "pending" });

    // 👉 Step 1: If result is not provided, create Razorpay subscription
    if (!result) {
      const razorpaySubscription = await razorpay.subscriptions.create({
        plan_id: plan.razorpayPlanId,
        customer_notify: 1,
        total_count: plan.durationMonths || 1,
      });

      subscription.razorpaySubscriptionId = razorpaySubscription.id;
      await subscription.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res.status(200).json({
        message: "Razorpay subscription created",
        subscription,
        razorpaySubscription
      });
    }

    // 👉 Step 2: If result is success (payment success)
    const today = new Date();
    const durationMs = plan.durationDays ? plan.durationDays * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;

  if (result === "success") {
  subscription.isActive = true;
  subscription.paymentStatus = "success";
  subscription.startDate = today;
  subscription.endDate = new Date(today.getTime() + durationMs);
  subscription.razorpayPaymentId = razorpay_payment_id;
  subscription.razorpaySubscriptionId = razorpay_subscription_id || subscription.razorpaySubscriptionId;
  subscription.razorpaySignature = razorpay_signature;
  await subscription.save({ session });

  user.subscription = {
    isActive: true,
    planType: plan.name,
    startDate: subscription.startDate,
    endDate: subscription.endDate,
  };
  user.referralCodeIsValid = true;

  // ✅ send confirmation email
  await sendMail({
    to: user.email,
    subject: "Subscription Activated",
    text: `Hi ${user.name}, your subscription for ${plan.name} is now active until ${subscription.endDate.toDateString()}.`,
    html: `<p>Hi <b>${user.name}</b>,</p>
           <p>Your subscription for <b>${plan.name}</b> is now active.</p>
           <p>It will expire on <b>${subscription.endDate.toDateString()}</b>.</p>
           <p>Thank you for subscribing 🎉</p>`
  });

  await user.save({ session });
}

      // update parent referral
      if (user.referredByUserId) {
        const parent = await User.findById(user.referredByUserId).session(session);
        if (parent) {
          parent.referralCodeUsageCount = (parent.referralCodeUsageCount || 0) + 1;
          if (parent.referralCodeUsageCount >= (parent.referralCodeUsageLimit || 2)) {
            parent.referralCodeIsValid = false;
          }
          await parent.save({ session });
        }
      
    } else {
      subscription.paymentStatus = result;
      await subscription.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    if (result === "success") await processReferral(userId);

    const message = result === "success" ? "Subscription activated" : `Payment ${result}`;
    return res.status(result === "success" ? 200 : 202).json({ message, subscription });

  } catch (err) {
    try { await session.abortTransaction(); } catch (e) {}
    session.endSession();
    console.error("subscribePlan error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};






exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.body ;
    const userId = req.Id || req.body.userId; // get from auth middleware

    if (!subscriptionId) {
      return res.status(400).json({ message: "Subscription ID is required" });
    }

    // Find subscription for this user only
    const subscription = await UserSubscription.findById(
 subscriptionId,
    );

    if (!subscription) {
      return res.status(404).json({ message: "Subscription not found" });
    }

    subscription.isActive = false;
    await subscription.save();

    res.status(200).json({ message: "Subscription cancelled successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
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






exports.userTrailPlanActive= async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;

    const newSub = await activateTrialPlan(userId);

    res.status(200).json({
      message: "Trial activated",
      subscription: newSub
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};




exports.checkUserActiveSubscription=async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if(!userId) return res.status(400).json({message:"userId required"});
    const result = await checkActiveSubscription(userId);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

