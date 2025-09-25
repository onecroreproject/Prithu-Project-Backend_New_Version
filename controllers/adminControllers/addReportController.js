const ReportQuestion = require("../../models/userModels/Report/reprotQuetionAnswerModel");
const ReportType = require("../../models/userModels/Report/reportTypeModel");
const ReportLog =require('../../models/reportLog');


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
    const { id } = req.params;

    const question = await ReportQuestion.findById(id).lean();
    if (!question) {
      return res.status(404).json({ message: "Question not found" });
    }

    res.status(200).json({
      message: "Next question fetched successfully",
      data: question,
    });
  } catch (error) {
    console.error("Error fetching next question:", error);
    res.status(500).json({ message: "Internal server error" });
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
    const userId = req.Id || req.body.Id; // assuming auth middleware

    if (!typeId || !targetId || !targetType || !answers || answers.length === 0) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Create new report
    const report = new Report({
      typeId,
      reportedBy: userId,
      targetId,
      targetType,
      answers, // [{questionId, questionText, selectedOption}, ...]
    });

    const savedReport = await report.save();

    res.status(201).json({
      message: "Report submitted successfully",
      data: savedReport,
    });
  } catch (error) {
    console.error("Error submitting report:", error);
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
