// ✅ models/ChildAdminJobActions.js
const mongoose =require ("mongoose");
const {prithuDB}=require("../database");

const actionSubSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job",
      required: true,
      index: true, // ⚡ Speeds up lookups by jobId
    },
    actionType: {
      type: String,
      enum: ["approved", "deleted"],
      required: true,
      index: true,
    },
    reason: {
      type: String,
      default: null, // Only for delete
    },
    timestamp: {
      type: Date,
      default: Date.now, // ✅ Per-action timestamp
      index: true,
    },
  },
  { _id: false } // Keep it lean, no need for nested _ids
);

const childAdminJobActionsSchema = new mongoose.Schema(
  {
    childAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ⚡ Commonly queried
    },
  // ✅ Track all approved jobs with timestamp
    approvedJobs: {
      type: [actionSubSchema],
      default: [],
    },

    // ✅ Track deleted jobs with reason + timestamp
    deletedJobs: {
      type: [actionSubSchema],
      default: [],
    },

    // ✅ Keep metadata for quick auditing
    lastActionAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    totalApproved: {
      type: Number,
      default: 0,
    },

    totalDeleted: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // ✅ createdAt, updatedAt
    versionKey: false,
  }
);

// ⚡ Add efficient indexes for frequent filters
childAdminJobActionsSchema.index({ childAdminId: 1, "approvedJobs.jobId": 1 });
childAdminJobActionsSchema.index({ childAdminId: 1, "deletedJobs.jobId": 1 });

/* 🔹 Pre-save hook: keep counts and last action synced */
childAdminJobActionsSchema.pre("save", function (next) {
  this.totalApproved = this.approvedJobs.length;
  this.totalDeleted = this.deletedJobs.length;
  if (
    this.approvedJobs.length > 0 ||
    this.deletedJobs.length > 0
  ) {
    this.lastActionAt = new Date();
  }
  next();
});


module.exports = prithuDB.model("ChildAdminJobActions", childAdminJobActionsSchema,"ChildAdminJobActions");
