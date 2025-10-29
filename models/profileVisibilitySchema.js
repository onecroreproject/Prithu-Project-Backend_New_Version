const mongoose = require("mongoose");

// 🔹 Independent model for field-level visibility settings
const ProfileVisibilitySchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    gender: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    userName: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    bio: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    dateOfBirth: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },
    maritalDate: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },
    maritalStatus: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },
    phoneNumber: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "private",
    },
    country: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    city: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    profileAvatar: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    coverPhoto: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    socialLinks: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },
    email: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "private",
    },
    location: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "followers",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProfileVisibility", ProfileVisibilitySchema);
