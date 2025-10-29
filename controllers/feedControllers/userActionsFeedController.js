const UserFeedActions = require("../../models/userFeedInterSectionModel.js");
const Feeds = require("../../models/feedModel.js");
const { getActiveUserAccount } = require('../../middlewares/creatorAccountactiveStatus.js');
const UserComment =require("../../models/userCommentModel.js");
const UserReplyComment=require('../../models/userRepliesModel')
const CommentLike = require("../../models/commentsLikeModel.js");
const path=require('path')
const User=require('../../models/userModels/userModel');
const mongoose = require("mongoose");
const ProfileSettings=require('../../models/profileSettingModel');
const { feedTimeCalculator } = require("../../middlewares/feedTimeCalculator");
const UserCategory=require('../../models/userModels/userCategotyModel.js');
const Category=require('../../models/categorySchema.js');
const HiddenPost=require("../../models/userModels/hiddenPostSchema.js");
const Feed =require("../../models/feedModel.js");
const Notification = require("../../models/notificationModel.js");
const { createAndSendNotification } = require("../../middlewares/helper/socketNotification.js");



exports.likeFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const feedId = req.body.feedId;

  if (!userId || !feedId) {
    return res.status(400).json({ message: "userId and feedId required" });
  }

  try {
    const existingAction = await UserFeedActions.findOne({
      userId,
      "likedFeeds.feedId": feedId,
    });

    let updatedDoc, message, isLike;

    if (existingAction) {
      updatedDoc = await UserFeedActions.findOneAndUpdate(
        { userId },
        { $pull: { likedFeeds: { feedId } } },
        { new: true }
      );
      message = "Unliked successfully";
      isLike = false;
    } else {
      updatedDoc = await UserFeedActions.findOneAndUpdate(
        { userId },
        { $push: { likedFeeds: { feedId, likedAt: new Date() } } },
        { upsert: true, new: true }
      );
      message = "Liked successfully";
      isLike = true;
    }

   // 🔹 Create notification only if liked
if (isLike) {
  const feed = await Feeds.findById(feedId)
    .select("createdByAccount contentUrl roleRef")
    .lean();

  if (feed && feed.createdByAccount.toString() !== userId.toString()) {
    await createAndSendNotification({
      senderId: userId,
      receiverId: feed.createdByAccount,
      type: "LIKE_POST",
      title: "New Like ❤️",
      message: "Someone liked your post.",
      entityId: feed._id,
      entityType: "Feed",
      image: feed.contentUrl || "",
      roleRef: feed.roleRef || "User", // optional, for context
    });
  }
}


    res.status(200).json({
      message,
      likedFeeds: updatedDoc.likedFeeds,
    });
  } catch (err) {
    console.error("Error in likeFeed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};




exports.toggleDislikeFeed = async (req, res) => {
  try {
    const { feedId } = req.body;
    const userId = req.Id || req.body.userId;


    if (!feedId) {
      return res.status(400).json({ success: false, message: "Feed ID is required" });
    }

    if (!userId && !accountId) {
      return res.status(400).json({ success: false, message: "User or Account ID is required" });
    }

    //  Identify the query based on user type
    const query = userId ? { userId } : { accountId };

    //  Find or create user action document
    let userActions = await UserFeedActions.findOne(query);

    if (!userActions) {
      userActions = new UserFeedActions({
        ...query,
        disLikeFeeds: [],
      });
    }

    //  Check if feed is already disliked
    const isDisliked = userActions.disLikeFeeds.some(
      (item) => item.feedId.toString() === feedId
    );

    if (isDisliked) {
      //  Pull feedId (remove dislike)
      await UserFeedActions.updateOne(query, {
        $pull: { disLikeFeeds: { feedId: new mongoose.Types.ObjectId(feedId) } },
      });

      return res.status(200).json({
        success: true,
        message: "Dislike removed successfully",
        action: "removed",
      });
    } else {
      //  Push feedId (add dislike)
      await UserFeedActions.updateOne(
        query,
        {
          $push: {
            disLikeFeeds: {
              feedId: new mongoose.Types.ObjectId(feedId),
              downloadedAt: new Date(),
            },
          },
        },
        { upsert: true }
      );

      return res.status(200).json({
        success: true,
        message: "Feed disliked successfully",
        action: "added",
      });
    }
  } catch (error) {
    console.error("❌ Error toggling dislike:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};









exports.toggleSaveFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const { feedId } = req.body;

  if (!userId || !feedId) {
    return res.status(400).json({ message: "userId and feedId required" });
  }

  try {
    const feedObjectId = new mongoose.Types.ObjectId(feedId);

    // Check if the feed is already saved
    const existingAction = await UserFeedActions.findOne({
      userId,
      "savedFeeds.feedId": feedObjectId,
    });

    let updatedDoc, message;

    if (existingAction) {
      // Already saved → remove the feed object
      updatedDoc = await UserFeedActions.findOneAndUpdate(
        { userId },
        { $pull: { savedFeeds: { feedId: feedObjectId } } },
        { new: true }
      );
      message = "Unsaved successfully";
    } else {
      // Not saved → push new feed object with timestamp
      updatedDoc = await UserFeedActions.findOneAndUpdate(
        { userId },
        { $push: { savedFeeds: { feedId: feedObjectId, savedAt: new Date() } } },
        { upsert: true, new: true }
      );
      message = "Saved successfully";
    }

    res.status(200).json({
      message,
      savedFeeds: updatedDoc.savedFeeds,
    });
  } catch (err) {
    console.error("Error in toggleSaveFeed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};









exports.downloadFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const feedId = req.body.feedId;

  if (!userId) return res.status(400).json({ message: "userId is required" });
  if (!feedId) return res.status(400).json({ message: "feedId is required" });

  try {
    // ✅ Record download (push every time with timestamp)
    const updatedDoc = await UserFeedActions.findOneAndUpdate(
      { userId },
      { $push: { downloadedFeeds: { feedId, downloadedAt: new Date() } } },
      { upsert: true, new: true }
    );

    // ✅ Fetch feed to get the download link
    const feed = await Feeds.findById(feedId).select(
      "contentUrl fileUrl downloadUrl"
    );
    if (!feed) return res.status(404).json({ message: "Feed not found" });

    // ✅ Generate proper absolute download link
   
    const downloadLink =
      feed.downloadUrl
        ?feed.downloadUrl
        : feed.fileUrl
        ? feed.fileUrl
        : feed.contentUrl
        ? feed.contentUrl
        : null;

    if (!downloadLink) {
      return res.status(400).json({ message: "No downloadable link available" });
    }

    res.status(201).json({
      message: "Download recorded successfully",
      downloadedFeeds: updatedDoc.downloadedFeeds,
      downloadLink,
    });
  } catch (err) {
    console.error("Error in downloadFeed:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};





exports.shareFeed = async (req, res) => {
  const userId = req.Id || req.body.userId;
  const { feedId } = req.body;

  if (!userId || !feedId) {
    return res.status(400).json({ message: "userId and feedId are required" });
  }

  try {
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    const feed = await Feeds.findById(feedId).lean();
    if (!feed) return res.status(404).json({ message: "Feed not found" });

    const host = `${req.protocol}://${req.get("host")}`;
    const shareUrl = `${host}/feed/${feedId}?ref=${user.referralCode}`;

    res.status(200).json({
      message: "Share link generated",
      shareUrl
    });
  } catch (err) {
    console.error("Error generating share link:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};






exports.postComment = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const { feedId, commentText, parentCommentId } = req.body;

    if (!userId || !feedId || !commentText?.trim()) {
      return res.status(400).json({ message: "Invalid input" });
    }

    if (parentCommentId && !(await UserComment.exists({ _id: parentCommentId }))) {
      return res.status(400).json({ message: "Parent comment not found" });
    }

    const newComment = await UserComment.create({
      userId,
      feedId,
      commentText: commentText.trim(),
      parentCommentId: parentCommentId || null,
      createdAt: new Date(),
    });

    const userProfile = await ProfileSettings.findOne({ userId })
      .select("userName profileAvatar")
      .lean();
// 🔹 Notify feed owner
const feed = await Feeds.findById(feedId)
  .select("createdByAccount contentUrl roleRef")
  .lean();

if (feed && feed.createdByAccount.toString() !== userId.toString()) {
  await createAndSendNotification({
    senderId: userId,
    receiverId: feed.createdByAccount,
    type: "COMMENT",
    title: "New Comment 💬",
    message: `${commentText.slice(0, 50)}...`,
    entityId: feed._id,
    entityType: "Feed",
    image: feed.contentUrl || "",
    roleRef: feed.roleRef || "User", // optional
  });
}


    res.status(201).json({
      message: "Comment posted successfully",
      comment: {
        ...newComment.toObject(),
        timeAgo: feedTimeCalculator(newComment.createdAt),
        username: userProfile?.userName || "Unknown User",
        avatar: userProfile?.profileAvatar || null,
      },
    });
  } catch (err) {
    console.error("Error posting comment:", err);
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

    // Like: create new
    await CommentLike.create({ userId, commentId, likedAt: new Date() });

    const likeCount = await CommentLike.countDocuments({ commentId });

    // 🔹 Find comment to get feedId and text
    const comment = await UserComment.findById(commentId)
      .select("feedId commentText userId")
      .lean();

    if (comment) {
      const feed = await Feeds.findById(comment.feedId).select("userId contentUrl").lean();

      // 🔹 Get liker info (for better message)
      const likerProfile = await ProfileSettings.findOne({ userId })
        .select("userName profileAvatar")
        .lean();

      // 🔹 Notify comment owner (not self)
      if (comment.userId.toString() !== userId.toString()) {
        await createAndSendNotification({
          senderId: userId,
          receiverId: comment.userId,
          type: "COMMENT_LIKE",
          title: `${likerProfile?.userName || "Someone"} liked your comment 💬`,
          message: `"${comment.commentText?.slice(0, 80) || "Your comment"}"`,
          entityId: comment.feedId,
          entityType: "Comment",
          image: likerProfile?.profileAvatar || feed?.contentUrl || "",
        });
      }
    }

    res.status(201).json({
      message: "Comment liked",
      liked: true,
      likeCount,
    });
  } catch (err) {
    console.error("❌ Error toggling comment like:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};





exports.postReplyComment = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const { commentText, parentCommentId } = req.body;

    if (!userId || !commentText?.trim()) {
      return res.status(400).json({ message: "Invalid input" });
    }

    if (parentCommentId && !(await UserComment.exists({ _id: parentCommentId }))) {
      return res.status(400).json({ message: "Parent comment not found" });
    }

    const newReply = await UserReplyComment.create({
      userId,
      replyText: commentText.trim(),
      parentCommentId: parentCommentId || null,
      createdAt: new Date(),
    });

    const userProfile = await ProfileSettings.findOne({ userId })
      .select("userName profileAvatar")
      .lean();

    // 🔹 Notify parent comment owner
    const parentComment = await UserComment.findById(parentCommentId).select("userId feedId").lean();
    if (parentComment && parentComment.userId.toString() !== userId.toString()) {
      const feed = await Feeds.findById(parentComment.feedId).select("contentUrl").lean();
      await createAndSendNotification({
        senderId: userId,
        receiverId: parentComment.userId,
        type: "COMMENT",
        title: "New Reply 💬",
        message: commentText.slice(0, 50) + "...",
        entityId: parentComment.feedId,
        entityType: "Comment",
        image: feed?.contentUrl || "",
      });
    }

    res.status(201).json({
      message: "Reply posted successfully",
      comment: {
        ...newReply.toObject(),
        timeAgo: feedTimeCalculator(newReply.createdAt),
        username: userProfile?.userName || "Unknown User",
        avatar: userProfile?.profileAvatar || null,
      },
    });
  } catch (err) {
    console.error("Error posting reply:", err);
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
  try {
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }


    // 1️⃣ Get user's saved feeds
    const userActions = await UserFeedActions.findOne({ userId }).lean();
    if (!userActions) {
      return res.status(404).json({ message: "No actions found for this user" });
    }

    const savedFeedIds = userActions.savedFeeds.map(feed => feed.feedId);
    if (savedFeedIds.length === 0) {
      return res.status(200).json({ savedFeeds: [] });
    }

    // 2️⃣ Fetch feed details
    const feeds = await Feeds.find({ _id: { $in: savedFeedIds } })
      .select("contentUrl type")
      .lean();

    // 3️⃣ Aggregate like counts for saved feeds
    const likesAggregation = await UserFeedActions.aggregate([
      { $unwind: "$likedFeeds" },
      { $match: { "likedFeeds.feedId": { $in: savedFeedIds } } },
      { 
        $group: {
          _id: "$likedFeeds.feedId",
          likeCount: { $sum: 1 }
        }
      }
    ]);

    // 4️⃣ Map feed details with savedAt, likeCount, and full content URL
    const result = feeds.map(feed => {
      const savedInfo = userActions.savedFeeds.find(f => f.feedId.toString() === feed._id.toString());
      const likeInfo = likesAggregation.find(like => like._id.toString() === feed._id.toString());

      // Determine folder based on type
      const folder = feed.type === "video" ? "videos" : "images";
      const fullContentUrl = feed.contentUrl
        ? feed.contentUrl
        : null;

      return {
        _id: feed._id,
        contentUrl: fullContentUrl,
        type: feed.type,
        savedAt: savedInfo?.savedAt,
        likeCount: likeInfo ? likeInfo.likeCount : 0
      };
    });

    return res.status(200).json({ savedFeeds: result });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
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
    const likedFeeds = await UserFeedActions.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $unwind: "$likedFeeds" },

      // Join feed data
      {
        $lookup: {
          from: "Feeds",
          localField: "likedFeeds.feedId",
          foreignField: "_id",
          as: "feed",
        },
      },
      { $unwind: "$feed" },

      // Count total likes for each feed
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$likedFeeds.feedId" },
          pipeline: [
            { $unwind: "$likedFeeds" },
            { $match: { $expr: { $eq: ["$likedFeeds.feedId", "$$feedId"] } } },
            { $count: "totalLikes" },
          ],
          as: "likeStats",
        },
      },

      // Format output (no host concatenation)
      {
        $project: {
          feedId: "$feed._id",
          type: "$feed.type",
          likedAt: "$likedFeeds.likedAt",
          totalLikes: { $ifNull: [{ $arrayElemAt: ["$likeStats.totalLikes", 0] }, 0] },
          url: {
            $cond: [
              { $ifNull: ["$feed.downloadUrl", false] },
              "$feed.downloadUrl",
              {
                $cond: [
                  { $ifNull: ["$feed.fileUrl", false] },
                  "$feed.fileUrl",
                  {
                    $cond: [
                      { $ifNull: ["$feed.contentUrl", false] },
                      "$feed.contentUrl",
                      null,
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
    ]);

    if (!likedFeeds.length) {
      return res.status(404).json({ message: "No liked feeds found" });
    }

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








exports.userHideFeed = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const postId = req.body.feedId;

    if (!userId || !postId) {
      return res.status(400).json({ message: "User ID and Post ID are required" });
    }

    // ✅ Check if post and user exist
    const [user, post] = await Promise.all([
      User.findById(userId),
      Feed.findById(postId)
    ]);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!post) return res.status(404).json({ message: "Feed not found" });

    // ✅ Check if already hidden
    const alreadyHidden = await HiddenPost.findOne({ userId, postId });
    if (alreadyHidden) {
      return res.status(400).json({ message: "Post already hidden" });
    }

    // ✅ Create new hidden post entry
    await HiddenPost.create({ userId, postId });

    res.status(200).json({ message: "Post hidden successfully" });
  } catch (err) {
    console.error("Error hiding post:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


exports.getUserCategory = async (req, res) => {
  try {
    const userId= req.Id || req.body.userId  ;
    

    if (!userId) {
      return res.status(400).json({ message: "User ID not found in token" });
    }

    // Get user category document
    const userCategory = await UserCategory.findOne({ userId });
    if (!userCategory) {
      return res.status(404).json({ message: "User categories not found" });
    }

    // Extract interested and non-interested IDs
    const interestedIds = userCategory.interestedCategories.map(c => c.categoryId);
    const nonInterestedIds = userCategory.nonInterestedCategories.map(c => c.categoryId);

    // Fetch category names
    const interestedCategories = await Category.find(
      { _id: { $in: interestedIds } },
      { _id: 1, name: 1 }
    );

    const nonInterestedCategories = await Category.find(
      { _id: { $in: nonInterestedIds } },
      { _id: 1, name: 1 }
    );

    return res.status(200).json({
      success: true,
      data: {
        interestedCategories,
        nonInterestedCategories,
      },
    });
  } catch (error) {
    console.error("Error in getUserCategory:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



