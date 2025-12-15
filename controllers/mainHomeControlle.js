const User = require("../models/userModels/userModel"); // prithuDB
const JobPost = require("../models/Job/JobPost/jobSchema"); // jobDB
const CompanyLogin = require("../models/Job/CompanyModel/companyLoginSchema"); // jobDB


exports.getManiBoardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalJobs,
      totalCompanies,
    ] = await Promise.all([
      // 👤 Users (only active users, optional)
      User.countDocuments({ isActive: true }),

      // 💼 Jobs (exclude drafts if needed)
      JobPost.countDocuments({
        status: { $ne: "draft" }
      }),

      // 🏢 Companies (only active companies)
      CompanyLogin.countDocuments({
        status: "active"
      }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        totalJobs,
        totalCompanies,
      },
    });
  } catch (error) {
    console.error("❌ Dashboard stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};