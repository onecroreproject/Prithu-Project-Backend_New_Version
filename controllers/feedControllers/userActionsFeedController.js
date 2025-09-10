const UserFeedActions = require("../../models/userFeedInterSectionModel.js");
const Feeds = require("../../models/feedModel.js");
const { getActiveUserAccount } = require('../../middlewares/creatorAccountactiveStatus.js');
const UserComment =require("../../models/userModels/userCommentModel.js");
const CommentLike = require("../../models/userModels/commentsLikeModel.js");
const path=require('path')



exports.likeFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const feedId = req.body.feedId;

  if (!userId || !feedId) {
    return res.status(400).json({ message: "userId and feedId required" });
  }

  try {
    // Check if feed is already liked by this user
    const existingAction = await UserFeedActions.findOne({
      userId,
      "likedFeeds.feedId": feedId
    });

    let updatedDoc, message;

    if (existingAction) {
      // Unlike: remove the feed from likedFeeds
      updatedDoc = await UserFeedActions.findOneAndUpdate(
        { userId },
        { $pull: { likedFeeds: { feedId } } },
        { new: true }
      );
      message = "Unliked successfully";
    } else {
      // Like: add the feed with current timestamp
      updatedDoc = await UserFeedActions.findOneAndUpdate(
        { userId },
        { $push: { likedFeeds: { feedId, likedAt: new Date() } } },
        { upsert: true, new: true }
      );
      message = "Liked successfully";
    }

    res.status(200).json({
      message,
      likedFeeds: updatedDoc.likedFeeds
    });
  } catch (err) {
    console.error("Error in likeFeed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};





exports.saveFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const feedId = req.body.feedId;

  if (!userId || !feedId) {
    return res.status(400).json({ message: "userId and feedId required" });
  }

  try {
    // 1️⃣ Check if already saved
    const existingAction = await UserFeedActions.findOne({
      userId,
      "savedFeeds.feedId": feedId,
    });

    let updatedDoc, message;

    if (existingAction) {
      // 2️⃣ Already saved → remove (un-save)
      updatedDoc = await UserFeedActions.findOneAndUpdate(
        { userId },
        { $pull: { savedFeeds: { feedId } } },
        { new: true }
      );
      message = "Unsaved successfully";
    } else {
      // 3️⃣ Not saved → add with timestamp
      updatedDoc = await UserFeedActions.findOneAndUpdate(
        { userId },
        { $push: { savedFeeds: { feedId, savedAt: new Date() } } },
        { upsert: true, new: true }
      );
      message = "Saved successfully";
    }

    res.status(200).json({
      message,
      savedFeeds: updatedDoc.savedFeeds,
    });
  } catch (err) {
    console.error("Error in saveFeed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};




exports.downloadFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const feedId = req.body.feedId;

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!feedId) return res.status(400).json({ message: "feedId is required" });

  try {
    // 1️⃣ Always record download (can have duplicates or only latest based on your choice)
    const updatedDoc = await UserFeedActions.findOneAndUpdate(
      { userId },
      { $push: { downloadedFeeds: { feedId, downloadedAt: new Date() } } }, // always push
      { upsert: true, new: true }
    );

    // 2️⃣ Fetch feed to get the download link
    const feed = await Feeds.findById(feedId).select("contentUrl fileUrl downloadUrl");
    if (!feed) return res.status(404).json({ message: "Feed not found" });

    res.status(201).json({
      message: "Download recorded successfully",
      downloadedFeeds: updatedDoc.downloadedFeeds,
      downloadLink: feed.downloadUrl || feed.fileUrl || feed.contentUrl,
    });
  } catch (err) {
    console.error("Error in downloadFeed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};





exports.shareFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const { feedId, shareChannel, shareTarget } = req.body;

  if (!userId || !feedId) {
    return res.status(400).json({ message: "userId and feedId are required" });
  }

  try {
    const updatedDoc = await UserFeedActions.findOneAndUpdate(
      { userId },
      {
        $push: {
          sharedFeeds: {
            feedId,
            shareChannel: shareChannel || null, // e.g. whatsapp, email, facebook
            shareTarget: shareTarget || null,   // e.g. friendId, groupId, email
            sharedAt: new Date(),
          },
        },
      },
      { upsert: true, new: true }
    );

    res.status(200).json({
      message: "Feed shared successfully",
      lastShared: updatedDoc.sharedFeeds[updatedDoc.sharedFeeds.length - 1],
      totalShares: updatedDoc.sharedFeeds.length,
      sharedFeeds: updatedDoc.sharedFeeds,
    });
  } catch (err) {
    console.error("Error in shareFeed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};




exports.postComment = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const { feedId, commentText, parentCommentId } = req.body;

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!feedId) return res.status(400).json({ message: "feedId is required" });
  if (!commentText || !commentText.trim()) {
    return res.status(400).json({ message: "commentText is required" });
  }

  try {
    // ✅ Optional check for parent comment (if it's a reply)
    if (parentCommentId) {
      const parentComment = await UserComment.findById(parentCommentId);
      if (!parentComment) {
        return res.status(400).json({ message: "Parent comment not found" });
      }
    }

    // ✅ Create comment
    const newComment = await UserComment.create({
      userId,
      feedId,
      commentText: commentText.trim(),
      parentCommentId: parentCommentId || null,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: parentCommentId ? "Reply posted successfully" : "Comment posted successfully",
      comment: newComment,
    });
  } catch (err) {
    console.error("Error posting comment:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};



exports.postView = async (req, res) => {
  const userId = req.Id || req.body.userId; // optional, for anonymous views
  const { feedId, watchDuration } = req.body;

  if (!feedId) return res.status(400).json({ message: "feedId is required" });

  try {
    // Create a new view entry
    const view = await UserView.create({
      userId: userId || null, // allow anonymous views
      feedId,
      watchDuration: watchDuration || 0
    });

    res.status(201).json({
      message: "View recorded successfully",
      view
    });
  } catch (err) {
    console.error("Error recording view:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUserSavedFeeds = async (req, res) => {
  const userId = req.Id || req.body.userId;

  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const userActions = await UserFeedActions.findOne({ userId })
      .populate("savedFeeds.feedId", "contentUrl fileUrl downloadUrl type") // ✅ nested populate
      .lean();

    if (!userActions || !userActions.savedFeeds.length) {
      return res.status(404).json({ message: "No saved feeds found" });
    }

    // Build URLs
    const savedFeeds = userActions.savedFeeds.map(item => {
      const feed = item.feedId;
      if (!feed) return null;

      const folder = feed.type === "video" ? "videos" : "images";
      const url =
        feed.downloadUrl ||
        feed.fileUrl ||
        (feed.contentUrl
          ? `http://192.168.1.48:5000/uploads/${folder}/${path.basename(feed.contentUrl)}`
          : null);

      return {
        feedId: feed._id,
        contentUrl:url,
        type: feed.type,
        savedAt: item.savedAt, // ✅ timestamp from schema
      };
    }).filter(Boolean);

    res.status(200).json({
      message: "Saved feeds retrieved successfully",
      count: savedFeeds.length,
      savedFeeds
    });
  } catch (err) {
    console.error("Error fetching saved feeds:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

exports.getUserDownloadedFeeds = async (req, res) => {
  const userId = req.Id || req.body.userId;

  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const userActions = await UserFeedActions.findOne({ userId })
      .populate("downloadedFeeds.feedId", "contentUrl fileUrl downloadUrl type")
      .lean();

    if (!userActions || !userActions.downloadedFeeds.length) {
      return res.status(404).json({ message: "No downloaded feeds found" });
    }

    // Map with timestamp
    const downloadedFeeds = userActions.downloadedFeeds.map(item => {
      const feed = item.feedId;
      if (!feed) return null;

      const folder = feed.type === "video" ? "videos" : "images";
      const url =
        feed.downloadUrl ||
        feed.fileUrl ||
        (feed.contentUrl
          ? `http://192.168.1.48:5000/uploads/${folder}/${path.basename(feed.contentUrl)}`
          : null);

      return {
        feedId: feed._id,
        url,
        type: feed.type,
        downloadedAt: item.downloadedAt, // ✅ include timestamp
      };
    }).filter(Boolean);

    res.status(200).json({
      message: "Downloaded feeds retrieved successfully",
      count: downloadedFeeds.length,
      downloadedFeeds,
    });
  } catch (err) {
    console.error("Error fetching downloaded feeds:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.getUserLikedFeeds = async (req, res) => {
  const userId = req.Id || req.body.userId;

  if (!userId) return res.status(400).json({ message: "userId is required" });

  try {
    const userActions = await UserFeedActions.findOne({ userId })
      .populate("likedFeeds.feedId", "contentUrl fileUrl downloadUrl type")
      .lean();

    if (!userActions || !userActions.likedFeeds.length) {
      return res.status(404).json({ message: "No liked feeds found" });
    }

    // Map with timestamp
    const likedFeeds = userActions.likedFeeds.map(item => {
      const feed = item.feedId;
      if (!feed) return null;

      const folder = feed.type === "video" ? "videos" : "images";
      const url =
        feed.downloadUrl ||
        feed.fileUrl ||
        (feed.contentUrl
          ? `http://192.168.1.48:5000/uploads/${folder}/${path.basename(feed.contentUrl)}`
          : null);

      return {
        feedId: feed._id,
        url,
        type: feed.type,
        likedAt: item.likedAt, // ✅ include timestamp
      };
    }).filter(Boolean);

    res.status(200).json({
      message: "Liked feeds retrieved successfully",
      count: likedFeeds.length,
      likedFeeds,
    });
  } catch (err) {
    console.error("Error fetching liked feeds:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};


exports.commentLike = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const { commentId } = req.body;

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!commentId) return res.status(400).json({ message: "commentId is required" });

  try {
    // Check if user already liked the comment
    const existingLike = await CommentLike.findOne({ userId, commentId });

    if (existingLike) {
      // Unlike: remove the like
      await CommentLike.deleteOne({ _id: existingLike._id });
      const likeCount = await CommentLike.countDocuments({ commentId });
      return res.status(200).json({
        message: "Comment unliked",
        liked: false,
        likeCount,
      });
    }

    // Like: create new with timestamp
    await CommentLike.create({ userId, commentId, likedAt: new Date() });

    const likeCount = await CommentLike.countDocuments({ commentId });

    res.status(201).json({
      message: "Comment liked",
      liked: true,
      likeCount,
    });
  } catch (err) {
    console.error("Error toggling comment like:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};




