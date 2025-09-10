const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

// -------------------
// Device Sub-Schema
// -------------------
const DeviceSchema = new mongoose.Schema({
  deviceId: { type: String, required: true },
  deviceType: { type: String, enum: ["web", "mobile"], required: true },
  ipAddress: { type: String },
  lastActiveAt: { type: Date, default: Date.now },
});

// -------------------
// User Schema
// -------------------
const UserSchema = new mongoose.Schema(
  {
    // Basic Info
    userName: { type: String, required: true, unique: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },

    // Roles & Accounts
    roles: { type: [String], enum: ["User", "Business", "Creator"], default: ["User"] },
    activeAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    accounts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Account" }],

    // Profile References
    profileSettings: { type: mongoose.Schema.Types.ObjectId, ref: "ProfileSettings" },

    // Referral System
referralCode: { type: String, unique: true, index: true },
referredByCode: { type: String },
referralCodeUsageLimit: { type: Number, default: 0 },
referralCodeIsValid: { type: Boolean, default: true },
referredByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
referralCount: { type: Number, default: 0 },
directReferralsCount: { type: Number, default: 0 },
sideUnderParent: { type: String, enum: ["left", "right", null], default: null },

// ✅ Keep direct finisher arrays (fast lookup)
directReferralFinishersLeft: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
directReferralIncompleteLeft: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
directReferralFinishersRight: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
directReferralIncompleteRight: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

// ✅ New: cached level/tier info
currentLevel: { type: Number, default: 1 },
currentTier: { type: Number, default: 1 },
lastPromotedAt: { type: Date },
isTierComplete: { type: Boolean, default: false },


 totalEarnings: { type: Number, default: 0 },      // all earned
  withdrawableEarnings: { type: Number, default: 0 }, 


    // Devices & Session Info
    devices: { type: [DeviceSchema], default: [] },
    activeSession: { type: String, default: null },
    isOnline: { type: Boolean, default: false, index: true },
    lastSeenAt: { type: Date, default: null },
    fcmTokens: { type: [String], default: [] },

    // Account Activity
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },

    // OTP
    otpCode: { type: String },
    otpExpiresAt: { type: Date },

    // Terms & Trial
    termsAccepted: { type: Boolean, required: true, default: false },
    termsAcceptedAt: { type: Date },
    trialUsed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// -------------------
// Indexes
// -------------------
UserSchema.index({ referredByUserId: 1 });
UserSchema.index({ referralCodeIsValid: 1 });

// -------------------
// Pre-save hook
// -------------------
UserSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// -------------------
// Export Model
// -------------------
module.exports = mongoose.models.User || mongoose.model("User", UserSchema, "User");
