const mongoose = require("mongoose");

const ReplySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", index: true },

  // Link back to feed and comment
  feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", required: true, index: true },
  commentId: { type: mongoose.Schema.Types.ObjectId, ref: "UserComment", required: true, index: true },

  replyText: { type: String, required: true },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Reply", ReplySchema, "Replies");
