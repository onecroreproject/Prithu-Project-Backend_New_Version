// models/JobPost.js
const mongoose = require("mongoose");
const dbTimer = require("../../middlewares/dbTimer");


const JobPostSchema = new mongoose.Schema(
  {
    /* 🔹 Basic Info */
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // ✅ faster user-based lookups
    },

    title: { type: String, trim: true, required: true, index: true },
    jobRole: { type: String, trim: true, index: true },
    role: { type: String, trim: true },
    description: { type: String, trim: true },
    salary:{type:Number,trim:true},
    companyName: { type: String, trim: true, index: true },
    location: { type: String, trim: true, index: true },
    category: { type: String, trim: true, index: true },
    keyword: { type: String, trim: true, index: true },

    /* 🔹 Job Details */
    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract"],
      default: "Full-time",
      index: true,
    },
    experience: { type: Number, default: 0, min: 0 },
    salaryRange: { type: String, trim: true },

    /* 🔹 Image Handling */
    image: { type: String, trim: true },
    imagePublicId: { type: String, trim: true }, // ✅ corrected type (was Number)

    /* 🔹 Validity Period */
    startDate: { type: Date, index: true },
    endDate: {
      type: Date,
      index: { expireAfterSeconds: 0 }, // ✅ TTL auto-delete when expired
    },

    /* 🔹 Payment & Priority */
    isPaid: { type: Boolean, default: false, index: true },
    priorityScore: { type: Number, default: 0 },

    /* 🔹 Analytics */
    stats: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
      appliedCount: { type: Number, default: 0 },
      engagementScore: { type: Number, default: 0 },
    },

    /* 🔹 Status & Moderation */
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "blocked", "draft"],
      default: "active",
      index: true,
    },
    isApproved: { type: Boolean, default: false, index: true },
    reasonForBlock: { type: String, trim: true },

    /* 🔹 Miscellaneous */
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

/* 🔹 Middleware: Mark as expired before saving */
JobPostSchema.pre("save", function (next) {
  if (this.endDate && this.endDate < new Date()) {
    this.status = "expired";
  }
  next();
});

/* 🔹 Compound Indexes for faster lookups & filtering */
JobPostSchema.plugin(dbTimer);
JobPostSchema.index({ category: 1, location: 1 });
JobPostSchema.index({ companyName: 1, jobType: 1 });
JobPostSchema.index({ title: "text", description: "text", keyword: "text" }); // 🔥 Full-text search
JobPostSchema.index({ createdAt: -1 }); // sort by newest
JobPostSchema.index({ isPaid: -1, priorityScore: -1 }); // boost premium listings

module.exports = mongoose.model("JobPost", JobPostSchema, "JobPost");
