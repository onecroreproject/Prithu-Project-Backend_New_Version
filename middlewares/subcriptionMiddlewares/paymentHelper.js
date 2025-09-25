// services/subscriptionService.js
const User = require("../../models/userModels/userModel");
const UserSubscription = require("../../models/subcriptionModels/userSubscreptionModel");
const SubscriptionPlan = require("../../models/subcriptionModels/subscriptionPlanModel");
const { processReferral } = require("../../middlewares/referralMiddleware/referralCount");
const mongoose = require("mongoose");

exports.activateSubscription = async (userId, planId, paymentResult) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!userId || !planId) {
      throw new Error("userId and planId are required");
    }

    // 🔎 Check if already subscribed
    const existingSubscription = await UserSubscription.findOne({
      userId,
      planId,
      isActive: true,
    }).session(session);

    if (existingSubscription) {
      throw new Error("You have already subscribed to this plan");
    }

    // 🔎 Fetch user & plan
    const user = await User.findById(userId).session(session);
    if (!user) throw new Error("User not found");

    const plan = await SubscriptionPlan.findById(planId).session(session);
    if (!plan) throw new Error("Subscription plan not found");

    // 🔎 Find or create subscription
    let subscription = await UserSubscription.findOne({ userId }).session(session);
    if (!subscription) {
      subscription = new UserSubscription({
        userId,
        planId,
        isActive: false,
        paymentStatus: "pending",
      });
    }

    // 📅 Duration
    const today = new Date();
    const durationMs = (plan.durationDays || 30) * 24 * 60 * 60 * 1000;

    // ✅ Success
    if (paymentResult === "success") {
      subscription.isActive = true;
      subscription.paymentStatus = "success";
      subscription.startDate = subscription.startDate || today;
      subscription.endDate =
        subscription.endDate && subscription.endDate > today
          ? new Date(subscription.endDate.getTime() + durationMs)
          : new Date(today.getTime() + durationMs);

      await subscription.save({ session });

      user.subscription = {
        isActive: true,
        planType: plan.name,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
      };
      user.referralCodeIsValid = true;
      await user.save({ session });

      await processReferral(userId);

      // update parent referral
      if (user.referredByUserId) {
        const parent = await User.findById(user.referredByUserId).session(session);
        if (parent) {
          parent.referralCodeUsageCount += 1;
          if (parent.referralCodeUsageCount >= parent.referralCodeUsageLimit) {
            parent.referralCodeIsValid = false;
          }
          await parent.save({ session });
        }
      }

      await session.commitTransaction();
      return subscription;
    }

    // ❌ Failed
    if (paymentResult === "failed") {
      subscription.isActive = false;
      subscription.paymentStatus = "failed";
      await subscription.save({ session });

      user.subscription.isActive = false;
      user.referralCodeIsValid = false;
      await user.save({ session });

      await session.commitTransaction();
      return subscription;
    }

    // ⏳ Pending
    subscription.paymentStatus = "pending";
    await subscription.save({ session });
    await session.commitTransaction();

    return subscription;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
};
