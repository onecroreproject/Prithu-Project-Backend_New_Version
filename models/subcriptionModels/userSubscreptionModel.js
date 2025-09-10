const mongoose = require("mongoose");

const userSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
  startDate: { type: Date, default: Date.now },
  endDate: { type: Date, required: true },
  limitsUsed: { type: mongoose.Schema.Types.Mixed, default: {} }, // <-- store as object
  isActive: { type: Boolean, default: true },
  paymentStatus: { 
    type: String, 
    enum: ["pending", "success", "failed"], 
    default: "pending" 
  },
});

module.exports = mongoose.model("UserSubscription", userSubscriptionSchema);
