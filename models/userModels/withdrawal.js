const mongoose = require("mongoose");

const WithdrawalSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true }, // requested withdrawal amount
  withdrawalAmount: { type: Number, required: true }, // optional: separate field for clarity
  totalAmount: { type: Number, required: true }, // total balance before withdrawal
  invoiceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Invoice" }], // array of invoice IDs
  status: { type: String, enum: ["pending", "completed", "rejected"], default: "pending" },
  requestedAt: { type: Date, default: Date.now },
  processedAt: { type: Date }
});

module.exports = mongoose.model("Withdrawal", WithdrawalSchema, "Withdrawals");
