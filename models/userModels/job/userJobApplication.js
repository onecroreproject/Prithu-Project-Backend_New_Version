const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

const JobApplicationSchema = new mongoose.Schema(
  {
    /* -----------------------------------------------------
     *  User & Job Linking
     * --------------------------------------------------- */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
      index: true,
    },

    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyLogin",
      required: true,
      index: true,
    },

    /* -----------------------------------------------------
     *  Application Status
     * --------------------------------------------------- */
    status: {
      type: String,
      enum: [
        "applied",
        "reviewed",
        "shortlisted",
        "accepted",
        "rejected",
      ],
      default: "applied",
      index: true,
    },

    /* -----------------------------------------------------
     *  Resume & Additional Info
     * --------------------------------------------------- */
    resume: { type: String }, // Resume URL (Cloudinary / S3)
    coverLetter: { type: String }, // Optional
    portfolioLink: { type: String },
    githubLink: { type: String },
    linkedinProfile: { type: String },

    /* -----------------------------------------------------
     *  Candidate Personal Info Snapshot
     *  (prevents data change if user edits profile later)
     * --------------------------------------------------- */
    applicantInfo: {
      name: String,
      email: String,
      phone: String,
    },

    /* -----------------------------------------------------
     *  Tracking History
     * --------------------------------------------------- */
    history: [
      {
        status: String,
        note: String,
        updatedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    /* -----------------------------------------------------
     *  Interview Details
     * --------------------------------------------------- */
    interview: {
      date: { type: Date },
      mode: { type: String, enum: ["online", "offline"], default: null },
      location: { type: String },
      meetingLink: { type: String },
      interviewerName: { type: String },
      notes: { type: String },
    },

    /* -----------------------------------------------------
     *  Admin Notes (Company Internal)
     * --------------------------------------------------- */
    adminNotes: { type: String },
  },

  { timestamps: true }
);

/* Prevent duplicate applications for the same job */
JobApplicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

module.exports = jobDB.model(
  "JobApplication",
  JobApplicationSchema,
  "JobApplication"
);
