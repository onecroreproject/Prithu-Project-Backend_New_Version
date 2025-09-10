const mongoose = require("mongoose");

const UserCommentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", index: true },

  feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", required: true, index: true },
  commentText: { type: String, required: true },

  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("UserComment", UserCommentSchema, "UserComments");
