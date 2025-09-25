const Follower = require("../../models/userFollowingModel");
const Account=require('../../models/accountSchemaModel')
const mongoose = require("mongoose");
const CreatorFollower=require('../../models/creatorFollowerModel');
const User =require("../../models/userModels/userModel");




exports.followAccount = async (req, res) => {
  try {
    const currentUserId = req.Id || req.body.userId; // logged-in user
    const accountId = req.body.accountId; // account to follow

    if (!currentUserId || !accountId) {
      return res.status(400).json({ message: "Follower and Target account IDs are required" });
    }

    // 1️⃣ Get the target account
    const targetAccount = await Account.findById(accountId).lean();
    if (!targetAccount || targetAccount.type !== "Creator") {
      return res.status(404).json({ message: "Creator account not found" });
    }

    const targetUserId = targetAccount.userId.toString();

    // 2️⃣ Prevent self-follow
    if (currentUserId.toString() === targetUserId) {
      return res.status(400).json({ message: "You cannot follow your own account" });
    }

    // 3️⃣ Check if Follower document exists
    let followerDoc = await Follower.findOne({ userId: targetUserId });

    // 4️⃣ If document exists, check if user already followed
    if (followerDoc) {
      const alreadyFollowed = followerDoc.followerIds.some(
        (f) => f.userId.toString() === currentUserId.toString()
      );
      if (alreadyFollowed) {
        return res.status(400).json({ message: "You already followed this Creator" });
      }

      // 5️⃣ Add current user to followerIds
      followerDoc.followerIds.push({ userId: currentUserId, createdAt: new Date() });
      await followerDoc.save();
    } else {
      // 6️⃣ Create new follower document if not exists
      followerDoc = await Follower.create({
        userId: targetUserId,
        followerIds: [{ userId: currentUserId, createdAt: new Date() }],
      });
    }

    // 🔹 7️⃣ Also update CreatorFollower schema
    await CreatorFollower.findOneAndUpdate(
      { creatorId: accountId },
      { $addToSet: { followerIds: currentUserId } }, // avoid duplicates
      { upsert: true, new: true }
    );

    res.status(200).json({ message: "Followed successfully", followerDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


// Unfollow an account
exports.unFollowAccount = async (req, res) => {
  try {
    const currentUserId = req.Id || req.body.userId // logged-in user
    const accountId = req.body.accountId; // account to unfollow

    if (!currentUserId || !accountId) {
      return res.status(400).json({ message: "Follower and Target account IDs are required" });
    }

    // 1️⃣ Get the target account
    const targetAccount = await Account.findById(accountId).lean();
    if (!targetAccount) {
      return res.status(404).json({ message: "Target account not found" });
    }

    const targetUserId = targetAccount.userId.toString();

    // 2️⃣ Find or create Follower document for target user
    let followerDoc = await Follower.findOne({ userId: targetUserId });
    if (!followerDoc) {
      return res.status(400).json({ message: "You are not following this account" });
    }

    // 3️⃣ Check if user is in followerIds
    const isFollowing = followerDoc.followerIds.some(
      (f) => f.userId.toString() === currentUserId.toString()
    );

    if (!isFollowing) {
      // Check if already in nonFollowerIds
      const alreadyUnfollowed = followerDoc.nonFollowerIds.some(
        (nf) => nf.userId.toString() === currentUserId.toString()
      );
      if (alreadyUnfollowed) {
        return res.status(400).json({ message: "You already unfollowed this account" });
      }

      // Not following, but add to nonFollowerIds
      followerDoc.nonFollowerIds.push({ userId: currentUserId, createdAt: new Date() });
      await followerDoc.save();

      // 🔹 Also make sure user is removed from CreatorFollower
      await CreatorFollower.updateOne(
        { creatorId: accountId },
        { $pull: { followerIds: currentUserId } }
      );

      return res.status(200).json({ message: "You are now in non-followers list", followerDoc });
    }

    // 4️⃣ Pull from followerIds and push to nonFollowerIds
    followerDoc.followerIds = followerDoc.followerIds.filter(
      (f) => f.userId.toString() !== currentUserId.toString()
    );

    followerDoc.nonFollowerIds.push({ userId: currentUserId, createdAt: new Date() });

    await followerDoc.save();

    // 🔹 Also update CreatorFollower schema → remove current user
    await CreatorFollower.updateOne(
      { creatorId: accountId },
      { $pull: { followerIds: currentUserId } }
    );

    res.status(200).json({ message: "Unfollowed successfully", followerDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


exports.getCreatorFollowers = async (req, res) => {
  const creatorId = req.accountId||req.body.accountId // creator's userId from token

  if (!creatorId) {
    return res.status(400).json({ message: "Creator ID is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ message: "Invalid Creator ID" });
  }

  try {
    // 1️⃣ Fetch all followers of this creator
    const creatorFollowers = await CreatorFollower.findOne({ creatorId }).lean();

    const followerIds = creatorFollowers?.followerIds || [];

    if (followerIds.length === 0) {
      return res.status(200).json({
        count: 0,
        followers: [],
      });
    }

    // 2️⃣ Fetch user info + profile avatar for all followerIds
    const followers = await User.find({ _id: { $in: followerIds } })
      .select("userName profileSettings")
      .populate({
        path: "profileSettings",
        select: "profileAvatar",
      })
      .lean();

    // 3️⃣ Format response
    const formattedFollowers = followers.map(f => ({
      userName: f.userName || "Unavailable",
      profileAvatar: f.profileSettings?.profileAvatar || "Unavailable",
    }));

    return res.status(200).json({
      count: formattedFollowers.length,
      followers: formattedFollowers,
    });
  } catch (error) {
    console.error("❌ Error fetching followers:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};





exports.getUserFollowersData = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    console.log("hi")
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    const followersData = await mongoose.connection
      .collection("UserFollowings")
      .aggregate([
        // 1️⃣ Match by userId
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },

        // 2️⃣ Lookup all followers in one go
        {
          $lookup: {
            from: "ProfileSettings", // ensure this matches your actual collection name
            let: {
              followerIds: {
                $map: {
                  input: "$followerIds",
                  as: "f",
                  in: "$$f.userId",
                },
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: { $in: ["$userId", "$$followerIds"] },
                },
              },
              {
                $project: {
                  _id: 0,
                  userId: 1,
                  userName: 1,
                  profileAvatar: 1,
                },
              },
            ],
            as: "followers",
          },
        },

        // 3️⃣ Add followersCount
        {
          $addFields: {
            followersCount: { $size: "$followers" },
          },
        },

        // 4️⃣ Shape final response
        {
          $project: {
            _id: 0,
            creatorId: "$userId",
            followersCount: 1,
            followers: 1,
          },
        },
      ])
      .toArray();

    if (!followersData || followersData.length === 0) {
      return res.status(200).json({
        message: "No followers found",
        data: { creatorId: userId, followersCount: 0, followers: [] },
      });
    }

    res.status(200).json({
      message: "Followers fetched successfully",
      data: followersData[0],
    });
  } catch (err) {
    console.error("Error fetching followers data:", err);
    res.status(500).json({
      message: "Error fetching followers data",
      error: err.message,
    });
  }
};




