
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
const UserComment=require ('../../models/userCommentModel')







exports.userImageViewCount = async (req, res) => {
  try {
    const { feedId } = req.body;
    const userId = req.Id || req.body.userId;

    if (!userId || !feedId) {
      return res.status(400).json({ message: "userId and feedId are required" });
    }

    // 1️⃣ Check feed type
    const feed = await Feed.findById(feedId, "type");
    if (!feed || feed.type !== "image") {
      return; 
    }

    // 2️⃣ Check if this user has already viewed this feed
    const existing = await ImageView.findOne({
      userId,
      "views.imageId": feedId,
    });

    if (existing) {
      return; 
    }

    // 3️⃣ Push new feedId + timestamp into views array
    await ImageView.findOneAndUpdate(
      { userId },
      { $push: { views: { imageId: feedId, viewedAt: new Date() } } },
      { upsert: true }
    );

    // 4️⃣ Update aggregated stats
    await ImageStats.findOneAndUpdate(
      { imageId: feedId },
      {
        $inc: { totalViews: 1 },
        $set: { lastViewed: new Date() },
      },
      { upsert: true }
    );

    // 5️⃣ Minimal response
    return res.json({ message: "Image view recorded" });
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

    // Fetch user liked feeds
    const actions = await UserFeedActions.findOne({ userId })
      .populate("likedFeeds.feedId", "type category language contentUrl");
     
    if (!actions) {
      return res.status(200).json({ success: true, likedFeeds: [] });
    }

    let likedFeeds = actions.likedFeeds || [];

    // Filter by type if specified (image/video)
    if (type && type !== "all") {
      likedFeeds = likedFeeds.filter(
        (item) => item.feedId?.type === type
      );
    }

    // Filter by date range if specified
    if (startDate || endDate) {
      likedFeeds = likedFeeds.filter((item) => {
        const likedAt = new Date(item.likedAt);
        if (startDate && likedAt < new Date(startDate)) return false;
        if (endDate && likedAt > new Date(endDate)) return false;
        return true;
      });
    }

console.log(likedFeeds)

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

    // Fetch all data in parallel for speed
    const [user, feedActions, userCategory, followerData] = await Promise.all([
      User.findById(userId).select("hiddenPostIds"),
      UserFeedActions.findOne({ userId }),
      UserCategory.findOne({ userId }),
      Follower.findOne({ userId }),
    ]);

    if (!user && !feedActions && !userCategory && !followerData) {
      return res.status(404).json({ success: false, message: "No user data found" });
    }

    // Extract and count everything safely
    const totalLiked = feedActions?.likedFeeds?.length || 0;
    const totalSaved = feedActions?.savedFeeds?.length || 0;
    const totalDownloaded = feedActions?.downloadedFeeds?.length || 0;
    const totalShared = feedActions?.sharedFeeds?.length || 0;

    const totalInterested = userCategory?.interestedCategories?.length || 0;
    const totalNonInterested = userCategory?.nonInterestedCategories?.length || 0;

    const totalHidden = user?.hiddenPostIds?.length || 0;
    const totalFollowing = followerData?.followerIds?.length || 0;
    const totalBlocked = followerData?.blockedIds?.length || 0;

    // Combine all counts
    const summary = {
      liked: totalLiked,
      saved: totalSaved,
      downloaded: totalDownloaded,
      shared: totalShared,
      interested: totalInterested,
      notInterested: totalNonInterested,
      hidden: totalHidden,
      following: totalFollowing,
      blocked: totalBlocked,
    };

    return res.status(200).json({
      success: true,
      message: "User analytics summary fetched successfully",
      summary,
    });

  } catch (error) {
    console.error("Error fetching user analytics summary:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching user analytics summary",
    });
  }
};

