const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    deviceId: {
      type: mongoose.Schema.Types.ObjectId, // reference Device schema
      ref: "Device",
      required: true,
    },
    refreshToken: {
      type: String,
      required: true,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    expiredAt: {
      type: Date,
      default: null, // optional, can set based on refreshToken expiry
    },
  },
  { timestamps: true } // adds updatedAt automatically
);

module.exports = mongoose.models.Session || mongoose.model("Session", sessionSchema);
