const path = require("path");
const UserFeedActions = require("../models/userFeedInterSectionModel");
const Feed = require("../models/feedModel");
const UserComment = require("../models/userCommentModel");
const UserView = require("../models/userModels/userViewFeedsModel");
const CommentLike = require("../models/commentsLikeModel");

// ---------------------- FEED LIKE ----------------------
exports.creatorlikeFeed = async (req, res) => {
  const accountId = req.accountId || req.body.accountId || null;
  const feedId = req.body.feedId;

  if (!feedId) return res.status(400).json({ message: "feedId required" });
  if (!accountId) return res.status(400).json({ message: "accountId required" });

  try {
    // Only filter by accountId now
    const result = await UserFeedActions.findOneAndUpdate(
      { accountId },
      { $addToSet: { likedFeeds: feedId } },
      { upsert: true, new: true }
    );

    const isLiked = result.likedFeeds.includes(feedId);

    res.status(200).json({
      message: isLiked ? "Liked successfully" : "Already liked",
      liked: true,
      likedFeeds: result.likedFeeds
    });
  } catch (err) {
    console.error("Error liking feed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------- FEED SAVE ----------------------
exports.creatorsaveFeed = async (req, res) => {
  const accountId = req.accountId || req.body.accountId || null;
  const feedId = req.body.feedId;

  if (!feedId) return res.status(400).json({ message: "feedId required" });
  if (!accountId) return res.status(400).json({ message: "accountId required" });

  try {
    // Only filter by accountId
    const result = await UserFeedActions.findOneAndUpdate(
      { accountId },
      { $addToSet: { savedFeeds: feedId } },
      { upsert: true, new: true }
    );

    const isSaved = result.savedFeeds.includes(feedId);

    res.status(200).json({
      message: isSaved ? "Saved successfully" : "Already saved",
      saved: true,
      savedFeeds: result.savedFeeds
    });
  } catch (err) {
    console.error("Error saving feed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------- FEED DOWNLOAD ----------------------
exports.creatorDownloadFeed = async (req, res) => {
  const accountId = req.accountId || req.body.accountId;
  const feedId = req.body.feedId;

  if (!accountId) return res.status(400).json({ message: "accountId required" });
  if (!feedId) return res.status(400).json({ message: "feedId required" });

  try {
    const result = await UserFeedActions.findOneAndUpdate(
      { accountId },
      { $addToSet: { downloadedFeeds: feedId } },
      { upsert: true, new: true }
    );

    const feed = await Feed.findById(feedId).select("contentUrl fileUrl downloadUrl type");
    if (!feed) return res.status(404).json({ message: "Feed not found" });

    res.status(201).json({
      message: "Download recorded successfully",
      downloadedFeeds: result.downloadedFeeds,
      downloadLink: getFeedUrl(feed, `${req.protocol}://${req.get("host")}`)
    });
  } catch (err) {
    console.error("Error downloading feed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


// ---------------------- FEED SHARE ----------------------
exports.creatorShareFeed = async (req, res) => {
  const accountId = req.accountId || req.body.accountId;
  const { feedId, shareChannel, shareTarget } = req.body;

  if (!accountId) return res.status(400).json({ message: "accountId required" });
  if (!feedId) return res.status(400).json({ message: "feedId required" });

  try {
    const result = await UserFeedActions.findOneAndUpdate(
      { accountId },
      { $push: { sharedFeeds: { feedId, shareChannel, shareTarget, sharedAt: new Date() } } },
      { upsert: true, new: true }
    );

    res.status(200).json({ message: "Feed shared successfully", sharedFeeds: result.sharedFeeds });
  } catch (err) {
    console.error("Error sharing feed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------- COMMENT POST ----------------------
exports.creatorPostView = async (req, res) => {
  const accountId = req.accountId || req.body.accountId;
  const { feedId, watchDuration } = req.body;

  if (!accountId) return res.status(400).json({ message: "accountId required" });
  if (!feedId) return res.status(400).json({ message: "feedId required" });

  try {
    const view = await UserView.create({ accountId, feedId, watchDuration: watchDuration || 0 });
    res.status(201).json({ message: "View recorded successfully", view });
  } catch (err) {
    console.error("Error recording view:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


// ---------------------- VIEW POST ----------------------
exports.creatorpostView = async (req, res) => {
  const userId = req.accountId || req.body.userId || null;
  const accountId = req.accountId || req.body.accountId || null;
  const { feedId, watchDuration } = req.body;

  if (!feedId) return res.status(400).json({ message: "feedId is required" });

  try {
    const view = await UserView.create({
      userId,
      accountId,
      feedId,
      watchDuration: watchDuration || 0,
    });

    res.status(201).json({
      message: "View recorded successfully",
      view,
    });
  } catch (err) {
    console.error("Error recording view:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

// ---------------------- COMMENT LIKE TOGGLE ----------------------
exports.creatorCommentLike = async (req, res) => {
  const accountId = req.accountId || req.body.accountId;
  const { commentId } = req.body;

  if (!accountId) return res.status(400).json({ message: "accountId required" });
  if (!commentId) return res.status(400).json({ message: "commentId required" });

  try {
    const existingLike = await CommentLike.findOne({ commentId, accountId });
    if (existingLike) {
      await CommentLike.deleteOne({ _id: existingLike._id });
      const likeCount = await CommentLike.countDocuments({ commentId });
      return res.status(200).json({ message: "Comment unliked", liked: false, likeCount });
    }

    await CommentLike.create({ commentId, accountId });
    const likeCount = await CommentLike.countDocuments({ commentId });
    res.status(201).json({ message: "Comment liked", liked: true, likeCount });
  } catch (err) {
    console.error("Error toggling comment like:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


// ---------------------- GET SAVED FEEDS ----------------------
exports.getCreatorSavedFeeds = async (req, res) => {
  const accountId = req.accountId || req.body.accountId;
  if (!accountId) return res.status(400).json({ message: "accountId required" });

  try {
    const userActions = await UserFeedActions.findOne({ accountId })
      .populate("savedFeeds", "contentUrl fileUrl downloadUrl type")
      .lean();

    if (!userActions || !userActions.savedFeeds.length)
      return res.status(404).json({ message: "No saved feeds found" });


    const savedFeedUrls = userActions.savedFeeds
      .map(feed => {
        const folder = feed.type === "video" ? "videos" : "images";
        return feed.downloadUrl || null ;
      })
      .filter(Boolean);

    res.status(200).json({ message: "Saved feeds retrieved successfully", savedFeedUrls });
  } catch (err) {
    console.error("Error fetching saved feeds:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


// ---------------------- GET DOWNLOADED FEEDS ----------------------
exports.getCreatorDownloadedFeeds = async (req, res) => {
  const accountId = req.accountId || req.body.accountId;
  if (!accountId) return res.status(400).json({ message: "accountId required" });

  try {
    const userActions = await UserFeedActions.findOne({ accountId })
      .populate("downloadedFeeds", "contentUrl fileUrl downloadUrl type")
      .lean();

    if (!userActions || !userActions.downloadedFeeds.length)
      return res.status(404).json({ message: "No downloaded feeds found" });

   
    const downloadedFeedUrls = userActions.downloadedFeeds
      .map(feed => {
        const folder = feed.type === "video" ? "videos" : "images";
        return feed.downloadUrl || feed.fileUrl || feed.contentUrl ;
      })
      .filter(Boolean);

    res.status(200).json({ message: "Downloaded feeds retrieved successfully", downloadedFeedUrls });
  } catch (err) {
    console.error("Error fetching downloaded feeds:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


// ---------------------- GET LIKED FEEDS ----------------------
exports.getCreatorLikedFeeds = async (req, res) => {
  const accountId = req.accountId || req.body.accountId;
  if (!accountId) return res.status(400).json({ message: "accountId required" });

  try {
    const userActions = await UserFeedActions.findOne({ accountId })
      .populate("likedFeeds", "contentUrl fileUrl downloadUrl type")
      .lean();

    if (!userActions || !userActions.likedFeeds.length)
      return res.status(404).json({ message: "No liked feeds found" });

    const likedFeedUrls = userActions.likedFeeds
      .map(feed => {
        const folder = feed.type === "video" ? "videos" : "images";
        return feed.downloadUrl || feed.fileUrl || feed.contentUrl
      })
      .filter(Boolean);

    res.status(200).json({ message: "Liked feeds retrieved successfully", likedFeedUrls });
  } catch (err) {
    console.error("Error fetching liked feeds:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
