// models/userModels/userProfile/userProfileModel.js
const mongoose = require("mongoose");

// Import all sub-schemas
const educationSchema = require("./userEductionSchema");
const experienceSchema = require("./UserExprienceSchema");
const skillSchema = require("./userSkillSchema");
const certificationSchema = require("./userCertificationSchema");

const userProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Arrays of embedded sub-schemas
    education: [educationSchema],
    experience: [experienceSchema],
    skills: [skillSchema],
    certifications: [certificationSchema],

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
