const JobEngagement = require("../../models/JobPost/jobEngagementSchema");
const JobPost = require("../../models/JobPost/jobSchema");
const mongoose =require("mongoose");


exports.updateEngagement = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const { jobId, actionType } = req.body; // actionType can be 'like', 'share', 'download', or 'apply'

    if (!jobId || !actionType) {
      return res.status(400).json({ message: "Job ID and actionType are required." });
    }

    // Check if Job exists
    const jobExists = await JobPost.findById(jobId);
    if (!jobExists) {
      return res.status(404).json({ message: "Job post not found." });
    }

    // Find or create engagement record
    let engagement = await JobEngagement.findOne({ jobId, userId });

    if (!engagement) {
      engagement = new JobEngagement({ jobId, userId });
    }

    // Toggle or update the specific action
    switch (actionType) {
      case "like":
        engagement.liked = !engagement.liked;
        break;
      case "share":
        engagement.shared = true;
        break;
      case "download":
        engagement.downloaded = true;
        break;
      case "apply":
        engagement.applied = true;
        break;
      default:
        return res.status(400).json({ message: "Invalid action type." });
    }

    engagement.lastActionAt = Date.now();
    await engagement.save();

    res.status(200).json({
      message: `Job ${actionType} action updated successfully.`,
      engagement,
    });
  } catch (error) {
    console.error("Error updating engagement:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🔹 2️⃣ Get Engagement Stats by Job
exports.getJobEngagementStats = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid Job ID." });
    }

    const stats = await JobEngagement.aggregate([
      { $match: { jobId: new mongoose.Types.ObjectId(jobId) } },
      {
        $group: {
          _id: "$jobId",
          totalLikes: { $sum: { $cond: ["$liked", 1, 0] } },
          totalShares: { $sum: { $cond: ["$shared", 1, 0] } },
          totalDownloads: { $sum: { $cond: ["$downloaded", 1, 0] } },
          totalApplications: { $sum: { $cond: ["$applied", 1, 0] } },
        },
      },
    ]);

    res.status(200).json({
      jobId,
      stats: stats[0] || {
        totalLikes: 0,
        totalShares: 0,
        totalDownloads: 0,
        totalApplications: 0,
      },
    });
  } catch (error) {
    console.error("Error fetching job engagement stats:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// 🔹 3️⃣ Get All Engagements by User
exports.getUserEngagements = async (req, res) => {
  try {
    const userId = req.Id || req.params.userId;

    const engagements = await JobEngagement.find({ userId })
      .populate("jobId", "title companyName location")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      message: "User engagement history fetched successfully.",
      count: engagements.length,
      engagements,
    });
  } catch (error) {
    console.error("Error fetching user engagements:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};