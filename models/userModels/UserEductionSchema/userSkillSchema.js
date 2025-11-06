// models/userModels/userProfile/skillSchema.js
const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema({
  category: { type: String }, // e.g. "Frontend", "Backend", "Database", "Soft Skill"
  name: { type: String, required: true },
  level: {
    type: String,
    enum: ["Beginner", "Intermediate", "Advanced", "Expert"],
    default: "Intermediate",
  },
  yearsOfExperience: { type: Number },
  lastUsed: { type: Number },
  description: { type: String },
});

module.exports = skillSchema;
