const mongoose = require("mongoose");

const videoStatsSchema = new mongoose.Schema(
  {
    videoId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", required: true, unique: true },
    totalViews: { type: Number, default: 0 },
    totalDuration: { type: Number, default: 0 }, // ✅ total watch duration for this video
    uniqueUsers: { type: Number, default: 0 },   // optional unique users count
    lastViewed: { type: Date },
  },
  { timestamps: true }
);

// Index for "most viewed videos"
videoStatsSchema.index({ totalViews: -1 });

module.exports = mongoose.model("VideoStats", videoStatsSchema, "VideoStats");
