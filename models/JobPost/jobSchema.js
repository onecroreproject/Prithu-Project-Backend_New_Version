const mongoose = require("mongoose");

const JobPostSchema = new mongoose.Schema(
  {
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: { type: String, trim: true },
    jobRole: { type: String, trim: true },
    experience: { type: Number, default: 0 },
    title: { type: String, trim: true },
    description: { type: String },
    companyName: { type: String },
    location: { type: String },
    category: { type: String },
    keyword: { type: String, trim: true },

    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract"],
      default: "Full-time",
    },

    salaryRange: { type: String },

    image: { type: String },

    startDate: { type: Date },

    // ✅ Automatically delete job after this date (TTL index)
    endDate: {
      type: Date,
      index: { expireAfterSeconds: 0 }, // 🔥 TTL index: delete when date passes
    },

    isPaid: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0 },

    stats: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
      appliedCount: { type: Number, default: 0 },
      engagementScore: { type: Number, default: 0 },
    },

    status: {
      type: String,
      enum: ["active", "inactive", "expired", "blocked", "draft"],
      default: "active",
    },

    isApproved: { type: Boolean, default: true },
    reasonForBlock: { type: String },

    language: { type: String, default: "en" },

    tags: [
      {
        type: String,
        trim: true,
        set: (v) =>
          v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v,
      },
    ],
  },
  { timestamps: true }
);

// ✅ Mark as expired before deletion
JobPostSchema.pre("save", function (next) {
  if (this.endDate && this.endDate < new Date()) {
    this.status = "expired";
  }
  next();
});

module.exports = mongoose.model("JobPost", JobPostSchema, "JobPost");
