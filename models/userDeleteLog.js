const mongoose = require("mongoose");

const userDeleteLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },

    actionType: {
      type: String,
      enum: ["deactivate", "delete_now"],
      required: true,
    },

    reason: {
      type: String,
      default: "",
    },

    // store snapshot before deleting
    nameSnapshot: {
      type: String,
      default: "",
    },

    mobileSnapshot: {
      type: String,
      default: "",
    },

    actionDate: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserDeleteLog", userDeleteLogSchema,"UserDeleteLog");
