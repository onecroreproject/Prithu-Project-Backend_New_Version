const Users = require("../../models/userModels/userModel.js");
const {userTimeAgo}=require('../../middlewares/userStatusTimeAgo.js');
const UserFeedActions=require('../../models/userFeedInterSectionModel');
const ProfileSettings=require('../../models/profileSettingModel.js');
const mongoose=require("mongoose");
const UserDevices = require("../../models/userModels/userSession-Device/deviceModel");
const Subscriptions=require('../../models/subcriptionModels/userSubscreptionModel.js');
const UserLanguage=require('../../models/userModels/userLanguageModel.js');
const Follower=require("../../models/userFollowingModel.js");
const UserCategory=require('../../models/userModels/userCategotyModel.js');
const ImageView=require('../../models/userModels/MediaSchema/userImageViewsModel.js');
const VideoView=require('../../models/userModels/MediaSchema/userVideoViewModel.js');
const Feed =require('../../models/feedModel.js');
const UserLevel =require('../../models/userModels/userRefferalModels/userReferralLevelModel');
const Withdrawal=require('../../models/userModels/userRefferalModels/withdrawal.js');
const UserEarning=require('../../models/userModels/userRefferalModels/referralEarnings.js');



// Get single user detail
exports.getUserProfileDetail = async (req, res) => {
  try {
    const {userId }=req.body; // from auth middleware

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID is required" });
    }

    // ✅ Run queries in parallel
    const [user, profile, languages] = await Promise.all([
      User.findById(userId).select("userName email").lean(),
      Profile.findOne({ userId }).lean(),
      UserLanguage.find({ userId, active: true }).select("appLanguageCode feedLanguageCode").lean()
    ]);

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({
      success: true,
      user: {
        ...user,
        profile,
        languages
      }
    });
  } catch (err) {
    console.error("Error fetching user profile:", err);
    return res.status(500).json({
      success: false,
      message: "Cannot fetch user profile",
      error: err.message
    });
  }
};

// Get user status with devices
exports.getUserStatus = async (req, res) => {
  
  try {
    const client = await getRedis();
  
    const users = await User.find({}, "_id name role").lean();
    
    const result = [];

    for (const user of users) {
      const lastSeen = await client.get(`lastseen:${user._id}`);
      console.log(lastSeen)
      const sockets = await client.sMembers(`user:sockets:${user._id}`);

      // get devices
      const devices = [];
      for (const s of sockets) {
        const d = await client.hGetAll(`user:device:${user._id}:${s}`);
        if (Object.keys(d).length > 0) devices.push(d);
      }

      result.push({
        ...user,
        status: sockets.length > 0 ? "online" : "offline",
        lastSeen: sockets.length > 0 ? "now" : lastSeen ?userTimeAgo(lastSeen) : "unknown",
        devices,
      });
    }

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  }
};


exports.getUsersByDate = async (req, res) => {
  try {
    const { date, type = "created" } = req.query; 
    // type = "created" (default) or "updated"

    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }

    // Create start & end range for the day
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    // Choose filter field dynamically
    const filterField = type === "updated" ? "updatedAt" : "createdAt";

    // ✅ Query only required fields + populate
    const users = await Users.find(
      { [filterField]: { $gte: start, $lte: end } },
      "userName email profileSettings createdAt updatedAt" // projection
    )
      .populate("profileSettings") // one populate instead of multiple queries
      .lean(); // return plain JS objects (faster, less memory)

    if (!users || users.length === 0) {
      return res.status(404).json({ message: "No users found for this date" });
    }

    res.status(200).json({ users });
  } catch (err) {
    console.error("Error fetching users by date:", err);
    res.status(500).json({ message: "Cannot fetch user details", error: err.message });
  }
};


exports.getAllUserDetails = async (req, res) => {
  try {
    const allUsers = await Users.find()
      .select("userName _id email lastActiveAt createdAt isActive profileSettings subscription") 
      .populate({
        path: "profileSettings",
        select: "profileAvatar", // only profileAvatar
      })
      .populate({
        path: "subscription",
        select: "isActive", // only subscription status
      });

    if (!allUsers || allUsers.length === 0) {
      return res.status(404).json({ message: "Users details not found" });
    }

    // reshape response
    const formattedUsers = allUsers.map((user) => ({
      userId:user._id,
      userName: user.userName,
      email: user.email,
      createdAt: user.createdAt,
      lastActiveAt:user.lastActiveAt,
      isActive: user.isActive,
      profileAvatar: user.profileSettings?.profileAvatar || null,
      subscriptionActive: user.subscription?.isActive || false,
    }));

    res.status(200).json({ users: formattedUsers });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ message: "Cannot fetch user details", error: err.message });
  }
};





exports.getAnaliticalCountforUser = async (req, res) => {
  try {
    let userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }
    userId = userId.trim();

    const objectId = new mongoose.Types.ObjectId(userId);

    // 🔹 Fetch the UserActions doc for this user
    const userAction = await mongoose.connection
      .collection("UserFeedActions")
      .findOne({ userId: objectId });

    // 🔹 Count comments from UserComments
    const commentCount = await mongoose.connection
      .collection("UserComments")
      .countDocuments({ userId: objectId });

    // 🔹 Build response (count based on new object-array structure)
    const result = {
      likes: userAction?.likedFeeds?.length || 0,
      saves: userAction?.savedFeeds?.length || 0,
      shares: userAction?.sharedFeeds?.length || 0,
      downloads: userAction?.downloadedFeeds?.length || 0,
      comments: commentCount || 0,
    };

    res.status(200).json({
      message: "Analytical count fetched successfully",
      data: result,
    });
  } catch (err) {
    console.error("Error fetching analytical counts:", err);
    res.status(500).json({
      message: "Error fetching analytical counts",
      error: err.message,
    });
  }
};



exports.getUserLikedFeedsforAdmin = async (req, res) => {
  try {
    const userId = req.params.userId;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    const userLikedFeeds = await UserFeedActions.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$likedFeeds" },
      // Lookup feed details
      {
        $lookup: {
          from: "Feeds",
          localField: "likedFeeds.feedId",
          foreignField: "_id",
          as: "feedInfo"
        }
      },
      { $unwind: "$feedInfo" },
      // Lookup creator account
      {
        $lookup: {
          from: "Accounts",
          localField: "feedInfo.createdByAccount",
          foreignField: "_id",
          as: "creatorAccount"
        }
      },
      { $unwind: { path: "$creatorAccount", preserveNullAndEmptyArrays: true } },
      // Lookup creator profile
      {
        $lookup: {
          from: "ProfileSettings",
          localField: "creatorAccount.userId",
          foreignField: "userId",
          as: "creatorProfile"
        }
      },
      { $unwind: { path: "$creatorProfile", preserveNullAndEmptyArrays: true } },
      // Project final fields (no host)
      {
        $project: {
          _id: 0,
          likedAt: "$likedFeeds.likedAt",
          contentUrl: "$feedInfo.contentUrl",
          feedInfo: {
            feedId: "$feedInfo._id",
            type: "$feedInfo.type",
            language: "$feedInfo.language",
            category: "$feedInfo.category",
            createdAt: "$feedInfo.createdAt",
            createdBy: {
              userName: { $ifNull: ["$creatorProfile.userName", "Unknown"] },
              profileAvatar: "$creatorProfile.profileAvatar"
            }
          }
        }
      }
    ]);

    res.status(200).json({
      message: "User liked feeds fetched successfully",
      count: userLikedFeeds.length,
      data: userLikedFeeds
    });
  } catch (err) {
    console.error("Error fetching user liked feeds:", err);
    res.status(500).json({
      message: "Error fetching user liked feeds",
      error: err.message
    });
  }
};





exports.getUsersStatus = async (req, res) => {
  try {
    // 1️⃣ Fetch users with required fields
    const users = await Users.find({}, "username email isOnline lastSeenAt").lean();

    if (!users.length) {
      return res.json({ totalOnline: 0, totalOffline: 0, users: [] });
    }

    // 2️⃣ Get devices in a single query (only needed fields)
    const userIds = users.map((u) => u._id);
    const devices = await UserDevices.find(
      { userId: { $in: userIds } },
      "userId deviceId deviceType ipAddress lastActiveAt"
    ).lean();

    // 3️⃣ Group devices by userId
    const devicesByUser = devices.reduce((acc, d) => {
      const id = d.userId.toString();
      if (!acc[id]) acc[id] = [];
      acc[id].push({
        deviceId: d.deviceId,
        deviceType: d.deviceType,
        ipAddress: d.ipAddress,
        lastActiveAt: d.lastActiveAt,
      });
      return acc;
    }, {});

    // 4️⃣ Build result + online/offline count
    let totalOnline = 0;
    let totalOffline = 0;

    const result = users.map((user) => {
      if (user.isOnline) totalOnline++;
      else totalOffline++;

      const userDevices = devicesByUser[user._id.toString()] || [];

      return {
        ...user,
        deviceCount: userDevices.length,
        devices: userDevices,
      };
    });

    // 5️⃣ Final response
    res.json({
      totalOnline,
      totalOffline,
      totalUsers: users.length,
      users: result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



exports.getUserDetailWithIdForAdmin = async (req, res) => {
  try {
    const userId = req.params.id;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Base user info
    const user = await Users.findById(userId)
      .select("userName email role referralCode referredByUserId directReferrals currentLevel currentTier totalEarnings withdrawableEarnings isActive lastActiveAt lastLoginAt")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Profile settings
    const profile = await ProfileSettings.findOne({ userId })
      .select("gender bio dateOfBirth maritalStatus maritalDate phoneNumber profileAvatar timezone")
      .lean();

    // ✅ Subscription info
    const subscription = await Subscriptions.findOne({ userId })
      .select("subscriptionActive startDate endDate subscriptionActiveDate")
      .lean();

    // ✅ Language preferences
    const language = await UserLanguage.findOne({ userId })
      .select("feedLanguageCode appLanguageCode")
      .lean();

    // ✅ Device info
    const device = await UserDevices.findOne({ userId })
      .select("deviceType deviceName ipAddress")
      .sort({ createdAt: -1 }) // latest device
      .lean();

    // ✅ Merge all details
    const userDetails = {
      userName: user.userName,
      email: user.email,
      role: user.role,
      referralCode: user.referralCode,
      referredByUserId: user.referredByUserId,
      directReferrals: user.directReferrals || [],
      currentLevel: user.currentLevel,
      currentTier: user.currentTier,
      totalEarnings: user.totalEarnings || 0,
      withdrawableEarnings: user.withdrawableEarnings || 0,
      isActive: user.isActive,
      isActiveAt: user.lastActiveAt,
      lastLoginAt: user.lastLoginAt,

      profile: profile || {},
      subscription: subscription || {
        subscriptionActive: false,
        startDate: null,
        endDate: null,
        subscriptionActiveDate: null,
      },
      language: language || { feedLanguageCode: "en", appLanguageCode: "en" },
      device: device || {},
    };

    return res.status(200).json({ success: true, user: userDetails });
  } catch (err) {
    console.error("Error fetching user details:", err);
    return res.status(500).json({
      success: false,
      message: "Cannot fetch user details",
      error: err.message,
    });
  }
};



exports.getUserAnalyticalData = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    // ------------------ User Profile ------------------
    const userProfile = await ProfileSettings.findOne({ userId })
      .select("userName profileAvatar")
      .lean();

    const selectedUser = {
      userName: userProfile?.userName || "Unknown User",
      userAvatar: userProfile?.profileAvatar || "/default-avatar.png",
    };

    // ------------------ Feeds ------------------
    const imageData = await ImageView.findOne({ userId }).lean();
    const videoData = await VideoView.findOne({ userId }).lean();

    const feeds = [
      ...(imageData?.views || []).map((v, i) => ({
        id: v.imageId,
        title: `Image ${i + 1}`,
        description: `Viewed at ${v.viewedAt}`,
      })),
      ...(videoData?.views || []).map((v, i) => ({
        id: v.videoId,
        title: `Video ${i + 1}`,
        description: `Watched ${v.watchedSeconds || 0}s at ${v.viewedAt}`,
      })),
    ];

    // ------------------ Following ------------------
    const followingData = await Follower.findOne({ userId }).lean();
    const followerUserIds = (followingData?.followerIds || []).map(f => f.userId) || [];

    const profiles = await ProfileSettings.find({ userId: { $in: followerUserIds } })
      .select("userId userName displayName profileAvatar")
      .lean();

    const followingProfileMap = profiles.reduce((acc, p) => {
      acc[p.userId.toString()] = p;
      return acc;
    }, {});

    const following = (followingData?.followerIds || []).map((f, i) => {
      const profile = followingProfileMap[f.userId.toString()] || {};
      return {
        id: f.userId,
        name: profile.displayName || profile.userName || `User ${i + 1}`,
        description: `Following since ${f.createdAt}`,
        avatar: profile.profileAvatar || null,
      };
    }) || [];

    // ------------------ Hidden Feeds ------------------
    const user = await Users.findById(userId).lean();
    const hiddenFeedIds = user?.hiddenPostIds || [];
    const hiddenFeeds = await Feed.find({ _id: { $in: hiddenFeedIds } })
      .select("type language category contentUrl createdByAccount roleRef")
      .lean() || [];

    const creatorIds = hiddenFeeds.map(f => f.createdByAccount);
    const creatorProfiles = await ProfileSettings.find({ userId: { $in: creatorIds } })
      .select("userId userName displayName profileAvatar")
      .lean() || [];

    const profileMap = creatorProfiles.reduce((acc, p) => {
      acc[p.userId.toString()] = p;
      return acc;
    }, {});

    const hidden = hiddenFeeds.map(feed => ({
      id: feed._id,
      type: feed.type || "image",
      category: feed.category || "Unknown",
      language: feed.language || "en",
      contentUrl: feed.contentUrl || "",
      createdBy: {
        id: feed.createdByAccount,
        role: feed.roleRef || "User",
      },
      creator: {
        name: profileMap[feed.createdByAccount?.toString()]?.displayName ||
              profileMap[feed.createdByAccount?.toString()]?.userName ||
              "Unknown Creator",
        avatar: profileMap[feed.createdByAccount?.toString()]?.profileAvatar || null,
      },
    })) || [];

    // ------------------ Interested Categories ------------------
    const categoryData = await UserCategory.findOne({ userId })
      .populate("interestedCategories.categoryId", "name description")
      .populate("nonInterestedCategories.categoryId", "name description")
      .lean() || {};

    const interested = (categoryData?.interestedCategories || []).map((c, i) => ({
      id: c.categoryId?._id || i,
      title: c.categoryId?.name || `Category ${i + 1}`,
      description: c.categoryId?.description || `Interested since ${c.updatedAt?.toDateString() || "Unknown"}`,
    })) || [];

    const nonInterested = (categoryData?.nonInterestedCategories || []).map((c, i) => ({
      id: c.categoryId?._id || i,
      title: c.categoryId?.name || `Category ${i + 1}`,
      description: c.categoryId?.description || `Not interested since ${c.updatedAt?.toDateString() || "Unknown"}`,
    })) || [];

    // ------------------ Response ------------------
    return res.status(200).json({
      selectedUser,
      feeds,
      following,
      hidden,
      interested,
      nonInterested,
    });

  } catch (err) {
    console.error("Error fetching analytics:", err);
    return res.status(500).json({ message: "Server error" });
  }
};




exports.getUserLevelWithEarnings = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    // 1️⃣ Get current user's profile with fallback
    const currentUserProfile = await ProfileSettings.findOne({ userId })
      .select("userName profileAvatar")
      .lean();

    const currentUser = {
      userId: userId || null,
      userName: currentUserProfile?.userName || "Unknown User",
      profileAvatar: currentUserProfile?.profileAvatar || "/default-avatar.png",
    };

    // 2️⃣ Find the topmost level for this user
    const topLevel = await UserLevel.findOne({ userId })
      .sort({ level: -1 }) // highest level
      .select("level leftUsers rightUsers")
      .lean();

    const level = topLevel?.level || 0; // fallback to level 1
    const leftUserIds = topLevel?.leftUsers || [];
    const rightUserIds = topLevel?.rightUsers || [];

    // 3️⃣ Fetch left and right users with profile info, with fallbacks
    const fetchUsersWithProfile = async (userIds) => {
      if (!userIds || userIds.length === 0) return [];

      const profiles = await ProfileSettings.find({ userId: { $in: userIds } })
        .select("userId userName profileAvatar")
        .lean();

      return userIds.map(uId => {
        const profile = profiles.find(p => p.userId.toString() === uId.toString()) || {};
        return {
          _id: uId,
          userName: profile.userName || "Unknown User",
          profileAvatar: profile.profileAvatar || "/default-avatar.png",
        };
      });
    };

    const leftUsers = await fetchUsersWithProfile(leftUserIds);
    const rightUsers = await fetchUsersWithProfile(rightUserIds);

    // 4️⃣ Calculate total earnings for current user
    const earnings = await UserEarning.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: { _id: "$userId", totalEarned: { $sum: "$amount" } } }
    ]);
    const totalEarned = earnings[0]?.totalEarned || 0;

    // 5️⃣ Calculate total withdrawn and pending withdrawable amounts
    const withdrawals = await Withdrawal.find({ userId }).lean() || [];

    const totalWithdrawn = withdrawals
      .filter(w => w.status === "completed")
      .reduce((sum, w) => sum + (w.amount || 0), 0);

    const pendingWithdrawable = withdrawals
      .filter(w => w.status === "pending")
      .reduce((sum, w) => sum + (w.amount || 0), 0);

    // 6️⃣ Send response with all fallbacks
    return res.status(200).json({
      user: currentUser,
      level,
      totalEarned,
      totalWithdrawn,
      pendingWithdrawable,
      leftUsers,
      rightUsers,
    });

  } catch (err) {
    console.error("getUserLevelWithEarnings error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};









