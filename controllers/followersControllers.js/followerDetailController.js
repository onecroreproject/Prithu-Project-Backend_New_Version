const Follower = require("../../models/followerModel");
const Creator = require("../../models/creatorModel");
const mongoose = require("mongoose");


// Follow an account (e.g., follow a Creator account)
exports.followAccount = async (req, res) => {
  try {
    const userId = req.Id; // current logged-in account
    const creatorId = req.body.accountId; // account to follow
    if (!userId || !creatorId) {
      return res.status(400).json({ message: "Follower and Target account IDs are required" });
    }

    if (userId === creatorId) {
      return res.status(400).json({ message: "You cannot follow your own account" });
    }

    // Ensure target exists and is a Creator
    const targetAccount = await Account.findById(creatorId);
    if (!targetAccount || targetAccount.type !== "Creator") {
      return res.status(404).json({ message: "Creator account not found" });
    }

    // Create follow relation
    await Follower.create({ userId, followingAccountId: creatorId });

    res.status(200).json({ message: "Followed successfully" });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "Already following" });
    }
    res.status(500).json({ message: "Server error", error });
  }
};

// Unfollow an account
exports.unfollowAccount = async (req, res) => {
  try {
    const userId = req.Id;
    const creatorId = req.body.accountId;

    if (!userId || !creatorId) {
      return res.status(400).json({ message: "Follower and Target account IDs are required" });
    }

    const deleted = await Follower.findOneAndDelete({
      userId,
      followingAccountId: creatorId
    });

    if (!deleted) {
      return res.status(400).json({ message: "You are not following this account" });
    }

    res.status(200).json({ message: "Unfollowed successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};

// Get all followers of the current account
exports.getAccountFollowers = async (req, res) => {
  try {
    const accountId = req.accountId;

    if (!accountId) {
      return res.status(400).json({ message: "Account ID is required" });
    }

    const followers = await Follower.find({ followingAccountId: accountId })
      .populate({
        path: "userId",
        populate: {
          path: "profileData", // ProfileSettings ref
          select: "profileAvatar"
        }
      })
      .populate({
        path: "userId",
        populate: {
          path: "userId", // User ref inside Account
          select: "userName email"
        }
      });

    const formatted = followers.map(f => {
      return {
        userName: f.userId?.userId?.userName || "Unavailable",
        email: f.userId?.userId?.email || "Unavailable",
        profileAvatar: f.userId?.profileData?.profileAvatar || "Unavailable"
      };
    });

    res.status(200).json({
      count: formatted.length,
      followers: formatted
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
};






exports.getCreatorFollowers = async (req, res) => {
  const  creatorId  = req.accountId;

  console.log("Received creatorId:", creatorId);

  if (!creatorId) {
    return res.status(400).json({ message: "Creator ID is required" });
  }

  if (!mongoose.Types.ObjectId.isValid(creatorId)) {
    return res.status(400).json({ message: "Invalid Creator ID" });
  }

  try {
    const followers = await Follower.find({ creatorId })
      .populate({
        path: "userId",
        select: "userName profileSettings",
        populate: {
          path: "profileSettings",
          select: "profileAvatar",
        }
      });

      console.log("Fetched followers:", followers);

    const formattedFollowers = followers.map(f => ({
      userName: f.userId?.userName || "Unavailable",
      profileAvatar: f.userId?.profileSettings?.profileAvatar || "Unavailable"
    }));

    return res.status(200).json({
      count: formattedFollowers.length,
      followers: formattedFollowers
    });
  } catch (error) {
    console.error("Error fetching followers:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};
