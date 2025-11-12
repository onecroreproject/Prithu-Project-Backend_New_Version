// models/Payment.js
const mongoose = require("mongoose");
const JobPost = require("./jobSchema");

const PaymentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ✅ improves user payment lookups
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      index: true,
    },

    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    transactionId: { type: String, unique: true, required: true },
    status: {
      type: String,
      enum: ["pending", "success", "failed"],
      default: "pending",
      index: true,
    },
    paymentMethod: { type: String, trim: true },
  },
  { timestamps: true }
);

/* ==========================================================
   🧠 Pre-save Hook → Validate Job ID & Auto-remove if invalid
   ========================================================== */
PaymentSchema.pre("save", async function (next) {
  try {
    // If jobId exists, validate that the JobPost actually exists
    if (this.jobId) {
      const jobExists = await JobPost.exists({ _id: this.jobId });
      if (!jobExists) {
        console.warn(`⚠️ Invalid jobId (${this.jobId}) — payment removed.`);
        // Delete this payment document before saving
        await this.deleteOne();
        return next(new Error("Invalid jobId — payment document deleted."));
      }
    }
    next();
  } catch (err) {
    console.error("❌ Error validating jobId in Payment:", err.message);
    next(err);
  }
});

/* ==========================================================
   🧹 Optional Cleanup Hook → Remove orphaned payments
   ========================================================== */
// If you delete a job, automatically remove linked payments
// (use with mongoose middleware on JobPost)
JobPost.schema.post("findOneAndDelete", async function (doc) {
  if (doc?._id) {
    await mongoose.model("Payment").deleteMany({ jobId: doc._id });
    console.log(`🧹 Removed payments linked to deleted job: ${doc._id}`);
  }
});

/* ==========================================================
   ⚡ Indexes for Faster Lookups
   ========================================================== */
PaymentSchema.index({ userId: 1, status: 1 });
PaymentSchema.index({ jobId: 1 });
PaymentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Payment", PaymentSchema, "JobPostPayment");
