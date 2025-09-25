const mongoose = require("mongoose");

const imageStatsSchema = new mongoose.Schema(
  {
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image", required: true, unique: true },
    totalViews: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 }, // optional
    lastViewed: { type: Date },
  },
  { timestamps: true }
);

imageStatsSchema.index({ totalViews: -1 }); // for "most viewed" queries

module.exports = mongoose.model("ImageStats", imageStatsSchema,"ImageStats");
