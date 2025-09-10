export const checkSubscription = async (req, res, next) => {
  const subscription = await UserSubscription.findOne({ userId: req.user._id, isActive: true })
    .populate("planId");

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

  req.subscription = subscription;
  next();
};
