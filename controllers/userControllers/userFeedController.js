
const Feed = require("../../models/feedModel");
const ImageView = require("../../models/userModels/MediaSchema/userImageViewsModel");
const ImageStats = require("../../models/userModels/MediaSchema/imageViewModel");
const VideoView =require("../../models/userModels/MediaSchema/userVideoViewModel");
const VideoStats =require("../../models/userModels/MediaSchema/videoViewStatusModel");
const mongoose = require("mongoose");
const User = require("../../models/userModels/userModel");
const Follower = require("../../models/userFollowingModel");
const UserFeedActions = require("../../models/userFeedInterSectionModel");
const UserCategory = require("../../models/userModels/userCategotyModel");
const {buildDateFilter} =require("../../middlewares/helper/buildDateFilter");
const Hidden =require("../../models/userModels/hiddenPostSchema");
const ProfileSettings=require('../../models/profileSettingModel');
const UserComment=require ('../../models/userCommentModel');
const CreatorFollower=require("../../models/creatorFollowerModel");
const {feedTimeCalculator}=require("../../middlewares/feedTimeCalculator")







exports.userImageViewCount = async (req, res) => {
  try {
    const { feedId } = req.body;
    console.log(feedId)
    const userId = req.Id || req.body.userId;
 
    if (!userId || !feedId) {
      return res.status(400).json({ message: "userId and feedId are required" });
    }
 
    // ✅ Add only if not already viewed (unique)
    const updated = await ImageView.updateOne(
      { userId },
      { $addToSet: { views: { imageId: feedId, viewedAt: new Date() } } },
      { upsert: true }
    );
 
    // ✅ If new view was added → increment count only once
    if (updated.modifiedCount > 0) {
      Feed.updateOne(
        { _id: feedId },
        { $inc: { views: 1 } }
      ).exec(); // No await → non-blocking
    }
 
    return res.json({ message: "Unique image view recorded" });
  } catch (err) {
    console.error("❌ Error recording image view:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
 




exports.userVideoViewCount = async (req, res) => {
  try {
    const { feedId } = req.body;
    const userId = req.Id || req.body.userId;

    if (!userId || !feedId ) {
      return res.status(400).json({ message: "userId, feedId, and watchedSeconds are required" });
    }

    // 1️⃣ Check feed type and duration
    const feed = await Feed.findById(feedId, "type duration");
    if (!feed) {
      return res.status(404).json({ message: "Feed not found" });
    }
    if (feed.type !== "video") {
      return res.status(400).json({ message: "Feed is not a video" });
    }

    

    // 3️⃣ Check if already recorded for this user + video
    const existing = await VideoView.findOne({
      userId,
      "views.videoId": feedId,
    });

    if (existing) {
      return res.json({ message: "Session already recorded", watched: true });
    }

    // 4️⃣ Push view + increment user's total duration (use feed.duration, not watchedSeconds)
    await VideoView.findOneAndUpdate(
      { userId },
      {
        $push: {
          views: {
            videoId: feedId,
            watchedSeconds,
            totalDuration: feed.duration, // ✅ store feed’s duration
            viewedAt: new Date(),
          },
        },
        $inc: { totalDuration: feed.duration }, // ✅ increment total by feed duration
      },
      { upsert: true }
    );

    // 5️⃣ Update video stats (also increment by feed.duration)
    await VideoStats.findOneAndUpdate(
      { videoId: feedId },
      {
        $inc: { totalViews: 1, totalDuration: feed.duration }, // ✅ add feed duration instead of watchedSeconds
        $set: { lastViewed: new Date() },
      },
      { upsert: true }
    );

    // 6️⃣ Success response
    return res.json({
      message: "Video view recorded",
      watched: true,
      durationCounted: feed.duration,
    });
  } catch (err) {
    console.error("❌ Error recording video view:", err);
    return res.status(500).json({ message: "Server error" });
  }
};








/* ================================================================
   1️⃣ FETCH USER FEEDS — all feeds created by the user
================================================================ */
exports.fetchUserFeeds = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, type } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (type) filter.type = type;

    const feeds = await Feed.find({ createdByAccount: userId, ...filter })
      .populate("createdByAccount", "userName email");


    res.status(200).json({ success: true, feeds });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user feeds", error: err.message });
  }
};

/* ================================================================
   2️⃣ FOLLOWING USERS
================================================================ */
exports.fetchUserFollowing = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // ✅ Date filter builder (optional helper)
    const dateFilter = buildDateFilter("followerIds", "createdAt", startDate, endDate);

    // ✅ Find the following list
    const followingData = await Follower.findOne({ userId, ...dateFilter })
      .populate("followerIds.userId", "userName email");

    if (!followingData || !followingData.followerIds?.length) {
      return res.status(200).json({
        success: true,
        following: [],
        message: "No following users found for the given criteria",
      });
    }

    // ✅ Extract all followed user IDs
    const followedUserIds = followingData.followerIds.map(f => f.userId?._id);

    // ✅ Fetch corresponding profile avatars
    const profiles = await ProfileSettings.find({
      userId: { $in: followedUserIds },
    }).select("userId profileAvatar");

    // ✅ Map userId → avatar for quick lookup
    const avatarMap = profiles.reduce((acc, profile) => {
      acc[profile.userId.toString()] = profile.profileAvatar;
      return acc;
    }, {});

    // Merge avatar into response
    const followingWithAvatars = followingData.followerIds.map(f => ({
      userId: f.userId?._id,
      userName: f.userId?.userName,
      email: f.userId?.email,
      profileAvatar: avatarMap[f.userId?._id?.toString()] || "/default-avatar.png",
      followedAt: f.createdAt,
    }));

    res.status(200).json({
      success: true,
      following: followingWithAvatars,
    });
  } catch (err) {
    console.error(" Error in fetchUserFollowing:", err);
    res.status(500).json({
      message: "Failed to fetch following users",
      error: err.message,
    });
  }
};

/* ================================================================
   3️⃣ INTERESTED CATEGORIES
================================================================ */
exports.fetchUserInterested = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Build the date filter if you have a utility function
    const match = buildDateFilter("interestedCategories", "updatedAt", startDate, endDate);

    // Find user categories
    const userCats = await UserCategory.findOne({ userId, ...match })
  .populate({
    path: "interestedCategories.categoryId",
    model: "Categories",
    select: "name", 
  });
// Map to get category name + user's updatedAt
const categories = userCats?.interestedCategories.map((c) => ({
  _id: c.categoryId._id,
  name: c.categoryId.name,
  updatedAt: c.updatedAt, // user's updated date
})) || [];

res.status(200).json({
  success: true,
  categories,
});
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Failed to fetch interested categories",
      error: err.message,
    });
  }
};

/* ================================================================
   4️⃣ NON-INTERESTED CATEGORIES
================================================================ */
exports.fetchUserNonInterested = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    // Build date filter for non-interested categories
    const match = buildDateFilter(
      "nonInterestedCategories",
      "updatedAt",
      startDate,
      endDate
    );

    const userCats = await UserCategory.findOne({ userId, ...match }).populate({
      path: "nonInterestedCategories.categoryId",
      model: "Categories",
      select: "name", // only category name
    });
  console.log(userCats)
    // Map to include category name + user's updatedAt
    const categories = userCats?.nonInterestedCategories.map((c) => ({
      _id: c.categoryId._id,
      name: c.categoryId.name,
      updatedAt: c.updatedAt, // user's updated date
    })) || [];

    res.status(200).json({
      success: true,
      categories,
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch non-interested categories",
      error: err.message,
    });
  }
};

/* ================================================================
   5️⃣ HIDDEN FEEDS
================================================================ */
exports.fetchUserHidden = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, startDate, endDate } = req.query;

    // Step 1: Find all hidden feeds for the user
    const hiddenEntries = await Hidden.find({ userId }).select("feedId");
    if (!hiddenEntries.length) {
      return res.status(200).json({ success: true, hiddenFeeds: [] });
    }

    // Step 2: Extract feed IDs
    const feedIds = hiddenEntries.map((h) => h.feedId);

    // Step 3: Build filter using your utility
    const feedFilter = {
      _id: { $in: feedIds },
      ...buildDateFilter({ field: "createdAt", type, startDate, endDate }),
    };

    // Step 4: Fetch hidden feeds
    const hiddenFeeds = await Feed.find(feedFilter).select(
      "type contentUrl language createdAt"
    );

    res.status(200).json({ success: true, hiddenFeeds });
  } catch (err) {
    console.error("Error fetching hidden feeds:", err);
    res.status(500).json({
      message: "Failed to fetch hidden feeds",
      error: err.message,
    });
  }
};



/* ================================================================
   6️⃣ LIKED FEEDS
================================================================ */
exports.fetchUserLiked = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, type } = req.query;

    // Optimized: Use aggregation to filter and fetch liked feeds with feed details
    const pipeline = [
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      { $unwind: "$likedFeeds" },
      {
        $lookup: {
          from: "Feed",
          localField: "likedFeeds.feedId",
          foreignField: "_id",
          as: "feedDetails",
          pipeline: [{ $project: { type: 1, category: 1, language: 1, contentUrl: 1 } }]
        }
      },
      { $unwind: "$feedDetails" },
      {
        $match: {
          ...(type && type !== "all" && { "feedDetails.type": type }),
          ...(startDate || endDate ? {
            "likedFeeds.likedAt": {
              ...(startDate && { $gte: new Date(startDate) }),
              ...(endDate && { $lte: new Date(endDate) })
            }
          } : {})
        }
      },
      {
        $project: {
          feedId: "$feedDetails._id",
          type: "$feedDetails.type",
          category: "$feedDetails.category",
          language: "$feedDetails.language",
          contentUrl: "$feedDetails.contentUrl",
          likedAt: "$likedFeeds.likedAt"
        }
      },
      { $sort: { likedAt: -1 } }
    ];

    const likedFeeds = await UserFeedActions.aggregate(pipeline);

    res.status(200).json({
      success: true,
      likedFeeds,
    });
  } catch (err) {
    console.error("Error fetching liked feeds:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch liked feeds",
      error: err.message,
    });
  }
};

/* ================================================================
   7️⃣ DISLIKED FEEDS (if tracked later)
================================================================ */
exports.fetchUserDisliked = async (req, res) => {
  try {
    res.status(200).json({ success: true, dislikedFeeds: [] });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch disliked feeds", error: err.message });
  }
};

/* ================================================================
   8️⃣ COMMENTED FEEDS (placeholder — if comment model exists)
================================================================ */
exports.fetchUserCommented = async (req, res) => {
  try {
    const { userId } = req.params;

    // Fetch comments by user and populate feed contentUrl
    const comments = await UserComment.find({ userId })
      .sort({ createdAt: -1 }) // latest comments first
      .populate({
        path: "feedId",
        select: "contentUrl title", // fetch only contentUrl and title
      });

    // Format response
    const commentedFeeds = comments.map((comment) => ({
      _id: comment._id,
      commentText: comment.commentText,
      createdAt: comment.createdAt,
      feed: comment.feedId
        ? {
            _id: comment.feedId._id,
            contentUrl: comment.feedId.contentUrl,
            title: comment.feedId.title || null,
          }
        : null,
    }));

    res.status(200).json({ success: true, commentedFeeds });
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch commented feeds",
      error: err.message,
    });
  }
};

/* ================================================================
   9️⃣ SHARED FEEDS
================================================================ */
exports.fetchUserShared = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, type } = req.query;

    // Build date filter
    const match = buildDateFilter("sharedFeeds", "sharedAt", startDate, endDate);

    // Get user's shared feeds
    const actions = await UserFeedActions.findOne({ userId, ...match })
      .populate("sharedFeeds.feedId", "type category language contentUrl title");

    if (!actions || !actions.sharedFeeds) {
      return res.status(200).json({ success: true, sharedFeeds: [] });
    }

    // Process feeds to filter by type and count
    const processedFeeds = actions.sharedFeeds
      .filter((item) => !type || item.feedId?.type === type) // filter by type if provided
      .map((item) => ({
        feed: item.feedId,
        sharedAt: item.sharedAt,
        count: actions.sharedFeeds.filter(
          (f) => f.feedId?.toString() === item.feedId?._id.toString()
        ).length,
      }));

    res.status(200).json({
      success: true,
      sharedFeeds: processedFeeds,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch shared feeds", error: err.message });
  }
};

/* ================================================================
   🔟 DOWNLOADED FEEDS
================================================================ */
exports.fetchUserDownloaded = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, type } = req.query;

    // Build date filter
    const match = buildDateFilter("downloadedFeeds", "downloadedAt", startDate, endDate);

    // Get user's downloaded feeds
    const actions = await UserFeedActions.findOne({ userId, ...match })
      .populate("downloadedFeeds.feedId", "type category language contentUrl title");

    if (!actions || !actions.downloadedFeeds) {
      return res.status(200).json({ success: true, downloadedFeeds: [] });
    }

    // Process feeds to filter by type and count
    const processedFeeds = actions.downloadedFeeds
      .filter((item) => !type || item.feedId?.type === type) // filter by type if provided
      .map((item) => ({
        feed: item.feedId,
        downloadedAt: item.downloadedAt,
        count: actions.downloadedFeeds.filter(
          (f) => f.feedId?.toString() === item.feedId?._id.toString()
        ).length,
      }));

    res.status(200).json({
      success: true,
      downloadedFeeds: processedFeeds,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch downloaded feeds", error: err.message });
  }
};



exports.getUserAnalyticsSummary = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }

    // Optimized: Single aggregation pipeline to count all metrics
    const [result] = await UserFeedActions.aggregate([
      { $match: { userId: mongoose.Types.ObjectId(userId) } },
      {
        $lookup: {
          from: "User",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { hiddenPostIds: 1 } }]
        }
      },
      {
        $lookup: {
          from: "UserCategories",
          localField: "userId",
          foreignField: "userId",
          as: "userCategory",
          pipeline: [{ $project: { interestedCategories: 1, nonInterestedCategories: 1 } }]
        }
      },
      {
        $lookup: {
          from: "UserFollowings",
          localField: "userId",
          foreignField: "userId",
          as: "followerData",
          pipeline: [{ $project: { followerIds: 1, blockedIds: 1 } }]
        }
      },
      {
        $project: {
          liked: { $size: { $ifNull: ["$likedFeeds", []] } },
          saved: { $size: { $ifNull: ["$savedFeeds", []] } },
          downloaded: { $size: { $ifNull: ["$downloadedFeeds", []] } },
          shared: { $size: { $ifNull: ["$sharedFeeds", []] } },
          interested: { $size: { $ifNull: ["$userCategory.interestedCategories", []] } },
          notInterested: { $size: { $ifNull: ["$userCategory.nonInterestedCategories", []] } },
          hidden: { $size: { $ifNull: ["$user.hiddenPostIds", []] } },
          following: { $size: { $ifNull: ["$followerData.followerIds", []] } },
          blocked: { $size: { $ifNull: ["$followerData.blockedIds", []] } }
        }
      }
    ]);

    if (!result) {
      return res.status(404).json({ success: false, message: "No user data found" });
    }

    return res.status(200).json({
      success: true,
      message: "User analytics summary fetched successfully",
      summary: result,
    });

  } catch (error) {
    console.error("Error fetching user analytics summary:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching user analytics summary",
    });
  }
};




// In-memory cache for profile data (simple Map-based cache)
const profileCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Assuming you have a middleware that sets req.userId from the token
exports.getUserdetailWithinTheFeed = async (req, res) => {
  try {
    const currentUserId = req.Id; // from token middleware
    const { profileUserId, roleRef } = req.query;

    if (!profileUserId || !roleRef) {
      return res.status(400).json({ message: "profileUserId and roleRef are required" });
    }

    // Check cache first
    const cacheKey = `${profileUserId}-${roleRef}`;
    const cached = profileCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return res.json({
        success: true,
        profile: cached.data,
      });
    }

    // Determine the field to query based on roleRef
    let query = {};
    if (roleRef === "Admin") query.adminId = profileUserId;
    else if (roleRef === "User") query.userId = profileUserId;
    else if (roleRef === "Child_Admin") query.childAdminId = profileUserId;
    else return res.status(400).json({ message: "Invalid roleRef" });

    // Find the profile
    const profile = await ProfileSettings.findOne(query).select("userName profileAvatar bio");
    if (!profile) return res.status(404).json({ message: "Profile not found" });

    // Get following info from Follower collection
    const followerDoc = await Follower.findOne({ userId: profileUserId });
    const followingCount = followerDoc ? followerDoc.followingIds.length : 0;

    // Get creator follower count
    const creatorFollowerDoc = await CreatorFollower.findOne({ creatorId: profileUserId });
    const creatorFollowerCount = creatorFollowerDoc ? creatorFollowerDoc.followerIds.length : 0;

    // Check if current user is following this profile
    const isFollowing = followerDoc
      ? followerDoc.followingIds.some(f => f.userId.toString() === currentUserId)
      : false;

    const profileData = {
      userName: profile.userName,
      profileAvatar: profile.profileAvatar,
      bio: profile.bio,
      followingCount,
      creatorFollowerCount,
      isFollowing,
    };

    // Cache the result
    profileCache.set(cacheKey, { data: profileData, timestamp: Date.now() });

    return res.json({
      success: true,
      profile: profileData,
    });

  } catch (error) {
    console.error("Error in getUserdetailWithinTheFeed:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};





exports.getUserPost = async (req, res) => {
  try {
    const userId = req.body.profileUserId || req.body.currentUserId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const creatorId = userId;

    // Optimized: Single aggregation pipeline to fetch feeds with like counts
    const result = await Feed.aggregate([
      { $match: { createdByAccount: mongoose.Types.ObjectId(creatorId) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: "$likedFeeds" },
            { $match: { $expr: { $eq: ["$likedFeeds.feedId", "$$feedId"] } } },
            { $count: "likeCount" }
          ],
          as: "likeData"
        }
      },
      {
        $addFields: {
          likeCount: { $ifNull: [{ $arrayElemAt: ["$likeData.likeCount", 0] }, 0] },
          timeAgo: { $function: { body: feedTimeCalculator.toString(), args: ["$createdAt"], lang: "js" } }
        }
      },
      {
        $project: {
          feedId: "$_id",
          contentUrl: 1,
          timeAgo: 1,
          likeCount: 1
        }
      }
    ]);

    if (!result || result.length === 0) {
      return res.status(404).json({
        message: "No feeds found for this creator",
        feedCount: 0,
        feeds: [],
      });
    }

    return res.status(200).json({
      message: "Creator feeds retrieved successfully",
      feedCount: result.length,
      feeds: result,
    });

  } catch (error) {
    console.error("Error fetching creator feeds:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};



 