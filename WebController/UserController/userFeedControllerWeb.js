const mongoose = require("mongoose");
const Feed = require("../../models/feedModel");
const UserFeedActions = require("../../models/userFeedInterSectionModel");
const {feedTimeCalculator} =require("../../middlewares/feedTimeCalculator");



exports.getUserFeedsWeb = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId; // Assuming middleware sets req.Id
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

    // 2️⃣ Get all like counts for these feeds
    const feedIds = feeds.map((f) => f._id);

    const likeCounts = await UserFeedActions.aggregate([
      { $unwind: "$likedFeeds" },
      {
        $match: {
          "likedFeeds.feedId": { $in: feedIds },
        },
      },
      {
        $group: {
          _id: "$likedFeeds.feedId",
          count: { $sum: 1 },
        },
      },
    ]);

    const likeCountMap = new Map(
      likeCounts.map((item) => [item._id.toString(), item.count])
    );

    // 3️⃣ Get user's liked feed IDs
    const userActions = await UserFeedActions.findOne({ userId })
      .select("likedFeeds.feedId")
      .lean();

    const likedFeedIds = new Set(
      userActions?.likedFeeds?.map((f) => f.feedId.toString()) || []
    );

    // 4️⃣ Combine results
    const result = feeds.map((feed) => ({
      _id: feed._id,
      type: feed.type,
      contentUrl: feed.contentUrl,
      createdAt: feed.createdAt,
      timeAgo: feedTimeCalculator(feed.createdAt),
      likesCount: likeCountMap.get(feed._id.toString()) || 0,
      isLiked: likedFeedIds.has(feed._id.toString()),
    }));

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