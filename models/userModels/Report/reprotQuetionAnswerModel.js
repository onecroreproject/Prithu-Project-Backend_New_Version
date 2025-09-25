const mongoose = require("mongoose");

const ReportOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  nextQuestion: { type: mongoose.Schema.Types.ObjectId, ref: "ReportQuestion", default: null },
});

const ReportQuestionSchema = new mongoose.Schema(
  {
    typeId: { type: mongoose.Schema.Types.ObjectId, ref: "ReportType", required: true },
    questionText: { type: String, required: true },
    options: [ReportOptionSchema], // choices user can pick
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ReportQuestion", ReportQuestionSchema, "ReportQuestions");
