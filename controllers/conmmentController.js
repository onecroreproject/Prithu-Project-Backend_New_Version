const UserComment = require("../models/userCommentModel");
const UserReplyComment = require("../models/userRepliesModel");
const CommentLike = require("../models/commentsLikeModel");
const { feedTimeCalculator } = require("../middlewares/feedTimeCalculator");
const ProfileSettings=require('../models/profileSettingModel');
const mongoose=require("mongoose")





exports.getCommentsByFeed = async (req, res) => {
  try {
    const { feedId } = req.body;
    const userId = req.Id || req.body.userId;

    if (!feedId) return res.status(400).json({ message: "Feed ID required" });

    // 1. Get top-level comments
    const comments = await UserComment.find({ feedId })
      .sort({ createdAt: -1 })
      .lean();

    if (!comments.length) {
      return res.status(200).json({ comments: [] });
    }

    const commentIds = comments.map(c => c._id);
    const userIds = comments.map(c => c.userId);

    /* ======================================================
       2. Get like count for MAIN comments
       (Correct field → commentId)
    ======================================================= */
    const commentLikesAgg = await CommentLike.aggregate([
      { $match: { commentId: { $in: commentIds } } },
      { $group: { _id: "$commentId", count: { $sum: 1 } } }
    ]);

    const commentLikeMap = {};
    commentLikesAgg.forEach(l => {
      commentLikeMap[l._id.toString()] = l.count;
    });

    /* ======================================================
       3. Get which comments USER has liked
       (Correct field → commentId)
    ======================================================= */
    const userLikedComments = await CommentLike.find({
      userId,
      commentId: { $in: commentIds }
    }).select("commentId -_id");

    const userLikedCommentIds = new Set(
      userLikedComments.map(c => c.commentId.toString())
    );

    /* ======================================================
       4. Replies count
    ======================================================= */
    const replyAgg = await UserReplyComment.aggregate([
      { $match: { parentCommentId: { $in: commentIds } } },
      { $group: { _id: "$parentCommentId", count: { $sum: 1 } } }
    ]);

    const replyCountMap = {};
    replyAgg.forEach(r => { replyCountMap[r._id.toString()] = r.count; });

    /* ======================================================
       5. Fetch user profile info
    ======================================================= */
    const profiles = await ProfileSettings.find({
      userId: { $in: userIds }
    }).select("userId userName profileAvatar");

    const profileMap = {};
    profiles.forEach(p => {
      profileMap[p.userId.toString()] = {
        username: p.userName,
        avatar: p.profileAvatar
      };
    });

    /* ======================================================
       6. Format final response
    ======================================================= */
    const formattedComments = comments.map(c => {
      const profile = profileMap[c.userId?.toString()] || {};

      return {
        commentId: c._id,
        commentText: c.commentText,
        likeCount: commentLikeMap[c._id.toString()] || 0,
        isLiked: userLikedCommentIds.has(c._id.toString()),
        replyCount: replyCountMap[c._id.toString()] || 0,
        timeAgo: feedTimeCalculator(c.createdAt),
        username: profile.username || "Unknown User",
        avatar: profile.avatar
      };
    });

    return res.status(200).json({ comments: formattedComments });

  } catch (error) {
    console.error("Error in getCommentsByFeed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};






exports.getRepliesByComment = async (req, res) => {
  try {
    const { parentCommentId } = req.body;
    const currentUserId = req.Id || req.body.userId;

    if (!parentCommentId)
      return res.status(400).json({ message: "Parent Comment ID required" });

    const replies = await UserReplyComment.aggregate([
      {
        $match: {
          parentCommentId: new mongoose.Types.ObjectId(parentCommentId)
        }
      },
      { $sort: { createdAt: -1 } },

      // LIKE COUNT for each reply
      {
        $lookup: {
          from: "CommentLikes",       // FIXED
          let: { replyId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$replyCommentId", "$$replyId"] }
              }
            },
            { $count: "count" }
          ],
          as: "likeData"
        }
      },
      {
        $addFields: {
          likeCount: {
            $ifNull: [{ $arrayElemAt: ["$likeData.count", 0] }, 0]
          }
        }
      },
      { $project: { likeData: 0 } }
    ]);

    if (!replies.length) return res.status(200).json({ replies: [] });

    // Fetch user profiles
    const replyUserIds = replies.map(r => r.userId);

    const profiles = await ProfileSettings.find({
      userId: { $in: replyUserIds }
    }).select("userId userName profileAvatar").lean();

    const profileMap = {};
    profiles.forEach(p => {
      profileMap[p.userId.toString()] = {
        username: p.userName,
        avatar: p.profileAvatar
      };
    });

    // Which replies the current user liked
    const userObjectId = new mongoose.Types.ObjectId(currentUserId);

    const userLikedReplies = await CommentLike.find({
      userId: userObjectId,
      replyCommentId: { $in: replies.map(r => r._id) }
    }).select("replyCommentId");

    const userLikedReplyIds = new Set(
      userLikedReplies.map(r => r.replyCommentId.toString())
    );

    // Format response
    const formattedReplies = replies.map(r => {
      const profile = profileMap[r.userId?.toString()] || {};
      return {
        replyId: r._id,
        replyText: r.replyText,
        likeCount: r.likeCount,
        isLiked: userLikedReplyIds.has(r._id.toString()),
        timeAgo: feedTimeCalculator(r.createdAt),
        username: profile.username || "Unknown User",
        avatar: profile.avatar
      };
    });

    res.status(200).json({ replies: formattedReplies });

  } catch (error) {
    console.error("Error in getRepliesByComment:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};



