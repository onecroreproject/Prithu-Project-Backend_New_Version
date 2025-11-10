const mongoose = require("mongoose");
const UserEarning = require("../../models/userModels/referralEarnings");
const ProfileSettings = require("../../models/profileSettingModel");
const Withdrawal = require("../../models/userModels/withdrawal");
const UserSubscription=require("../../models/subcriptionModels/userSubscreptionModel");
const SubscriptionPlan=require("../../models/subcriptionModels/subscriptionPlanModel.js");






exports.getUserEarnings = async (req, res) => {
  try {
    const userId = req.Id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
    }

    // ✅ Check if the user has an active "basic" subscription
    const basicPlan = await SubscriptionPlan.findOne({ planType: "basic" }).lean();
    if (!basicPlan) return res.status(500).json({ message: "Basic plan not found" });

    const activeSubscription = await UserSubscription.findOne({
      userId,
      planId: basicPlan._id,
      isActive: true,
      paymentStatus: "success",
      endDate: { $gte: new Date() },
    }).lean();

    if (!activeSubscription) {
      return res.status(403).json({ message: "Please subscribe to the basic plan first" });
    }

    // 1️⃣ Fetch all earnings for this user
    const earnings = await UserEarning.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!earnings.length) {
      return res.status(404).json({
        message: "No earnings found for this user",
        totalEarnings: 0,
        totalWithdrawn: 0,
        balance: 0,
        earnings: [],
      });
    }

    //  Collect all unique fromUserIds
    const fromUserIds = [...new Set(earnings.map(e => e.fromUserId.toString()))];

    //  Fetch profile info for fromUserIds
    const profiles = await ProfileSettings.find({ userId: { $in: fromUserIds } })
      .select("userId userName profileAvatar modifyAvatarPublicId")
      .lean();

    const profileMap = {};
    profiles.forEach(profile => {
      profileMap[profile.userId.toString()] = {
        userName: profile.userName || "Unknown",
        profileAvatar: profile.modifyAvatarPublicId || profile.profileAvatar || null,
      };
    });

    // 4️⃣ Fetch total withdrawn amount for this user
    const withdrawals = await Withdrawal.find({ userId })
      .select("withdrawalAmount status")
      .lean();

    const totalWithdrawn = withdrawals
      .filter(w => w.status === "completed")
      .reduce((sum, w) => sum + (w.withdrawalAmount || 0), 0);

    // Calculate total earnings and balance
    const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const balance = totalEarnings - totalWithdrawn;

    //  Check subscription for all fromUserIds
    const activeSubscriptions = await UserSubscription.find({
      userId: { $in: fromUserIds },
      isActive: true,
      paymentStatus: "success",
      endDate: { $gte: new Date() },
    }).lean();

    const subscriptionMap = {};
    activeSubscriptions.forEach(sub => {
      subscriptionMap[sub.userId.toString()] = true;
    });

    //  Format earnings with from-user profile info + subscription status
    const formattedEarnings = earnings.map(e => ({
      earningId: e._id,
      fromUserId: e.fromUserId,
      fromUserName: profileMap[e.fromUserId.toString()]?.userName || "Unknown",
      fromUserAvatar: profileMap[e.fromUserId.toString()]?.profileAvatar || null,
      fromUserSubscribed: !!subscriptionMap[e.fromUserId.toString()] || false,
      amount: e.amount,
      createdAt: e.createdAt,
    }));

    // Return final structured response
    res.status(200).json({
      message: "User earnings fetched successfully",
      userSubscription: activeSubscription, // Include user's active basic subscription details
      totalEarnings,
      totalWithdrawn,
      balance,
      earnings: formattedEarnings,
    });

  } catch (error) {
    console.error("Error fetching user earnings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



