// models/Report.js
const mongoose = require("mongoose");
const {sendMailSafe} = require("../utils/sendMail"); 

const ReportAnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, ref: "ReportQuestion", required: true },
  questionText: { type: String, required: true },
  selectedOption: { type: String, required: true },
});

const ReportSchema = new mongoose.Schema(
  {
    typeId: { type: mongoose.Schema.Types.ObjectId, ref: "ReportType", required: true },
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", required: true },
    targetType: { type: String, enum: ["Feed", "User", "Comment"], required: true },
    answers: [ReportAnswerSchema],

    status: {
      type: String,
      enum: ["Pending", "Reviewed", "Action Taken", "Rejected"],
      default: "Pending",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admins", default: null },
    actionTaken: { type: String, default: null },
    actionDate: { type: Date, default: null },

    notified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// ✅ Hook to send email on status change
ReportSchema.post("save", async function (doc) {
  try {
    if (doc.status !== "Pending" && !doc.notified) {
      const populatedDoc = await doc.populate("reportedBy", "email username");

      if (populatedDoc.reportedBy?.email) {
        const subject = "Your Report Status Has Been Updated";
        const html = `Hello ${populatedDoc.reportedBy.username},

Your report regarding ${populatedDoc.targetType} has been updated.

📌 Status: ${populatedDoc.status}
📌 Action: ${populatedDoc.actionTaken || "N/A"}
📌 Date: ${populatedDoc.actionDate || new Date().toLocaleString()}

Thank you,
Support Team`;

        await sendMailSafe({ to: populatedDoc.reportedBy.email, subject, html });

        populatedDoc.notified = true;
        await populatedDoc.save();
      }
    }
  } catch (err) {
    console.error("❌ Error sending report status mail:", err.message);
  }
});

module.exports = mongoose.model("Report", ReportSchema, "Reports");
