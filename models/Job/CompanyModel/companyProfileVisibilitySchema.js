const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

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
     * VISIBILITY SETTINGS
     * Values: public | private | restricted
     * -------------------------------------- */

    // Brand identity
    logo: { type: String, enum: ["public", "private"], default: "public" },
    coverImage: { type: String, enum: ["public", "private"], default: "public" },
    tagline: { type: String, enum: ["public", "private"], default: "public" },
    description: { type: String, enum: ["public", "private"], default: "public" },
    mission: { type: String, enum: ["public", "private"], default: "public" },
    vision: { type: String, enum: ["public", "private"], default: "public" },
    about: { type: String, enum: ["public", "private"], default: "public" },

    // Contact
    companyPhone: { type: String, enum: ["public", "private", "restricted"], default: "restricted" },
    companyEmail: { type: String, enum: ["public", "private", "restricted"], default: "restricted" },
    address: { type: String, enum: ["public", "private"], default: "private" },
    city: { type: String, enum: ["public", "private"], default: "public" },
    state: { type: String, enum: ["public", "private"], default: "public" },
    country: { type: String, enum: ["public", "private"], default: "public" },
    pincode: { type: String, enum: ["public", "private"], default: "private" },

    googleLocation: { type: String, enum: ["public", "private"], default: "private" },

    // Additional Company Info
    yearEstablished: { type: String, enum: ["public", "private"], default: "public" },
    employeeCount: { type: String, enum: ["public", "private"], default: "public" },
    workingHours: { type: String, enum: ["public", "private"], default: "public" },
    workingDays: { type: String, enum: ["public", "private"], default: "public" },

    // Documents
    registrationCertificate: { type: String, enum: ["private", "restricted"], default: "restricted" },
    gstNumber: { type: String, enum: ["private", "restricted"], default: "private" },
    panNumber: { type: String, enum: ["private", "restricted"], default: "private" },
    cinNumber: { type: String, enum: ["private", "restricted"], default: "private" },

    // Social Media
    socialLinks: {
      facebook: { type: String, enum: ["public", "private"], default: "public" },
      instagram: { type: String, enum: ["public", "private"], default: "public" },
      linkedin: { type: String, enum: ["public", "private"], default: "public" },
      twitter: { type: String, enum: ["public", "private"], default: "public" },
      youtube: { type: String, enum: ["public", "private"], default: "public" },
      website: { type: String, enum: ["public", "private"], default: "public" }
    },

    // Hiring Information
    hiringEmail: { type: String, enum: ["public", "private", "restricted"], default: "restricted" },
    hrName: { type: String, enum: ["public", "private"], default: "private" },
    hrPhone: { type: String, enum: ["public", "private", "restricted"], default: "restricted" },
    hiringProcess: { type: String, enum: ["public", "private"], default: "public" },

    // Business Info
    businessCategory: { type: String, enum: ["public", "private"], default: "public" },
    servicesOffered: { type: String, enum: ["public", "private"], default: "public" },
    clients: { type: String, enum: ["public", "private"], default: "public" },
    awards: { type: String, enum: ["public", "private"], default: "public" },
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
