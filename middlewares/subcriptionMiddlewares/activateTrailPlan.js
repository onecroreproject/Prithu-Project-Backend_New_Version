const UserSubscription =require ("../../models/subcriptionModels/userSubscreptionModel.js");
const SubscriptionPlan =require("../../models/subcriptionModels/subscriptionPlanModel.js");
const hasUsedTrial =require('../../middlewares/subcriptionMiddlewares/userTrailChecker');
const sendTemplateEmail=require("../../utils/templateMailer.js");
async function activateTrialPlan(userId, userEmail, userName) {

  const trialPlan = await SubscriptionPlan.findOne({ planType: "trial", isActive: true });
  if (!trialPlan) throw new Error("Trial plan is not available");

  const usedTrial = await hasUsedTrial(userId);
  console.log("usedTrial:", usedTrial);

  // Already finished trial
  if (usedTrial === false) {
    // Send email: trial expired / already used
    await sendTemplateEmail({
      templateName: "TrialPlanExpired.html",
      to: userEmail,
      subject: "Trial Plan Expired",
      placeholders: {
        userName
      },
      embedLogo: true
    });

    return {
      success: false,
      message: "You already finished the trial plan, please subscribe."
    };
  }

  // Already in active trial
  if (usedTrial?.status === true && usedTrial?.isActive) {
    const today = new Date();
    const endDate = new Date(usedTrial.endDate);
    const diffTime = endDate - today;
    const remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Send email: active trial reminder
    await sendTemplateEmail({
      templateName: "AllReadyInTrailPlan.html",
      to: userEmail,
      subject: "Trial Plan Already Active",
      placeholders: {
        userName,
        remainingDays,
        endDate: endDate.toDateString()
      },
      embedLogo: true
    });

    return {
      success: false,
      message: `You are already in a trial plan. It will finish in ${remainingDays} day(s).`,
      endDate
    };
  }

  // No record → create trial
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

    // Optionally, you can send an email here to confirm trial activation
    await sendTemplateEmail({
      templateName: "TrialPlanActivation.html",
      to: userEmail,
      subject: "Trial Plan Activated",
      placeholders: {
        userName,
        planType: trialPlan.planType,
        startDate: startDate.toDateString(),
        endDate: endDate.toDateString()
      },
      embedLogo: true
    });

    return {
      success: true,
      message: "Trial plan activated successfully!",
      subscription: newSubscription
    };
  }

  return { success: false, message: "Unable to determine trial status." };
}


 

module.exports = activateTrialPlan;