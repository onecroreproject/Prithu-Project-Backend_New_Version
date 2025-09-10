const mongoose = require("mongoose");

const AccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, enum: ["User", "Business", "Creator"], required: true },
  profileData: { type: mongoose.Schema.Types.ObjectId, ref: "ProfileSetting" },
  createdAt: { type: Date, default: Date.now }
},{ timestamps: true });

// prevent duplicate account type per user
AccountSchema.index({ userId: 1, type: 1 }, { unique: true });

// ✅ ModelName must be "Account" because your feed ref: 'Account'
module.exports = mongoose.model("Account", AccountSchema, "Accounts");
