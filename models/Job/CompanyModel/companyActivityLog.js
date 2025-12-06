// models/CompanyActivityLog.js
const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

const CompanyActivityLogSchema = new mongoose.Schema(
  {
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyLogin",
      required: true,
      index: true,
    },

    action: {
      type: String,
      enum: [
        "JOB_CREATED",
        "JOB_UPDATED",
        "JOB_DRAFT_SAVED",
        "JOB_DELETED",

        "PROFILE_UPDATED",
        "VISIBILITY_UPDATED",

        "PAYMENT_INITIATED",
        "PAYMENT_SUCCESS",
        "PAYMENT_FAILED",

        "LOGIN",
        "LOGOUT",

        "OTHER",
        "application_status_update",
      ],
      required: true,
      index: true,
    },

    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      index: true,
      default: null,
    },

    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPostPayment",
      index: true,
      default: null,
    },

    // A short description of what happened
    description: { type: String, trim: true },

    // Stores changed fields, old value & new value
    changes: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    // Technical meta-info (IP, device, browser)
    meta: {
      ip: String,
      userAgent: String,
    },
  },
  { timestamps: true }
);

/* --------- High-performance indexes --------- */
CompanyActivityLogSchema.index({ createdAt: -1 });
CompanyActivityLogSchema.index({ companyId: 1, action: 1 });
CompanyActivityLogSchema.index({ jobId: 1 });

module.exports = jobDB.model(
  "CompanyActivityLog",
  CompanyActivityLogSchema,
  "CompanyActivityLog"
);
