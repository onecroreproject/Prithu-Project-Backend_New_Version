const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true, unique: true, minlength: 3, maxlength: 30 },
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },

    roles: { type: [String], enum: ["User", "Business", "Creator"], default: ["User"] },
    activeAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    accounts: [{ type: mongoose.Schema.Types.ObjectId, ref: "Account" }],
    profileSettings: { type: mongoose.Schema.Types.ObjectId, ref: "ProfileSettings" },

  referralCode: { type: String, unique: true },
  referralCodeIsValid: { type: Boolean, default: false },
  referredByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  referralCodeUsageCount: { type: Number, default: 0 },
  referralCodeUsageLimit: { type: Number, default: 2 },


    totalEarnings: { type: Number, default: 0 },
  withdrawnEarnings: { type: Number, default: 0 },
  balanceEarnings: { type: Number, default: 0 },


    // subscription object
    subscription: {
      isActive: { type: Boolean, default: false },
      startDate: { type: Date },
      endDate: { type: Date },
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },


    fcmTokens: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    lastActiveAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date },
    otpCode: { type: String },
    otpExpiresAt: { type: Date },
    termsAccepted: { type: Boolean, required: true, default: false },
    termsAcceptedAt: { type: Date },
    trialUsed: { type: Boolean, default: false },
    hiddenPostIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Feed" }],
    isBlocked: { type: String }
  },
  { timestamps: true }
);

UserSchema.index({ referredByUserId: 1 });
UserSchema.index({ referralCodeIsValid: 1 });

UserSchema.pre("save", function (next) {
  if (this.subscription) this.subscription.updatedAt = Date.now();
  next();
});

module.exports = mongoose.models.User || mongoose.model("User", UserSchema, "User");
