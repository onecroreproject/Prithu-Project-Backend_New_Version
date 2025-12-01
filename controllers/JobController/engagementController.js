/*********************************************************************************************
 * JOB ENGAGEMENT CONTROLLER — Optimized for new schema
 * Supports: like, share, save, download, apply
 * Auto-updates engagementScore and job stats
 *********************************************************************************************/
const JobEngagement = require("../../models/Job/JobPost/jobEngagementSchema");
const JobPost = require("../../models/Job/JobPost/jobSchema");
const mongoose = require("mongoose");

/* ============================================================================================
   1️⃣ UPDATE / TOGGLE ENGAGEMENT
   ============================================================================================ */
exports.updateEngagement = async (req, res) => {
  try {
    const userId = req.Id;
    const { jobId, actionType } = req.body;

    if (!userId || !jobId || !actionType) {
      return res.status(400).json({
        success: false,
        message: "userId, jobId, and actionType are required",
      });
    }

    const jobExists = await JobPost.findById(jobId).lean();
    if (!jobExists) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    const validActions = ["like", "share", "save", "apply", "view"];
    if (!validActions.includes(actionType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid actionType",
      });
    }

    let engagement = await JobEngagement.findOne({ jobId, userId });

    if (!engagement) {
      engagement = new JobEngagement({
        jobId,
        userId,
        companyId: jobExists.companyId,
      });
    }

    const fieldMap = {
      like: "liked",
      share: "shared",
      save: "saved",
      apply: "applied",
      view: "view",
    };

    const fieldName = fieldMap[actionType];

    // ----------------------------------------------------------------
    // 👁 VIEW → only record first time
    // ----------------------------------------------------------------
    if (actionType === "view") {
      if (!engagement.view) {
        engagement.view = true;
        engagement.lastActionAt = new Date();
        await engagement.save();
      }

      return res.status(200).json({
        success: true,
        message: "View recorded",
        engagement,
      });
    }

    // ----------------------------------------------------------------
    // 💾 SAVE → toggle
    // ----------------------------------------------------------------
    if (actionType === "save") {
      engagement.saved = !engagement.saved;
    }

    // ----------------------------------------------------------------
    // 👍 LIKE & APPLY → toggle
    // ----------------------------------------------------------------
    else if (["like", "apply"].includes(actionType)) {
      engagement[fieldName] = !engagement[fieldName];
    }

    // ----------------------------------------------------------------
    // 🔁 SHARE → always true (but no view count increment)
    // ----------------------------------------------------------------
    else if (actionType === "share") {
      engagement.shared = true;
    }

    engagement.lastActionAt = new Date();
    await engagement.save();

    return res.status(200).json({
      success: true,
      message: `Action '${actionType}' updated`,
      engagement,
    });

  } catch (error) {
    console.error("❌ Error updating job engagement:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};




/* ============================================================================================
   2️⃣ GET ENGAGEMENT STATS (Aggregation)
   ============================================================================================ */
exports.getJobEngagementStats = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ success: false, message: "Invalid job ID" });
    }

    const stats = await JobEngagement.aggregate([
      { $match: { jobId: new mongoose.Types.ObjectId(jobId) } },
      {
        $group: {
          _id: "$jobId",
          totalLikes: { $sum: { $cond: ["$liked", 1, 0] } },
          totalShares: { $sum: { $cond: ["$shared", 1, 0] } },
          totalSaved: { $sum: { $cond: ["$saved", 1, 0] } },
          totalDownloads: { $sum: { $cond: ["$downloaded", 1, 0] } },
          totalApplications: { $sum: { $cond: ["$applied", 1, 0] } },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      jobId,
      stats: stats[0] || {
        totalLikes: 0,
        totalShares: 0,
        totalSaved: 0,
        totalDownloads: 0,
        totalApplications: 0,
      },
    });
  } catch (error) {
    console.error("❌ Error getting engagement stats:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};

/* ============================================================================================
   3️⃣ GET ALL USER ENGAGEMENTS
   ============================================================================================ */
exports.getUserEngagements = async (req, res) => {
  try {
    const userId = req.Id || req.params.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "userId is required",
      });
    }

    const engagements = await JobEngagement.find({ userId })
      .populate("jobId", "jobTitle companyName city state country jobImage")
      .sort({ updatedAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: engagements.length,
      engagements,
    });
  } catch (error) {
    console.error("❌ Error fetching user engagements:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};
