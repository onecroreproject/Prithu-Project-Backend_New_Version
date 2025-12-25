const mongoose = require("mongoose");
const { jobDB } = require("../../../database");

const JobCompanyPostSchema = new mongoose.Schema(
  {
    /* ----------------------------------------
     * 🔗 Company Reference
     * -------------------------------------- */
    companyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CompanyLogin",
      required: true,
      index: true,
    },

    companyName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    companyLogo: {
      type: String,
      default: "",
    },

    /* ----------------------------------------
     * 📌 Job Post Reference
     * -------------------------------------- */
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JobPost",
      required: true,
      index: true,
    },

    /* ----------------------------------------
     * 🖼️ Post Image (NEW)
     * -------------------------------------- */
    postImage: {
      type: String,          // image URL or local path
      default: "",
      trim: true,
    },

    /* ----------------------------------------
     * 🏁 Status
     * -------------------------------------- */
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

/* ----------------------------------------
 * ⚡ Indexes
 * -------------------------------------- */
JobCompanyPostSchema.index({ companyId: 1, postId: 1 }, { unique: true });
JobCompanyPostSchema.index({ companyName: 1 });

module.exports = jobDB.model(
  "JobCompanyPost",
  JobCompanyPostSchema,
  "JobCompanyPost"
);
