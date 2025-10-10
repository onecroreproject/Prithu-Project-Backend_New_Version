const Account = require("../../models/accountSchemaModel");
const Feed = require("../../models/feedModel");
const ProfileSettings=require('../../models/profileSettingModel');
const TrendingCreators=require('../../models/treandingCreators');




exports.getAllCreatorDetails = async (req, res) => {
  console.log("working");

  try {
    // Find all accounts and populate user and profileSettings
    const allCreators = await Account.find()
      .populate({
        path: "userId",
        select: "userName email profileSettings",
        populate: {
          path: "profileSettings",
          select:
            "profileAvatar timeAgo contentUrl contentFullUrl feedId likeCount shareCount comments downloadCount"
        }
      })
      .lean(); // returns plain JS objects

    if (!allCreators || allCreators.length === 0) {
      return res.status(400).json({ message: "Creators Details not Found" });
    }

    // Map creators and include feed count + createdAt
    const creators = await Promise.all(
      allCreators.map(async (acc) => {
        const user = acc.userId || {};
        const profile = user.profileSettings || {};

        // 🔹 Aggregate feed counts by type
        const feedStats = await Feed.aggregate([
          {
            $match: { createdByAccount: acc._id }
          },
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 }
            }
          }
        ]);

        // Convert stats to easy lookup
        const statsMap = feedStats.reduce((map, obj) => {
          map[obj._id] = obj.count;
          return map;
        }, {});

        const imageCount = statsMap["image"] || 0;
        const videoCount = statsMap["video"] || 0;
        const totalFeeds = imageCount + videoCount;

        return {
          accountId: acc._id,
          userName: user.userName || "Unknown",
          email: user.email || "",
          profileAvatar: profile.profileAvatar || "",
          followers: null, // placeholder
          totalFeeds,
          imageCount,
          videoCount,
          createdAt: acc.createdAt
        };
      })
    );

    res.status(200).json({
      total: creators.length,
      creators
    });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Cannot Fetch Creator Details", error: err });
  }
};



exports.getAllTrendingCreators = async (req, res) => {
  try {
    // 1️⃣ Get all trending creators
    const creators = await TrendingCreators.find({}).sort({ trendingScore: -1 });

    // 2️⃣ Build response with profile info
    const result = await Promise.all(
      creators.map(async (creator) => {
        // Find related account
        const account = await Account.findById(creator.accountId);
        if (!account) return null;

        // Find profile data using accountId
        const profile = await ProfileSettings.findOne({ userId: account.userId });

        return {
          accountId: creator.accountId,
          userName: profile?.userName || creator.userName || "Unknown",
          profileAvatar: profile?.profileAvatar || creator.profileAvatar || "",
          trendingScore: creator.trendingScore || 0,
          totalVideoViews: creator.totalVideoViews || 0,
          totalImageViews: creator.totalImageViews || 0,
          totalLikes: creator.totalLikes || 0,
          totalShares: creator.totalShares || 0,
          followerCount: creator.followerCount || 0,
          lastUpdated: creator.lastUpdated,
        };
      })
    );

    // 3️⃣ Filter out null accounts and send
    const filtered = result.filter((r) => r !== null);
    res.status(200).json({ success: true, creators: filtered });
  } catch (error) {
    console.error("Error fetching trending creators:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

