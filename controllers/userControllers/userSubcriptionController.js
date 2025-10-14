const UserSubscription =require ("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel.js");
const User=require('../../models/userModels/userModel.js');
const {processReferral}=require('../../middlewares/referralMiddleware/referralCount.js');
const mongoose =require('mongoose');
const activateTrialPlan = require('../../middlewares/subcriptionMiddlewares/activateTrailPlan');
const checkActiveSubscription=require('../../middlewares/subcriptionMiddlewares/checkActiveSubcription.js');
const razorpay = require("../../middlewares/helper/razorPayConfig.js");
const {sendTemplateEmail} = require("../../utils/templateMailer.js");
const  {handleReferralReward} = require("../../middlewares/helper/directReferalFunction.js");




exports.subscribePlan = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const {
      planId,
      result,
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature,
    } = req.body;

    const userId = req.Id || req.body.userId;
    if (!planId || !userId)
      return res.status(400).json({ message: "userId, planId required" });

    const user = await User.findById(userId).session(session);
    if (!user) return res.status(404).json({ message: "User not found" });

    const plan = await SubscriptionPlan.findById(planId).session(session);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    // 🔍 Check if active subscription already exists
    let existing = await UserSubscription.findOne({
      userId,
      planId,
      isActive: true,
    }).session(session);

   if (existing) {
  const now = new Date();
  if (existing.endDate && existing.endDate > now) {
    await sendTemplateEmail({
      templateName: "SubscrioptionAlreadyActive.html", 
      to: user.email,
      subject: "Active Subscription Notice",
      placeholders: {
        username: user.userName,
        endDate: existing.endDate.toDateString(), 
      },
      embedLogo: true, 
    });
  }
}


    // 🆕 Create or find subscription record
    let subscription = await UserSubscription.findOne({ userId, planId }).session(session);
    if (!subscription) {
      subscription = new UserSubscription({ userId, planId, paymentStatus: "pending" });
    }

    // ✅ Step 1: Create Razorpay subscription if `result` not provided
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
        razorpaySubscription,
      });
    }

    // ✅ Step 2: Handle successful payment
    const today = new Date();
    const durationMs = plan.durationDays
      ? plan.durationDays * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

    if (result === "success") {
      subscription.isActive = true;
      subscription.paymentStatus = "success";
      subscription.startDate = today;
      subscription.endDate = new Date(today.getTime() + durationMs);
      subscription.razorpayPaymentId = razorpay_payment_id;
      subscription.razorpaySubscriptionId =
        razorpay_subscription_id || subscription.razorpaySubscriptionId;
      subscription.razorpaySignature = razorpay_signature;
      await subscription.save({ session });

      user.subscription = {
        isActive: true,
        planType: plan.name,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      };
      user.referralCodeIsValid = true;
      await user.save({ session });

      // ✅ Send subscription confirmation email
   await sendTemplateEmail({
  templateName: "SubscriptionActivation.html",
  to: user.email,
  subject: "🎉 Your Prithu Subscription is Activated!",
  placeholders: {
    userName: user.name,
    planType: plan.name,
    startDate: subscription.startDate.toDateString(),
    endDate: subscription.endDate.toDateString(),
  },
  embedLogo: true,
});


      await session.commitTransaction();
      session.endSession();

      // ✅ Apply referral reward only if user has a referrer
      if (user.referredByUserId) {
        await handleReferralReward({ body: { userId } }, res);
        return; // referral handler sends response
      }

      // If no referrer, just respond
      return res.status(200).json({ message: "Subscription activated", subscription });
    } else {
      // ❌ Payment failed or pending
      subscription.paymentStatus = result;
      await subscription.save({ session });
      await session.commitTransaction();
      session.endSession();

      return res.status(202).json({ message: `Payment ${result}`, subscription });
    }
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

