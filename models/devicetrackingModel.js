const mongoose = require("mongoose");

const UserDeviceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    refPath: "roleRef", // dynamic reference (User, Business, etc.)
    index: true,
  },
  roleRef: {
    type: String,
    required: true,
    enum: ["User", "Business", "Creator", "Admin"],
  },

  // Device session fields
  deviceId: { type: String, required: true }, // unique ID per device (e.g., uuid)
  token: { type: String, required: true }, // session token per device
  userAgent: String, // raw user agent string
  deviceName: { type: String, default: "Unknown device" }, // friendly name
  deviceType: String, // e.g., mobile/desktop/tablet
  os: String, // e.g., Windows 11, Android 14, iOS 17
  browser: String, // e.g., Chrome, Safari
  brand: String, // e.g., Samsung, Apple
  model: String, // e.g., iPhone 13, SM-G991B
  ip: String, // IP address
  locationHint: String, // City or Country from IP

  // Role detail
  role: {
    type: String,
    enum: ["creator", "business", "consumer", "admin"],
    required: true,
  },

  // Session tracking
  lastLoginAt: { type: Date, default: Date.now },
  lastSeenAt: { type: Date, default: Date.now }, // updates on activity
}, {
  timestamps: true, // adds createdAt and updatedAt automatically
});

module.exports = mongoose.model("UserDevice", UserDeviceSchema, "UserDeviceSchema");
