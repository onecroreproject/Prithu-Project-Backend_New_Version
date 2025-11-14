// controllers/jobController.js
const mongoose = require("mongoose");
const JobPost = require("../../models/JobPost/jobSchema");
const JobEngagement = require("../../models/JobPost/jobEngagementSchema");
const Payment = require("../../models/JobPost/jobPaymentSchema");
const ProfileSettings = require("../../models/profileSettingModel");
const { deleteFromCloudinary } = require("../../middlewares/helper/Cloudinary/jobCloudinaryUpload");

/* ==========================================================
   🧩 CREATE OR UPDATE JOB
   ========================================================== */
exports.createJobPost = async (req, res) => {
  try {
    const userId = req.Id;
    const {
      jobId,
      title,
      experience,
      description,
      companyName,
      location,
      category,
      jobRole,
      keyword,
      jobType,
      salaryRange,
      startDate,
      endDate,
      isPaid,
      tags,
      status,
    } = req.body;

    const jobStatus = status || "draft";

    // ✅ Cloudinary (via multer)
    const imageUrl = req.file?.path || "";
    const imagePublicId = req.file?.filename || "";

    // 🧩 Normalize tags
    const formattedTags = Array.isArray(tags)
      ? tags.map((t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase())
      : [];

    // 🟡 Validate required fields if publishing
    if (
      (jobStatus === "active" || jobStatus === "publish") &&
      (!title ||
        !description ||
        !companyName ||
        !location ||
        !category ||
        !startDate ||
        !endDate ||
        !experience)
    ) {
      return res.status(400).json({
        message: "All required fields must be filled before publishing the job.",
      });
    }

    // ==========================================================
    // CASE 1: Update existing draft
    // ==========================================================
    if (jobId && jobStatus === "draft") {
      const existingJob = await JobPost.findOne({ _id: jobId, postedBy: userId });
      if (!existingJob)
        return res.status(404).json({ message: "Draft job not found." });

      // 🧹 Delete old image if new one uploaded
      if (imagePublicId && existingJob.imagePublicId) {
        await deleteFromCloudinary(existingJob.imagePublicId);
      }

      Object.assign(existingJob, {
        title,
        description,
        companyName,
        location,
        category,
        jobRole,
        keyword,
        jobType,
        salary:salaryRange,
        startDate,
        endDate,
        experience,
        isPaid: isPaid || false,
        tags: formattedTags.length ? formattedTags : existingJob.tags,
        status: "draft",
        priorityScore: isPaid ? 10 : 1,
      });

      if (imageUrl) {
        existingJob.image = imageUrl;
        existingJob.imagePublicId = imagePublicId;
      }

      await existingJob.save();

      return res.status(200).json({
        success: true,
        message: "Draft job updated successfully.",
        job: existingJob,
      });
    }

    // ==========================================================
    // CASE 2: Create new job (draft or publish)
    // ==========================================================
    const newJob = await JobPost.create({
      postedBy: userId,
      role: jobRole || "General",
      title,
      description,
      companyName,
      location,
      category,
      jobRole,
      keyword,
      jobType,
      salary:salaryRange,
      startDate,
      endDate,
      experience,
      isPaid: isPaid || false,
      image: imageUrl,
      imagePublicId,
      tags: formattedTags,
      status: jobStatus === "publish" ? "active" : "draft",
      priorityScore: isPaid ? 10 : 1,
    });

    res.status(201).json({
      success: true,
      message:
        jobStatus === "publish"
          ? "Job published successfully."
          : "Job draft created successfully.",
      job: newJob,
    });
  } catch (error) {
    console.error("❌ Error creating/updating job post:", error);
    res.status(500).json({
      success: false,
      message: "Server error while creating/updating job post.",
      error: error.message,
    });
  }
};

/* ==========================================================
   🧠 GET ALL JOBS (Feed)
   ========================================================== */
exports.getAllJobs = async (req, res) => {
  try {
    const { category, location, isPaid, language, keyword, jobType, experience, tags, search, status } =
      req.query;

    const filter = { isApproved: true };

    if (category) filter.category = category;
    if (location) filter.location = location;
    if (isPaid) filter.isPaid = isPaid === "true";
    if (language) filter.language = language;
    if (jobType) filter.jobType = jobType;
    if (status) filter.status = status;
    if (tags) filter.tags = { $in: tags.split(",").map((t) => t.trim()) };
    if (experience) filter.experience = { $gte: Number(experience) };

    // 🔍 Full-text or regex search
    if (keyword || search) {
      const regex = new RegExp(keyword || search, "i");
      filter.$text = { $search: keyword || search };
      filter.$or = [
        { title: regex },
        { jobRole: regex },
        { companyName: regex },
        { description: regex },
        { keyword: regex },
      ];
    }

    // 🧹 Auto mark expired jobs
    await JobPost.updateMany(
      { endDate: { $lt: new Date() }, status: { $ne: "expired" } },
      { $set: { status: "expired" } }
    );

    const jobs = await JobPost.find(filter)
      .sort({ isPaid: -1, priorityScore: -1, "stats.engagementScore": -1, createdAt: -1 })
      .populate("postedBy", "name email")
      .lean();

    // Enhance with profile info
    const jobsWithProfile = await Promise.all(
      jobs.map(async (job) => {
        const profile = await ProfileSettings.findOne(
          { userId: job.postedBy?._id },
          "userName profileAvatar"
        ).lean();

        return {
          ...job,
          postedBy: {
            ...job.postedBy,
            userName: profile?.userName || job.postedBy?.name || "Unknown",
            profileAvatar:
              profile?.profileAvatar ||
              "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      total: jobsWithProfile.length,
      jobs: jobsWithProfile,
    });
  } catch (error) {
    console.error("❌ Error fetching jobs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching jobs",
      error: error.message,
    });
  }
};


exports.getAllJobsForAdmin = async (req, res) => {
  try {
    const { category, location, isPaid, language, keyword, jobType, experience, tags, search, status } =
      req.query;

    let filter;

    if (category) filter.category = category;
    if (location) filter.location = location;
    if (language) filter.language = language;
    if (jobType) filter.jobType = jobType;
    if (status) filter.status = status;
    if (tags) filter.tags = { $in: tags.split(",").map((t) => t.trim()) };
    if (experience) filter.experience = { $gte: Number(experience) };

    // 🔍 Full-text or regex search
    if (keyword || search) {
      const regex = new RegExp(keyword || search, "i");
      filter.$text = { $search: keyword || search };
      filter.$or = [
        { title: regex },
        { jobRole: regex },
        { companyName: regex },
        { description: regex },
        { keyword: regex },
      ];
    }

    // 🧹 Auto mark expired jobs
    await JobPost.updateMany(
      { endDate: { $lt: new Date() }, status: { $ne: "expired" } },
      { $set: { status: "expired" } }
    );

    const jobs = await JobPost.find(filter)
      .sort({ isPaid: -1, priorityScore: -1, "stats.engagementScore": -1, createdAt: -1 })
      .populate("postedBy", "name email ")
      .lean();

    // Enhance with profile info
    const jobsWithProfile = await Promise.all(
      jobs.map(async (job) => {
        const profile = await ProfileSettings.findOne(
          { userId: job.postedBy?._id },
          "userName profileAvatar phoneNumber"
        ).lean();

        return {
          ...job,
          postedBy: {
            ...job.postedBy,
            userName: profile?.userName || job.postedBy?.name || "Unknown",
            phoneNumber:profile?.phoneNumber || "Unknown",
            profileAvatar:
              profile?.profileAvatar ||
              "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      total: jobsWithProfile.length,
      jobs: jobsWithProfile,
    });
  } catch (error) {
    console.error("❌ Error fetching jobs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching jobs",
      error: error.message,
    });
  }
};

/* ==========================================================
   🔍 GET JOB BY ID
   ========================================================== */
exports.getJobById = async (req, res) => {
  try {
    const job = await JobPost.findById(req.params.id)
      .populate("postedBy", "name email")
      .lean();

    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    // Auto expire if needed
    if (job.endDate && new Date(job.endDate) < new Date() && job.status === "active") {
      await JobPost.findByIdAndUpdate(job._id, { status: "expired" });
      job.status = "expired";
    }

    res.status(200).json({ success: true, job });
  } catch (error) {
    console.error("❌ Error fetching job:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching job details",
      error: error.message,
    });
  }
};

/* ==========================================================
   🧹 DELETE JOB (with Cloudinary cleanup)
   ========================================================== */
exports.deleteJobPost = async (req, res) => {
  try {
    const userId = req.Id;
    const { jobId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(jobId))
      return res.status(400).json({ success: false, message: "Invalid job ID" });

    const job = await JobPost.findById(jobId);
    if (!job) return res.status(404).json({ success: false, message: "Job not found" });
    if (job.postedBy.toString() !== userId.toString())
      return res.status(403).json({
        success: false,
        message: "Unauthorized — You can only delete your own job posts.",
      });

    if (job.imagePublicId) await deleteFromCloudinary(job.imagePublicId);
    await JobPost.findByIdAndDelete(jobId);

    res.status(200).json({
      success: true,
      message: "Job and associated image deleted successfully",
      deletedJobId: jobId,
    });
  } catch (error) {
    console.error("❌ Error deleting job:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting job",
      error: error.message,
    });
  }
};

/* ==========================================================
   🧮 RANKED JOBS (Aggregated Performance)
   ========================================================== */
exports.getRankedJobs = async (req, res) => {
  try {
    // Auto expire outdated jobs
    await JobPost.updateMany(
      { endDate: { $lt: new Date() }, status: "active" },
      { $set: { status: "expired" } }
    );

    const jobs = await JobPost.find({ status: "active", isApproved: true })
      .populate("postedBy", "name email")
      .lean();

    if (!jobs.length)
      return res.status(404).json({ success: false, message: "No active jobs found" });

    // Compute ranking efficiently
    const rankedJobs = await Promise.all(
      jobs.map(async (job) => {
        const [engagements, payment] = await Promise.all([
          JobEngagement.find({ jobId: job._id }),
          Payment.findOne({ jobId: job._id, status: "success" }),
        ]);

        const engagementScore = engagements.reduce(
          (acc, e) =>
            acc +
            (e.liked ? 3 : 0) +
            (e.shared ? 5 : 0) +
            (e.downloaded ? 2 : 0) +
            (e.applied ? 10 : 0),
          0
        );

        const maxEngagement = 60;
        const engagementPercent = Math.min(
          (engagementScore / maxEngagement) * 60,
          60
        );
        const paymentBonus = payment ? 25 : 0;
        const daysSincePosted =
          (Date.now() - new Date(job.createdAt)) / (1000 * 60 * 60 * 24);
        const recencyBonus = Math.max(0, 15 - daysSincePosted);

        const finalScore = Math.min(
          Math.round(paymentBonus + engagementPercent + recencyBonus),
          100
        );

        const profile = await ProfileSettings.findOne(
          { userId: job.postedBy?._id },
          "userName profileAvatar"
        ).lean();

        return {
          ...job,
          score: finalScore,
          engagementCount: engagements.length,
          userName: profile?.userName || job.postedBy?.name || "Unknown",
          profileAvatar:
            profile?.profileAvatar ||
            "https://cdn-icons-png.flaticon.com/512/149/149071.png",
          isPaid: !!payment,
        };
      })
    );

    rankedJobs.sort((a, b) => {
      if (a.isPaid !== b.isPaid) return b.isPaid - a.isPaid;
      if (a.score !== b.score) return b.score - a.score;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.status(200).json({
      success: true,
      count: rankedJobs.length,
      jobs: rankedJobs,
    });
  } catch (error) {
    console.error("❌ Error fetching ranked jobs:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching ranked jobs",
      error: error.message,
    });
  }
};



// ✅ Get all jobs posted by the logged-in user
exports.getJobsByUserId = async (req, res) => {
  try {
    const userId = req.Id || req.params.userId || req.body.userId;

    // 🔹 Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // 🔹 Auto-expire old jobs
    await JobPost.updateMany(
      {
        postedBy: userId,
        endDate: { $lt: new Date() },
        status: { $ne: "expired" },
      },
      { $set: { status: "expired" } }
    );

    // 🔹 Fetch all jobs by user (lean for performance)
    const jobs = await JobPost.find({ postedBy: userId })
      .sort({ createdAt: -1 })
      .lean();

    if (!jobs.length) {
      return res.status(404).json({
        success: false,
        message: "No jobs found for this user",
      });
    }

    // 🔹 Enhance jobs with engagement + payment info (parallel computation)
    const enhancedJobs = await Promise.all(
      jobs.map(async (job) => {
        // 1️⃣ Engagement aggregation
        const engagements = await JobEngagement.find({ jobId: job._id }).lean();
        const engagementStats = engagements.reduce(
          (acc, e) => {
            if (e.liked) acc.likes += 1;
            if (e.shared) acc.shares += 1;
            if (e.downloaded) acc.downloads += 1;
            if (e.applied) acc.appliedCount += 1;
            return acc;
          },
          { likes: 0, shares: 0, downloads: 0, appliedCount: 0 }
        );

        // 2️⃣ Calculate engagement score (weighted)
        const engagementScore =
          engagementStats.likes * 2 +
          engagementStats.shares * 3 +
          engagementStats.downloads * 1 +
          engagementStats.appliedCount * 5;

        // 3️⃣ Check if job has successful payment (for boosting)
        const payment = await Payment.findOne({
          jobId: job._id,
          status: "success",
        }).lean();

        // 4️⃣ Compute final priority score
        const priorityScore = (payment ? 25 : 0) + engagementScore;

        // 5️⃣ Return enhanced job object
        return {
          ...job,
          stats: {
            ...engagementStats,
            engagementScore,
          },
          isPaid: !!payment,
          priorityScore,
        };
      })
    );

    // 🔹 Sort by Paid → Engagement → CreatedAt
    enhancedJobs.sort((a, b) => {
      if (a.isPaid !== b.isPaid) return b.isPaid - a.isPaid;
      if (a.stats.engagementScore !== b.stats.engagementScore)
        return b.stats.engagementScore - a.stats.engagementScore;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // ✅ Final response
    res.status(200).json({
      success: true,
      total: enhancedJobs.length,
      jobs: enhancedJobs,
    });
  } catch (error) {
    console.error("❌ Error fetching jobs by user ID:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching user jobs",
      error: error.message,
    });
  }
};

