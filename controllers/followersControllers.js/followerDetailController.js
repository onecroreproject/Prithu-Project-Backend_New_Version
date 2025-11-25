
const mongoose = require("mongoose");
const CreatorFollower = require("../../models/creatorFollowerModel");
const Feed = require("../../models/feedModel");
const ProfileSettings = require("../../models/profileSettingModel");
const {
  createAndSendNotification,
} = require("../../middlewares/helper/socketNotification");
const { logUserActivity } = require("../../middlewares/helper/logUserActivity.js");
const User=require("../../models/userModels/userModel.js");
const {sendTemplateEmail}=require("../../utils/templateMailer.js")
 
 
 
 
exports.followAccount = async (req, res) => {
  try {
    const currentUserId = req.Id || req.body.currentUserId;
    const userId = req.body.userId;

    if (!currentUserId || !userId) {
      return res.status(400).json({
        message: "Follower and Target account IDs are required",
      });
    }

    if (currentUserId.toString() === userId.toString()) {
      return res.status(400).json({
        message: "You cannot follow your own account",
      });
    }

    // 1️⃣ Try to create follow relation
    await CreatorFollower.create({
      creatorId: userId,
      followerId: currentUserId,
    }).catch((err) => {
      // Duplicate entry → already following
      if (err.code === 11000) {
        return res.status(400).json({
          message: "You are already following this user",
        });
      }
      throw err;
    });

    // 2️⃣ Get follower profile info
    const followerProfile = await ProfileSettings.findOne({
      userId: currentUserId,
    })
      .select("userName profileAvatar")
      .lean();

    // 3️⃣ Log Activity
    await logUserActivity({
      userId,
      actionType: "FOLLOW_USER",
      targetId: userId,
      targetModel: "User",
      metadata: { platform: "web" },
    });

    // 4️⃣ Send Notification
    await createAndSendNotification({
      senderId: currentUserId,
      receiverId: userId,
      type: "FOLLOW",
      title: `${followerProfile?.userName ||" " } started following you 👥`,
      message: `${followerProfile?.userName || "A user"} is now following your account.`,
      entityId: userId,
      entityType: "Follow",
      image: followerProfile?.profileAvatar || "",
    });

    res.status(200).json({
      message: "Followed successfully",
    });

  } catch (error) {
    console.error("❌ Follow error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};





exports.unFollowAccount = async (req, res) => {
  try {
    const currentUserId = req.Id || req.body.currentUserId;
    const userId = req.body.userId;

    if (!currentUserId || !userId) {
      return res.status(400).json({
        message: "Follower and Target account IDs are required",
      });
    }

    // 1️⃣ Delete follow relation
    const result = await CreatorFollower.deleteOne({
      creatorId: userId,
      followerId: currentUserId,
    });

    if (result.deletedCount === 0) {
      return res.status(400).json({
        message: "You are not following this user",
      });
    }

    // 2️⃣ Get follower profile
    const followerProfile = await ProfileSettings.findOne({
      userId: currentUserId,
    }).select("userName profileAvatar");

    // 3️⃣ Log activity
    await logUserActivity({
      userId,
      actionType: "UNFOLLOW_USER",
      targetId: userId,
      targetModel: "User",
      metadata: { platform: "web" },
    });

    // 4️⃣ Send Notification
    await createAndSendNotification({
      senderId: currentUserId,
      receiverId: userId,
      type: "UNFOLLOW",
      title: `${followerProfile?.userName || "Someone"} unfollowed you 🙁`,
      message: `${followerProfile?.userName || "A user"} has unfollowed your account.`,
      entityId: userId,
      entityType: "Unfollow",
      image: followerProfile?.profileAvatar || "",
    });

    res.status(200).json({
      message: "Unfollowed successfully",
    });

  } catch (error) {
    console.error("❌ Unfollow error:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};

 
 
 
 
 

exports.getUserFollowersData = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // 1️⃣ Followers count
    const followersCount = await CreatorFollower.countDocuments({ creatorId: userId });

    // 2️⃣ Following count
    const followingCount = await CreatorFollower.countDocuments({ followerId: userId });

    // 3️⃣ Feed count
    const feedCount = await Feed.countDocuments({ createdByAccount: userId });

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

  } catch (error) {
    console.error("Error fetching followers data:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching follower/following/feed data",
      error: error.message,
    });
  }
};





exports.removeFollower = async (req, res) => {
  try {
    const creatorId = req.Id; // logged-in user (the account removing a follower)
    const { followerId } = req.body; // the follower to remove

    if (!creatorId || !followerId) {
      return res.status(400).json({ message: "creatorId and followerId are required" });
    }

    // 1) Remove follow relation
    const removed = await CreatorFollower.findOneAndDelete({
      creatorId,
      followerId,
    });

    if (!removed) {
      return res.status(404).json({ message: "Follower not found or already removed" });
    }

    // 2) Get follower profile (the person who was removed)
    const followerProfile = await ProfileSettings.findOne({
      userId: followerId,
    }).select("userName profileAvatar ");


      const userProfile = await User.findOne({
      _id: followerId,
    }).select("email");

    // 3) (Optional) Get creator profile for personalized messages
    const creatorProfile = await ProfileSettings.findOne({
      userId: creatorId,
    }).select("userName profileAvatar");

    // 4) Log activity (the creator removed follower)
    await logUserActivity({
      userId: creatorId,
      actionType: "REMOVE_FOLLOWER",
      targetId: followerId,
      targetModel: "User",
      metadata: { platform: "web" },
    });

    // 5) Create & send in-app notification to the removed follower
    try {
      await createAndSendNotification({
        senderId: creatorId,
        receiverId: followerId,
        type: "REMOVED_FROM_FOLLOWERS",
        title: `${creatorProfile?.userName || "Someone"} removed you`,
        message: `${creatorProfile?.userName || "A user"} has removed you from their followers.`,
        entityId: creatorId,
        entityType: "RemoveFollower",
        image: creatorProfile?.profileAvatar || "",
        // optional: add deep link or other metadata:
        metadata: { creatorId },
      });
    } catch (notifyErr) {
      console.warn("Notification send failed (non-fatal):", notifyErr);
    }

    // 6) Send email to follower (if email exists)
    if (userProfile?.email) {
  try {
    await sendTemplateEmail({
      templateName: "removeFollower.html",  
      to: followerProfile.email,
      subject: `${creatorProfile?.userName || "Someone"} removed you from followers`,
      embedLogo: true,
      placeholders: {
        creatorName: creatorProfile?.userName || "A user",
        creatorAvatar: creatorProfile?.profileAvatar || "",
        followerName: followerProfile?.userName || "Friend",
        actionTime: new Date().toLocaleString(),
        creatorProfileUrl: `https://prithu.app/profile/${creatorProfile?.userName}`,
      },
    });
  } catch (mailErr) {
    console.warn("Email send failed (non-fatal):", mailErr);
  }
}


    // 7) Return success
    return res.status(200).json({
      message: "Follower removed successfully",
      removed,
    });
  } catch (err) {
    console.error("❌ Remove follower error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};




exports.checkFollowStatus = async (req, res) => {
  try {
    const { creatorId } = req.body;
    const followerId=req.Id;

    if (!creatorId || !followerId) {
      return res.status(400).json({
        success: false,
        message: "creatorId and followerId are required",
      });
    }

    // Check if follow relationship exists
    const follow = await CreatorFollower.findOne({ creatorId, followerId });

    const isFollowing = !!follow;

    return res.status(200).json({
      success: true,
      isFollowing,
    });

  } catch (err) {
    console.error("❌ Follow Status Error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error",
      error: err.message,
    });
  }
};


 
 
 
 
 
 