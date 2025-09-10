const User = require("../models/userModels/userModel");
const UserLevel = require("../models/userModels/userRefferalModels/userReferralLevelModel");
const DirectFinisher = require("../models/userModels/userRefferalModels/directReferralFinishers");
const UserEarning = require("../models/userModels/userRefferalModels/userEarningModel"); // new
const { getOrCreateLevel, tryPromoteUserLevel, computeThreshold } = require("./referralService");

async function onUserSubscriptionComplete(childId) {
  const edges = await DirectFinisher.find({ childId, status: 'incomplete' });

  for (const edge of edges) {
    const parentId = edge.parentId;
    const side = edge.side;

    // Mark as finished
    edge.status = 'finished';
    edge.completedAt = new Date();
    await edge.save();

    // Only count earnings if parent subscription is active
    const parent = await User.findById(parentId).select('subscription').lean();
    if (!parent.subscription?.isActive) continue;

    // Get UserLevel for parent
    let lvlDoc = await UserLevel.findOne({ userId: parentId, level: 1 });
    if (!lvlDoc) lvlDoc = await getOrCreateLevel(parentId, 1);

    // 1️⃣ Update counts
    await UserLevel.updateOne(
      { userId: parentId, level: lvlDoc.level },
      { $inc: side === 'left' ? { leftTreeCount: 1 } : { rightTreeCount: 1 } }
    );

    // 2️⃣ Calculate earning
    const threshold = lvlDoc.threshold || computeThreshold(lvlDoc.level);
    const shareAmount = 250;
    const earning = shareAmount / threshold;

    // 3️⃣ Save earning
    await UserEarning.create({
      userId: parentId,
      level: lvlDoc.level,
      fromUserId: childId,
      amount: earning
    });

    // Optional: update parent total balance
    await User.updateOne({ _id: parentId }, { $inc: { totalEarnings: earning } });

    // 4️⃣ Try promotion
    await tryPromoteUserLevel(parentId, lvlDoc.level);
  }
}

module.exports = {
  onUserSubscriptionComplete
};
