const User = require("../../models/userModels/userModel");
const UserSubscription = require("../../models/subcriptionModels/userSubscreptionModel");
const UserEarning = require("../../models/userModels/referralEarnings");
const UserReferral = require("../../models/userModels/userReferralModel");
const {sendTemplateEmail} = require("../../utils/templateMailer");
const Withdrawal =require("../../models/userModels/withdrawal");


exports.handleReferralReward = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    const currentUser = await User.findById(userId);
    if (!currentUser) return res.status(404).json({ message: "User not found" });

    const referrerId = currentUser.referredByUserId;
    if (!referrerId)
      return res.status(200).json({ message: "No referrer found, no reward applied." });

    const referrerSubscription = await UserSubscription.findOne({
      userId: referrerId,
      isActive: true,
      paymentStatus: "success",
      endDate: { $gt: new Date() },
    });

    const referrer = await User.findById(referrerId);

    // ✅ If referrer has an active subscription
    if (referrerSubscription) {
      const rewardAmount = 25;

      // Add earning record
      await UserEarning.create({
        userId: referrerId,
        fromUserId: userId,
        level: 1,
        tier: 1,
        amount: rewardAmount,
        isPartial: false,
      });

      // Update referrer's earnings
      const updatedReferrer = await User.findByIdAndUpdate(
        referrerId,
        { $inc: { totalEarnings: rewardAmount, balanceEarnings: rewardAmount } },
        { new: true }
      );

      // Handle withdrawal cumulatively
      let withdrawal = await Withdrawal.findOne({ userId: referrerId, status: "pending" });
      if (withdrawal) {
        withdrawal.amount += rewardAmount;
        withdrawal.totalAmount += rewardAmount;
        await withdrawal.save();
      } else {
        withdrawal = await Withdrawal.create({
          userId: referrerId,
          amount: rewardAmount,
          withdrawalAmount: 0,
          totalAmount: updatedReferrer.balanceEarnings,
          invoiceIds: [],
          status: "pending",
        });
      }

      // ✅ Send template emails
      if (updatedReferrer?.email) {
        await sendTemplateEmail({
          templateName: "ReferralReward.html",
          to: updatedReferrer.email,
          subject: "You earned ₹25 from a referral!",
          placeholders: {
            referrerName: updatedReferrer.userName,
            referredUserName: currentUser.userName,
            rewardAmount,
            balance: updatedReferrer.balanceEarnings,
          },
          embedLogo: true,
        });
      }

      if (currentUser?.email) {
        await sendTemplateEmail({
          templateName: "ReferralReward.html",
          to: currentUser.email,
          subject: "Referral reward applied!",
          placeholders: {
            userName: currentUser.userName,
            referrerName: updatedReferrer.userName,
          },
          embedLogo: true,
        });
      }

      return res.status(200).json({
        success: true,
        message: "Referral reward applied successfully (₹25 added to referrer and emails sent).",
      });
    }

    // ✅ Referrer subscription expired
    await User.findByIdAndUpdate(userId, { $unset: { referredByUserId: "" } });
    await UserReferral.findOneAndUpdate(
      { parentId: referrerId },
      { $pull: { childIds: userId } }
    );

    // Notify referrer
    if (referrer?.email) {
      await sendTemplateEmail({
        templateName: "SubscriptionExpired.html",
        to: referrer.email,
        subject: "Referral Subscription Expired",
        placeholders: {
          referrerName: referrer.userName,
          referredUserName: currentUser.userName,
          referralCode: currentUser.referralCode,
        },
        embedLogo: true,
      });
    }

    // Notify referred user
    if (currentUser?.email) {
      await sendTemplateEmail({
        templateName: "ReferralExpiredUser.html",
        to: currentUser.email,
        subject: "Your Referral Link Has Expired",
        placeholders: {
          userName: currentUser.userName,
          referrerName: referrer?.userName || "your referrer",
        },
        embedLogo: true,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Referrer subscription expired. Referral link removed, users notified, and current user can use a new referral code.",
    });
  } catch (error) {
    console.error("Referral reward handler error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

