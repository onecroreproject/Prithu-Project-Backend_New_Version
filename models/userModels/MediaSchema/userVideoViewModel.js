const mongoose = require("mongoose");

const videoViewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feed",
      required: true,
      index: true
    },

    watchedSeconds: {
      type: Number,
      default: 0,
      min: 0
    },

    viewedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// Compound indexes for super-fast lookups
videoViewSchema.index({ userId: 1, videoId: 1 });
videoViewSchema.index({ videoId: 1, viewedAt: -1 });
videoViewSchema.index({ userId: 1, viewedAt: -1 });

module.exports = mongoose.model("UserVideoView", videoViewSchema, "UserVideoView");
