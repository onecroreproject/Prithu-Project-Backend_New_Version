const mongoose=require("mongoose");

const JobEngagementSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "JobPost", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    liked: { type: Boolean, default: false },
    shared: { type: Boolean, default: false },
    downloaded: { type: Boolean, default: false },
    applied: { type: Boolean, default: false },

    lastActionAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

JobEngagementSchema.index({ jobId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("JobEngagement", JobEngagementSchema,"JobEngagement");
