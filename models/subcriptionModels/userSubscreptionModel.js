const mongoose = require("mongoose");

const userSubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: "SubscriptionPlan", required: true },
  
  // Subscription dates
  startDate: { type: Date },
  endDate: { type: Date },

  // Limits usage (e.g., API calls, storage, etc.)
  limitsUsed: { type: mongoose.Schema.Types.Mixed, default: {} },

  // Subscription status
  isActive: { type: Boolean, default: false },
  paymentStatus: { type: String, enum: ["pending", "success", "failed"], default: "pending" },

  // Razorpay details
  razorpaySubscriptionId: { type: String }, // subscription id created by Razorpay
  razorpayPaymentId: { type: String },      // payment id after success
  razorpaySignature: { type: String },      // signature for verification

  // Meta
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Auto-update updatedAt
userSubscriptionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model(
  "UserSubscription",
  userSubscriptionSchema,
  "UserSubscriptions"
);
