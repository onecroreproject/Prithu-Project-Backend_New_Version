const AnalyticsMetric = require("../../../models/adminModels/salesDashboardMetricks");
const UserSubscription = require("../../../models/subcriptionModels/userSubscreptionModel");
const ProfileSettings = require("../../../models/profileSettingModel");
const SubscriptionPlan = require("../../../models/subcriptionModels/subscriptionPlanModel");
const UserReferral =require("../../../models/userModels/userReferralModel");
const UserEarning =require("../../../models/userModels/referralEarnings");
const User =require("../../../models/userModels/userModel")


exports.getAnalytics = async (req, res) => {
  try {
    let { startDate, endDate } = req.query;
 console.log("called")
    const query = {};

    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      query.date = { $gte: start, $lte: end };
    }
    // If startDate/endDate are not provided, query will be empty → fetch all data

    // Fetch data from AnalyticsMetric collection
    const data = await AnalyticsMetric.find(query).sort({ date: 1 });

    // Aggregate totals
    const totals = data.reduce(
      (acc, curr) => {
        acc.totalRevenue += curr.totalRevenue || 0;
        acc.totalUsers += curr.totalUsers || 0;
        acc.totalInvoices += curr.totalInvoices || 0;
        acc.totalWithdrawals += curr.totalWithdrawals || 0;
        acc.totalWithdrawalInvoices += curr.totalWithdrawalInvoices || 0;
        acc.totalSubscribers += curr.totalSubscribers || 0;
        acc.totalTrialUsers += curr.totalTrialUsers || 0;
        return acc;
      },
      {
        totalRevenue: 0,
        totalUsers: 0,
        totalInvoices: 0,
        totalWithdrawals: 0,
        totalWithdrawalInvoices: 0,
        totalSubscribers: 0,
        totalTrialUsers: 0,
      }
    );

    res.status(200).json({
      success: true,
      data,
      totals,
    });
  } catch (err) {
    console.error("❌ Error fetching analytics:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};








exports.getRecentSubscriptionUsers = async (req, res) => {
  try {
    // ✅ Fetch latest subscriptions (limit 5)
    const subscriptions = await UserSubscription.find()
      .sort({ createdAt: -1 }) // most recent first
      .limit(5)
      .populate({
        path: "planId",
        select: "planName planType duration price",
        model: SubscriptionPlan,
      })
      .lean();

    // ✅ Get all unique userIds
    const userIds = subscriptions.map((sub) => sub.userId);

    // ✅ Fetch profile details (username, avatar)
    const profiles = await ProfileSettings.find(
      { userId: { $in: userIds } },
      { userId: 1, userName: 1, modifyAvatar: 1, profileAvatar: 1 }
    ).lean();

    // ✅ Map profile info to subscriptions
    const profileMap = profiles.reduce((acc, profile) => {
      acc[profile.userId.toString()] = profile;
      return acc;
    }, {});

    // ✅ Fetch emails from User collection
    const users = await User.find({ _id: { $in: userIds } }).select("email").lean();
    const emailMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = user.email;
      return acc;
    }, {});

    // ✅ Build final result
    const result = subscriptions.map((sub) => {
      const profile = profileMap[sub.userId?.toString()] || {};
      return {
        userId: sub.userId,
        userName: profile.userName || "Unknown User",
        avatar: profile.modifyAvatar || profile.profileAvatar || null,
        planName: sub.planId?.planName || "N/A",
        planType: sub.planId?.planType || "N/A",
        startDate: sub.startDate,
        endDate: sub.endDate,
        isActive: sub.isActive,
        email: emailMap[sub.userId?.toString()] || "N/A",
        paymentStatus: sub.paymentStatus,
        createdAt: sub.createdAt,
      };
    });

    res.status(200).json({
      success: true,
      count: result.length,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching recent subscriptions:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching recent subscriptions",
    });
  }
};







exports.getTopReferralUsers = async (req, res) => {
  try {
    // 1️⃣ Aggregate top users by number of referrals
    const topReferrals = await UserReferral.aggregate([
      {
        $project: {
          parentId: 1,
          referralCount: { $size: "$childIds" }, // count of referred users
        },
      },
      { $sort: { referralCount: -1 } }, // sort descending
      { $limit: 10 }, // top 10 users
    ]);

    const parentIds = topReferrals.map((ref) => ref.parentId);



    // 2️⃣ Fetch profile info for all parentIds
    const profiles = await ProfileSettings.find(
      { userId: { $in: parentIds } },
      { userId: 1, userName: 1, modifyAvatar: 1, profileAvatar: 1 }
    ).lean();

    const profileMap = profiles.reduce((acc, profile) => {
      acc[profile.userId.toString()] = profile;
      return acc;
    }, {});


    
    const userData= await User.findById(parentIds)

    // 3️⃣ Fetch total earnings for all parentIds
    const earningsData = await UserEarning.aggregate([
      { $match: { userId: { $in: parentIds } } },
      {
        $group: {
          _id: "$userId",
          totalEarnings: { $sum: "$amount" },
        },
      },
    ]);

    const earningsMap = earningsData.reduce((acc, earning) => {
      acc[earning._id.toString()] = earning.totalEarnings;
      return acc;
    }, {});

    // 4️⃣ Combine data
    const results = topReferrals.map((ref) => {
      const profile = profileMap[ref.parentId.toString()] || {};
      const totalEarnings = earningsMap[ref.parentId.toString()] || 0;

      return {
        parentId: ref.parentId,
        userName: profile.userName || "Unknown",
        avatar: profile.profileAvatar || null,
        referralCount: ref.referralCount,
        totalEarnings,
        email:userData.email || "Unknown"
      };
    });

    res.status(200).json({ success: true, data: results });
  } catch (err) {
    console.error("Error getting top referrals:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};







