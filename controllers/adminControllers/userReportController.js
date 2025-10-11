const ReportQuestion = require("../../models/userModels/Report/reprotQuetionAnswerModel");
const ReportType = require("../../models/userModels/Report/reportTypeModel");
const ReportLog =require('../../models/reportLog');
const ReportPost=require('../../models/feedReportModel');
const Report =require("../../models/feedReportModel");
const User =require("../../models/userModels/userModel");
const Feed=require("../../models/feedModel");
const Account=require('../../models/accountSchemaModel');
const {sendMailSafe}=require("../../utils/sendMail");


exports.addReportQuestion = async (req, res) => {
  try {
    const { typeId, questionText, options } = req.body;

    if (!typeId || !questionText || !options || !Array.isArray(options) || options.length === 0) {
      return res.status(400).json({ message: "Type, question text and options are required" });
    }

    // Optional: validate that typeId exists
    const typeExists = await ReportType.findById(typeId);
    if (!typeExists) return res.status(404).json({ message: "ReportType not found" });

    // Create the question
    const question = new ReportQuestion({
      typeId,
      questionText,
      options: options.map(opt => ({
        text: opt.text,
        nextQuestion: opt.nextQuestion || null
      }))
    });

    await question.save();

    res.status(201).json({
      message: "Report question created successfully",
      question
    });

  } catch (error) {
    console.error("Error creating report question:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



exports.createReportType = async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Report type name is required" });
    }

    const existing = await ReportType.findOne({ name: name.trim() });
    if (existing) {
      return res.status(400).json({ message: "Report type already exists" });
    }

    const reportType = new ReportType({
      name: name.trim(),
      description: description || "",
    });

    const savedType = await reportType.save();

    res.status(201).json({
      message: "Report type created successfully",
      data: savedType,
    });
  } catch (error) {
    console.error("Error creating report type:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



exports.getStartQuestion = async (req, res) => {
  try {
    const { typeId } = req.query;
    if (!typeId) {
      return res.status(400).json({ message: "typeId is required" });
    }

    // Get the first active question for that type
    const firstQuestion = await ReportQuestion.findOne({ typeId, isActive: true })
      .sort({ createdAt: 1 }) // oldest created = first question
      .lean();

    if (!firstQuestion) {
      return res.status(404).json({ message: "No start question found for this type" });
    }

    res.status(200).json({
      message: "Start question fetched successfully",
      data: firstQuestion,
    });
  } catch (error) {
    console.error("Error fetching start question:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};





exports.getNextQuestion = async (req, res) => {
  try {
    const { reportId, questionId, selectedOption } = req.body;
    const userId = req.Id || req.body.userId; // from auth middleware

    // 1. Get the question
    const question = await ReportQuestion.findById(questionId);
    if (!question) return res.status(404).json({ message: "Question not found" });

    // 2. Validate option
    const chosenOption = question.options.find(
      (opt) => opt._id.toString() === selectedOption
    );
    if (!chosenOption)
      return res.status(400).json({ message: "Invalid option selected" });

    // 3. Save to Report.answers[] (for final snapshot)
    await ReportType.findByIdAndUpdate(
      reportId,
      {
        $push: {
          answers: {
            questionId,
            questionText: question.questionText,
            selectedOption: chosenOption.text,
          },
        },
      },
      { new: true }
    );

    // 4. Log this answer in ReportLog
    await ReportLog.create({
      reportId,
      action: "Answered",
      performedBy: userId,
      answer: {
        questionId,
        questionText: question.questionText,
        selectedOption: chosenOption.text,
      },
    });

    // 5. Return next question (if exists)
    if (chosenOption.nextQuestion) {
      const nextQ = await ReportQuestion.findById(chosenOption.nextQuestion).lean();
      return res.json({
        message: "Next question",
        data: nextQ,
      });
    } else {
      return res.json({
        message: "No more questions, reporting flow complete",
      });
    }
  } catch (error) {
    console.error("Error answering question:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};


exports.getReportTypes = async (req, res) => {
  try {
    const types = await ReportType.find({ isActive: true }).sort({ createdAt: 1 }).lean();

    if (!types || types.length === 0) {
      return res.status(404).json({ message: "No report types found" });
    }

    res.status(200).json({
      message: "Report types fetched successfully",
      data: types,
    });
  } catch (error) {
    console.error("Error fetching report types:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};





exports.createFeedReport = async (req, res) => {

  try {

    const { typeId, targetId, targetType, answers } = req.body;

    const userId = req.Id || req.body.userId;
 
    if (!typeId || !targetId || !targetType) {

      return res.status(400).json({ message: "Missing required fields" });

    }
 
    if (!Array.isArray(answers) || answers.length === 0) {

      return res.status(400).json({ message: "Answers must be a non-empty array" });

    }
 
    // Map frontend answers to schema format

    const formattedAnswers = answers.map(a => ({

      questionId: a.questionId,

      questionText: a.questionText,

      selectedOption: a.answer, // match your schema field

    }));
 
    // Create report

    const report = new ReportPost({

      typeId,

      reportedBy: userId,

      targetId,

      targetType,

      answers: formattedAnswers,

    });
 
    const savedReport = await report.save();
 
    // Log creation

    await ReportLog.create({

      reportId: savedReport._id,

      action: "Created",

      performedBy: userId,

      note: "User started report",

    });
 
    res.status(201).json({

      message: "Report created successfully",

      data: savedReport,

    });

  } catch (error) {

    console.error("Error creating report:", error);

    res.status(500).json({ message: "Internal server error", error: error.message });

  }

};
 




exports.getReportLogs = async (req, res) => {
  try {
    const { reportId } = req.params;

    const logs = await ReportLog.find({ reportId })
      .populate("performedBy", "name email") // optional
      .sort({ createdAt: 1 });

    res.json({ reportId, logs });
  } catch (error) {
    console.error("Error fetching report logs:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};




exports.updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, note } = req.body;
    const adminId = req.user._id; // from admin auth middleware

    const report = await Report.findById(reportId);
    if (!report) return res.status(404).json({ message: "Report not found" });

    // Update main report
    report.status = status;
    report.reviewedBy = adminId;
    if (status === "Action Taken") {
      report.actionTaken = note || "Action performed";
      report.actionDate = new Date();
    }
    await report.save();

    // Add log entry
    await ReportLog.create({
      reportId: report._id,
      action: status,
      performedBy: adminId,
      note
    });

    res.json({ message: "Report updated successfully", data: report });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};



exports.adminTakeActionOnReport = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status, actionTaken} = req.body; 
    const adminId=req.id;

    // 1️⃣ Find report
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // 2️⃣ Update report
    report.status = status;
    report.actionTaken = actionTaken || null;
    report.reviewedBy = adminId || null;
    report.actionDate = new Date();
    await report.save();

    // 3️⃣ If Action Taken → Notify Feed Creator
    if (status === "Action Taken") {
      // Get the Feed
      const feed = await Feed.findById(report.targetId);
      if (feed) {
        // Get Account who created the feed
        const account = await Account.findById(feed.createdByAccount);
        if (account) {
          // Get User from Account
          const user = await User.findById(account.userId);
          if (user?.email) {
            const subject = "Action Taken on Your Feed";
            const html = `Hello ${user.userName},

An admin has reviewed a report against your feed and taken action.

📌 Status: ${report.status}
📌 Action Taken: ${report.actionTaken || "N/A"}
📌 Date: ${report.actionDate.toLocaleString()}

Thank you,
Support Team`;

            await sendMailSafe({
              to: user.email,
              subject,
              html,
            });
          }
        }
      }
    }

    res.status(200).json({
      message: "Report updated successfully",
      report,
    });
  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({
      message: "Failed to update report",
      error: error.message,
    });
  }
};
