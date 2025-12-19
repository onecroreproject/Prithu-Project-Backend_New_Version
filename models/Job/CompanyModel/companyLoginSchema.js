const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

const CompanyLoginSchema = new mongoose.Schema(
  {
    // 🔐 Login Credentials
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    /* ---------------------------------------------------
     * 👤 Login Person Details
     * --------------------------------------------------- */
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    position: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    whatsAppNumber: {
      type: String,
      required: true,
      trim: true,
    },

    /* ---------------------------------------------------
     * 🏢 Account Segregation (IMPORTANT)
     * --------------------------------------------------- */
    accountType: {
      type: String,
      enum: ["company", "consultant"],
      required: true,
      default: "company",
      index: true,
    },

    /* ---------------------------------------------------
     * 🏢 Company / Consultant Details
     * --------------------------------------------------- */
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    companyEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    /* ---------------------------------------------------
     * 🟢 Status & Verification
     * --------------------------------------------------- */
    isVerified: {
      type: Boolean,
      default: false,
      index: true,
    },

    profileAvatar: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "banned"],
      default: "active",
      index: true,
    },

    /* ---------------------------------------------------
     * 🔐 OTP
     * --------------------------------------------------- */
    otp: {
      type: String,
      default: null,
    },

    otpExpiry: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ---------------------------------------------------
 * ⚡ Indexes
 * --------------------------------------------------- */
CompanyLoginSchema.index({ email: 1 });
CompanyLoginSchema.index({ companyName: 1 });
CompanyLoginSchema.index({ accountType: 1 });

module.exports = jobDB.model(
  "CompanyLogin",
  CompanyLoginSchema,
  "CompanyLogin"
);
