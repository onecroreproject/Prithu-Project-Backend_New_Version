const mongoose = require("mongoose");

const followingSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  }, // the user who owns this list

  // Arrays of objects to track actions with timestamps
  followingIds: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  nonFollowingIds: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  blockedIds: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  createdAt: { type: Date, default: Date.now } // document creation time
});

// Ensure one document per user
followingSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("Follower", followingSchema, "UserFollowings");
