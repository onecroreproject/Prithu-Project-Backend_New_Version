const UserSubscription = require('../models/userModels/userSubscriptionModel');
const DirectFinisher = require('../models/userModels/userRefferalModels/directReferralFinishers');
const { tryPromoteUserLevel } = require('../services/referralService'); // your existing promotion module
const User = require('../models/userModels/userModel');

async function onUserSubscriptionComplete(userId) {
  // Find all parents who referred this user
  const edges = await DirectFinisher.find({ childId: userId, status: 'incomplete' });

  for (const edge of edges) {
    // Only mark finished if payment is successful
    const subscription = await UserSubscription.findOne({ userId, paymentStatus: 'success', isActive: true });
    if (!subscription) continue;

    // Update direct finisher
    edge.status = 'finished';
    await edge.save();

    // Update parent's tree counts
    const parentId = edge.parentId;
    const side = edge.side;
    await User.updateOne(
      { _id: parentId },
      {
        $inc: side === 'left' ? { directReferralFinishersLeft: 1 } : { directReferralFinishersRight: 1 }
      }
    );

    // Attempt promotion for parent
    await tryPromoteUserLevel(parentId, 1); // Or pass actual level if stored
  }
}
