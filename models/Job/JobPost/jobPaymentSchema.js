const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

const PaymentSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyLogin",
      index: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
    },

    amount: { type: Number, required: true, index: true },
    currency: { type: String, default: "INR" },

    transactionId: { type: String, required: true, unique: true },

    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      index: true,
    },

    paymentMethod: { type: String },
    gateway: { type: String }, // Razorpay, Stripe, etc.
    receiptUrl: { type: String },

    meta: {
      planType: String,
      durationDays: Number,
      boostLevel: Number,
    },
  },
  { timestamps: true }
);

/* Speed optimization indexes */
PaymentSchema.index({ companyId: 1, status: 1 });
PaymentSchema.index({ jobId: 1 });
PaymentSchema.index({ createdAt: -1 });

module.exports = jobDB.model("JobPayment", PaymentSchema, "JobPostPayment");
