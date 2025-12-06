const mongoose = require("mongoose");
const {prithuDB}=require("../database");




const TestSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  sessionToken: { type: String, required: true },

  status: {
    type: String,
    enum: ["pending", "completed"],
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now,
    expires: "2h" // auto-delete after 2 hours
  }
});

module.exports = prithuDB.model("TestSession", TestSessionSchema,"TestSession");
