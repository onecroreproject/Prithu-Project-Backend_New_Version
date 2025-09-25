const mongoose = require("mongoose");

const heldReferralSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  heldChildIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

module.exports = mongoose.model("HeldReferral", heldReferralSchema,"HeldReferral");
