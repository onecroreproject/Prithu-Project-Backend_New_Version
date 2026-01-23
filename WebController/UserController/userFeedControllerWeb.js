const mongoose = require("mongoose");
const Feed = require("../../models/feedModel");
const UserFeedActions = require("../../models/userFeedInterSectionModel");
const {feedTimeCalculator} =require("../../middlewares/feedTimeCalculator");
const ImageStats = require("../../models/userModels/MediaSchema/imageViewModel");
const VideoStats = require("../../models/userModels/MediaSchema/videoViewStatusModel");



exports.getUserFeedsWeb = async (req, res) => {
  try {
    const userId = req.Id || req.query.id;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // 1️⃣ Fetch only feeds created by this user
    const feeds = await Feed.find({
      createdByAccount: new mongoose.Types.ObjectId(userId),
      roleRef: "User",
      status: "Published",
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!feeds.length) {
      return res.status(200).json({
        success: true,
        totalFeeds: 0,
        feeds: [],
        message: "No posts found for this user",
      });
    }

    const feedIds = feeds.map((f) => f._id);

    // 2️⃣ Fetch like counts (fast aggregation)
    const likeCounts = await UserFeedActions.aggregate([
      { $unwind: "$likedFeeds" },
      { $match: { "likedFeeds.feedId": { $in: feedIds } } },
      { $group: { _id: "$likedFeeds.feedId", count: { $sum: 1 } } },
    ]);

    const likeMap = new Map(likeCounts.map((i) => [i._id.toString(), i.count]));

    // 3️⃣ Fetch logged-in user's liked feed IDs
    const userActions = await UserFeedActions.findOne({ userId })
      .select("likedFeeds.feedId")
      .lean();

    const likedFeedIds = new Set(
      userActions?.likedFeeds?.map((f) => f.feedId.toString()) || []
    );

    // 4️⃣ Fetch image stats (for images only)
    const imageFeeds = feeds.filter((f) => f.type === "image");
    const imageStats = await ImageStats.find({
      imageId: { $in: imageFeeds.map((i) => i._id) },
    })
      .select("imageId totalViews")
      .lean();

    const imageStatsMap = new Map(
      imageStats.map((i) => [i.imageId.toString(), i.totalViews])
    );

    // 5️⃣ Fetch video stats (for videos only)
    const videoFeeds = feeds.filter((f) => f.type === "video");
    const videoStats = await VideoStats.find({
      videoId: { $in: videoFeeds.map((v) => v._id) },
    })
      .select("videoId totalViews totalDuration")
      .lean();

    const videoStatsMap = new Map(
      videoStats.map((v) => [
        v.videoId.toString(),
        { totalViews: v.totalViews, totalDuration: v.totalDuration },
      ])
    );

    // 6️⃣ Combine all results in final response
    const result = feeds.map((feed) => {
      const id = feed._id.toString();

      return {
        _id: feed._id,
        type: feed.type,
        contentUrl: feed.contentUrl,
        duration: feed.duration || null, // ⏱ video duration
        createdAt: feed.createdAt,
        timeAgo: feedTimeCalculator(feed.createdAt),

        // ❤️ likes
        likesCount: likeMap.get(id) || 0,
        isLiked: likedFeedIds.has(id),

        // 👁 image + video views
        totalViews:
          feed.type === "image"
            ? imageStatsMap.get(id) || 0
            : videoStatsMap.get(id)?.totalViews || 0,

        // ⏳ only for videos
        totalWatchTime:
          feed.type === "video"
            ? videoStatsMap.get(id)?.totalDuration || 0
            : 0,
      };
    });

    return res.status(200).json({
      success: true,
      totalFeeds: result.length,
      feeds: result,
    });
  } catch (error) {
    console.error("Error fetching user feeds:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching user feeds",
      error: error.message,
    });
  }
};
