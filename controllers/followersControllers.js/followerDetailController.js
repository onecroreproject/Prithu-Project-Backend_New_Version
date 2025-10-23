const UserFollower = require("../../models/userFollowingModel");
const Account=require('../../models/accountSchemaModel')
const mongoose = require("mongoose");
const CreatorFollower=require('../../models/creatorFollowerModel');
const User =require("../../models/userModels/userModel");




exports.followAccount = async (req, res) => {
  try {
    const currentUserId = req.Id || req.body.userId; 
    const userId = req.body.userId; 

    if (!currentUserId || !userId) {
      return res.status(400).json({ message: "Follower and Target account IDs are required" });
    }

   

    const targetUserId = userId.toString();

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
      { creatorId: userId },
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
    const currentUserId = req.Id || req.body.userId 
    const userId = req.body.userId; 

    if (!currentUserId || !userId) {
      return res.status(400).json({ message: "Follower and Target account IDs are required" });
    }

    const targetUserId = userId.toString();

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
        { creatorId: userId },
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
      { creatorId:userId },
      { $pull: { followerIds: currentUserId } }
    );

    res.status(200).json({ message: "Unfollowed successfully", followerDoc });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};






exports.getUserFollowersData = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // 1️⃣ Get follower details from CreatorFollowers
    const creatorFollowerDoc = await CreatorFollower.findOne({ creatorId:userId })
      .populate({
        path: "followerIds",
        select: "userName profileAvatar",
        model: "User", // or your actual user model
      });

    const followers = creatorFollowerDoc?.followerIds || [];
    const followersCount = followers.length;

    // 2️⃣ Get following count from UserFollowings
    const userFollowingDoc = await UserFollower.findOne({ userId:userId });
    const followingCount = userFollowingDoc?.followerIds?.length || 0;

    res.status(200).json({
      message: "Followers fetched successfully",
      data: {
        userId,
        followersCount,
        followingCount,
        followers: followers.map(f => ({
          userId: f._id,
          userName: f.userName,
          profileAvatar: f.profileAvatar,
        })),
      },
    });
  } catch (err) {
    console.error("Error fetching followers data:", err);
    res.status(500).json({
      message: "Error fetching followers data",
      error: err.message,
    });
  }
};




