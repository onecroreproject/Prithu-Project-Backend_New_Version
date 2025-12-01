const mongoose = require("mongoose");
const {prithuDB}=require("../../database");


// ------------ FCM SUB-SCHEMA -------------
const FcmTokenSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, index: true }, // ⚡ fast lookup
    platform: { type: String, enum: ["web", "ios", "android"], required: true },
    topics: { type: [String], default: [] },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ------------ SUBSCRIPTION SUB-SCHEMA -------------
const SubscriptionSchema = new mongoose.Schema(
  {
    isActive: { type: Boolean, default: false, index: true },
    startDate: { type: Date },
    endDate: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ------------ MAIN USER SCHEMA --------------
const UserSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
      minlength: 3,
      maxlength: 30,
      trim: true,
      index: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    passwordHash: {
      type: String,
      required: true,
    },

    roles: {
      type: [String],
      enum: ["User", "Business", "Creator"],
      default: ["User"],
    },

    accountType: {
      type: String,
      enum: ["personal", "company"],
      default: "personal",
      required: true,
      index: true,
    },

    activeAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },

    accounts: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Account",
      },
    ],

    profileSettings: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProfileSettings",
    },

    // ------------ REFERRAL LOGIC --------------
    referralCode: { type: String, unique: true, sparse: true, trim: true },

    referralCodeIsValid: { type: Boolean, default: false },

    referredByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    referralCodeUsageCount: { type: Number, default: 0 },
    referralCodeUsageLimit: { type: Number, default: 2 },

    // ------------ EARNING SYSTEM --------------
    totalEarnings: { type: Number, default: 0 },
    withdrawnEarnings: { type: Number, default: 0 },
    balanceEarnings: { type: Number, default: 0 },

    // ------------ SUBSCRIPTION --------------
    subscription: { type: SubscriptionSchema, default: {} },

    // ------------ FCM DEVICES --------------
    fcmTokens: { type: [FcmTokenSchema], default: [] },

    // ------------ ACCOUNT STATUS --------------
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },

    // ------------ TIMING METRICS --------------
    lastActiveAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },

    // ------------ PRESENCE STATUS --------------
    isOnline: { type: Boolean, default: false },
    lastSeenAt: { type: Date, default: null },

    // ------------ OTP --------------
    otpCode: { type: String },
    otpExpiresAt: { type: Date },

    // ------------ TERMS & COMPLIANCE --------------
    termsAccepted: { type: Boolean, default: false, required: true },
    termsAcceptedAt: { type: Date },

    trialUsed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    versionKey: false, // ⚡ remove __v
    minimize: true, // ⚡ remove empty objects
  }
);

// ------------ INDEXES FOR PERFORMANCE --------------
UserSchema.index({ email: 1 }, { unique: true });
UserSchema.index({ userName: 1 }, { unique: true });
UserSchema.index({ referralCode: 1 }, { unique: true, sparse: true });
UserSchema.index({ referralCodeIsValid: 1 });
UserSchema.index({ accountType: 1 });
UserSchema.index({ "subscription.isActive": 1 });
UserSchema.index({ isOnline: 1 }); // For efficient presence queries

// ------------ AUTO UPDATE SUBSCRIPTION TIMESTAMP --------------
UserSchema.pre("save", function (next) {
  if (this.subscription) {
    this.subscription.updatedAt = Date.now();
  }
  next();
});

module.exports = mongoose.models.User || prithuDB.model("User", UserSchema, "User");
