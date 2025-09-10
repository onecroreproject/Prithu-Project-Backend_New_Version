const mongoose = require("mongoose");

const UserLevelSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  // Level + Tier tracking
  level: { type: Number, required: true },   // current level within this tier
  tier: { type: Number, required: true },    // which tier this belongs to

  // Limits + thresholds
  threshold: { type: Number, required: true }, // how many needed to complete this level (e.g., 2,4,8,...)
  levelLimit: { type: Number }, // optional: max for this level if you want cap (not always needed)

  // Referral tree tracking
  leftTreeCount: { type: Number, default: 0 },
  rightTreeCount: { type: Number, default: 0 },

  // Carry-over handling (🔥 NEW)
  leftCarryOver: { type: Number, default: 0 },
  rightCarryOver: { type: Number, default: 0 },

  // Who this user referred (for debugging / reports)
  referringPeople: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
UserLevelSchema.index({ userId: 1, level: 1, tier: 1 }, { unique: true });
UserLevelSchema.index({ userId: 1 });

// Auto update `updatedAt`
UserLevelSchema.pre("save", function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("UserLevel", UserLevelSchema, "UserLevels");
