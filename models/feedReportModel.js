const mongoose = require("mongoose");

const ReportAnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "ReportQuestion", required: true },
  questionText: { type: String, required: true },
  selectedOption: { type: String, required: true },
});

const ReportSchema = new mongoose.Schema(
  {
    typeId: { type: mongoose.Schema.Types.ObjectId, ref: "ReportType", required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

   

    targetId: { type: mongoose.Schema.Types.ObjectId, ref:"Feed" , required: true }, // e.g., feedId or userId
    targetType: { type: String, enum: ["Feed", "User", "Comment"], required: true },

    answers: [ReportAnswerSchema], // ✅ all question/answers stored here

    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Action Taken", "Rejected"],
      default: "Pending",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admins", default: null },
    actionTaken: { type: String, default: null },
    actionDate: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Report", ReportSchema, "Reports");
