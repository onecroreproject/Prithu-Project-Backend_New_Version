const mongoose = require("mongoose");
const UserEarning = require("../../models/userModels/referralEarnings");
const ProfileSettings = require("../../models/profileSettingModel");
const Withdrawal = require("../../models/userModels/withdrawal");



exports.getUserEarnings = async (req, res) => {
  try {
    const userId = req.params.userId || req.body.userId || req.user?.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Valid userId is required" });
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

    // 2️⃣ Collect all unique fromUserIds
    const fromUserIds = [...new Set(earnings.map(e => e.fromUserId.toString()))];

    // 3️⃣ Fetch profile info for fromUserIds
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

    // 5️⃣ Calculate total earnings and balance
    const totalEarnings = earnings.reduce((sum, e) => sum + (e.amount || 0), 0);
    const balance = totalEarnings - totalWithdrawn;

    // 6️⃣ Format earnings with from-user profile info
    const formattedEarnings = earnings.map(e => ({
      earningId: e._id,
      fromUserId: e.fromUserId,
      fromUserName: profileMap[e.fromUserId.toString()]?.userName || "Unknown",
      fromUserAvatar: profileMap[e.fromUserId.toString()]?.profileAvatar || null,
      amount: e.amount,
      level: e.level,
      tier: e.tier,
      isPartial: e.isPartial,
      createdAt: e.createdAt,
    }));

    // 7️⃣ Return final structured response
    res.status(200).json({
      message: "User earnings fetched successfully",
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