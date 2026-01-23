
const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

const JobEngagementSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyLogin",
      index: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    /* Engagement Flags */
    liked: { type: Boolean, default: false, index: true },
    shared: { type: Boolean, default: false },
    saved: { type: Boolean, default: false },
    applied: { type: Boolean, default: false, index: true },
    view: { type: Boolean, default: false, index: true },

    lastActionAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

/* Unique per job/user */
JobEngagementSchema.index({ jobId: 1, userId: 1 }, { unique: true });

/* Aggregation optimization */
JobEngagementSchema.index({ companyId: 1, applied: 1 });

module.exports = jobDB.model("JobEngagement", JobEngagementSchema, "JobEngagement");

