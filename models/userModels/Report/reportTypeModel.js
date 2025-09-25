const mongoose = require("mongoose");

const ReportTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, maxlength: 200, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportType", ReportTypeSchema, "ReportTypes");
