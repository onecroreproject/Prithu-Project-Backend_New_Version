const UserSubscription = require("../models/UserSubscription");
const cron = require("node-cron");


function deactivateExpiredSubscriptions() {
  // Runs every minute
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const result = await UserSubscription.updateMany(
        { isActive: true, endDate: { $lt: now } },
        { isActive: false }
      );

      if (result.modifiedCount > 0) {
        console.log(`Deactivated ${result.modifiedCount} expired subscriptions`);
      }
    } catch (err) {
      console.error("Error deactivating expired subscriptions:", err);
    }
  });
}

module.exports = deactivateExpiredSubscriptions;