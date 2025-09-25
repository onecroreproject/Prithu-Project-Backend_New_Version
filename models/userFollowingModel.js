const mongoose = require("mongoose");

const followerSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  }, // the user who owns this list

  // Arrays of objects to track actions with timestamps
  followerIds: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
      createdAt: { type: Date, default: Date.now }
    }
  ],

  nonFollowerIds: [
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
followerSchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("Follower", followerSchema, "UserFollowings");
