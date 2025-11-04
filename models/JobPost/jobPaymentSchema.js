const mongoose =require("mongoose")
const PaymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    transactionId: { type: String, unique: true },
    status: { type: String, enum: ["pending", "success", "failed"], default: "pending" },
    paymentMethod: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", PaymentSchema,"JobPostPayment");
