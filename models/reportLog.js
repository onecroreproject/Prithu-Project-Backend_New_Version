const mongoose = require("mongoose");

const ReportLogSchema = new mongoose.Schema(
  {
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true }, // Link to Report
    action: {
      type: String,
      enum: ["Created", "Reviewed", "Action Taken", "Rejected", "Reopened"],
      required: true,
    },
    note: { type: String, default: null }, // optional comment by admin or system
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admins" }, // admin who did it
    performedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportLog", ReportLogSchema, "ReportLogs");
