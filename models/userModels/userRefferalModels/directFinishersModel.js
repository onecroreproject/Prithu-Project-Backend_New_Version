const mongoose = require("mongoose");
const {prithuDB}=require("../../../database");


const directFinisherSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  finished: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = prithuDB.model("DirectFinisher", directFinisherSchema,"DirectFinisher");
