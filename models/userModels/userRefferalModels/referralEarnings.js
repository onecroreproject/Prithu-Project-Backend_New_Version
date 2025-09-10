const mongoose = require("mongoose");

const userEarningSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  level: { type: Number, required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // child who triggered earning
  amount: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("UserEarning", userEarningSchema);
