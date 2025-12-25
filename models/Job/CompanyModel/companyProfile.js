const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

const CompanyProfileSchema = new mongoose.Schema(
  {
    // 🔗 Link to Company Account
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyLogin",
      required: true,
      index: true,
      unique: true, // one profile per company
    },

    /* ----------------------------------------
     * BRAND IDENTITY
     * -------------------------------------- */
    logo: { type: String },
    coverImage: { type: String },


    description: { type: String, trim: true },
 

    /* ----------------------------------------
     * CONTACT DETAILS
     * -------------------------------------- */
    companyPhone: { type: String, trim: true, index: true },
    companyEmail: { type: String, lowercase: true, trim: true },

    address: { type: String, trim: true },
    city: { type: String, trim: true, index: true },
    state: { type: String, trim: true, index: true },
    country: { type: String, trim: true, index: true },
    pincode: { type: String, trim: true, index: true },

    // GeoJSON location (BEST for maps)
      googleLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        default: [0, 0],
      },
    },

    /* ----------------------------------------
     * ADDITIONAL COMPANY INFO
     * -------------------------------------- */
    yearEstablished: { type: Number, index: true },
    employeeCount: { type: Number },
    workingHours: { type: String },
    workingDays: { type: String },

    /* ----------------------------------------
     * DOCUMENTS
     * -------------------------------------- */
    registrationCertificate: { type: String },
    gstNumber: { type: String, trim: true },
    panNumber: { type: String, trim: true },
    cinNumber: { type: String, trim: true },

    /* ----------------------------------------
     * SOCIAL MEDIA
     * -------------------------------------- */
    socialLinks: {
      facebook: { type: String },
      instagram: { type: String },
      linkedin: { type: String },
      twitter: { type: String },
      youtube: { type: String },
      website: { type: String },
    },

    /* ----------------------------------------
     * HIRING INFORMATION
     * -------------------------------------- */
    hiringEmail: { type: String, lowercase: true, trim: true },
    hrName: { type: String, trim: true },
    hrPhone: { type: String, trim: true },

    hiringProcess: { type: [String], default: [] }, // e.g., ["Resume Screening", "Interview", "HR Round"]


    galleryImages: {
  type: [String],
  default: [],
  validate: {
    validator: v => v.length <= 5,
    message: "Maximum 5 gallery images allowed"
  }
},
    /* ----------------------------------------
     * BUSINESS DETAILS
     * -------------------------------------- */
    businessCategory: { type: String, trim: true, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// High-performance indexes
CompanyProfileSchema.index({ city: 1, state: 1, country: 1 });
CompanyProfileSchema.index({ businessCategory: 1 });

module.exports = jobDB.model(
  "CompanyProfile",
  CompanyProfileSchema,
  "CompanyProfile"
);
