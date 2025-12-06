const ProfileSettings = require("../../../models/profileSettingModel");
const UserCurricluam = require("../../../models/userModels/UserEductionSchema/userFullCuricluamSchema");
const JobApplication = require("../../../models/userModels/job/userJobApplication");
const JobPost = require("../../../models/Job/JobPost/jobSchema");
const User =require("../../../models/userModels/userModel")
const {logCompanyActivity} =require("../../../middlewares/utils/jobActivityLoogerFunction");
const CompanyActivityLog = require("../../../models/Job/CompanyModel/companyActivityLog");
const mongoose =require("mongoose")


exports.getCompanyApplicants = async (req, res) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    /* -----------------------------------------------------
     * 1️⃣ Fetch all applications for this company (NO POPULATE FOR userId)
     * --------------------------------------------------- */
    const applications = await JobApplication.find({ companyId })
      .populate({
        path: "jobId",
        select:
          "jobTitle jobRole jobCategory employmentType workMode city state salaryMin salaryMax createdAt"
      })
      .lean();

    if (!applications.length) {
      return res.status(200).json({
        success: true,
        message: "No applicants found",
        applicants: []
      });
    }

    /* -----------------------------------------------------
     * 2️⃣ For each application → manually fetch User + Profile + Curriculum
     * --------------------------------------------------- */
    const finalApplicants = await Promise.all(
      applications.map(async (app) => {
        const userId = app.userId;

        // 🔹 Fetch user basic info (from prithuDB)
        const user = await User.findById(userId).lean();

        // 🔹 Fetch profile settings
        const profile = await ProfileSettings.findOne({ userId }).lean();

        // 🔹 Fetch curriculum
        const curriculum = await UserCurricluam.findOne({ userId }).lean();

        return {
          application: app,
          profileSettings: profile || {},
          curriculum: curriculum || {}
        };
      })
    );

    return res.status(200).json({
      success: true,
      total: finalApplicants.length,
      applicants: finalApplicants,
    });

  } catch (error) {
    console.error("❌ GET COMPANY APPLICANTS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching applicants",
      error: error.message,
    });
  }
};





exports.updateApplicationStatus = async (req, res) => {
  try {
    const companyId = req.companyId; // from companyAuth middleware
    const { applicationId, status, note } = req.body;

    console.log("com", companyId);
    console.log("app", applicationId);
    console.log("sat", status);
    console.log("note", note);

    // Allowed statuses
    const allowedStatuses = [
      "applied",
      "reviewed",
      "shortlisted",
      "accepted",
      "rejected",
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid application status",
      });
    }

    /* -----------------------------------------------------
     * 1️⃣ Validate application belongs to this company
     * --------------------------------------------------- */
    const application = await JobApplication.findOne({
      _id: applicationId,
      companyId: companyId,
    });

    if (!application) {
      return res.status(404).json({
        success: false,
        message: "Application not found or unauthorized access",
      });
    }

    /* -----------------------------------------------------
     * 2️⃣ Update status & push history
     * --------------------------------------------------- */
    const oldStatus = application.status;

    application.status = status;

    application.history.push({
      status,
      note: note || `${status} updated by company`,
      updatedAt: new Date(),
    });

    await application.save();

    /* -----------------------------------------------------
     * 3️⃣ COMPANY ACTIVITY LOG
     * --------------------------------------------------- */
    await logCompanyActivity({
      companyId: companyId,
      action: "application_status_update",
      description: `Updated application ${applicationId} status from '${oldStatus}' to '${status}'`,
      jobId: application.jobId,
      changes: {
        old: oldStatus,
        new: status,
        note: note || "",
      },
      req, // pass req for IP + UserAgent
    });

    return res.status(200).json({
      success: true,
      message: "Application status updated successfully",
      application,
    });

  } catch (error) {
    console.error("❌ UPDATE APPLICATION STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Error updating application status",
      error: error.message,
    });
  }
};






exports.getRecentCompanyActivities = async (req, res) => {
  try {
    const companyId = req.companyId; // From middleware
    const { limit = 20 } = req.query; // Optional: ?limit=10

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: companyId missing",
      });
    }

    // Fetch recent activities sorted by latest first
    const activities = await CompanyActivityLog.find({ companyId })
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return res.status(200).json({
      success: true,
      count: activities.length,
      activities,
    });

  } catch (error) {
    console.error("❌ ERROR FETCHING COMPANY ACTIVITIES:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching recent company activities",
      error: error.message,
    });
  }
};



exports.getCompanyJobStats = async (req, res) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: companyId missing",
      });
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    /* -----------------------------------------------------
     * 📌 1️⃣ JOB COUNTS
     * --------------------------------------------------- */
    const [
      totalPostedJobs,
      activeJobs,
      draftJobs,
      expiredJobs
    ] = await Promise.all([
      JobPost.countDocuments({ companyId: companyObjectId }),
      JobPost.countDocuments({ companyId: companyObjectId, status: "active" }),
      JobPost.countDocuments({ companyId: companyObjectId, status: "draft" }),
      JobPost.countDocuments({ companyId: companyObjectId, status: { $in: ["expired", "closed"] } }),
    ]);

    /* -----------------------------------------------------
     * 📌 2️⃣ GET ALL APPLICANTS WITH DATE
     * --------------------------------------------------- */
    const applicantsList = await JobApplication.aggregate([
      { $match: { companyId: companyObjectId } },
      {
        $project: {
          applicationId: "$_id",
          jobId: 1,
          userId: 1,
          status: 1,
          createdAt: 1,
          formattedDate: {
            $dateToString: { format: "%d-%m-%Y", date: "$createdAt" }
          }
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    const totalApplicants = applicantsList.length;

    /* -----------------------------------------------------
     * 📌 3️⃣ GET SHORTLISTED WITH DATE
     * --------------------------------------------------- */
    const shortlistedList = applicantsList.filter(a => a.status === "shortlisted");
    const shortlistedApplicants = shortlistedList.length;

    /* -----------------------------------------------------
     * 📌 4️⃣ FINAL RESPONSE
     * --------------------------------------------------- */
    return res.status(200).json({
      success: true,
      stats: {
        totalPostedJobs,
        activeJobs,
        draftJobs,
        expiredJobs,
        totalApplicants,
        shortlistedApplicants,
      },
      applicantsList,
      shortlistedList
    });

  } catch (error) {
    console.error("❌ ERROR FETCHING COMPANY JOB STATS:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching job & applicant statistics",
      error: error.message,
    });
  }
};



exports.getTopPerformingJobs = async (req, res) => {
  try {
    const companyId = req.companyId;
    const limit = Number(req.query.limit) || 5;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: companyId missing",
      });
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    const topJobs = await JobPost.aggregate([
      {
        $match: { companyId: companyObjectId }   // FIXED ✔
      },

      // Applicant count
      {
        $lookup: {
          from: "JobApplication",
          localField: "_id",
          foreignField: "jobId",
          as: "applications",
        },
      },
      {
        $addFields: {
          applicantCount: { $size: "$applications" },
        },
      },

      // Engagement views
      {
        $lookup: {
          from: "JobEngagement",
          let: { jobId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$jobId", "$$jobId"] },
                view: true,
              },
            },
          ],
          as: "engagementViews",
        },
      },
      {
        $addFields: {
          engagementViewCount: { $size: "$engagementViews" },
        },
      },

      // Combine views
      {
        $addFields: {
          totalViews: {
            $add: ["$stats.views", "$engagementViewCount"],
          },
        },
      },

      // Sorting
      {
        $sort: {
          applicantCount: -1,
          totalViews: -1,
        },
      },

      { $limit: limit },

      // Output formatting
      {
        $project: {
          jobTitle: 1,
          jobCategory: 1,
          createdAt: 1,
          formattedDate: {
            $dateToString: { format: "%d-%m-%Y", date: "$createdAt" },
          },
          applicantCount: 1,
          totalViews: 1,
          stats: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      count: topJobs.length,
      topJobs,
    });

  } catch (error) {
    console.error("❌ ERROR GETTING TOP JOBS:", error);
    return res.status(500).json({
      success: false,
      message: "Error fetching top performing jobs",
      error: error.message,
    });
  }
};