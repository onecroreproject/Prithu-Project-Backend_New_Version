const mongoose = require("mongoose");
const {prithuDB}=require("../database");

const AptitudeResultSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  certificateId:{ type: String, required: true },

  testId:{type:String,required:true},

  result:{type:String,required: true},

  mailSent:{
      type: Boolean,
      default: true,
      index: true
    },

    certificateUrl:{type:String},

  testName: { type: String },

  score: { type: Number, required: true },

  timeTaken: { type: Number }, // seconds

  receivedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = prithuDB.model("AptitudeResult", AptitudeResultSchema,"AptitudeResult");
