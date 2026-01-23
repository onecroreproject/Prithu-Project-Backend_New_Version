const mongoose = require("mongoose");
const {prithuDB}=require("../../../database");


const heldReferralSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  heldChildIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
}, { timestamps: true });

module.exports = prithuDB.model("HeldReferral", heldReferralSchema,"HeldReferral");
