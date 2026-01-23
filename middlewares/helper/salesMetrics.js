// controllers/analyticsController.js
const UserSubscription = require("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionInvoice = require("../../models/InvoiceModel/subscriptionInvoice.js");
const WithdrawalInvoice = require("../../models/InvoiceModel/withdrawelInvoice.js");
const AnalyticsMetric = require("../../models/adminModels/salesDashboardMetricks.js");
const User =require("../../models/userModels/userModel.js");
const Subscriptions=require("../../models/subcriptionModels/subscriptionPlanModel.js");



exports.updateDailyAnalytics = async () => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // ✅ Active subscriptions
    const activeSubscriptions = await UserSubscription.find()
      .populate("planId", "planType price");

    // ✅ Total users
    const totalUsers = await User.countDocuments();

    // ✅ Trial & paid subscribers count
    const totalTrialUsers = activeSubscriptions.filter(
      (sub) => sub.planId?.planType === "trial"
    ).length;

    const totalSubscribers = activeSubscriptions.filter(
      (sub) => sub.planId?.planType !== "trial"
    ).length;

    // ✅ Total revenue from active & successful subscriptions
    const totalRevenue = activeSubscriptions.reduce((sum, sub) => {
      if (sub.isActive && sub.paymentStatus === "success") {
        return sum + (sub.planId?.price || 0);
      }
      return sum;
    }, 0);

    // ✅ Paid invoices today
    const paidInvoices = await SubscriptionInvoice.find({
      status: "paid",
      paidAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const totalInvoices = paidInvoices.length;

    // ✅ Total withdrawals today
    const completedWithdrawals = await WithdrawalInvoice.find({
      status: "completed",
      processedAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const totalWithdrawals = completedWithdrawals.reduce(
      (sum, w) => sum + w.withdrawalAmount,
      0
    );
    const totalWithdrawalInvoices = completedWithdrawals.length;

    // ✅ Total referral users
    const totalReferralUsers = await User.countDocuments({
      referredByUserId: { $ne: null },
    });

    // ✅ Upsert analytics metric for today
    const analytics = await AnalyticsMetric.findOneAndUpdate(
      { date: startOfDay },
      {
        $set: {
          totalRevenue,
          totalUsers,
          totalSubscriptionInvoices: totalInvoices,
          totalWithdrawals,
          totalWithdrawalInvoices,
          totalSubscribers,
          totalTrialUsers,
          byReferralUsers: totalReferralUsers, // added referral user count
        },
      },
      { upsert: true, new: true }
    );

    return analytics;
  } catch (err) {
    console.error("❌ Error updating daily analytics:", err);
    throw err;
  }
};

