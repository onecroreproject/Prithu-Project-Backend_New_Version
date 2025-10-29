const mongoose = require("mongoose");

const ProfileSettingsSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    childAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "ChildAdmin" },

    // Basic Details
    displayName: { type: String },
    gender: { type: String },
    userName: { type: String },
    bio: { type: String },
    dateOfBirth: { type: Date },
    maritalDate: { type: Date },
    maritalStatus: { type: String },
    phoneNumber: { type: String },

    // Location
    country: { type: String },
    city: { type: String },

    // Avatar & Cover
    profileAvatar: { type: String },
    profileAvatarId: { type: String },
    modifyAvatar: { type: String },
    modifyAvatarPublicId: { type: String },
    coverPhoto: { type: String },
    coverPhotoId: { type: String },
    modifiedCoverPhoto: { type: String },
    modifiedCoverPhotoId: { type: String },

    // Social Links
    socialLinks: {
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
      twitter: { type: String, default: "" },
      linkedin: { type: String, default: "" },
      github: { type: String, default: "" },
      youtube: { type: String, default: "" },
      website: { type: String, default: "" },
    },

    // Theme, Notifications, Privacy
    theme: { type: String, default: "light" },
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false },
    },
    privacy: {
      showEmail: { type: Boolean, default: false },
      showProfilePicture: { type: Boolean, default: true },
      showCoverPhoto: { type: Boolean, default: true },
      showLocation: { type: Boolean, default: true },
      showPhoneNumber: { type: Boolean, default: true },
    },

    language: { type: String, default: "en" },
    timezone: { type: String, default: "Asia/Kolkata" },
    details: { type: mongoose.Schema.Types.Mixed },

    // Visibility — now stored as reference
    visibility: { type: mongoose.Schema.Types.ObjectId, ref: "ProfileVisibility" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileSettings", ProfileSettingsSchema, "ProfileSettings");
