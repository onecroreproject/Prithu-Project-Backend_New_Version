const mongoose = require("mongoose");

const ProfileSettingsSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    childAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "ChildAdmin" },

    // Profile Details
    displayName: { type: String },
    gender: { type: String },
    userName: { type: String },
    bio: { type: String },
    dateOfBirth: { type: Date },
    maritalDate: { type: Date },
    maritalStatus: { type: String },
    phoneNumber: { type: String },

    // Avatar Fields
    profileAvatar: { type: String },   // Original Cloudinary URL
    profileAvatarId: { type: String }, // Cloudinary public_id
    modifyAvatar: { type: String },    // Background removed or modified avatar URL

    // Social Media Links
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
    },

    language: { type: String, default: "en" },
    timezone: { type: String, default: "Asia/Kolkata" },
    details: { type: mongoose.Schema.Types.Mixed },

    // ✅ Visibility Toggles
    visibility: {
      displayName: { type: Boolean, default: true },
      gender: { type: Boolean, default: true },
      userName: { type: Boolean, default: true },
      bio: { type: Boolean, default: true },
      dateOfBirth: { type: Boolean, default: true },
      maritalDate: { type: Boolean, default: true },
      maritalStatus: { type: Boolean, default: true },
      phoneNumber: { type: Boolean, default: true },
      profileAvatar: { type: Boolean, default: true },
      socialLinks: { type: Boolean, default: true },
    },

    // Optional: Individual social link visibility
    socialLinksVisibility: {
      facebook: { type: Boolean, default: true },
      instagram: { type: Boolean, default: true },
      twitter: { type: Boolean, default: true },
      linkedin: { type: Boolean, default: true },
      github: { type: Boolean, default: true },
      youtube: { type: Boolean, default: true },
      website: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  "ProfileSettings",
  ProfileSettingsSchema,
  "ProfileSettings"
);
