const JobPost = require("../../models/JobPost/jobSchema");
const mongoose = require("mongoose");
const ProfileSettings = require("../../models/profileSettingModel");
const JobEngagement = require("../../models/JobPost/jobEngagementSchema");
const Payment = require("../../models/JobPost/jobPaymentSchema");
const {
  uploadToCloudinary,
  deleteFromCloudinary,
} = require("../../middlewares/helper/Cloudinary/jobCloudinaryUpload");

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

    // ✅ Upload image if provided
    let imageUrl = "";
    let imagePublicId = "";

    if (req.file && req.file.path) {
      const uploadResult = await uploadToCloudinary(req.file.path, "job_posts");
      imageUrl = uploadResult.url;
      imagePublicId = uploadResult.public_id;
    }

    // 🧩 Normalize tags
    const formattedTags =
      tags && Array.isArray(tags)
        ? tags.map(
            (tag) => tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()
          )
        : [];

    console.log({
      title,
      description,
      companyName,
      location,
      category,
      startDate,
      endDate,
      experience,
    });

    // 🟡 Validate required fields if publishing
    if (jobStatus === "active" || jobStatus === "publish") {
      if (
        !title ||
        !description ||
        !companyName ||
        !location ||
        !category ||
        !startDate ||
        !endDate ||
        !experience
      ) {
        return res.status(400).json({
          message:
            "All required fields must be filled before publishing the job.",
        });
      }
    }

    // ==========================================================
    // 🧠 CASE 1: Update existing draft
    // ==========================================================
    if (jobId && jobStatus === "draft") {
      const existingJob = await JobPost.findOne({
        _id: jobId,
        postedBy: userId,
      });

      if (!existingJob) {
        return res.status(404).json({ message: "Draft job not found." });
      }

      // 🧹 If new image uploaded, delete old one from Cloudinary
      if (imageUrl && existingJob.imagePublicId) {
        try {
          await deleteFromCloudinary(existingJob.imagePublicId);
          console.log("🗑️ Old image removed:", existingJob.imagePublicId);
        } catch (err) {
          console.warn(
            "⚠️ Failed to delete old Cloudinary image:",
            err.message
          );
        }
      }

      // 🧩 Update job fields
      existingJob.title = title || existingJob.title;
      existingJob.description = description || existingJob.description;
      existingJob.companyName = companyName || existingJob.companyName;
      existingJob.location = location || existingJob.location;
      existingJob.category = category || existingJob.category;
      existingJob.jobRole = jobRole || existingJob.jobRole;
      existingJob.keyword = keyword || existingJob.keyword;
      existingJob.jobType = jobType || existingJob.jobType;
      existingJob.salaryRange = salaryRange || existingJob.salaryRange;
      existingJob.startDate = startDate || existingJob.startDate;
      existingJob.endDate = endDate || existingJob.endDate;
      existingJob.isPaid = isPaid ?? existingJob.isPaid;
      existingJob.experience = experience || existingJob.experience;
      existingJob.tags = formattedTags.length
        ? formattedTags
        : existingJob.tags;
      existingJob.status = "draft";
      existingJob.priorityScore = isPaid ? 10 : 1;

      // Update image only if a new one was uploaded
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
    // 🧠 CASE 2: Create new draft
    // ==========================================================
    if (!jobId && jobStatus === "draft") {
      const draftJob = await JobPost.create({
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
        salaryRange,
        startDate,
        endDate,
        isPaid: isPaid || false,
        image: imageUrl,
        imagePublicId,
        experience,
        tags: formattedTags,
        status: "draft",
        priorityScore: isPaid ? 10 : 1,
      });

      return res.status(201).json({
        success: true,
        message: "Job draft created successfully.",
        job: draftJob,
      });
    }

    // ==========================================================
    // 🧠 CASE 3: Publish job
    // ==========================================================
    if (jobStatus === "publish") {
      const publishedJob = await JobPost.create({
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
        salaryRange,
        startDate,
        endDate,
        experience,
        isPaid: isPaid || false,
        image: imageUrl,
        imagePublicId,
        tags: formattedTags,
        status: "active",
        priorityScore: isPaid ? 10 : 1,
      });

      return res.status(201).json({
        success: true,
        message: "Job published successfully.",
        job: publishedJob,
      });
    }

    // ==========================================================
    // ❌ Fallback
    // ==========================================================
    return res.status(400).json({
      success: false,
      message: "Invalid job status or request data.",
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

// ✅ Get All Jobs (Feed) - visible to users
exports.getAllJobs = async (req, res) => {
  try {
    const {
      category,
      location,
      isPaid,
      language,
      keyword,
      jobType,
      exprience,
      tags,
      search,
      status,
    } = req.query;

    // Base filter: only show approved + active jobs
    const filter = { isApproved: true };

    if (category) filter.category = category;
    if (location) filter.location = location;
    if (isPaid) filter.isPaid = isPaid === "true";
    if (language) filter.language = language;
    if (jobType) filter.jobType = jobType;
    if (exprience) filter.exprience = exprience;
    if (status) filter.status = status; // allows admin filtering (active/inactive/etc.)
    if (tags) filter.tags = { $in: tags.split(",").map((t) => t.trim()) };

    // 🔍 Keyword / Search filter
    if (keyword || search) {
      const searchRegex = new RegExp(keyword || search, "i");
      filter.$or = [
        { title: searchRegex },
        { role: searchRegex },
        { jobRole: searchRegex },
        { companyName: searchRegex },
        { description: searchRegex },
        { keyword: searchRegex },
      ];
    }

    // 🧠 Automatically mark expired jobs as expired
    await JobPost.updateMany(
      { endDate: { $lt: new Date() }, status: { $ne: "expired" } },
      { $set: { status: "expired" } }
    );

    // ⚡ Sort order: Paid → Priority → Engagement → Recent
    const jobs = await JobPost.find(filter)
      .sort({
        isPaid: -1,
        priorityScore: -1,
        "stats.engagementScore": -1,
        createdAt: -1,
      })
      .populate("postedBy", "name email"); // temporary basic populate

    // 🔹 Enhance each job with username and profileAvatar from ProfileSettings
    const jobsWithUserDetails = await Promise.all(
      jobs.map(async (job) => {
        if (!job.postedBy?._id) return job;

        const profile = await ProfileSettings.findOne(
          { userId: job.postedBy._id },
          "userName profileAvatar"
        );

        return {
          ...job.toObject(),
          postedBy: {
            _id: job.postedBy._id,
            name: job.postedBy.name,
            email: job.postedBy.email,
            username: profile?.userName || "Unknown User",
            profileAvatar:
              profile?.profileAvatar ||
              "https://cdn-icons-png.flaticon.com/512/149/149071.png", // fallback avatar
          },
        };
      })
    );

    res.status(200).json({
      success: true,
      total: jobsWithUserDetails.length,
      jobs: jobsWithUserDetails,
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

// ✅ Get Job by ID (detail view)
exports.getJobById = async (req, res) => {
  try {
    const job = await JobPost.findById(req.params.id)
      .populate("postedBy", "name email")
      .lean();

    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // Auto mark expired if needed
    if (
      job.endDate &&
      new Date(job.endDate) < new Date() &&
      job.status === "active"
    ) {
      await JobPost.findByIdAndUpdate(job._id, { status: "expired" });
      job.status = "expired";
    }

    res.status(200).json({ success: true, job });
  } catch (error) {
    console.error("❌ Error fetching job:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error", error: error.message });
  }
};

// =============================================================
// 🔹 Auto Deactivate Expired Jobs (can be scheduled by CRON)
// =============================================================
exports.deactivateExpiredJobs = async () => {
  try {
    const now = new Date();
    const result = await JobPost.updateMany(
      { endDate: { $lt: now }, status: "active" },
      { $set: { status: "expired" } }
    );
    console.log(`✅ Expired jobs deactivated: ${result.modifiedCount}`);
  } catch (error) {
    console.error("❌ Error deactivating expired jobs:", error);
  }
};




exports.getJobsByUserId = async (req, res) => {
  try {
    const userId = req.Id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid user ID" });
    }

    // Auto expire old jobs
    await JobPost.updateMany(
      {
        postedBy: userId,
        endDate: { $lt: new Date() },
        status: { $ne: "expired" },
      },
      { $set: { status: "expired" } }
    );

    const jobs = await JobPost.find({ postedBy: userId })
      .sort({ createdAt: -1 })
      .populate("postedBy", "name email");

    if (!jobs.length) {
      return res
        .status(404)
        .json({ success: false, message: "No jobs found for this user" });
    }

    // Calculate engagement score dynamically
    const updatedJobs = jobs.map((job) => {
      const s = job.stats || {};
      const engagementScore =
        (s.views || 0) +
        (s.likes || 0) * 2 +
        (s.shares || 0) * 3 +
        (s.appliedCount || 0) * 5;

      return { ...job.toObject(), stats: { ...s, engagementScore } };
    });

    res.status(200).json({
      success: true,
      total: updatedJobs.length,
      jobs: updatedJobs,
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

exports.deleteJobPost = async (req, res) => {
  try {
    const userId = req.Id;
    const { jobId } = req.params;

    // 🔹 Validate ID
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid job ID" });
    }

    // 🔹 Find the job
    const job = await JobPost.findById(jobId);
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    // 🔹 Check permission
    if (job.postedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized — You can only delete your own job posts.",
      });
    }

    // 🔹 Delete Cloudinary image (if exists)
    if (job.imagePublicId) {
      try {
        await deleteFromCloudinary(job.imagePublicId);
        console.log(`🗑️ Cloudinary image deleted: ${job.imagePublicId}`);
      } catch (cloudErr) {
        console.warn(
          "⚠️ Failed to delete image from Cloudinary:",
          cloudErr.message
        );
      }
    } else if (job.image && job.image.includes("res.cloudinary.com")) {
      // Optional fallback: extract public ID from URL
      try {
        const match = job.image.match(/\/upload\/(?:v\d+\/)?(.+?)\.[a-zA-Z]+$/);
        if (match && match[1]) {
          await deleteFromCloudinary(match[1]);
          console.log(`🗑️ Extracted Cloudinary image deleted: ${match[1]}`);
        }
      } catch (err) {
        console.warn("⚠️ Cloudinary URL parse failed:", err.message);
      }
    }

    // 🔹 Delete Job from DB
    await JobPost.findByIdAndDelete(jobId);

    return res.status(200).json({
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

exports.getRankedJobs = async (req, res) => {
  try {
    // 🔹 Auto-expire outdated jobs
    await JobPost.updateMany(
      { endDate: { $lt: new Date() }, status: "active" },
      { $set: { status: "expired" } }
    );

    // 🔹 Fetch all active & approved jobs
    const jobs = await JobPost.find({ status: "active", isApproved: true })
      .populate("postedBy", "name email")
      .lean();

    if (!jobs.length) {
      return res
        .status(404)
        .json({ success: false, message: "No active jobs found" });
    }

    // 🔹 Process and rank each job
    const rankedJobs = await Promise.all(
      jobs.map(async (job) => {
        // 1️⃣ Engagement stats
        const engagement = await JobEngagement.find({ jobId: job._id });
        const engagementScore = engagement.reduce((acc, e) => {
          let score = 0;
          if (e.liked) score += 3;
          if (e.shared) score += 5;
          if (e.downloaded) score += 2;
          if (e.applied) score += 10;
          return acc + score;
        }, 0);

        const maxEngagement = 60;
        const engagementPercent = Math.min(
          (engagementScore / maxEngagement) * 60,
          60
        );

        // 2️⃣ Payment bonus
        const payment = await Payment.findOne({
          jobId: job._id,
          status: "success",
        });
        const paymentBonus = payment ? 25 : 0;

        // 3️⃣ Recency bonus
        const daysSincePosted =
          (Date.now() - new Date(job.createdAt)) / (1000 * 60 * 60 * 24);
        const recencyBonus = Math.max(0, 15 - daysSincePosted);

        // 4️⃣ Final score (max 100)
        const finalScore = Math.min(
          Math.round(paymentBonus + engagementPercent + recencyBonus),
          100
        );
      
        // 5️⃣ Get profile from ProfileSettings based on postedBy userId
        const profile = await ProfileSettings.findOne(
          { userId: job.postedBy?._id },
          { userName: 1, profileAvatar: 1, modifyAvatar: 1 }
        ).lean();

        const userName =
          profile?.userName || job.postedBy?.name || "Unknown User";

        const profileAvatar =
          profile?.modifyAvatar ||
          profile?.profileAvatar ||
          "https://cdn-icons-png.flaticon.com/512/149/149071.png"; // default avatar
console.log({profileAvatar,userName})
        return {
          ...job,
          score: finalScore,
          isPaid: !!payment,
          engagementCount: engagement.length,
          userName,
          profileAvatar,
          image: job.image || "",
        };
      })
    );

    // 🔹 Sort jobs by Paid → Score → Date
    rankedJobs.sort((a, b) => {
      if (a.isPaid !== b.isPaid) return b.isPaid - a.isPaid;
      if (a.score !== b.score) return b.score - a.score;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // 🔹 Response
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
