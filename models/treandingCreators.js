const mongoose = require("mongoose");

const TrendingCreatorsSchema = new mongoose.Schema({
  accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true, unique: true },
  userName: { type: String },
  profileAvatar: { type: String },
  trendingScore: { type: Number },
  totalVideoViews: { type: Number },
  totalImageViews: { type: Number },
  totalLikes: { type: Number },
  totalShares: { type: Number },
  followerCount: { type: Number },
  lastUpdated: { type: Date, default: Date.now },
});

module.exports = mongoose.model("TrendingCreators", TrendingCreatorsSchema, "TrendingCreators");
