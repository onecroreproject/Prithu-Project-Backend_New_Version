const mongoose = require("mongoose");
const { prithuDB } = require("../database");

/* ------------------ Social Media Sub Schema ------------------ */
const socialMediaSchema = new mongoose.Schema(
  {
    website: {
      type: String,
      trim: true,
    },

    linkedin: {
      type: String,
      trim: true,
    },

    twitter: {
      type: String,
      trim: true,
    },

    instagram: {
      type: String,
      trim: true,
    },

    facebook: {
      type: String,
      trim: true,
    },

    youtube: {
      type: String,
      trim: true,
    },

    github: {
      type: String,
      trim: true,
    },

    telegram: {
      type: String,
      trim: true,
    },

    whatsapp: {
      type: String,
      trim: true,
    },
  },
  { _id: false } // prevents extra _id
);

/* ------------------ Main Company Schema ------------------ */
const prithuCompanySchema = new mongoose.Schema(
  {
    // Basic Info
    companyName: {
      type: String,
      required: true,
      trim: true,
    },

    tagline: {
      type: String,
      trim: true,
    },

    aboutShort: {
      type: String,
      trim: true,
    },

    aboutLong: {
      type: String,
      trim: true,
    },

    // Contact Info
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },

    phone: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    // 🌐 Social & Website
    socialMedia: socialMediaSchema,

    // Branding
    logoUrl: {
      type: String,
      trim: true,
    },

    faviconUrl: {
      type: String,
      trim: true,
    },

    // Legal & Meta
    companyRegistrationNumber: String,
    gstNumber: String,
    privacyPolicyUrl: String,
    termsConditionsUrl: String,

    // SEO
    seo: {
      metaTitle: String,
      metaDescription: String,
      keywords: [String],
    },

    // Status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Admin tracking
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

module.exports = prithuDB.model(
  "PrithuCompany",
  prithuCompanySchema,
  "PrithuCompany"
);
