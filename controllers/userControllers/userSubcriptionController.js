const UserSubscription =require ("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel.js");
const { assignPlanToUser }=require( "../../middlewares/subcriptionMiddlewares/assignPlanToUserHelper.js");
const {processPayment}=require('../../middlewares/subcriptionMiddlewares/paymentHelper.js');

exports.subscribePlan = async (req, res) => {

  const { result } = req.body;
  if (!result) {
    return res.status(400).json({ message: "Payment result is required" });
  }

  const { planId } = req.body;
  if (!planId) {
    return res.status(400).json({ message: "Plan ID is required" });
  }
  const userId = req.userId;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }

  console.log({ userId, planId, result });

  try {
    const subscriptionPayment = await processPayment(userId, planId, result);

    res.status(200).json({ message: "Plan assigned", subscriptionPayment });
  } catch(err) {
    res.status(400).json({ message: err.message });
  }
};




exports.cancelSubscription = async (req, res) => {
  const { subscriptionId } = req.body;
if (!subscriptionId) {
    return res.status(400).json({ message: "Subscription ID is required" });
  }
  const subscription = await UserSubscription.findById(subscriptionId);
  if(!subscription) return res.status(404).json({ message: "Subscription not found" });

  subscription.isActive = false;
  await subscription.save();
  res.status(200).json({ message: "Subscription cancelled" });
};


exports.getUserSubscriptionPlanWithId = async (req, res) => {
  const userId = req.userId;
  if (!userId) {
    return res.status(400).json({ message: "User ID is required" });
  }
  

  try {
    const plan = await SubscriptionPlan.findById(userId);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    res.status(200).json({ plan });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getAllSubscriptionPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find();
    res.status(200).json({ plans });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};
