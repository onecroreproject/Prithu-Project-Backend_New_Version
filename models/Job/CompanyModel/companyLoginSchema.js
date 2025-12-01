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
      index: true, // FAST login lookup
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },

    // 👤 Login Person Details
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

    whatsAppNumber:{
      type: String,
      required: true,
      trim: true,
    },

    // 🏢 Company Basic Details (Profile is separate)
    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true, // FAST filtering
    },
    companyEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    // 🟢 Status + Verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "banned"],
      default: "active",
      index: true,
    },

    // OTP for login / forgot password
    otp: {
      type: String,
      default: null,
    },
    otpExpiry: {
      type: Date,
      default: null,
      index: true,
    }
  },
  {
    timestamps: true, // stores createdAt + updatedAt
    versionKey: false // removes __v for cleaner documents
  }
);

// Compound index for high-speed queries
CompanyLoginSchema.index({ email: 1, companyName: 1 });

module.exports = jobDB.model("CompanyLogin", CompanyLoginSchema,"CompanyLogin");
