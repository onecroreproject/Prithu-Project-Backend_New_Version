const mongoose = require("mongoose");

const CommentLikeSchema = new mongoose.Schema(
  {
    // Like by User
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
      sparse: true,
    },

    // MAIN COMMENT like
    commentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "UserComment",
      index: true,
      sparse: true,
    },

    // REPLY COMMENT like
    replyCommentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ReplyComment",
      index: true,
      sparse: true,
    },

    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);



/* ======================================================
   HIGH PERFORMANCE LOOKUP INDEXES
====================================================== */
CommentLikeSchema.index({ commentId: 1 });
CommentLikeSchema.index({ replyCommentId: 1 });

module.exports = mongoose.model("CommentLike", CommentLikeSchema, "CommentLikes");





