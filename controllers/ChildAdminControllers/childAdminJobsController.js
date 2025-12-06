/********************************************************************************************
 * CHILD ADMIN — JOB APPROVAL & DELETION CONTROLLERS
 * Updated to match NEW JobPost Schema (company-based)
 ********************************************************************************************/
const ChildAdminJobActions = require("../../models/childAdminJobActionModel.js");
const JobPost = require("../../models/Job/JobPost/jobSchema.js");
const CompanyLogin = require("../../models/Job/CompanyModel/companyLoginSchema.js");
const CompanyProfile = require("../../models/Job/CompanyModel/companyProfile.js");

const { createAndSendNotification } = require("../../middlewares/helper/socketNotification.js");
const { sendTemplateEmail } = require("../../utils/templateMailer.js");

/* ============================================================================================
   🟢 APPROVE JOB CONTROLLER
   ============================================================================================ */
exports.approveJob = async (req, res) => {
  try {
    const { jobId } = req.body;
    const childAdminId = req.user?.id || req.Id;

    if (!jobId || !childAdminId) {
      return res.status(400).json({
        success: false,
        message: "Missing jobId or admin identity",
      });
    }

    // Fetch job
    const job = await JobPost.findById(jobId).lean();
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });

    if (job.isApproved) {
      return res.status(200).json({
        success: true,
        message: "Job is already approved",
      });
    }

    // Fetch company info (NOT user)
    const company = await CompanyLogin.findById(job.companyId).lean();
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company associated with job not found",
      });
    }

    // Update job status
    await JobPost.findByIdAndUpdate(jobId, {
      isApproved: true,
      status: "active",
    });

    // Log admin action
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

    /* --------------------------------------------------------------------------
     * 🔔 SEND NOTIFICATION TO COMPANY ACCOUNT
     * -------------------------------------------------------------------------- */
    await createAndSendNotification({
      senderId: childAdminId,
      receiverId: company._id,
      type: "job_approved",
      title: "🎉 Your Job is Approved!",
      message: `Your job "${job.jobTitle}" has been approved and published.`,
      entityId: jobId,
      entityType: "JobPost",
    });

    /* --------------------------------------------------------------------------
     * 📧 SEND EMAIL TO COMPANY
     * -------------------------------------------------------------------------- */
    await sendTemplateEmail({
      templateName: "jobStatusUpdate.html",
      to: company.email,
      subject: "Your Job Has Been Approved ✔️",
      placeholders: {
        username: company.name || company.companyName,
        title: job.jobTitle,
        message: "Your job is now live and visible to all job seekers!",
      },
      embedLogo: false,
    });

    return res.status(200).json({
      success: true,
      message: "Job approved successfully",
      jobId,
    });
  } catch (error) {
    console.error("❌ Error approving job:", error);
    res.status(500).json({
      success: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
};

/* ============================================================================================
   🔴 DELETE JOB CONTROLLER
   ============================================================================================ */
exports.deleteJob = async (req, res) => {
  try {
    const { jobId, reason } = req.body;
    const childAdminId = req.user?.id || req.Id;

    if (!jobId || !childAdminId || !reason) {
      return res.status(400).json({
        success: false,
        message: "Missing jobId, adminId or reason",
      });
    }

    // Fetch job
    const job = await JobPost.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Fetch company
    const company = await CompanyLogin.findById(job.companyId).lean();
    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company account not found",
      });
    }

    /* --------------------------------------------------------------------------
     * 📝 LOG CHILD ADMIN ACTION BEFORE DELETE
     * -------------------------------------------------------------------------- */
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

    /* --------------------------------------------------------------------------
     * 🔔 SEND NOTIFICATION TO COMPANY
     * -------------------------------------------------------------------------- */
    await createAndSendNotification({
      senderId: childAdminId,
      receiverId: company._id,
      type: "job_deleted",
      title: "⚠️ Your Job Was Removed",
      message: `Your job "${job.jobTitle}" was deleted. Reason: ${reason}`,
      entityId: jobId,
      entityType: "JobPost",
    });

    /* --------------------------------------------------------------------------
     * 📧 SEND EMAIL TO COMPANY
     * -------------------------------------------------------------------------- */
    await sendTemplateEmail({
      templateName: "jobStatusUpdate.html",
      to: company.email,
      subject: "Your Job Has Been Removed ❌",
      placeholders: {
        username: company.name || company.companyName,
        title: job.jobTitle,
        message: `Your job was removed by an admin. Reason: ${reason}`,
      },
      embedLogo: false,
    });

    /* --------------------------------------------------------------------------
     * ❌ DELETE JOB
     * -------------------------------------------------------------------------- */
    await JobPost.findByIdAndDelete(jobId);

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully",
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
