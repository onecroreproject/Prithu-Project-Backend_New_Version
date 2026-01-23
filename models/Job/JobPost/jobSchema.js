const mongoose = require("mongoose");
const { jobDB } = require("../../../database");
const dbTimer = require("../../../middlewares/dbTimer");

/* =====================================================
 * 🧩 Job Post Schema
 * ===================================================== */
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

    companyName: { type: String, trim: true, index: true },
    companyLogo: { type: String, trim: true },
    companyIndustry: { type: String, trim: true, index: true },
    companyWebsite: { type: String, trim: true },

    /* ---------------------------------------------------
     * 📌 Job Basics
     * --------------------------------------------------- */
    jobTitle: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    jobRole: [{ type: String, index: true }],
    jobIndustry: { type: String, index: true },

    employmentType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "internship", "freelance"],
      index: true,
    },

    workMode: {
      type: String,
      enum: ["onsite", "remote", "hybrid"],
      index: true,
    },

    shiftType: {
      type: String,
      enum: ["day", "night", "rotational", "flexible"],
      index: true,
    },

    openingsCount: { type: Number, default: 1, index: true },

    urgencyLevel: {
      type: String,
      enum: ["immediate", "15 days", "30 days"],
      index: true,
    },

    /* ---------------------------------------------------
     * ⏱️ Contract Duration (Contract Jobs Only)
     * --------------------------------------------------- */
    contractDuration: {
      type: Number,
      min: 1,
      max: 120,
      index: true,
      default: null,
    },

    contractDurationUnit: {
      type: String,
      enum: ["days", "months", "years"],
      default: null,
    },

    /* ---------------------------------------------------
     * 📍 Location
     * --------------------------------------------------- */
    country: { type: String, index: true },
    state: { type: String, index: true },
    city: { type: String, index: true },
    area: { type: String, index: true },
    pincode: { type: String, index: true },
    fullAddress: { type: String },

    remoteEligibility: { type: Boolean, default: false },

    latitude: { type: String, index: true },
    longitude: { type: String, index: true },

    googleLocation: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], index: "2dsphere" },
    },

    /* ---------------------------------------------------
     * 📝 Job Description
     * --------------------------------------------------- */
    jobDescription: { type: String },

    /* ---------------------------------------------------
     * 🎯 Skills
     * --------------------------------------------------- */
    requiredSkills: [{ type: String }],

    /* ---------------------------------------------------
     * 🎓 Qualifications (Updated for multiple qualifications)
     * --------------------------------------------------- */
    qualifications: [{
      educationLevel: { type: String },
      course: { type: String },
      specialization: { type: String },
      // Derived field for easy display/search
      fullQualification: { type: String }
    }],
    
    // Keeping degreeRequired for backward compatibility
    degreeRequired: [{ type: String }],
    
    certificationRequired: [{ type: String }],

    minimumExperience: { type: Number, index: true },
    maximumExperience: { type: Number, index: true },
    freshersAllowed: { type: Boolean, default: false },

    /* ---------------------------------------------------
     * 💰 Salary
     * --------------------------------------------------- */
    salaryType: {
      type: String,
      enum: ["monthly", "yearly", "hourly"],
    },

    salaryMin: { type: Number, index: true },
    salaryMax: { type: Number, index: true },
    salaryCurrency: { type: String, default: "INR" },

    benefits: [{ type: String }],

    /* ---------------------------------------------------
     * 📅 Job Timeline
     * --------------------------------------------------- */
    startDate: { type: Date, index: true },
    endDate: { type: Date, index: true },

    /* ---------------------------------------------------
     * 🖼️ Media
     * --------------------------------------------------- */
    jobImage: { type: String },

    /* ---------------------------------------------------
     * 🏁 Status & Flags
     * --------------------------------------------------- */
    status: {
      type: String,
      enum: ["active", "inactive", "expired", "draft", "submit"],
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

/* =====================================================
 * 🔍 Indexes
 * ===================================================== */
JobPostSchema.index({
  jobTitle: "text",
  jobDescription: "text",
  jobRole: "text",
});

JobPostSchema.index({ companyId: 1, status: 1 });
JobPostSchema.index({ jobCategory: 1, city: 1, minimumExperience: 1 });
JobPostSchema.index({ salaryMin: 1, salaryMax: 1 });
JobPostSchema.index({ employmentType: 1, contractDuration: 1 });
JobPostSchema.index({ createdAt: -1 });
JobPostSchema.index({ isFeatured: -1, isPromoted: -1, priorityScore: -1 });

// Index for qualifications
JobPostSchema.index({ "qualifications.fullQualification": 1 });

/* =====================================================
 * 🔧 Virtuals
 * ===================================================== */
JobPostSchema.virtual("formattedContractDuration").get(function () {
  if (this.employmentType === "contract" && this.contractDuration) {
    return `${this.contractDuration} ${this.contractDurationUnit}`;
  }
  return null;
});

/* =====================================================
 * ⚙️ Middleware - Auto-generate fullQualification
 * ===================================================== */
JobPostSchema.pre("save", function (next) {
  // Auto-generate fullQualification for each qualification
  if (this.qualifications && this.qualifications.length > 0) {
    this.qualifications = this.qualifications.map(qual => {
      let fullQual = "";
      if (qual.educationLevel) {
        fullQual += qual.educationLevel;
      }
      if (qual.course) {
        fullQual += fullQual ? ` - ${qual.course}` : qual.course;
      }
      if (qual.specialization) {
        fullQual += ` (${qual.specialization})`;
      }
      return {
        ...qual,
        fullQualification: fullQual || undefined
      };
    });
    
    // Also populate degreeRequired for backward compatibility
    this.degreeRequired = this.qualifications
      .map(q => q.fullQualification)
      .filter(q => q);
  }
  
  if (this.employmentType !== "contract") {
    this.contractDuration = null;
    this.contractDurationUnit = null;
  }

  if (this.latitude && this.longitude) {
    const lat = parseFloat(this.latitude);
    const lng = parseFloat(this.longitude);

    if (!isNaN(lat) && !isNaN(lng)) {
      this.googleLocation = {
        type: "Point",
        coordinates: [lng, lat],
      };
    }
  }

  next();
});

/* =====================================================
 * 📦 Export Model
 * ===================================================== */
module.exports = jobDB.model("JobPost", JobPostSchema, "JobPost");