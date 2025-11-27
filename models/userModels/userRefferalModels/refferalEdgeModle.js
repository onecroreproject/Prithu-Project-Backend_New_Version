const mongoose = require("mongoose");
const {prithuDB}=require("../../../database");


const referralEdgeSchema = new mongoose.Schema({
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  childId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = prithuDB.model("ReferralEdge", referralEdgeSchema,"ReferralEdge");
