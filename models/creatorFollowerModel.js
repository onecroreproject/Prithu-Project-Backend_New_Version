const mongoose = require("mongoose");

const creatorFollowerSchema = new mongoose.Schema({
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
  
  followerIds: [
    { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User" 
    }
  ],

  createdAt: { type: Date, default: Date.now }
});

// Ensure one document per creator
creatorFollowerSchema.index({ creatorId: 1 }, { unique: true });

module.exports = mongoose.model("CreatorFollower", creatorFollowerSchema, "CreatorFollowers");
