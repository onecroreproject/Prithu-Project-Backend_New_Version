
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


// 🔹 Helper to build date filter
const buildDateFilter = (arrayField, dateKey, startDate, endDate) => {
  const match = {};
  if (startDate || endDate) {
    match[`${arrayField}.${dateKey}`] = {};
    if (startDate) match[`${arrayField}.${dateKey}`].$gte = new Date(startDate);
    if (endDate) match[`${arrayField}.${dateKey}`].$lte = new Date(endDate);
  }
  return match;
};





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

    const dateFilter = buildDateFilter("followerIds", "createdAt", startDate, endDate);

    const following = await Follower.findOne({ userId, ...dateFilter })
      .populate("followerIds.userId", "userName email");

    res.status(200).json({ success: true, following: following?.followerIds || [] });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch following users", error: err.message });
  }
};

/* ================================================================
   3️⃣ INTERESTED CATEGORIES
================================================================ */
exports.fetchUserInterested = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const match = buildDateFilter("interestedCategories", "updatedAt", startDate, endDate);

    const userCats = await UserCategory.findOne({ userId, ...match })
      .populate("interestedCategories.categoryId", "name description");

    res.status(200).json({
      success: true,
      categories: userCats?.interestedCategories || [],
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch interested categories", error: err.message });
  }
};

/* ================================================================
   4️⃣ NON-INTERESTED CATEGORIES
================================================================ */
exports.fetchUserNonInterested = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const match = buildDateFilter("nonInterestedCategories", "updatedAt", startDate, endDate);

    const userCats = await UserCategory.findOne({ userId, ...match })
      .populate("nonInterestedCategories.categoryId", "name description");

    res.status(200).json({
      success: true,
      categories: userCats?.nonInterestedCategories || [],
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch non-interested categories", error: err.message });
  }
};

/* ================================================================
   5️⃣ HIDDEN FEEDS
================================================================ */
exports.fetchUserHidden = async (req, res) => {
  try {
    const { userId } = req.params;
    const { type, startDate, endDate } = req.query;
    console.log(req.query)

    // Build date filter using your helper
    const dateFilter = buildDateFilter("hiddenPostIds", "createdAt", startDate, endDate);

    const user = await User.findById(userId).populate({
      path: "hiddenPostIds",
      select: "type language category contentUrl createdAt",
      match: {
        ...(type && type !== "all" ? { type } : {}),
        ...dateFilter, // Apply the date filter here
      },
    });
     
    res.status(200).json({
      success: true,
      hiddenFeeds: user?.hiddenPostIds || [],
    });
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
    const { startDate, endDate } = req.query;

    const match = buildDateFilter("likedFeeds", "likedAt", startDate, endDate);

    const actions = await UserFeedActions.findOne({ userId, ...match })
      .populate("likedFeeds.feedId", "type category language contentUrl");

    res.status(200).json({
      success: true,
      likedFeeds: actions?.likedFeeds || [],
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch liked feeds", error: err.message });
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
    res.status(200).json({ success: true, commentedFeeds: [] });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch commented feeds", error: err.message });
  }
};

/* ================================================================
   9️⃣ SHARED FEEDS
================================================================ */
exports.fetchUserShared = async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate } = req.query;

    const match = buildDateFilter("sharedFeeds", "sharedAt", startDate, endDate);

    const actions = await UserFeedActions.findOne({ userId, ...match })
      .populate("sharedFeeds.feedId", "type category language contentUrl");

    res.status(200).json({
      success: true,
      sharedFeeds: actions?.sharedFeeds || [],
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
    const { startDate, endDate } = req.query;

    const match = buildDateFilter("downloadedFeeds", "downloadedAt", startDate, endDate);

    const actions = await UserFeedActions.findOne({ userId, ...match })
      .populate("downloadedFeeds.feedId", "type category language contentUrl");

    res.status(200).json({
      success: true,
      downloadedFeeds: actions?.downloadedFeeds || [],
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

