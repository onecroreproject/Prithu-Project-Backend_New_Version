const Follower = require("../../models/userFollowingModel");
const mongoose = require("mongoose");
const CreatorFollower=require('../../models/creatorFollowerModel');
const Feed =require("../../models/feedModel");

 
 
 
 
exports.followAccount = async (req, res) => {
  try {
    const currentUserId = req.Id || req.body.currentUserId;
    const userId = req.body.userId;

    if (!currentUserId || !userId) {
      return res.status(400).json({ message: "Follower and Target account IDs are required" });
    }

    if (currentUserId.toString() === userId.toString()) {
      return res.status(400).json({ message: "You cannot follow your own account" });
    }

    // 🔹 1️⃣ Update or create entry in UserFollowing schema
    let followingDoc = await Follower.findOne({ userId: currentUserId });

    if (followingDoc) {
      const alreadyFollowing = followingDoc.followingIds.some(
        (f) => f.userId.toString() === userId.toString()
      );

      if (alreadyFollowing) {
        return res.status(400).json({ message: "You are already following this user" });
      }

      followingDoc.followingIds.push({ userId, createdAt: new Date() });
      // Remove from nonFollowingIds if exists
      followingDoc.nonFollowingIds = followingDoc.nonFollowingIds.filter(
        (nf) => nf.userId.toString() !== userId.toString()
      );
      await followingDoc.save();
    } else {
      followingDoc = await Follower.create({
        userId: currentUserId,
        followingIds: [{ userId, createdAt: new Date() }],
      });
    }

    // 🔹 2️⃣ Update or create entry in CreatorFollower schema
    await CreatorFollower.findOneAndUpdate(
      { creatorId: userId },
      { $addToSet: { followerIds: currentUserId } }, // avoid duplicates
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: "Followed successfully",
      followingDoc,
    });
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
 
 
// Unfollow an account

exports.unFollowAccount = async (req, res) => {
  try {
    const currentUserId = req.Id || req.body.currentUserId;
    const userId = req.body.userId;

    if (!currentUserId || !userId) {
      return res.status(400).json({ message: "Follower and Target account IDs are required" });
    }

    // 🔹 1️⃣ Find current user's following document
    const followingDoc = await Follower.findOne({ userId: currentUserId });

    if (!followingDoc) {
      return res.status(400).json({ message: "You are not following this user" });
    }

    // 🔹 2️⃣ Check if actually following
    const isFollowing = followingDoc.followingIds.some(
      (f) => f.userId.toString() === userId.toString()
    );

    if (!isFollowing) {
      return res.status(400).json({ message: "You are not following this user" });
    }

    // 🔹 3️⃣ Remove from followingIds and add to nonFollowingIds
    followingDoc.followingIds = followingDoc.followingIds.filter(
      (f) => f.userId.toString() !== userId.toString()
    );

    followingDoc.nonFollowingIds.push({ userId, createdAt: new Date() });

    await followingDoc.save();

    // 🔹 4️⃣ Remove from CreatorFollower’s followerIds
    await CreatorFollower.updateOne(
      { creatorId: userId },
      { $pull: { followerIds: currentUserId } }
    );

    res.status(200).json({
      message: "Unfollowed successfully",
      followingDoc,
    });
  } catch (err) {
    console.error("Unfollow error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};
 
 
 
 
 

exports.getUserFollowersData = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // 1️⃣ Get follower count (users who follow this user)
    const creatorFollowerDoc = await CreatorFollower.findOne({ creatorId: userId }).select("followerIds");
    const followersCount = creatorFollowerDoc?.followerIds?.length || 0;

    // 2️⃣ Get following count (users this user follows)
    const userFollowingDoc = await Follower.findOne({ userId }).select("followingIds");
    const followingCount = userFollowingDoc?.followingIds?.length || 0;

    // 3️⃣ Get total feed count (feeds created by this user)
    const feedCount = await Feed.countDocuments({ createdByAccount: userId });

    // ✅ 4️⃣ Return all counts
    res.status(200).json({
      success: true,
      message: "Follower, following, and feed counts fetched successfully",
      data: {
        userId,
        followersCount,
        followingCount,
        feedCount,
      },
    });
  } catch (err) {
    console.error("Error fetching followers data:", err);
    res.status(500).json({
      success: false,
      message: "Error fetching follower/following/feed data",
      error: err.message,
    });
  }
};
 
 
 
 
 
 