const mongoose = require("mongoose");

const videoViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    totalDuration: { type: Number, default: 0 }, // ✅ total watch duration for this user (all videos)
    views: [
      {
        videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", required: true },
        watchedSeconds: { type: Number, default: 0 }, // ✅ how long this user watched this video
        viewedAt: { type: Date, default: Date.now },
      }
    ]
  },
  { timestamps: true }
);

// Index for faster queries
videoViewSchema.index({ "views.videoId": 1 });
videoViewSchema.index({ userId: 1 });

module.exports = mongoose.model("VideoView", videoViewSchema, "VideoView");
