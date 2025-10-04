const UserSubscription =require ("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel.js");
const hasUsedTrial =require('../../middlewares/subcriptionMiddlewares/userTrailChecker');

async function activateTrialPlan(userId) {

  const trialPlan = await SubscriptionPlan.findOne({ planType: "trial", isActive: true });

  if (!trialPlan) throw new Error("Trial plan is not available");
 
  const usedTrial = await hasUsedTrial(userId);

  console.log("usedTrial:", usedTrial);
 
  // If function returns boolean false to mean "already used"

  if (usedTrial === false) {

    return {

      success: false,

      message: "You already finished the trial plan, please subscribe."

    };

  }
 
  // Safe access with optional chaining — won't throw if usedTrial is null/undefined

  if (usedTrial?.status === true && usedTrial?.isActive) {

    const today = new Date();

    const endDate = new Date(usedTrial.endDate);

    const diffTime = endDate - today;

    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return {

      success: false,

      message: `You are already in a trial plan. It will finish in ${remainingDays} day(s).`,

      endDate

    };

  }
 
  // No record at all → create trial

  if (usedTrial === null || usedTrial === undefined) {

    const startDate = new Date();

    const endDate = new Date();

    endDate.setDate(startDate.getDate() + (trialPlan.durationDays || 0));
 
    const newSubscription = new UserSubscription({

      userId,

      planId: trialPlan._id,

      startDate,

      endDate,

      paymentStatus: "success",

      isActive: true,

      limitsUsed: {},

    });

    await newSubscription.save();
 
    return {

      success: true,

      message: "Trial plan activated successfully!",

      subscription: newSubscription

    };

  }
 
  // Fallback (if usedTrial is some unexpected value)

  return { success: false, message: "Unable to determine trial status." };

}

 

module.exports = activateTrialPlan;