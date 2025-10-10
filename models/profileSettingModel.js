const mongoose = require("mongoose");

const ProfileSettingsSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    childAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "ChildAdmin" },
    displayName: { type: String },
    gender: { type: String },
    userName: { type: String },
    bio: { type: String },
    dateOfBirth: { type: Date },
    maritalDate: { type: Date },
    maritalStatus: { type: String },
    phoneNumber: { type: String },

    // ✅ Existing avatar fields
    profileAvatar: { type: String },        // Original Cloudinary URL
    profileAvatarId: { type: String },      // Cloudinary public_id

    // ✅ New field to store modified avatar
    modifyAvatar: { type: String },         // Background removed or modified avatar URL

    theme: { type: String, default: "light" },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showProfilePicture: { type: Boolean, default: true },
    },
    language: { type: String, default: "en" },
    timezone: { type: String, default: "Asia/Kolkata" },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileSettings", ProfileSettingsSchema, "ProfileSettings");
