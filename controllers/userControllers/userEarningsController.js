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

    // Optimized: Check user's active basic subscription
    const basicPlan = await SubscriptionPlan.findOne({ planType: "basic" }).select("_id").lean();
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

    // Optimized: Single aggregation pipeline to combine earnings, profiles, subscriptions, and withdrawals
    const result = await UserEarning.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "profilesettings",
          localField: "fromUserId",
          foreignField: "userId",
          as: "fromUserProfile",
          pipeline: [{ $project: { userName: 1, profileAvatar: 1, modifyAvatarPublicId: 1 } }]
        }
      },
      { $unwind: { path: "$fromUserProfile", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "usersubscriptions",
          localField: "fromUserId",
          foreignField: "userId",
          as: "fromUserSubscription",
          pipeline: [
            { $match: { isActive: true, paymentStatus: "success", endDate: { $gte: new Date() } } },
            { $project: { _id: 1 } }
          ]
        }
      },
      {
        $addFields: {
          fromUserName: { $ifNull: ["$fromUserProfile.userName", "Unknown"] },
          fromUserAvatar: {
            $ifNull: [
              { $ifNull: ["$fromUserProfile.modifyAvatarPublicId", "$fromUserProfile.profileAvatar"] },
              null
            ]
          },
          fromUserSubscribed: { $gt: [{ $size: "$fromUserSubscription" }, 0] }
        }
      },
      {
        $group: {
          _id: null,
          earnings: {
            $push: {
              earningId: "$_id",
              fromUserId: "$fromUserId",
              fromUserName: "$fromUserName",
              fromUserAvatar: "$fromUserAvatar",
              fromUserSubscribed: "$fromUserSubscribed",
              amount: "$amount",
              createdAt: "$createdAt"
            }
          },
          totalEarnings: { $sum: "$amount" }
        }
      }
    ]);

    if (!result || result.length === 0) {
      return res.status(404).json({
        message: "No earnings found for this user",
        totalEarnings: 0,
        totalWithdrawn: 0,
        balance: 0,
        earnings: [],
      });
    }

    const { earnings, totalEarnings } = result[0];

    // Optimized: Fetch total withdrawn amount using aggregation
    const withdrawalResult = await Withdrawal.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId), status: "completed" } },
      { $group: { _id: null, totalWithdrawn: { $sum: "$withdrawalAmount" } } }
    ]);

    const totalWithdrawn = withdrawalResult.length > 0 ? withdrawalResult[0].totalWithdrawn : 0;
    const balance = totalEarnings - totalWithdrawn;

    // Return final structured response
    res.status(200).json({
      message: "User earnings fetched successfully",
      userSubscription: activeSubscription,
      totalEarnings,
      totalWithdrawn,
      balance,
      earnings,
    });

  } catch (error) {
    console.error("Error fetching user earnings:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



