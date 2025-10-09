// models/hiddenPostModel.js
const mongoose = require("mongoose");

const hiddenPostSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feed",
      required: true,
    },
    reason: {
      type: String, // optional: why the post was hidden
    },
    hiddenAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("HiddenPost", hiddenPostSchema,"HiddenPost");
