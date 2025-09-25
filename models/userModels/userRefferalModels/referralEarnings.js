const mongoose = require("mongoose");

const UserEarningSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  fromUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  level: { type: Number, required: true },
  tier: { type: Number, required: true },
  amount: { type: Number, required: true },
  isPartial: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

UserEarningSchema.index({ userId: 1, level: 1, tier: 1 });

module.exports = mongoose.model("UserEarning", UserEarningSchema,"UserEarnings");
