// models/userModels/userProfile/experienceSchema.js
const mongoose = require("mongoose");

const experienceSchema = new mongoose.Schema({
  jobTitle: { type: String, required: true },
  companyName: { type: String, required: true },
  employmentType: {
    type: String,
    enum: ["Full-time", "Part-time", "Internship", "Freelance", "Contract", "Self-employed"],
    default: "Full-time",
  },
  industry: { type: String },
  location: { type: String },
  locationType: {
    type: String,
    enum: ["On-site", "Remote", "Hybrid"],
    default: "On-site",
  },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  currentlyWorking: { type: Boolean, default: false },
  description: { type: String },
  responsibilities: [{ type: String }],
  technologiesUsed: [{ type: String }],
  achievements: [{ type: String }],
  referenceContact: {
    name: String,
    designation: String,
    email: String,
    phone: String,
  },
});

module.exports = experienceSchema;
