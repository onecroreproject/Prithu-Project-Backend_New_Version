// ✅ controllers/childAdminActionsController.js
const mongoose = require("mongoose");
const ChildAdminJobActions = require("../../models/childAdminJobActionModel.js");
const JobPost = require("../../models/JobPost/jobSchema.js");
const User = require("../../models/userModels/userModel.js");
const { createAndSendNotification } = require("../../middlewares/helper/socketNotification.js");
const { sendTemplateEmail } = require("../../utils/templateMailer.js");

/* -------------------------------------------------------------------------- */
/* 🟢 APPROVE JOB CONTROLLER                                                   */
/* -------------------------------------------------------------------------- */
exports.approveJob = async (req, res) => {
  try {
    const { jobId } = req.body;
    const childAdminId = req.user?.id || req.Id;

    if (!jobId || !childAdminId) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const job = await JobPost.findById(jobId).populate("postedBy", "email userName");
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    if (job.isApproved) {
      return res
        .status(200)
        .json({ success: true, message: "Job already approved" });
    }

    // ✅ Update Job status
    job.isApproved = true;
    job.status = "active";
    await job.save();

    // ✅ Log approval in ChildAdminJobActions
    await ChildAdminJobActions.findOneAndUpdate(
      { childAdminId },
      {
        childAdminId,
        $push: {
          approvedJobs: {
            jobId,
            actionType: "approved",
            timestamp: new Date(),
          },
        },
        lastActionAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // ✅ Send Notification to Job Creator
    await createAndSendNotification({
      senderId: childAdminId,
      receiverId: job.postedBy._id,
      type: "job_approved",
      title: "🎉 Your Job Has Been Approved!",
      message: `Your job "${job.title}" has been approved and is now live.`,
      entityId: job._id,
      entityType: "JobPost",
    });

    // ✅ Send Email to Job Creator
    await sendTemplateEmail({
      templateName: "jobStatusUpdate.html",
      to: job.postedBy.email,
      subject: "Your Job Has Been Approved ✅",
      placeholders: {
        username: job.postedBy.userName,
        title: job.title,
        message: "Your job post has been approved and is now visible to all users.",
      },
      embedLogo: true,
    });

    return res.status(200).json({
      success: true,
      message: "Job approved successfully and notification sent.",
      jobId,
    });
  } catch (error) {
    console.error("❌ Error approving job:", error);
    res
      .status(500)
      .json({ success: false, message: "Internal Server Error", error });
  }
};

/* -------------------------------------------------------------------------- */
/* 🔴 DELETE JOB CONTROLLER                                                    */
/* -------------------------------------------------------------------------- */
exports.deleteJob = async (req, res) => {
  try {
    const { jobId, reason } = req.body;
    const childAdminId = req.user?.id || req.Id;

    if (!jobId || !childAdminId || !reason) {
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const job = await JobPost.findById(jobId).populate("postedBy", "email userName");
    if (!job) {
      return res
        .status(404)
        .json({ success: false, message: "Job not found" });
    }

    // ✅ Log deletion before actual removal
    await ChildAdminJobActions.findOneAndUpdate(
      { childAdminId },
      {
        childAdminId,
        $push: {
          deletedJobs: {
            jobId,
            actionType: "deleted",
            reason,
            timestamp: new Date(),
          },
        },
        lastActionAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // ✅ Send Notification to Job Creator
    await createAndSendNotification({
      senderId: childAdminId,
      receiverId: job.postedBy._id,
      type: "job_deleted",
      title: "⚠️ Your Job Was Removed",
      message: `Your job "${job.title}" has been deleted for the following reason: ${reason}`,
      entityId: job._id,
      entityType: "JobPost",
    });

    // ✅ Send Email to Job Creator
    await sendTemplateEmail({
      templateName: "jobStatusUpdate.html",
      to: job.postedBy.email,
      subject: "Your Job Has Been Removed ❌",
      placeholders: {
        username: job.postedBy.userName,
        title: job.title,
        message: `Your job post has been deleted for the following reason: ${reason}`,
      },
      embedLogo: true,
    });

    // ✅ Delete job from DB
    await JobPost.findByIdAndDelete(jobId);

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully and notification sent.",
      jobId,
    });
  } catch (error) {
    console.error("❌ Error deleting job:", error);
    return res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};
