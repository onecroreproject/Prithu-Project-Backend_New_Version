const JobPost = require("../../models/JobPost/jobSchema");
const mongoose =require("mongoose");
const ProfileSettings = require("../../models/profileSettingModel");
const JobEngagement=require("../../models/JobPost/jobEngagementSchema");
const Payment =require("../../models/JobPost/jobPaymentSchema");

exports.createJobPost = async (req, res) => {
  try {
    const userId = req.Id;
    const {
      jobId, // 👈 optional, comes from frontend when editing a draft
      title,
      exprience,
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
      image,
      tags,
      status,
    } = req.body;

    const jobStatus = status || "draft";

    // 🧩 Normalize tags (capitalize first letter)
    let formattedTags = [];
    if (tags && Array.isArray(tags)) {
      formattedTags = tags.map(
        (tag) => tag.charAt(0).toUpperCase() + tag.slice(1).toLowerCase()
      );
    }

    // 🟡 Validation before publishing
    if (jobStatus === "active" || jobStatus === "publish") {
      if (
        !title ||
        !description ||
        !companyName ||
        !location ||
        !category ||
        !startDate ||
        !endDate ||
        !exprience
      ) {
        return res.status(400).json({
          message: "All required fields must be filled before publishing the job.",
        });
      }
    }

    // 🧠 CASE 1: If jobId exists and status is draft → update the draft
    if (jobId && jobStatus === "draft") {
      const existingJob = await JobPost.findOne({ _id: jobId, postedBy: userId });

      if (!existingJob) {
        return res.status(404).json({ message: "Draft job not found." });
      }

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
      existingJob.image = image || existingJob.image;
      existingJob.exprience = exprience || existingJob.exprience;
      existingJob.tags = formattedTags.length ? formattedTags : existingJob.tags;
      existingJob.status = "draft";
      existingJob.priorityScore = isPaid ? 10 : 1;

      await existingJob.save();

      return res.status(200).json({
        message: "Draft job updated successfully.",
        job: existingJob,
      });
    }

    // 🧠 CASE 2: If no jobId but status is draft → create a new draft
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
        image,
        exprience,
        tags: formattedTags,
        status: "draft",
        priorityScore: isPaid ? 10 : 1,
      });

      return res.status(201).json({
        message: "Job draft created successfully.",
        job: draftJob,
      });
    }

    // 🧠 CASE 3: If status is publish → create new published job
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
        exprience,
        isPaid: isPaid || false,
        image,
        tags: formattedTags,
        status: "active", // published = active
        priorityScore: isPaid ? 10 : 1,
      });

      return res.status(201).json({
        message: "Job published successfully.",
        job: publishedJob,
      });
    }

    // 🧩 Fallback (should not reach here)
    return res.status(400).json({ message: "Invalid job status or request data." });
  } catch (error) {
    console.error("❌ Error creating/updating job post:", error);
    res.status(500).json({ message: "Server error", error });
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
    const filter = { isApproved: true};

    if (category) filter.category = category;
    if (location) filter.location = location;
    if (isPaid) filter.isPaid = isPaid === "true";
    if (language) filter.language = language;
    if (jobType) filter.jobType = jobType;
    if(exprience)filter.exprience=exprience;
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
    const job = await JobPost.findById(req.params.id).populate("postedBy", "name email");
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (error) {
    console.error("Error fetching job:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ Auto deactivate expired jobs (can also be run by CRON)
exports.deactivateExpiredJobs = async () => {
  const now = new Date();
  await JobPost.updateMany(
    { endDate: { $lt: now }, status: "active" },
    { $set: { status: "expired" } }
  );
  console.log("✅ Expired jobs deactivated");
};




exports.getJobsByUserId = async (req, res) => {
  try {
    const  userId  = req.Id;

    // ✅ Validate userId format
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // ⚙️ Automatically mark expired jobs for this user
    await JobPost.updateMany(
      {
        postedBy: userId,
        endDate: { $lt: new Date() },
        status: { $ne: "expired" },
      },
      { $set: { status: "expired" } }
    );

    // 🧩 Fetch jobs posted by this user
    const jobs = await JobPost.find({ postedBy: userId })
      .sort({ createdAt: -1 })
      .populate("postedBy", "name email");

    if (!jobs || jobs.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No jobs found for this user",
      });
    }

    // 🧠 Calculate engagement score for each job before sending
    const updatedJobs = jobs.map((job) => {
      const { stats } = job;
      const engagementScore =
        (stats.views || 0) +
        (stats.likes || 0) * 2 +
        (stats.shares || 0) * 3 +
        (stats.appliedCount || 0) * 5;

      return {
        ...job.toObject(),
        stats: { ...stats, engagementScore },
      };
    });

    // ✅ Send response
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

    // 🔍 Validate jobId
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid job ID.",
      });
    }

    // Find the job
    const job = await JobPost.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found.",
      });
    }

    // Check permission (user can delete only their own jobs)
    if (job.postedBy.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized — You can only delete your own job posts.",
      });
    }

    // Delete job
    await JobPost.findByIdAndDelete(jobId);

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully.",
      deletedJobId: jobId,
    });
  } catch (error) {
    console.error("❌ Error deleting job:", error);
    res.status(500).json({
      success: false,
      message: "Server error while deleting job.",
      error: error.message,
    });
  }
};






exports.getRankedJobs = async (req, res) => {
  try {
    // Step 1: Fetch all active jobs
    const jobs = await JobPost.find({ status: "active", isApproved: true })
      .populate("postedBy", "name email")
      .lean();

    if (!jobs.length) {
      return res.status(404).json({ success: false, message: "No active jobs found" });
    }

    // Step 2: For each job, calculate engagement and payment priority
    const rankedJobs = await Promise.all(
      jobs.map(async (job) => {
        // Fetch engagement data
        const engagement = await JobEngagement.find({ jobId: job._id });

        // Calculate engagement stats
        const engagementScore = engagement.reduce((acc, e) => {
          let score = 0;
          if (e.liked) score += 3;
          if (e.shared) score += 5;
          if (e.downloaded) score += 2;
          if (e.applied) score += 10;
          return acc + score;
        }, 0);

        // Normalize engagement score (0–60 max)
        const maxEngagement = 60;
        const engagementPercent = Math.min((engagementScore / maxEngagement) * 60, 60);

        // Check if job is paid
        const payment = await Payment.findOne({ jobId: job._id, status: "success" });
        const paymentBonus = payment ? 25 : 0;

        // Recency bonus (based on createdAt)
        const daysSincePosted = (Date.now() - new Date(job.createdAt)) / (1000 * 60 * 60 * 24);
        const recencyBonus = Math.max(0, 15 - daysSincePosted); // up to 15 points for recent posts

        // Final Score (1–100)
        const finalScore = Math.min(
          Math.round(paymentBonus + engagementPercent + recencyBonus),
          100
        );
       
        return {
          ...job,
          score: finalScore,
          isPaid: !!payment,
          engagementCount: engagement.length,
        };
      })
    );

    // Step 3: Sort jobs — first by paid, then by score desc, then by posting date
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
  } catch (err) {
    console.error("Error fetching ranked jobs:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
