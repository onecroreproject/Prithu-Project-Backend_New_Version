const JobPost = require("../models/Job/JobPost/jobSchema");
const CompanyLogin = require("../models/Job/CompanyModel/companyLoginSchema");
const JobApplication = require("../models/userModels/job/userJobApplication");
const JobPayment = require("../models/Job/JobPost/jobPaymentSchema");



exports.getJobDashboardStats = async (req, res) => {
  try {
    const [
      activeJobs,
      pendingJobApproval,
      totalApplications,
      totalCompanies,
      totalHires
    ] = await Promise.all([
      /* -------------------------------------------------
       * ✅ Active Jobs
       * status = active AND approved
       * ------------------------------------------------- */
      JobPost.countDocuments({
        status: "active",
        isApproved: true
      }),

      /* -------------------------------------------------
       * ⏳ Pending Job Approval
       * submitted but not approved
       * ------------------------------------------------- */
      JobPost.countDocuments({
        status: "submit",
        isApproved: false
      }),

      /* -------------------------------------------------
       * 📄 Total Job Applications
       * ------------------------------------------------- */
      JobApplication.countDocuments(),

      /* -------------------------------------------------
       * 🏢 Total Active Companies
       * ------------------------------------------------- */
      CompanyLogin.countDocuments({
        status: "active"
      }),

      /* -------------------------------------------------
       * 🏆 Total Hires (Shortlisted)
       * ------------------------------------------------- */
      JobApplication.countDocuments({
        status: "shortlisted"
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activeJobs,
        pendingJobApproval,
        totalApplications,
        totalCompanies,
        totalHires
      }
    });

  } catch (error) {
    console.error("❌ Job Dashboard Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch job dashboard statistics"
    });
  }
};
