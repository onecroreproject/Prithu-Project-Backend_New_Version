const User = require("../../models/userModels/userModel");
const Account = require("../../models/accountSchemaModel");
const UserSubscription = require("../../models/subcriptionModels/userSubscreptionModel"); // stores user subscriptions with planId
const SubscriptionPlan = require("../../models/subcriptionModels/subscriptionPlanModel");

exports.getDashboardMetricCount = async (req, res) => {
  try {
    const [totalUsers, subscriptionCount, accountCount] = await Promise.all([
      // 1️⃣ Total Users
      User.countDocuments(),

      // 2️⃣ Users with active subscriptions
      UserSubscription.distinct("userId", { isActive: true }).then(
        (ids) => ids.length
      ),

      // 3️⃣ Users with accounts
      Account.distinct("userId").then((ids) => ids.length),
    ]);

    res.status(200).json({ totalUsers, subscriptionCount, accountCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch dashboard metrics",
      error: error.message,
    });
  }
};



exports.getDashUserRegistrationRatio=async (req,res)=>{
 try {
    const monthlyCounts = await User.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Fill array for all 12 months
    const data = Array(12).fill(0);
    monthlyCounts.forEach(item => {
      data[item._id - 1] = item.count;
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
 }




exports.getDashUserSubscriptionRatio = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1️⃣ Get total users count
    const totalUsers = await User.countDocuments();

    // 2️⃣ Aggregate active subscriptions with plan price
    const subscriptionStats = await UserSubscription.aggregate([
      { $match: { isActive: true } },
      {
        $lookup: {
          from: "SubscriptionPlan", // collection name in MongoDB
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
        },
      },
    ]);

    const stats = subscriptionStats[0] || {
      totalSubscriptionAmount: 0,
      todaySubscriptionAmount: 0,
      todaySubscriptionUsers: 0,
    };

    const ratioPercentage = totalUsers
      ? ((stats.todaySubscriptionUsers / totalUsers) * 100).toFixed(2)
      : 0;

    res.json({
      totalUsers,
      totalSubscriptionAmount: stats.totalSubscriptionAmount,
      todaySubscriptionUsers: stats.todaySubscriptionUsers,
      todaySubscriptionAmount: stats.todaySubscriptionAmount,
      ratioPercentage,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};





