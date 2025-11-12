// models/userModels/userProfile/userProfileModel.js
const mongoose = require("mongoose");

// Import all sub-schemas
const educationSchema = require("./userEductionSchema");
const experienceSchema = require("./UserExprienceSchema");
const skillSchema = require("./userSkillSchema");
const certificationSchema = require("./userCertificationSchema");
const ProjectSchema=require("./userEducationProjectSchema");

const userProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

      professionalSummary: {
      type: String,
      maxlength: 2000,
      default:
        "A passionate professional focused on delivering innovative and scalable digital solutions.",
    },

    // Arrays of embedded sub-schemas
    education: [educationSchema],
    experience: [experienceSchema],
    skills: [skillSchema],
    certifications: [certificationSchema],
    projects:[ProjectSchema],

    // Extra profile fields (LinkedIn-style)
    about: { type: String, maxlength: 2000 },
    headline: { type: String },
    portfolioURL: { type: String },
    githubURL: { type: String },
    linkedinURL: { type: String },
    websiteURL: { type: String },
    languages: [{ type: String }],
    interests: [{ type: String }],
    resumeURL: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserCurricluam", userProfileSchema,"UserCurricluam");
