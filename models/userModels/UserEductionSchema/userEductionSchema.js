// models/userModels/userProfile/educationSchema.js
const mongoose = require("mongoose");

const educationSchema = new mongoose.Schema({
  level: {
    type: String,
    enum: [
      "Secondary School",
      "Higher Secondary",
      "Undergraduate",
      "Postgraduate",
      "Diploma",
      "Certification",
      "PhD"
    ],
    required: true,
  },
  schoolOrCollege: { type: String, required: true },
  boardOrUniversity: { type: String },
  fieldOfStudy: { type: String },
  startYear: { type: Number },
  endYear: { type: Number },
  gradeOrPercentage: { type: String },
  location: { type: String },
  description: { type: String },
});

module.exports = educationSchema;
