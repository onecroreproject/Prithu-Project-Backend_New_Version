const Hidden = require("../../models/userModels/hiddenPostSchema")
const Feed = require("../../models/feedModel")




exports.getHiddenPosts = async (req, res) => {
  try {
    const userId = req.Id; // assuming auth middleware
    const { page = 1, limit = 20 } = req.query;

    const skip = (page - 1) * limit;

    // 1️⃣ Fetch hidden posts of this user
    const hiddenList = await Hidden.find({ userId })
      .sort({ hiddenAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    if (!hiddenList.length) {
      return res.status(200).json({
        hidden: [],
        total: 0,
        message: "No hidden posts found",
      });
    }

    // Extract postIds
    const postIds = hiddenList.map((hp) => hp.postId);

    // 2️⃣ Fetch feed details for those postIds
    const feeds = await Feed.find({ _id: { $in: postIds } })
      .populate("category", "name")
      .populate("statsId") // views, likes, shares etc
      .lean();

    // 3️⃣ Merge hidden-post info + feed data
    const merged = hiddenList.map((hidden) => {
      const feed = feeds.find((f) => f._id.toString() === hidden.postId.toString());
      return {
        hiddenId: hidden._id,
        postId: hidden.postId,
        reason: hidden.reason,
        hiddenAt: hidden.hiddenAt,
        feed, // full feed data
      };
    });

    // 4️⃣ Count total
    const total = await Hidden.countDocuments({ userId });

    return res.status(200).json({
      hidden: merged,
      total,
      page: Number(page),
      limit: Number(limit),
    });

  } catch (err) {
    console.error("❌ Error fetching hidden posts:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};




exports.removeHiddenPost = async (req, res) => {
  try {
    const userId = req.Id;   // from auth middleware
    const { postId } = req.body;

    if (!postId) {
      return res.status(400).json({
        message: "postId is required",
      });
    }

    // Delete only user's own hidden entry
    const deleted = await Hidden.findOneAndDelete({ userId, postId });

    if (!deleted) {
      return res.status(404).json({
        message: "This post is not in your hidden list",
      });
    }

    return res.status(200).json({
      message: "Post removed from hidden list successfully",
      postId,
    });

  } catch (err) {
    console.error("❌ Error removing hidden post:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};




