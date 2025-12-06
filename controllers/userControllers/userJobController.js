const UserCurricluam =require("../../models/userModels/UserEductionSchema/userFullCuricluamSchema");
const JobPost =require('../../models/Job/JobPost/jobSchema');
const JobApplication=require("../../models/userModels/job/userJobApplication");
const User=require ("../../models/userModels/userModel");
const JobEngagement=require("../../models/Job/JobPost/jobEngagementSchema");


exports.applyForJob = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const jobId = req.body.jobId;

    console.log("APPLY JOB BODY:", req.body);

    if (!userId || !jobId) {
      return res.status(400).json({
        success: false,
        message: "userId and jobId are required",
      });
    }

    /* --------------------------------------------------
     * 0️⃣ Check User Curriculum
     * -------------------------------------------------- */
    const curriculum = await UserCurricluam.findOne({ userId }).lean();

    if (!curriculum) {
      return res.status(400).json({
        success: false,
        message: "Please complete your curriculum before applying for jobs.",
      });
    }

    const isCurriculumIncomplete =
      (!curriculum.education || curriculum.education.length === 0) &&
      (!curriculum.experience || curriculum.experience.length === 0) &&
      (!curriculum.skills || curriculum.skills.length === 0) &&
      (!curriculum.certifications || curriculum.certifications.length === 0) &&
      (!curriculum.projects || curriculum.projects.length === 0);

    if (isCurriculumIncomplete) {
      return res.status(400).json({
        success: false,
        message:
          "Your curriculum is incomplete. Please fill in education, skills, or upload your resume.",
      });
    }

    /* --------------------------------------------------
     * 1️⃣ Check if job exists
     * -------------------------------------------------- */
    const job = await JobPost.findById(jobId).lean();
    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    /* --------------------------------------------------
     * 2️⃣ Prevent duplicate application (STRICT)
     * -------------------------------------------------- */
    const existingApplication = await JobApplication.findOne({ userId, jobId });

    if (existingApplication) {
      return res.status(400).json({
        success: false,
        alreadyApplied: true,
        message: "You have already applied for this job.",
      });
    }

    /* --------------------------------------------------
     * 3️⃣ Fetch user snapshot
     * -------------------------------------------------- */
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const applicantInfo = {
      name: user.fullName || user.name,
      email: user.email,
      phone: user.phone,
    };

    /* --------------------------------------------------
     * 4️⃣ Create NEW application
     * -------------------------------------------------- */
    const application = await JobApplication.create({
      userId,
      jobId,
      companyId: job.companyId,
      status: "applied",
      resume: curriculum.resumeURL || null,
      coverLetter: req.body.coverLetter || "",
      portfolioLink: req.body.portfolioLink || "",
      githubLink: req.body.githubLink || "",
      linkedinProfile: req.body.linkedinProfile || "",
      applicantInfo,
      history: [
        {
          status: "applied",
          note: "Application submitted",
        },
      ],
    });

    /* --------------------------------------------------
     * 5️⃣ Save engagement → applied = true
     * -------------------------------------------------- */
    await JobEngagement.findOneAndUpdate(
      { userId, jobId },
      {
        $set: {
          applied: true,
          companyId: job.companyId,
          lastActionAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({
      success: true,
      message: "Job application submitted successfully",
      application,
    });

  } catch (error) {
    console.error("❌ APPLY JOB ERROR:", error);

    // Duplicate Key Error -> user already applied
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        alreadyApplied: true,
        message: "You have already applied for this job.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error applying for job",
      error: error.message,
    });
  }
};


