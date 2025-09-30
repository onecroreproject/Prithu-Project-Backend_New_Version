const mongoose = require("mongoose");

const AdminNotificationSchema = new mongoose.Schema({
  targetType: {
    type: String,
    enum: ["allUsers", "singleUser", "allCreators", "singleCreator"],
    required: true,
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },    // only for singleUser
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // only for singleCreator
  title: { type: String, required: true },
  body: { type: String, required: true },
  data: { type: Object },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("AdminNotification", AdminNotificationSchema,"AdminNotification");
