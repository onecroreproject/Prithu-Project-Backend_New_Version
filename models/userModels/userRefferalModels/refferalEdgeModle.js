const mongoose = require("mongoose");

const referralEdgeSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("ReferralEdge", referralEdgeSchema,"ReferralEdge");
