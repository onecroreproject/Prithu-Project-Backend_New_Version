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

    // 2. Likes for comments
    const commentLikesAgg = await CommentLike.aggregate([
      { $match: { commentId: { $in: commentIds } } },
      { $group: { _id: "$commentId", count: { $sum: 1 } } }
    ]);
    const commentLikeMap = {};
    commentLikesAgg.forEach(l => { commentLikeMap[l._id.toString()] = l.count; });

    // 3. User liked which comments
    const userLikedComments = await CommentLike.find({
      userId,
      commentId: { $in: commentIds }
    }).select("commentId -_id").lean();
    const userLikedCommentIds = userLikedComments.map(c => c.commentId.toString());

    // 4. Replies count per comment
    const replyAgg = await UserReplyComment.aggregate([
      { $match: { commentId: { $in: commentIds } } },
      { $group: { _id: "$commentId", count: { $sum: 1 } } }
    ]);
    const replyCountMap = {};
    replyAgg.forEach(r => { replyCountMap[r._id.toString()] = r.count; });

    // 5. Fetch user profiles for all commenters
    const profiles = await ProfileSettings.find({ userId: { $in: userIds } })
      .select("userId userName profileAvatar")
      .lean();

    const profileMap = {};
    profiles.forEach(p => {
      profileMap[p.userId.toString()] = {
        username: p.userName,
        avatar: p.profileAvatar 
      };
    });

    // 6. Format response
    const formattedComments = comments.map(c => {
      const profile = profileMap[c.userId?.toString()] || {};
      return {
        commentId: c._id,
        commentText: c.commentText,
        likeCount: commentLikeMap[c._id.toString()] || 0,
        isLiked: userLikedCommentIds.includes(c._id.toString()),
        replyCount: replyCountMap[c._id.toString()] || 0,
        timeAgo: feedTimeCalculator(c.createdAt),
        username: profile.username || "Unknown User",
        avatar: profile.avatar,
      };
    });

    res.status(200).json({ comments: formattedComments });
  } catch (error) {
    console.error("Error in getCommentsByFeed:", error);
    res.status(500).json({ message: "Server error" });
  }
};





exports.getRepliesByComment = async (req, res) => {
  try {
    const { parentCommentId } = req.body;
    const currentUserId = req.Id || req.body.userId;

    if (!parentCommentId) return res.status(400).json({ message: "Parent Comment ID required" });
    // Aggregation pipeline to fetch replies with like count
    const replies = await UserReplyComment.aggregate([
      { $match: { parentCommentId:new mongoose.Types.ObjectId(parentCommentId) } },
      { $sort: { createdAt: -1 } },
      {
        $lookup: {
          from: "CommentLikes",
          let: { replyId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$commentId", "$$replyId"] } } },
            { $count: "count" }
          ],
          as: "likeData"
        }
      },
      {
        $addFields: {
          likeCount: { $arrayElemAt: ["$likeData.count", 0] }
        }
      },
      { $project: { likeData: 0 } }
    ]);

    if (!replies.length) return res.status(200).json({ replies: [] });

    const replyUserIds = replies.map(r => r.userId);

    // Fetch profiles in one query
    const profiles = await ProfileSettings.find({ userId: { $in: replyUserIds } })
      .select("userId userName profileAvatar")
      .lean();

    const profileMap = {};
    profiles.forEach(p => {
      profileMap[p.userId.toString()] = {
        username: p.userName,
        avatar: p.profileAvatar ,
      };
    });

    // Fetch all likes by current user in one query
    const userLikedReplies = await CommentLike.find({
      userId: currentUserId,
      commentId: { $in: replies.map(r => r._id) }
    }).select("commentId -_id").lean();

    const userLikedReplyIds = new Set(userLikedReplies.map(r => r.commentId.toString()));

    // Format response
    const formattedReplies = replies.map(r => {
      const profile = profileMap[r.userId?.toString()] || {};
      return {
        replyId: r._id,
        replyText: r.replyText,
        likeCount: r.likeCount || 0,
        isLiked: userLikedReplyIds.has(r._id.toString()),
        timeAgo: feedTimeCalculator(r.createdAt),
        username: profile.username || "Unknown User",
        avatar: profile.avatar
      };
    });

    res.status(200).json({ replies: formattedReplies });
  } catch (error) {
    console.error("Error in getRepliesByComment:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

