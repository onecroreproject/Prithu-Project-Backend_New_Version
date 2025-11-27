/********************************************************************************************
 * ADMIN JOB CONTROLLER — Updated for new JobPost schema
 * Ultra-fast filtering + block system + auto-expire
 ********************************************************************************************/

const JobPost = require("../../../models/Job/JobPost/jobSchema");

/* ============================================================================================
   1️⃣ ADMIN — GET ALL JOB POSTS (WITH ADVANCED FILTERS)
   ============================================================================================ */
exports.getAllJobPostsAdmin = async (req, res) => {
  try {
    const {
      status,
      jobCategory,
      jobRole,
      employmentType,
      workMode,
      city,
      state,
      country,
      isApproved,
      isFeatured,
      search,
    } = req.query;

    const filter = {};

    // 🔹 Status
    if (status) filter.status = status;

    // 🔹 Filters based on new schema
    if (jobCategory) filter.jobCategory = jobCategory;
    if (jobRole) filter.jobRole = jobRole;
    if (employmentType) filter.employmentType = employmentType;
    if (workMode) filter.workMode = workMode;

    // 🔹 Location Filters
    if (city) filter.city = city;
    if (state) filter.state = state;
    if (country) filter.country = country;

    // 🔹 Approval Filters
    if (isApproved !== undefined) filter.isApproved = isApproved === "true";
    if (isFeatured !== undefined) filter.isFeatured = isFeatured === "true";

    // 🔍 TEXT SEARCH (Very Fast)
    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { jobTitle: regex },
        { jobRole: regex },
        { companyName: regex },
        { jobDescription: regex },
        { keywordSearch: regex },
      ];
    }

    // 🔥 Auto-expire old jobs
    await JobPost.updateMany(
      { endDate: { $lt: new Date() }, status: "active" },
      { $set: { status: "expired" } }
    );

    // 🔥 Fetch Jobs (lean = fastest format)
    const jobs = await JobPost.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      total: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("❌ Error fetching jobs:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching admin job list",
      error: error.message,
    });
  }
};

/* ============================================================================================
   2️⃣ ADMIN — BLOCK A JOB (Soft Delete)
   ============================================================================================ */
exports.blockJobPost = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Job ID is required",
      });
    }

    // 🔹 Update job status to blocked
    const job = await JobPost.findByIdAndUpdate(
      id,
      {
        status: "blocked",
        isApproved: false,
        reasonForBlock: reason || "Blocked by admin",
      },
      { new: true }
    ).lean();

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Job has been blocked successfully",
      job,
    });
  } catch (error) {
    console.error("❌ Error blocking job:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while blocking job",
      error: error.message,
    });
  }
};
