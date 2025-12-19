const mongoose = require("mongoose");
const { jobDB } = require("../../../database");
const dbTimer = require("../../../middlewares/dbTimer");

const JobPostSchema = new mongoose.Schema(
  {
    /* ---------------------------------------------------
     * 🔗 Company Details
     * --------------------------------------------------- */
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyLogin",
      required: true,
      index: true,
    },

    /* Company info snapshot (no joins required on frontend) */
    companyName: { type: String, trim: true, index: true },
    companyLogo: { type: String, trim: true },
    companyIndustry: { type: String, trim: true, index: true },
    companyWebsite: { type: String, trim: true },

    /* ---------------------------------------------------
     * 📌 Basic Job Info
     * --------------------------------------------------- */
    jobTitle: { type: String, required: true, index: true },
    jobRole: { type: String, index: true },
    jobCategory: { type: String, index: true },
    jobSubCategory: { type: String, index: true },
    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship", "freelance"],
      index: true,
    },
    workMode: { type: String, enum: ["onsite", "remote", "hybrid"], index: true },
    shiftType: {
      type: String,
      enum: ["day", "night", "rotational", "flexible"],
      index: true,
    },
    openingsCount: { type: Number, default: 1, index: true },
    urgencyLevel: { type: String, enum: ["immediate", "15 days", "30 days"], index: true },

    /* ---------------------------------------------------
     * 📍 Location
     * --------------------------------------------------- */
    city: { type: String, index: true },
    state: { type: String, index: true },
    country: { type: String, index: true },
    pincode: { type: String, index: true },
    fullAddress: { type: String },
    remoteEligibility: { type: Boolean, default: false },

    googleLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], index: "2dsphere" },
    },

    /* ---------------------------------------------------
     * 📝 Job Description
     * --------------------------------------------------- */
    jobDescription: { type: String },
    responsibilities: [String],
    dailyTasks: [String],
    keyDuties: [String],

    /* ---------------------------------------------------
     * 🎯 Skills
     * --------------------------------------------------- */
    requiredSkills: { type: [String], index: true },
    preferredSkills: [String],
    technicalSkills: [String],
    softSkills: [String],
    toolsAndTechnologies: [String],

    /* ---------------------------------------------------
     * 🎓 Qualification
     * --------------------------------------------------- */
    educationLevel: { type: String, index: true },
    degreeRequired: { type: String },
    certificationRequired: [String],
    minimumExperience: { type: Number, index: true },
    maximumExperience: { type: Number, index: true },
    freshersAllowed: { type: Boolean, default: false },

    /* ---------------------------------------------------
     * 💰 Salary
     * --------------------------------------------------- */
    salaryType: { type: String, enum: ["monthly", "yearly", "hourly"] },
    salaryMin: { type: Number, index: true },
    salaryMax: { type: Number, index: true },
    salaryCurrency: { type: String, default: "INR" },
    salaryVisibility: {
      type: String,
      enum: ["public", "private", "restricted"],
      default: "public",
    },

    benefits: [String],
    perks: [String],
    incentives: { type: String },
    bonuses: { type: String },

    /* ---------------------------------------------------
     * 📬 Hiring Information
     * --------------------------------------------------- */
    hiringManagerName: { type: String },
    hiringManagerEmail: { type: String },
    hiringManagerPhone: { type: String },
    interviewMode: { type: String, enum: ["online", "offline"] },
    interviewLocation: { type: String },
    interviewRounds: [String],
    hiringProcess: [String],
    interviewInstructions: { type: String },

    /* ---------------------------------------------------
     * 📅 Timing & Duration
     * --------------------------------------------------- */
    startDate: { type: Date, index: true },
    endDate: { type: Date, index: true },
    contractDuration: { type: String },
    jobTimings: { type: String },
    workingHours: { type: String },
    workingDays: { type: String },
    holidaysType: { type: String },

    /* ---------------------------------------------------
     * 🧾 Documents Required
     * --------------------------------------------------- */
    resumeRequired: { type: Boolean, default: true },
    coverLetterRequired: { type: Boolean, default: false },
    documentsRequired: [String],

    /* ---------------------------------------------------
     * 🔍 SEO & Keywords
     * --------------------------------------------------- */
    tags: [String],
    skillKeywords: { type: [String], index: true },
    keywordSearch: { type: [String], index: true },

    /* ---------------------------------------------------
     * 🏁 Status
     * --------------------------------------------------- */
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "closed", "draft","submit"],
      default: "draft",
      index: true,
    },
    isApproved: { type: Boolean, default: false, index: true },
    isFeatured: { type: Boolean, default: false },
    isPromoted: { type: Boolean, default: false },
    priorityScore: { type: Number, default: 0 },

    /* ---------------------------------------------------
     * 📊 Analytics
     * --------------------------------------------------- */
    stats: {
      views: { type: Number, default: 0 },
      applications: { type: Number, default: 0 },
      shortlisted: { type: Number, default: 0 },
      engagementScore: { type: Number, default: 0, index: true },
    },
  },
  { timestamps: true }
);

/* ---------------------------------------------------
 * ⚡ Text Index
 * --------------------------------------------------- */
JobPostSchema.index({
  jobTitle: "text",
  jobDescription: "text",
  jobRole: "text",
  keywordSearch: "text",
});

/* ---------------------------------------------------
 * ⚡ Heavy Query Optimization
 * --------------------------------------------------- */
JobPostSchema.index({ companyId: 1, status: 1 });
JobPostSchema.index({ jobCategory: 1, city: 1, minimumExperience: 1 });
JobPostSchema.index({ salaryMin: 1, salaryMax: 1 });
JobPostSchema.index({ createdAt: -1 });
JobPostSchema.index({ isFeatured: -1, isPromoted: -1, priorityScore: -1 });

module.exports = jobDB.model("JobPost", JobPostSchema, "JobPost");
