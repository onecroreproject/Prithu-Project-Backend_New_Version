const User = require("../../models/userModels/userModel");
const Account = require("../../models/accountSchemaModel");
const UserSubscription = require("../../models/subcriptionModels/userSubscreptionModel"); // stores user subscriptions with planId
const SubscriptionPlan = require("../../models/subcriptionModels/subscriptionPlanModel");
const Report =require("../../models/feedReportModel");

exports.getDashboardMetricCount = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // -----------------------------------
    // Run all queries in parallel
    // -----------------------------------
    const [
      totalUsers,
      activeUsersToday,     // using isOnline instead of lastActiveAt
      newRegistrationsToday,
      suspendedUsers,
      totalReports,
    ] = await Promise.all([
      // 1️⃣ Total Users
      User.countDocuments(),

      // 2️⃣ Active Users Today → users who are ONLINE
      User.countDocuments({
        isOnline: true,
      }),

      // 3️⃣ New registrations today
      User.countDocuments({
        createdAt: { $gte: startOfToday },
      }),

      // 4️⃣ Suspended users
      User.countDocuments({
        isBlocked: true,
      }),

      // 5️⃣ Total reports
      Report.countDocuments(),
    ]);

    // -----------------------------------
    // Send response
    // -----------------------------------
    return res.status(200).json({
      success: true,
      totalUsers,
      activeUsersToday,
      newRegistrationsToday,
      suspendedUsers,
      totalReports,
    });
  } catch (error) {
    console.error("Dashboard metric error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard metrics",
      error: error.message,
    });
  }
};





exports.getDashUserRegistrationRatio = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    // ---------------------------------------
    // Aggregate monthly data in a single trip
    // ---------------------------------------
    const result = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(`${currentYear}-01-01`),
            $lte: new Date(`${currentYear}-12-31`)
          }
        }
      },
      {
        $project: {
          month: { $month: "$createdAt" },
          isActiveToday: {
            $cond: [
              { $gte: ["$lastActiveAt", new Date(new Date().setHours(0,0,0,0))] },
              1,
              0
            ]
          },
          isSuspended: { $cond: [{ $eq: ["$isBlocked", true] }, 1, 0] },
          subscriptionActive: {
            $cond: [{ $eq: ["$subscription.isActive", true] }, 1, 0]
          }
        }
      },
      {
        $group: {
          _id: "$month",
          registrations: { $sum: 1 },
          activeUsers: { $sum: "$isActiveToday" },
          suspendedUsers: { $sum: "$isSuspended" },
          subscriptionUsers: { $sum: "$subscriptionActive" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // ---------------------------------------
    // Prepare full 12-month formatted dataset
    // ---------------------------------------
    const data = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      registrations: 0,
      activeUsers: 0,
      suspendedUsers: 0,
      subscriptionUsers: 0,
      growthPercent: 0
    }));

    // Insert aggregated values
    result.forEach(item => {
      const index = item._id - 1;
      data[index] = {
        ...data[index],
        registrations: item.registrations || 0,
        activeUsers: item.activeUsers || 0,
        suspendedUsers: item.suspendedUsers || 0,
        subscriptionUsers: item.subscriptionUsers || 0
      };
    });

    // ---------------------------------------
    // Calculate month-to-month growth %
    // ---------------------------------------
    for (let i = 1; i < 12; i++) {
      const prev = data[i - 1].registrations;
      const curr = data[i].registrations;

      data[i].growthPercent =
        prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;
    }

    // ---------------------------------------
    // Return the dataset
    // ---------------------------------------
    return res.status(200).json({
      success: true,
      year: currentYear,
      monthlyData: data
    });

  } catch (err) {
    console.error("❌ Monthly Growth Error:", err);
    res.status(500).json({ success: false, message: "Server Error" });
  }
};





exports.getDashUserSubscriptionRatio = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1️⃣ Get total users count
    const totalUsers = await User.countDocuments();

    // 2️⃣ Aggregate active subscriptions with plan price and overall subscription users
    const subscriptionStats = await UserSubscription.aggregate([
      {
        $lookup: {
          from: "SubscriptionPlan", // check your collection name in MongoDB
          localField: "planId",
          foreignField: "_id",
          as: "plan",
        },
      },
      { $unwind: "$plan" },
      {
        $group: {
          _id: null,
          totalSubscriptionAmount: { $sum: "$plan.price" },
          todaySubscriptionAmount: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$createdAt", startOfToday] }, { $lte: ["$createdAt", endOfToday] }] },
                "$plan.price",
                0,
              ],
            },
          },
          todaySubscriptionUsers: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$createdAt", startOfToday] }, { $lte: ["$createdAt", endOfToday] }] },
                1,
                0,
              ],
            },
          },
          // ✅ Count distinct active subscription users for overall ratio
          activeUserIds: { $addToSet: "$userId" },
        },
      },
    ]);

    const stats = subscriptionStats[0] || {
      totalSubscriptionAmount: 0,
      todaySubscriptionAmount: 0,
      todaySubscriptionUsers: 0,
      activeUserIds: [],
    };

    // 3️⃣ Calculate overall subscription ratio
    const overallSubscriptionUsers = stats.activeUserIds.length;
    const ratioPercentage = totalUsers
      ? ((overallSubscriptionUsers / totalUsers) * 100).toFixed(2)
      : "0.00";

    res.json({
      totalUsers,
      totalSubscriptionAmount: stats.totalSubscriptionAmount,
      todaySubscriptionUsers: stats.todaySubscriptionUsers,
      todaySubscriptionAmount: stats.todaySubscriptionAmount,
      overallSubscriptionUsers,
      ratioPercentage,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};











