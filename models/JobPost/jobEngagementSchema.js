// models/JobEngagement.js
const mongoose = require("mongoose");
const JobPost = require("./jobSchema");
const User = require("../userModels/userModel");

const JobEngagementSchema = new mongoose.Schema(
  {
    /* 🔹 References */
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    /* 🔹 Engagement actions */
    liked: { type: Boolean, default: false },
    shared: { type: Boolean, default: false },
    downloaded: { type: Boolean, default: false },
    applied: { type: Boolean, default: false },

    /* 🔹 For tracking activity recency */
    lastActionAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

/* ==========================================================
   ⚡ Indexes for Speed
   ========================================================== */

// Unique pair (ensures one engagement record per user/job)
JobEngagementSchema.index({ jobId: 1, userId: 1 }, { unique: true });

// Fast lookups by job
JobEngagementSchema.index({ jobId: 1, liked: 1, shared: 1, applied: 1 });

// Fast lookups by user (e.g., user dashboard)
JobEngagementSchema.index({ userId: 1, lastActionAt: -1 });

// Optional TTL (auto-cleanup old inactive engagement after 180 days)
JobEngagementSchema.index({ lastActionAt: 1 }, { expireAfterSeconds: 15552000 }); // 180 days


/* ==========================================================
   🧠 Pre-save Validation & Auto-Cleanup
   ========================================================== */
JobEngagementSchema.pre("save", async function (next) {
  try {
    const [jobExists, userExists] = await Promise.all([
      JobPost.exists({ _id: this.jobId }),
      User.exists({ _id: this.userId }),
    ]);

    if (!jobExists || !userExists) {
      console.warn(
        `⚠️ Invalid reference detected — jobId: ${this.jobId}, userId: ${this.userId}. Engagement removed.`
      );
      await this.deleteOne();
      return next(new Error("Invalid jobId or userId — engagement document removed."));
    }

    // ✅ Always update lastActionAt for latest interaction
    this.lastActionAt = new Date();
    next();
  } catch (err) {
    console.error("❌ Error validating engagement references:", err.message);
    next(err);
  }
});


/* ==========================================================
   🧹 Cleanup when Job or User is deleted
   ========================================================== */

// When a JobPost is deleted → remove its engagements
JobPost.schema.post("findOneAndDelete", async function (doc) {
  if (doc?._id) {
    await mongoose.model("JobEngagement").deleteMany({ jobId: doc._id });
    console.log(`🧹 Deleted engagements linked to job: ${doc._id}`);
  }
});

// When a User is deleted → remove their engagements
User.schema?.post?.("findOneAndDelete", async function (doc) {
  if (doc?._id) {
    await mongoose.model("JobEngagement").deleteMany({ userId: doc._id });
    console.log(`🧹 Deleted engagements linked to user: ${doc._id}`);
  }
});


/* ==========================================================
   🧩 Optional Utility Method (for fast toggle updates)
   ========================================================== */
JobEngagementSchema.statics.toggleAction = async function (jobId, userId, field) {
  if (!["liked", "shared", "downloaded", "applied"].includes(field)) {
    throw new Error("Invalid engagement field");
  }

  const engagement = await this.findOneAndUpdate(
    { jobId, userId },
    [
      {
        $set: {
          [field]: { $not: `$${field}` },
          lastActionAt: new Date(),
        },
      },
    ],
    { new: true, upsert: true }
  );

  return engagement;
};

module.exports = mongoose.model("JobEngagement", JobEngagementSchema, "JobEngagement");
