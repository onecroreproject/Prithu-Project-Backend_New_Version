const mongoose = require('mongoose');
const User = require('../models/userModels/userModel');
const ReferralEdge = require('../models/userModels/userRefferalModels/refferalEdgeModle');
const UserLevel = require('../models/userModels/userRefferalModels/userReferralLevelModel');
const DirectFinisher = require('../models/userModels/userRefferalModels/directReferralFinishers');
const { computeThreshold } = require('../middlewares/threshHold');

/**
 * Get or create a UserLevel document (upsert)
 */
async function getOrCreateLevel(userId, level, session = null) {
  const threshold = computeThreshold(level);
  await UserLevel.updateOne(
    { userId, level },
    {
      $setOnInsert: {
        userId,
        level,
        tier: Math.ceil(level / 10),
        leftTreeCount: 0,
        rightTreeCount: 0,
        threshold
      }
    },
    { upsert: true, session }
  );
  return UserLevel.findOne({ userId, level }).session(session);
}

/**
 * Get highest active placement level
 */
async function getActivePlacementLevel(userId, session = null) {
  const lvl = await UserLevel.find({ userId }).sort({ level: -1 }).limit(1).session(session);
  return (lvl && lvl.length) ? lvl[0].level : 1;
}

/**
 * Place a referral under a parent (idempotent)
 * - creates ReferralEdge
 * - seeds DirectFinisher as 'incomplete'
 * - does NOT increment tree counts yet (waits for subscription)
 */
async function placeReferral({ parentId, childId }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    // Check parent subscription
    const parent = await User.findById(parentId).select('subscription').session(session);
    if (!parent.subscription?.isActive) {
      // Parent not active yet, edge can still be created, but not counted for promotion
      console.log(`Parent ${parentId} subscription inactive, edge pending.`);
    }

    // Determine level
    let level = await getActivePlacementLevel(parentId, session);
    let lvlDoc = await getOrCreateLevel(parentId, level, session);

    // Choose side
    const side = (lvlDoc.leftTreeCount <= lvlDoc.rightTreeCount) ? 'left' : 'right';

    // Create referral edge (idempotent)
    await ReferralEdge.updateOne(
      { parentId, childId },
      {
        $setOnInsert: { parentId, childId, level, side, createdAt: new Date() }
      },
      { upsert: true, session }
    );

    // Create DirectFinisher as incomplete
    await DirectFinisher.updateOne(
      { parentId, childId },
      {
        $setOnInsert: {
          parentId,
          childId,
          side,
          status: 'incomplete',
          createdAt: new Date()
        },
        $set: { updatedAt: new Date() }
      },
      { upsert: true, session }
    );

    // Only increment counts if **child subscription is active**
    const child = await User.findById(childId).select('subscription').session(session);
    if (child.subscription?.isActive) {
      await UserLevel.updateOne(
        { userId: parentId, level },
        { $inc: side === 'left' ? { leftTreeCount: 1 } : { rightTreeCount: 1 } },
        { session }
      );

      await tryPromoteUserLevel(parentId, level, session);
    }

    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}



/**
 * Triggered when a referred user completes subscription
 */
async function onUserSubscriptionComplete(userId) {
  // Find all edges where this user is a child and status is 'incomplete'
  const edges = await DirectFinisher.find({ childId: userId, status: 'incomplete' });

  for (const edge of edges) {
    const parentId = edge.parentId;
    const side = edge.side;

    // Mark as finished
    edge.status = 'finished';
    edge.completedAt = new Date();
    await edge.save();

    // Only increment counts if parent subscription is active
    const parent = await User.findById(parentId).select('subscription').lean();
    if (!parent.subscription?.isActive) continue;

    // Update parent counts
    let lvlDoc = await UserLevel.findOne({ userId: parentId, level: 1 });
    if (!lvlDoc) lvlDoc = await getOrCreateLevel(parentId, 1);

    await UserLevel.updateOne(
      { userId: parentId, level: lvlDoc.level },
      { $inc: side === 'left' ? { leftTreeCount: 1 } : { rightTreeCount: 1 } }
    );

    // Try promotion
    await tryPromoteUserLevel(parentId, lvlDoc.level);
  }
}


/**
 * Try to promote a user level
 * Uses only finished DirectFinishers for eligibility
 */
async function tryPromoteUserLevel(userId, level, externalSession = null) {
  const session = externalSession || (await mongoose.startSession());
  let createdLocalSession = false;

  try {
    if (!externalSession) { session.startTransaction(); createdLocalSession = true; }

    const lvl = await UserLevel.findOne({ userId, level }).session(session);
    if (!lvl) return;

    // Count only finished referrals
    const finishedLeft = await DirectFinisher.countDocuments({ parentId: userId, side: 'left', status: 'finished' }).session(session);
    const finishedRight = await DirectFinisher.countDocuments({ parentId: userId, side: 'right', status: 'finished' }).session(session);

    if (finishedLeft >= lvl.threshold && finishedRight >= lvl.threshold) {
      const nextLevel = level + 1;
      await getOrCreateLevel(userId, nextLevel, session);

      // Carry-over overflow for left
      const leftOverflow = finishedLeft - lvl.threshold;
      if (leftOverflow > 0) {
        const toMoveLeft = await ReferralEdge.find({ parentId: userId, level, side: 'left' })
          .sort({ createdAt: -1 }).limit(leftOverflow).session(session);

        const ids = toMoveLeft.map(e => e._id);
        if (ids.length) {
          await ReferralEdge.updateMany({ _id: { $in: ids } }, { $set: { level: nextLevel } }, { session });
          await UserLevel.updateOne({ userId, level }, { $inc: { leftTreeCount: -ids.length } }, { session });
          await UserLevel.updateOne({ userId, level: nextLevel }, { $inc: { leftTreeCount: ids.length } }, { session });
        }
      }

      // Carry-over overflow for right
      const rightOverflow = finishedRight - lvl.threshold;
      if (rightOverflow > 0) {
        const toMoveRight = await ReferralEdge.find({ parentId: userId, level, side: 'right' })
          .sort({ createdAt: -1 }).limit(rightOverflow).session(session);

        const ids = toMoveRight.map(e => e._id);
        if (ids.length) {
          await ReferralEdge.updateMany({ _id: { $in: ids } }, { $set: { level: nextLevel } }, { session });
          await UserLevel.updateOne({ userId, level }, { $inc: { rightTreeCount: -ids.length } }, { session });
          await UserLevel.updateOne({ userId, level: nextLevel }, { $inc: { rightTreeCount: ids.length } }, { session });
        }
      }

      // Update User’s cached promotion info
      const newTier = Math.ceil(nextLevel / 10);
      await User.updateOne(
        { _id: userId },
        { $set: { currentLevel: nextLevel, currentTier: newTier, lastPromotedAt: new Date(), isTierComplete: nextLevel % 10 === 0 } },
        { session }
      );

      // Cascade promotion upward recursively
      const userDoc = await User.findById(userId).select('referredByUserId').session(session);
      if (userDoc?.referredByUserId) {
        await tryPromoteUserLevel(userDoc.referredByUserId, level, session);
      }
    }

    if (createdLocalSession) {
      await session.commitTransaction();
      session.endSession();
    }
  } catch (err) {
    if (createdLocalSession) { await session.abortTransaction(); session.endSession(); }
    throw err;
  }
}

module.exports = {
  placeReferral,
  tryPromoteUserLevel,
  getOrCreateLevel,
  onUserSubscriptionComplete
};
