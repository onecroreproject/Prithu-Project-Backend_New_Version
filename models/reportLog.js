const mongoose = require("mongoose"); 

const ReportLogSchema = new mongoose.Schema(
  {
    reportId: { type: mongoose.Schema.Types.ObjectId, ref: "Report", required: true }, 

    action: {
      type: String,
      enum: ["Created", "Reviewed", "Action Taken", "Rejected", "Reopened", "Answered"], // added Answered
      required: true,
    },

    note: { type: String, default: null }, // optional comment by admin or system

    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // user or admin id
    performedAt: { type: Date, default: Date.now },

    // ✅ Only used when action = "Answered"
    answer: {
      questionId: { type: mongoose.Schema.Types.ObjectId, ref: "ReportQuestion" },
      questionText: String,
      selectedOption: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportLog", ReportLogSchema, "ReportLogs");
