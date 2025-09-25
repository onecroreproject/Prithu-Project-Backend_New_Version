const User = require('../../../models/userModels/userModel');
const UserLevel = require('../../../models/userModels/userRefferalModels/userReferralLevelModel');
const ProfileSettings=require('../../../models/profileSettingModel');
const Withdrawal=require('../../../models/userModels/userRefferalModels/referralEarnings');
const mongoose=require('mongoose')


exports.getUserTreeWithProfiles = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "userId required" });

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const maxLevel = user.currentLevel || 1;
    const tree = {};

    // Fetch each level for this user
    for (let level = 1; level <= maxLevel; level++) {
      const levelDoc = await UserLevel.findOne({ userId, level }).lean();
      if (!levelDoc) continue;

      const fetchUsers = async (userIds) => {
        if (!userIds || userIds.length === 0) return [];

        // Fetch users and their profile settings
        const users = await User.find({ _id: { $in: userIds } }, 'subscription').lean();
        const profileSettings = await ProfileSettings.find({ userId: { $in: userIds } }, 'userId userName profileAvatar').lean();

        // Map users with profile settings
        return users.map(u => {
          const profile = profileSettings.find(p => p.userId.toString() === u._id.toString()) || {};
          return {
            _id: u._id,
            userName: profile.userName || null,
            profileAvatar: profile.profileAvatar || null,
            isSubscribed: u.subscription?.isActive || false,
          };
        });
      };

      tree[`level ${level}`] = {
        left: await fetchUsers(levelDoc.leftUsers),
        right: await fetchUsers(levelDoc.rightUsers),
      };
    }

    return res.status(200).json({
      userId,
      tree
    });

  } catch (err) {
    console.error("getUserTreeWithProfiles error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




exports.getUserEarnings = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "userId required" });

    // Fetch user and withdrawn sum concurrently
    const [user, withdrawalSumResult] = await Promise.all([
      User.findById(userId, 'totalEarnings withdrawableEarnings').lean(),
      Withdrawal.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId), status: 'completed' } },
        { $group: { _id: null, totalWithdrawn: { $sum: "$amount" } } }
      ])
    ]);

    if (!user) return res.status(404).json({ message: "User not found" });

    const alreadyWithdrawn = withdrawalSumResult[0]?.totalWithdrawn || 0;

    return res.status(200).json({
      userId,
      totalEarnings: user.totalEarnings || 0,
      withdrawableEarnings: user.withdrawableEarnings || 0,
      alreadyWithdrawn
    });

  } catch (err) {
    console.error("getUserEarnings error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
