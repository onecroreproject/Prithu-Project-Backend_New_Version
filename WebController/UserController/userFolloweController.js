const Followings = require("../../models/userFollowingModel"); // UserFollowings
const CreatorFollower = require("../../models/creatorFollowerModel"); // CreatorFollowers
const ProfileSettings = require("../../models/profileSettingModel");
const mongoose = require("mongoose");
const {feedTimeCalculator} =require("../../middlewares/feedTimeCalculator");

// ✅ Get Following List
exports.getUserFollowing = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    // 1️⃣ Find following document
    const followingDoc = await Followings.findOne({ userId }).lean();
    if (!followingDoc || followingDoc.followingIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, following: [] });
    }

    // 2️⃣ Get userIds of following
    const followingIds = followingDoc.followingIds.map(f => f.userId);

    // 3️⃣ Fetch profiles
    const profiles = await ProfileSettings.find({ userId: { $in: followingIds } })
      .select("userId userName displayName profileAvatar")
      .lean();

    // 4️⃣ Map with timeago
    const result = followingDoc.followingIds.map(follow => {
      const profile = profiles.find(p => p.userId.toString() === follow.userId.toString());
      return {
        userId: follow.userId,
        userName: profile?.userName || "Unknown",
        displayName: profile?.displayName || "",
        profileAvatar: profile?.profileAvatar || "",
        followedAt: feedTimeCalculator(follow.createdAt),
      };
    });

    res.status(200).json({
      success: true,
      count: result.length,
      following: result,
    });
  } catch (error) {
    console.error("Error fetching following:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching following list",
      error: error.message,
    });
  }
};

// ✅ Get Followers List
exports.getUserFollowers = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID required" });
    }

    // 1️⃣ Find follower document for this creator
    const followerDoc = await CreatorFollower.findOne({ creatorId: userId }).lean();
    if (!followerDoc || followerDoc.followerIds.length === 0) {
      return res.status(200).json({ success: true, count: 0, followers: [] });
    }

    const followerIds = followerDoc.followerIds;

    // 2️⃣ Fetch their profile details
    const profiles = await ProfileSettings.find({ userId: { $in: followerIds } })
      .select("userId userName displayName profileAvatar createdAt")
      .lean();

    // 3️⃣ Map with timeago
    const result = profiles.map((profile) => ({
      userId: profile.userId,
      userName: profile.userName,
      displayName: profile.displayName,
      profileAvatar: profile.profileAvatar || "",
      followedAt: feedTimeCalculator(profile.createdAt),
    }));

    res.status(200).json({
      success: true,
      count: result.length,
      followers: result,
    });
  } catch (error) {
    console.error("Error fetching followers:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching followers list",
      error: error.message,
    });
  }
};
