const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

const VISIBILITY = ["public", "private"];

const CompanyProfileVisibilitySchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyLogin",
      required: true,
      unique: true,
      index: true,
    },

    /* ----------------------------------------
     * BRAND IDENTITY
     * -------------------------------------- */
    logo: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    coverImage: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    description: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    /* ----------------------------------------
     * CONTACT INFORMATION
     * -------------------------------------- */
    companyPhone: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    companyWhatsAppNumber: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    companyEmail: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    address: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    city: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    state: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    country: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    pincode: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    googleLocation: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    /* ----------------------------------------
     * ADDITIONAL COMPANY INFO
     * -------------------------------------- */
    yearEstablished: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    employeeCount: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    workingHours: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    workingDays: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },

    /* ----------------------------------------
     * DOCUMENTS (HIGHLY SENSITIVE)
     * -------------------------------------- */
    registrationCertificate: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    gstNumber: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    panNumber: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    cinNumber: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    /* ----------------------------------------
     * SOCIAL MEDIA
     * -------------------------------------- */
    socialLinks: {
      facebook: { type: String, enum: VISIBILITY, default: "public" },
      instagram: { type: String, enum: VISIBILITY, default: "public" },
      linkedin: { type: String, enum: VISIBILITY, default: "public" },
      twitter: { type: String, enum: VISIBILITY, default: "public" },
      youtube: { type: String, enum: VISIBILITY, default: "public" },
      website: { type: String, enum: VISIBILITY, default: "public" },
    },

    /* ----------------------------------------
     * HIRING INFORMATION
     * -------------------------------------- */
    hiringEmail: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    hrName: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    hrPhone: {
      type: String,
      enum: VISIBILITY,
      default: "private",
    },

    hiringProcess: {
      type: String,
      enum: VISIBILITY,
      default: "public",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = jobDB.model(
  "CompanyProfileVisibility",
  CompanyProfileVisibilitySchema,
  "CompanyProfileVisibility"
);
