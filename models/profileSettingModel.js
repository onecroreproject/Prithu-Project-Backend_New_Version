const mongoose = require("mongoose");
const {prithuDB}=require("../database");

const ProfileSettingsSchema = new mongoose.Schema(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    adminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    childAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "ChildAdmin" },

    // Basic Details
    gender: { type: String },
    userName: { type: String ,index:true},
    name: { type: String,index:true },
    lastName: { type: String,index:true },
    bio: { type: String },
    profileSummary: { type: String },
    dateOfBirth: { type: Date },
    maritalDate: { type: Date },
    maritalStatus: { type: String },
    phoneNumber: { type: Number },
    whatsAppNumber: { type: Number },

    // Location
    address: { type: String },
    country: { type: String },
    city: { type: String },

    //Profile Link 
    shareableLink: { type: String },
    isPublished: { type: Boolean, default: false },

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
      showWhatsAppNumber: { type: Boolean, default: true },
    },

    language: { type: String, default: "en" },
    timezone: { type: String, default: "Asia/Kolkata" },
    details: { type: mongoose.Schema.Types.Mixed },

    // Visibility
    visibility: { type: mongoose.Schema.Types.ObjectId, ref: "ProfileVisibility" },
  },
  { timestamps: true }
);

/* ---------------------------------------------------
 * 🚀 PERFORMANCE INDEXES (CRITICAL FOR FEED SPEED)
 * ---------------------------------------------------
 */

// Used in feed aggregation lookups
ProfileSettingsSchema.index({ userId: 1 });
ProfileSettingsSchema.index({ adminId: 1 });
ProfileSettingsSchema.index({ childAdminId: 1 });
ProfileSettingsSchema.index({ accountId: 1 });

// Search & sorting
ProfileSettingsSchema.index({ userName: 1 });

// Public profile discovery
ProfileSettingsSchema.index({ shareableLink: 1 });

// Filtering visible profiles
ProfileSettingsSchema.index({ isPublished: 1 });

// Multi-role identification
ProfileSettingsSchema.index({ userId: 1, adminId: 1, childAdminId: 1 });

module.exports = prithuDB.model(
  "ProfileSettings",
  ProfileSettingsSchema,
  "ProfileSettings"
);
