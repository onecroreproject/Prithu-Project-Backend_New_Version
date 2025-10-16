// controllers/analyticsController.js
const UserSubscription = require("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionInvoice = require("../../models/InvoiceModel/subscriptionInvoice.js");
const WithdrawalInvoice = require("../../models/InvoiceModel/withdrawelInvoice.js");
const AnalyticsMetric = require("../../models/adminModels/salesDashboardMetricks.js");
const User =require("../../models/userModels/userModel.js")


exports.updateDailyAnalytics = async () => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // ✅ Active subscriptions
    const activeSubscriptions = await UserSubscription.find({ isActive: true })
      .populate("planId", "planType price");

      const totalUsers = await User.countDocuments();

    const totalTrialUsers = activeSubscriptions.filter(
      (sub) => sub.planId?.planType === "trial"
    ).length;

    const totalSubscribers = activeSubscriptions.filter(
      (sub) => sub.planId?.planType !== "trial"
    ).length;


    // ✅ Total revenue from paid invoices for today
    const paidInvoices = await SubscriptionInvoice.find({
      status: "paid",
      paidAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const totalRevenue = paidInvoices.reduce(
      (sum, inv) => sum + inv.amount / 100, // Razorpay amount in paise
      0
    );

    const totalInvoices = paidInvoices.length;

    // ✅ Total withdrawals for today
    const completedWithdrawals = await WithdrawalInvoice.find({
      status: "completed",
      processedAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const totalWithdrawals = completedWithdrawals.reduce(
      (sum, w) => sum + w.withdrawalAmount,
      0
    );

    const totalWithdrawalInvoices = completedWithdrawals.length;

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
