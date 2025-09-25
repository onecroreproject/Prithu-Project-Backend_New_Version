const mongoose = require("mongoose");

const DeviceSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  deviceId: { type: String, required: true }, // unique device identifier (UUID, fingerprint, etc.)
  deviceType: { type: String, enum: ["web", "mobile"], required: true },
  deviceName: { type: String }, // e.g., "iPhone 14", "Chrome on Windows"
  ipAddress: { type: String },

  pushToken: { type: String }, // optional: for FCM/APNS push notifications
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model("Device", DeviceSchema,"Devices");
