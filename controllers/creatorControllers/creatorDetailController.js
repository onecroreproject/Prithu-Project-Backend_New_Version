const Account = require("../../models/accountSchemaModel");
const Feed = require("../../models/feedModel");




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


