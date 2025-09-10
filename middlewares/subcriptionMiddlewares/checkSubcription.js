const UserSubscription = require('../../models/subcriptionModels/userSubscreptionModel');

exports.checkSubscriptionForFeature = (feature) => async (req, res, next) => {
  const subscription = await UserSubscription.findOne({ userId: req.user._id, isActive: true }).populate("planId");

  if(!subscription) return res.status(403).json({ message: "No active subscription" });
  if(subscription.paymentStatus === "failed") {
    subscription.isActive = false;
    await subscription.save();
    return res.status(403).json({ message: "Payment failed. Subscription terminated." });
  }
  if(new Date(subscription.endDate) < new Date()){
    subscription.isActive = false;
    await subscription.save();
    return res.status(403).json({ message: "Subscription expired" });
  }

  // Check feature-specific limits
  if(feature === "download" && subscription.limitsUsed.downloadCount >= subscription.planId.limits.downloadLimit){
    return res.status(403).json({ message: "Download limit reached for this plan." });
  }

  req.subscription = subscription;
  next();
};

