const UserCurricluam =require("../../models/userModels/UserEductionSchema/userFullCuricluamSchema");
const JobPost =require('../../models/Job/JobPost/jobSchema');
const JobApplication=require("../../models/userModels/job/userJobApplication");
const User=require ("../../models/userModels/userModel");
const JobEngagement=require("../../models/Job/JobPost/jobEngagementSchema");
const {sendTemplateEmail}=require("../../utils/templateMailer");
const JobDb=require("../../database");
const mongoose = require("mongoose");



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


    /* --------------------------------------------------
 * 6️⃣ Send Application Confirmation Mail
 * -------------------------------------------------- */
try {
  if (user?.email) {
    await sendTemplateEmail({
      templateName: "applicationApplied.html",
      to: user.email,
      subject: `Application Submitted – ${job.jobTitle}`,
      embedLogo: true,
      placeholders: {
        firstName: user.fullName || user.name || "Candidate",
        jobTitle: job.jobTitle,
        companyName: job.companyName || "Company",
        appliedDate: new Date().toLocaleDateString(),
        dashboardUrl: "https://www.prithu.app/jobs/applied",
      },
    });
  }
} catch (mailErr) {
  // ❗ Do NOT fail application if mail fails
  console.error("⚠️ Application mail failed:", mailErr.message);
}

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








exports.getAppliedJobsByUser = async (req, res) => {
  try {
    const userId = req.userId || req.Id;
    const { search } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const searchRegex = search ? new RegExp(search.trim(), "i") : null;

    const pipeline = [
      /* -------------------------------------------------
       * 1️⃣ USER FILTER
       * ------------------------------------------------- */
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
        },
      },

      /* -------------------------------------------------
       * 2️⃣ JOB POST JOIN
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "JobPost",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },

      /* -------------------------------------------------
       * 3️⃣ SEARCH FILTER
       * ------------------------------------------------- */
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { "job.jobTitle": searchRegex },
                  { "job.companyName": searchRegex },
                  { "job.city": searchRegex },
                  { "job.employmentType": searchRegex },
                  { "job.requiredSkills": searchRegex },
                ],
              },
            },
          ]
        : []),

      /* -------------------------------------------------
       * 4️⃣ TOTAL APPLICATIONS (FROM JobEngagement)
       * ------------------------------------------------- */
      {
  $lookup: {
    from: "JobEngagement",
    let: { jobId: "$job._id" },
    pipeline: [
      {
        $match: {
          $expr: {
            $and: [
              { $eq: ["$jobId", "$$jobId"] },
              { $eq: ["$applied", true] },
            ],
          },
        },
      },
      {
        $count: "count",
      },
    ],
    as: "jobApplications",
  },
},

      /* -------------------------------------------------
       * 5️⃣ COMPANY PROFILE JOIN
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfile",
          localField: "job.companyId",
          foreignField: "companyId",
          as: "companyProfile",
        },
      },
      {
        $unwind: {
          path: "$companyProfile",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* -------------------------------------------------
       * 6️⃣ COMPANY VISIBILITY JOIN
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfileVisibility",
          localField: "job.companyId",
          foreignField: "companyId",
          as: "visibility",
        },
      },
      {
        $unwind: {
          path: "$visibility",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* -------------------------------------------------
       * 7️⃣ HR JOIN
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyLogin",
          localField: "job.companyId",
          foreignField: "_id",
          as: "hr",
        },
      },
      {
        $unwind: {
          path: "$hr",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* -------------------------------------------------
       * 8️⃣ SORT (RECENT FIRST)
       * ------------------------------------------------- */
      {
        $sort: { createdAt: -1 },
      },

      /* -------------------------------------------------
       * 9️⃣ FINAL RESPONSE
       * ------------------------------------------------- */
      {
        $project: {
          _id: 0,

          /* ---------- APPLICATION ---------- */
          applicationId: "$_id",
          status: "$status",
          appliedAt: "$createdAt",

          /* ---------- JOB ---------- */
          job: {
            jobId: "$job._id",
            title: "$job.jobTitle",
            employmentType: "$job.employmentType",
            workMode: "$job.workMode",
            jobRole: "$job.jobRole",
            shiftType: "$job.shiftType",
            jobEndDate:"$job.endDate",
            jobStartDate:"$job.startDate",
            urgencyLevel: "$job.urgencyLevel",
            jobDescription: "$job.jobDescription",
            requiredSkills: "$job.requiredSkills",
            qualifications: "$job.qualifications",

            salary: {
              type: "$job.salaryType",
              min: "$job.salaryMin",
              max: "$job.salaryMax",
              currency: "$job.salaryCurrency",
            },

            experience: {
              min: "$job.minimumExperience",
              max: "$job.maximumExperience",
              freshersAllowed: "$job.freshersAllowed",
            },

            jobImage: "$job.jobImage",
            postedAt: "$job.createdAt",

            /* ✅ TOTAL APPLICATIONS */
           totalApplications: {
  $ifNull: [
    { $arrayElemAt: ["$jobApplications.count", 0] },
    0,
  ],
},
          },

          /* ---------- LOCATION ---------- */
          location: {
            country: "$job.country",
            state: "$job.state",
            city: "$job.city",
            area: "$job.area",
            remoteEligibility: "$job.remoteEligibility",
          },

          /* ---------- COMPANY ---------- */
          company: {
            companyId: "$job.companyId",
            name: "$job.companyName",
            logo: {
              $cond: [
                { $eq: ["$visibility.logo", "public"] },
                "$companyProfile.logo",
                null,
              ],
            },
            description: {
              $cond: [
                { $eq: ["$visibility.description", "public"] },
                "$companyProfile.description",
                null,
              ],
            },
            city: {
              $cond: [
                { $eq: ["$visibility.city", "public"] },
                "$companyProfile.city",
                null,
              ],
            },
            state: {
              $cond: [
                { $eq: ["$visibility.state", "public"] },
                "$companyProfile.state",
                null,
              ],
            },
            country: {
              $cond: [
                { $eq: ["$visibility.country", "public"] },
                "$companyProfile.country",
                null,
              ],
            },
            businessCategory: "$companyProfile.businessCategory",
          },

          /* ---------- HR ---------- */
          hr: {
            name: "$hr.name",
            position: "$hr.position",
            profileAvatar: "$hr.profileAvatar",
          },
        },
      },
    ];

    const jobs = await JobApplication.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("❌ GET APPLIED JOBS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch applied jobs",
    });
  }
};







exports.getSavedJobsByUser = async (req, res) => {
  try {
    const userId = req.userId || req.Id;
    const { search } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const searchRegex = search ? new RegExp(search.trim(), "i") : null;

    const pipeline = [
      /* -------------------------------------------------
       * 1️⃣ USER + SAVED FILTER
       * ------------------------------------------------- */
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          saved: true,
        },
      },

      /* -------------------------------------------------
       * 2️⃣ JOB POST JOIN
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "JobPost",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },

      /* -------------------------------------------------
       * 3️⃣ SEARCH FILTER
       * ------------------------------------------------- */
      ...(searchRegex
        ? [
            {
              $match: {
                $or: [
                  { "job.jobTitle": searchRegex },
                  { "job.companyName": searchRegex },
                  { "job.city": searchRegex },
                  { "job.employmentType": searchRegex },
                  { "job.requiredSkills": searchRegex },
                ],
              },
            },
          ]
        : []),

      /* -------------------------------------------------
       * 4️⃣ TOTAL APPLICATIONS (FROM JobEngagement)
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "JobEngagement",
          let: { jobId: "$job._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$jobId", "$$jobId"] },
                    { $eq: ["$applied", true] },
                  ],
                },
              },
            },
            { $project: { _id: 1 } },
          ],
          as: "jobApplications",
        },
      },

      /* -------------------------------------------------
       * 5️⃣ COMPANY PROFILE JOIN
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfile",
          localField: "job.companyId",
          foreignField: "companyId",
          as: "companyProfile",
        },
      },
      {
        $unwind: {
          path: "$companyProfile",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* -------------------------------------------------
       * 6️⃣ COMPANY VISIBILITY JOIN
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfileVisibility",
          localField: "job.companyId",
          foreignField: "companyId",
          as: "visibility",
        },
      },
      {
        $unwind: {
          path: "$visibility",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* -------------------------------------------------
       * 7️⃣ HR JOIN
       * ------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyLogin",
          localField: "job.companyId",
          foreignField: "_id",
          as: "hr",
        },
      },
      {
        $unwind: {
          path: "$hr",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* -------------------------------------------------
       * 8️⃣ SORT (RECENTLY SAVED)
       * ------------------------------------------------- */
      {
        $sort: { updatedAt: -1 },
      },

      /* -------------------------------------------------
       * 9️⃣ FINAL RESPONSE
       * ------------------------------------------------- */
      {
        $project: {
          _id: 0,

          /* ---------- SAVED META ---------- */
          savedAt: "$updatedAt",

          /* ---------- JOB ---------- */
          job: {
            jobId: "$job._id",
            title: "$job.jobTitle",
            employmentType: "$job.employmentType",
            workMode: "$job.workMode",
            jobRole: "$job.jobRole",
            shiftType: "$job.shiftType",
            urgencyLevel: "$job.urgencyLevel",
            jobDescription: "$job.jobDescription",
            requiredSkills: "$job.requiredSkills",
            qualifications: "$job.qualifications",

            salary: {
              type: "$job.salaryType",
              min: "$job.salaryMin",
              max: "$job.salaryMax",
              currency: "$job.salaryCurrency",
            },

            experience: {
              min: "$job.minimumExperience",
              max: "$job.maximumExperience",
              freshersAllowed: "$job.freshersAllowed",
            },

            jobImage: "$job.jobImage",
            postedAt: "$job.createdAt",

            /* ✅ TOTAL APPLICATIONS */
            totalApplications: {
              $size: "$jobApplications",
            },
          },

          /* ---------- LOCATION ---------- */
          location: {
            country: "$job.country",
            state: "$job.state",
            city: "$job.city",
            area: "$job.area",
            remoteEligibility: "$job.remoteEligibility",
          },

          /* ---------- COMPANY ---------- */
          company: {
            companyId: "$job.companyId",
            name: "$job.companyName",
            logo: {
              $cond: [
                { $eq: ["$visibility.logo", "public"] },
                "$companyProfile.logo",
                null,
              ],
            },
            description: {
              $cond: [
                { $eq: ["$visibility.description", "public"] },
                "$companyProfile.description",
                null,
              ],
            },
            city: {
              $cond: [
                { $eq: ["$visibility.city", "public"] },
                "$companyProfile.city",
                null,
              ],
            },
            state: {
              $cond: [
                { $eq: ["$visibility.state", "public"] },
                "$companyProfile.state",
                null,
              ],
            },
            country: {
              $cond: [
                { $eq: ["$visibility.country", "public"] },
                "$companyProfile.country",
                null,
              ],
            },
            businessCategory: "$companyProfile.businessCategory",
          },

          /* ---------- HR ---------- */
          hr: {
            name: "$hr.name",
            position: "$hr.position",
            profileAvatar: "$hr.profileAvatar",
          },
        },
      },
    ];

    const jobs = await JobEngagement.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("❌ GET SAVED JOBS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch saved jobs",
    });
  }
};


