const mongoose = require("mongoose");
const {prithuDB}=require("../database");

const AptitudeResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  testName: { type: String },

  score: { type: Number, required: true },

  timeTaken: { type: Number }, // seconds

  receivedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = prithuDB.model("AptitudeResult", AptitudeResultSchema,"AptitudeResult");
