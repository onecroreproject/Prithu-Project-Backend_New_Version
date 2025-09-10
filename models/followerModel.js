const mongoose = require("mongoose");

const followerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },     // person who follows
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "Creator", required: true }, // creator being followed
  createdAt: { type: Date, default: Date.now }
});

// Prevent duplicate follows
followerSchema.index({ userId: 1, creatorId: 1 }, { unique: true });

module.exports = mongoose.model("Follower", followerSchema,"Followers");
