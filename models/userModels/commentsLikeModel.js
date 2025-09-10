const mongoose = require("mongoose");

const CommentLikeSchema = new mongoose.Schema({
  // Either userId or accountId (support both operations)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", index: true },

  commentId: { type: mongoose.Schema.Types.ObjectId, ref: "UserComment", required: true, index: true },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Prevent duplicate like per user/account on a comment
CommentLikeSchema.index(
  { userId: 1, accountId: 1, commentId: 1 },
  { unique: true, partialFilterExpression: { commentId: { $exists: true } } }
);

module.exports = mongoose.model("CommentLike", CommentLikeSchema, "CommentLikes");
