const JobEngagement = require("../../models/JobPost/jobEngagementSchema");
const JobPost = require("../../models/JobPost/jobSchema");


// ✅ Record engagement (like/share/download/apply)
exports.recordEngagement = async (req, res) => {
  try {
    const { jobId, action } = req.body;
    const userId = req.Id;

    const validActions = ["like", "share", "download", "apply"];
    if (!validActions.includes(action))
      return res.status(400).json({ message: "Invalid action" });

    const engagement = await JobEngagement.findOneAndUpdate(
      { jobId, userId },
      { $set: { [action]: true, lastActionAt: new Date() } },
      { upsert: true, new: true }
    );

    // Increment count on JobPost
    const updateField = {};
    updateField[`stats.${action}s`] = 1;
    await JobPost.findByIdAndUpdate(jobId, { $inc: updateField });

    res.json({ message: `${action} recorded`, engagement });
  } catch (error) {
    console.error("Error recording engagement:", error);
    res.status(500).json({ message: "Server error" });
  }
};
