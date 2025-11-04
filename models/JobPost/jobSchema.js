const mongoose = require("mongoose");

const JobPostSchema = new mongoose.Schema(
  {
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    role: { type: String, trim: true }, // main role field
    jobRole: { type: String, trim: true }, // added to support separate job role
    experience:{type:Number,default:0},
    title: { type: String, trim: true },
    description: { type: String },
    companyName: { type: String },
    location: { type: String},
    category: { type: String},
    keyword: { type: String, trim: true }, // additional SEO keyword field

    jobType: {
      type: String,
      enum: ["Full-time", "Part-time", "Contract"],
      default: "Full-time",
    },

    salaryRange: { type: String },

    image: { type: String }, // Cloudinary URL

    startDate: { type: Date},
    endDate: { type: Date },

    isPaid: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0 },

    // --- Engagement tracking ---
    stats: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      shares: { type: Number, default: 0 },
      downloads: { type: Number, default: 0 },
      appliedCount: { type: Number, default: 0 },
      engagementScore: { type: Number, default: 0 },
    },

    // --- Status tracking ---
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "blocked", "draft"],
      default: "active",
    },

    // --- Moderation ---
    isApproved: { type: Boolean, default: true },
    reasonForBlock: { type: String },

    // --- Localization / Language ---
    language: { type: String, default: "en" },

    // --- SEO / Tags ---
    tags: [
      {
        type: String,
        trim: true,
        set: (v) => (v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : v),
      },
    ],
  },
  { timestamps: true }
);

// Expire job automatically after endDate
JobPostSchema.pre("save", function (next) {
  if (this.endDate && this.endDate < new Date()) {
    this.status = "expired";
  }
  next();
});

module.exports = mongoose.model("JobPost", JobPostSchema, "JobPost");
