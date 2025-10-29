const mongoose = require("mongoose");

const JobPostSchema = new mongoose.Schema(
  {
    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role:{type:String,required:true,trim:true},
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    companyName: { type: String, required: true },
    location: { type: String, required: true },
    category: { type: String, required: true }, // e.g., IT, Construction, Design, etc.
    jobType: { type: String, enum: ["Full-time", "Part-time", "Contract"], default: "Full-time" },
    salaryRange: { type: String }, // e.g. "30K–50K/month"

    image: { type: String }, // Cloudinary or local URL

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    isPaid: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0 }, // Used for sorting feeds (higher = more visibility)

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
      enum: ["active", "inactive", "expired", "blocked"],
      default: "active",
    },

    // --- Moderation ---
    isApproved: { type: Boolean, default: true },
    reasonForBlock: { type: String },

    // --- Localization / Language ---
    language: { type: String, default: "en" }, // For multi-language feeds

    // --- SEO / Search fields ---
    tags: [String], // For keyword search
  },
  { timestamps: true }
);

// Expire job automatically after endDate
JobPostSchema.pre("save", function (next) {
  if (this.endDate < new Date()) {
    this.status = "expired";
  }
  next();
});

module.exports = mongoose.model("JobPost", JobPostSchema,"JobPost");
