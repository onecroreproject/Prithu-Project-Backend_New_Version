/************************************************************************************************
 * JOB CONTROLLER — FULLY UPDATED FOR NEW SCHEMAS
 * Ultra-optimized: supports millions of job posts.
 * Company-based job posting system (NO USER POSTING)
 ************************************************************************************************/

const mongoose = require("mongoose");
const JobPost = require("../../models/Job/JobPost/jobSchema");
const JobEngagement = require("../../models/Job/JobPost/jobEngagementSchema");
const Payment = require("../../models/Job/JobPost/jobPaymentSchema");
const CompanyLogin = require("../../models/Job/CompanyModel/companyLoginSchema");
const CompanyProfile = require("../../models/Job/CompanyModel/companyProfile");
const {logCompanyActivity} =require("../../middlewares/services/JobsService/jobActivityLoogerFunction");
const {deleteLocalFile} = require("../../middlewares/services/JobsService/jobImageUploadSpydy.js");

exports.createOrUpdateJob = async (req, res) => {
  try {
    const companyId = req.companyId;
    const body = req.body || {};

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId missing" });
    }

    const jobId = body.jobId || body.id || null;

    /* --------------------------------------------------------
     * Get Company Snapshot
     * -------------------------------------------------------- */
    const company = await CompanyLogin.findById(companyId).lean();
    const profile = await CompanyProfile.findOne({ companyId }).lean();

    if (!company)
      return res.status(404).json({ success: false, message: "Company not found" });

    const companySnapshot = {
      companyId,
      companyName: company.companyName,
      companyLogo: profile?.logo || "",
      companyIndustry: profile?.businessCategory || "",
      companyWebsite: profile?.socialLinks?.website || "",
    };

    /* --------------------------------------------------------
     * Handle local job image upload
     * -------------------------------------------------------- */
    let jobImageUrl = null;

    if (req.file) {
      jobImageUrl = `${req.protocol}://${req.get("host")}/media/company/${companyId}/jobs/${req.savedJobFileName}`;
    }

    /* --------------------------------------------------------
     * Validate required fields only for ACTIVE jobs
     * -------------------------------------------------------- */
    const requiredFields = ["jobTitle", "employmentType", "workMode", "jobDescription"];

    if (!jobId && (body.status === "active" || !body.status)) {
      const missing = requiredFields.filter((f) => !body[f]);
      if (missing.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields for active job",
          fields: missing,
        });
      }
    }

    /* --------------------------------------------------------
     * Build job payload
     * -------------------------------------------------------- */
    const jobData = {
      ...companySnapshot,
      ...body,
      remoteEligibility:
        body.remoteEligibility === "true" || body.remoteEligibility === true,
      freshersAllowed:
        body.freshersAllowed === "true" || body.freshersAllowed === true,
      salaryMin: Number(body.salaryMin) || 0,
      salaryMax: Number(body.salaryMax) || 0,
      openingsCount: Number(body.openingsCount) || 1,
      minimumExperience: Number(body.minimumExperience) || 0,
      maximumExperience: Number(body.maximumExperience) || 0,
      status: body.status || "draft",
    };

    if (jobImageUrl) jobData.jobImage = jobImageUrl;

    /* --------------------------------------------------------
     * UPDATE JOB
     * -------------------------------------------------------- */
    if (jobId) {
      const existingJob = await JobPost.findOne({ _id: jobId, companyId });

      if (!existingJob)
        return res.status(404).json({ success: false, message: "Job not found" });

      // Delete old image if new one uploaded
      if (jobImageUrl && existingJob.jobImage) {
        const oldPath = path.join(
          __dirname,
          "../../../media/company",
          String(companyId),
          "jobs",
          path.basename(existingJob.jobImage)
        );
        deleteLocalFile(oldPath);
      }

      await JobPost.updateOne({ _id: jobId }, { $set: jobData });

      return res.status(200).json({
        success: true,
        message: "Job updated successfully",
        jobId,
      });
    }

    /* --------------------------------------------------------
     * CREATE JOB
     * -------------------------------------------------------- */
    const newJob = await JobPost.create(jobData);

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      job: newJob,
    });

  } catch (error) {
    console.error("❌ Error in createOrUpdateJob:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};





/* =============================================================================================
   2️⃣ GET ALL JOBS (Public + Search + Filters)
   ============================================================================================= */
exports.getAllJobs = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;

    const {
      jobCategory,
      jobRole,
      jobId,
      city,
      state,
      country,
      employmentType,
      workMode,
      keyword,
      search,
      tags,
      minExp,
      maxExp,
      minSalary,
      maxSalary,
      companyId,
      category,
      salaryRange,
      experience,
      location
    } = req.query;

    const q = keyword || search;

    /* -------------------------------------------
     * JOB ID FILTER (SINGLE JOB)
     * ------------------------------------------- */
    if (jobId) {
      const job = await JobPost.findOne({
        $or: [{ _id: jobId }, { jobId }],
        status: "active",
        isApproved: true
      })
        .populate("companyId", "companyName industry")
        .lean();

      if (!job) {
        return res.status(200).json({
          success: true,
          total: 0,
          jobs: []
        });
      }

      // 🔹 Fetch company logo
      const companyProfile = await CompanyProfile.findOne(
        { companyId: job.companyId?._id },
        { logo: 1 }
      ).lean();

      // 🔹 Engagement
      const engagementData = await JobEngagement.find({ jobId: job._id }).lean();

      const engagementStats = {
        likeCount: 0,
        shareCount: 0,
        saveCount: 0,
        applyCount: 0,
        viewCount: 0,
        isLiked: false,
        isSaved: false,
        isApplied: false,
        isViewed: false
      };

      engagementData.forEach(e => {
        if (e.liked) engagementStats.likeCount++;
        if (e.shared) engagementStats.shareCount++;
        if (e.saved) engagementStats.saveCount++;
        if (e.applied) engagementStats.applyCount++;
        if (e.view) engagementStats.viewCount++;

        if (e.userId?.toString() === userId?.toString()) {
          engagementStats.isLiked = e.liked;
          engagementStats.isSaved = e.saved;
          engagementStats.isApplied = e.applied;
          engagementStats.isViewed = e.view;
        }
      });

      return res.status(200).json({
        success: true,
        total: 1,
        jobs: [
          {
            ...job,
            companyId: job.companyId?._id,
            companyLogo: companyProfile?.logo || null,
            ...engagementStats
          }
        ]
      });
    }

    /* -------------------------------------------
     * BASE FILTER
     * ------------------------------------------- */
    const baseFilter = {
      status: "active",
      isApproved: true
    };

    if (companyId) {
      const ids = companyId.split(",");
      baseFilter.companyId = ids.length > 1 ? { $in: ids } : ids[0];
    }

    if (category && category !== "All") {
      baseFilter.jobCategory = new RegExp(category, "i");
    }

    if (experience) {
      const [minE, maxE] = experience.split("-").map(Number);
      baseFilter.$and = [
        { minimumExperience: { $gte: minE } },
        { maximumExperience: { $lte: maxE } }
      ];
    }

    if (salaryRange) {
      const [minS, maxS] = salaryRange.split("-").map(Number);
      baseFilter.$and = [
        ...(baseFilter.$and || []),
        { salaryMin: { $gte: minS } },
        { salaryMax: { $lte: maxS } }
      ];
    }

    const locationQuery = location || city;
    if (locationQuery) {
      baseFilter.$or = [
        { city: new RegExp(locationQuery, "i") },
        { state: new RegExp(locationQuery, "i") },
        { country: new RegExp(locationQuery, "i") }
      ];
    }

    if (state) baseFilter.state = new RegExp(`^${state}$`, "i");
    if (country) baseFilter.country = new RegExp(`^${country}$`, "i");

    if (employmentType) {
      const types = employmentType.split(",");
      baseFilter.employmentType = types.length > 1 ? { $in: types } : types[0];
    }

    if (workMode) {
      const modes = workMode.split(",");
      baseFilter.workMode = modes.length > 1 ? { $in: modes } : modes[0];
    }

    if (tags) baseFilter.tags = { $in: tags.split(",") };
    if (minExp) baseFilter.minimumExperience = { $gte: Number(minExp) };
    if (maxExp) baseFilter.maximumExperience = { $lte: Number(maxExp) };
    if (minSalary) baseFilter.salaryMin = { $gte: Number(minSalary) };
    if (maxSalary) baseFilter.salaryMax = { $lte: Number(maxSalary) };

    /* -------------------------------------------
     * FETCH JOBS
     * ------------------------------------------- */
    let jobs = [];

    if (q) {
      jobs = await JobPost.find({
        ...baseFilter,
        $text: { $search: q }
      })
        .populate("companyId", "companyName industry")
        .sort({ score: { $meta: "textScore" } })
        .lean();
    } else {
      jobs = await JobPost.find(baseFilter)
        .populate("companyId", "companyName industry")
        .sort({ isFeatured: -1, priorityScore: -1, createdAt: -1 })
        .lean();
    }

    /* -------------------------------------------
     * FETCH COMPANY LOGOS (ONE QUERY)
     * ------------------------------------------- */
    const companyIds = [
      ...new Set(jobs.map(j => j.companyId?._id?.toString()).filter(Boolean))
    ];

    const companyProfiles = await CompanyProfile.find(
      { companyId: { $in: companyIds } },
      { companyId: 1, logo: 1 }
    ).lean();

    const companyLogoMap = {};
    companyProfiles.forEach(cp => {
      companyLogoMap[cp.companyId.toString()] = cp.logo;
    });

    /* -------------------------------------------
     * ENGAGEMENT MERGE
     * ------------------------------------------- */
    const jobIds = jobs.map(j => j._id);
    const engagementData = await JobEngagement.find({ jobId: { $in: jobIds } }).lean();

    const engagementMap = {};
    jobIds.forEach(id => {
      engagementMap[id] = {
        likeCount: 0,
        shareCount: 0,
        saveCount: 0,
        applyCount: 0,
        viewCount: 0,
        isLiked: false,
        isSaved: false,
        isApplied: false,
        isViewed: false
      };
    });

    engagementData.forEach(e => {
      const job = engagementMap[e.jobId];
      if (!job) return;

      if (e.liked) job.likeCount++;
      if (e.shared) job.shareCount++;
      if (e.saved) job.saveCount++;
      if (e.applied) job.applyCount++;
      if (e.view) job.viewCount++;

      if (e.userId?.toString() === userId?.toString()) {
        job.isLiked = e.liked;
        job.isSaved = e.saved;
        job.isApplied = e.applied;
        job.isViewed = e.view;
      }
    });

    /* -------------------------------------------
     * FINAL RESPONSE
     * ------------------------------------------- */
    const finalJobs = jobs.map(job => ({
      ...job,
      companyId: job.companyId?._id,
      companyLogo: companyLogoMap[job.companyId?._id?.toString()] || null,
      ...engagementMap[job._id]
    }));

    return res.status(200).json({
      success: true,
      total: finalJobs.length,
      jobs: finalJobs
    });

  } catch (error) {
    console.error("GET ALL JOBS ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};









/* =============================================================================================
   3️⃣ GET JOB BY ID + Company Snapshot
   ============================================================================================= */
exports.getJobById = async (req, res) => {
  try {
    const jobId = req.params.id;
    const userId = req.Id;

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const jobObjectId = new mongoose.Types.ObjectId(jobId);

    const jobData = await JobPost.aggregate([
      /* --------------------------------------------------
       * 1️⃣ FILTER SPECIFIC JOB + ACTIVE + APPROVED
       * -------------------------------------------------- */
      {
        $match: {
          _id: jobObjectId,
          status: { $in: ["active", "expired"] },
          isApproved: true,
        },
      },

      /* --------------------------------------------------
       * ❌ REMOVED PAYMENT LOOKUP
       * -------------------------------------------------- */

      /* --------------------------------------------------
       * 2️⃣ JOIN ENGAGEMENT DATA
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "JobEngagement",
          localField: "_id",
          foreignField: "jobId",
          as: "engagementData",
        },
      },

      /* --------------------------------------------------
       * 3️⃣ GLOBAL COUNTS
       * -------------------------------------------------- */
      {
        $addFields: {
          likeCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.liked", true] },
              },
            },
          },
          shareCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.shared", true] },
              },
            },
          },
          saveCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.saved", true] },
              },
            },
          },
          applyCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.applied", true] },
              },
            },
          },
          viewCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.view", true] },
              },
            },
          },
        },
      },

      /* --------------------------------------------------
       * 4️⃣ CURRENT USER'S ENGAGEMENT
       * -------------------------------------------------- */
      {
        $addFields: {
          userEngagement: {
            $first: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.userId", userObjectId] },
              },
            },
          },
        },
      },

      /* --------------------------------------------------
       * 5️⃣ USER FLAGS
       * -------------------------------------------------- */
      {
        $addFields: {
          isLiked: { $ifNull: ["$userEngagement.liked", false] },
          isSaved: { $ifNull: ["$userEngagement.saved", false] },
          isApplied: { $ifNull: ["$userEngagement.applied", false] },
          isViewed: { $ifNull: ["$userEngagement.view", false] },
          isShared: { $ifNull: ["$userEngagement.shared", false] },
        },
      },

      /* --------------------------------------------------
       * ❌ REMOVED ENGAGEMENT SCORE
       * -------------------------------------------------- */

      /* --------------------------------------------------
       * 6️⃣ JOIN COMPANY LOGIN
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyLogin",
          localField: "companyId",
          foreignField: "_id",
          as: "companyLogin",
        },
      },
      { $unwind: "$companyLogin" },

      /* --------------------------------------------------
       * 7️⃣ JOIN COMPANY PROFILE
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfile",
          localField: "companyId",
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

      /* --------------------------------------------------
       * 8️⃣ FINAL PROJECTION (NO PAYMENT / NO SCORE)
       * -------------------------------------------------- */
      {
        $project: {
          jobId: "$_id",

          jobTitle: 1,
          jobRole: 1,
          jobCategory: 1,
          jobSubCategory: 1,
          employmentType: 1,
          workMode: 1,
          shiftType: 1,
          country: 1,
          state: 1,
          city: 1,
          salaryMin: 1,
          salaryMax: 1,
          salaryType: 1,
          jobDescription: 1,
          requiredSkills: 1,
          createdAt: 1,
          updatedAt: 1,
          status: 1,
          endDate: 1,

          /* Counts */
          likeCount: 1,
          shareCount: 1,
          saveCount: 1,
          applyCount: 1,
          viewCount: 1,

          /* User flags */
          isLiked: 1,
          isSaved: 1,
          isApplied: 1,
          isViewed: 1,
          isShared: 1,

          /* Company */
          companyId: 1,
          postedBy: {
            companyName: "$companyLogin.companyName",
            name: "$companyLogin.name",
            email: "$companyLogin.email",
            phone: "$companyLogin.phone",
            whatsAppNumber: "$companyLogin.whatsAppNumber",
            position: "$companyLogin.position",
          },

          companyProfile: 1,
        },
      },
    ]);

    if (!jobData || jobData.length === 0) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    return res.status(200).json({
      success: true,
      job: jobData[0],
    });

  } catch (error) {
    console.error("❌ GET JOB BY ID ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



/* =============================================================================================
   4️⃣ DELETE JOB
   ============================================================================================= */
exports.deleteJobs = async (req, res) => {
  try {
    const companyId = req.companyId;
    const jobId = req.params.jobId;

    const job = await JobPost.findOne({ _id: jobId, companyId });

    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    // Delete job image
    if (job.jobImage) {
      const imgPath = path.join(
        __dirname,
        "../../../media/company",
        String(companyId),
        "jobs",
        path.basename(job.jobImage)
      );
      deleteLocalFile(imgPath);
    }

    await JobPost.deleteOne({ _id: jobId });

    res.json({
      success: true,
      message: "Job deleted successfully",
      jobId,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


/* =============================================================================================
   5️⃣ GET ALL JOBS BY COMPANY (Dashboard)
   ============================================================================================= */
exports.getJobsByCompany = async (req, res) => {
  try {
    const companyId = req.companyId;

    // 1️⃣ Fetch all jobs of this company
    const jobs = await JobPost.find({ companyId })
      .sort({ createdAt: -1 })
      .lean();

    if (!jobs.length) {
      return res.status(404).json({
        success: false,
        message: "No jobs found for this company",
      });
    }

    /* --------------------------------------------------
     * 2️⃣ FETCH ALL ENGAGEMENTS FOR THESE JOBS
     * -------------------------------------------------- */
    const jobIds = jobs.map((j) => j._id);

    const engagements = await JobEngagement.find({
      jobId: { $in: jobIds },
    }).lean();

    /* --------------------------------------------------
     * 3️⃣ BUILD ENGAGEMENT COUNT MAP
     * -------------------------------------------------- */
    const engagementMap = {};

    jobIds.forEach((id) => {
      engagementMap[id] = {
        likeCount: 0,
        shareCount: 0,
        saveCount: 0,
        applyCount: 0,
        viewCount: 0,
      };
    });

    engagements.forEach((e) => {
      const item = engagementMap[e.jobId];
      if (!item) return;

      if (e.liked) item.likeCount++;
      if (e.shared) item.shareCount++;
      if (e.saved) item.saveCount++;
      if (e.applied) item.applyCount++;
      if (e.view) item.viewCount++;
    });

    /* --------------------------------------------------
     * 4️⃣ MERGE COUNTS INTO EACH JOB
     * -------------------------------------------------- */
    const final = jobs.map((job) => ({
      ...job,
      ...engagementMap[job._id], // merge counts only
    }));

    /* --------------------------------------------------
     * 5️⃣ RESPONSE
     * -------------------------------------------------- */
    return res.status(200).json({
      success: true,
      total: final.length,
      jobs: final,
    });

  } catch (error) {
    console.error("GET JOBS BY COMPANY ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};







exports.getTopRankedJobs = async (req, res) => {
  try {
    const userId = req.Id;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const jobs = await JobPost.aggregate([
      /* --------------------------------------------------
       * 1️⃣ FILTER ACTIVE + APPROVED JOBS
       * -------------------------------------------------- */
      {
        $match: {
          status: "active",
          isApproved: true
        }
      },

      /* --------------------------------------------------
       * 2️⃣ JOIN PAYMENT DETAILS
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "JobPostPayment",
          localField: "_id",
          foreignField: "jobId",
          as: "paymentInfo"
        }
      },
      {
        $addFields: {
          paymentAmount: { $ifNull: [{ $max: "$paymentInfo.amount" }, 0] },
          boostLevel: {
            $ifNull: [{ $max: "$paymentInfo.meta.boostLevel" }, 0]
          }
        }
      },

      /* --------------------------------------------------
       * 3️⃣ JOIN ENGAGEMENT DATA
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "JobEngagement",
          localField: "_id",
          foreignField: "jobId",
          as: "engagementData"
        }
      },

      /* --------------------------------------------------
       * 4️⃣ COMPUTE GLOBAL COUNTS
       * -------------------------------------------------- */
      {
        $addFields: {
          likeCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.liked", true] }
              }
            }
          },

          shareCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.shared", true] }
              }
            }
          },

          saveCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.saved", true] }
              }
            }
          },

          applyCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.applied", true] }
              }
            }
          },

          viewCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.view", true] }
              }
            }
          }
        }
      },

      /* --------------------------------------------------
       * 5️⃣ CURRENT USER ENGAGEMENT
       * -------------------------------------------------- */
      {
        $addFields: {
          userEngagement: {
            $first: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.userId", userObjectId] }
              }
            }
          }
        }
      },

      /* --------------------------------------------------
       * 6️⃣ USER FLAGS
       * -------------------------------------------------- */
      {
        $addFields: {
          isLiked: { $ifNull: ["$userEngagement.liked", false] },
          isSaved: { $ifNull: ["$userEngagement.saved", false] },
          isApplied: { $ifNull: ["$userEngagement.applied", false] },
          isViewed: { $ifNull: ["$userEngagement.view", false] },
          isShared: { $ifNull: ["$userEngagement.shared", false] }
        }
      },

      /* --------------------------------------------------
       * 7️⃣ ENGAGEMENT SCORE
       * -------------------------------------------------- */
      {
        $addFields: {
          engagementScore: {
            $add: [
              "$likeCount",
              { $multiply: ["$shareCount", 2] },
              { $multiply: ["$saveCount", 3] },
              { $multiply: ["$applyCount", 5] }
            ]
          }
        }
      },

      /* --------------------------------------------------
       * 8️⃣ JOIN COMPANY LOGIN
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyLogin",
          localField: "companyId",
          foreignField: "_id",
          as: "companyLogin"
        }
      },
      { $unwind: "$companyLogin" },

      /* --------------------------------------------------
       * 9️⃣ JOIN COMPANY PROFILE
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfile",
          localField: "companyId",
          foreignField: "companyId",
          as: "companyProfile"
        }
      },
      {
        $unwind: {
          path: "$companyProfile",
          preserveNullAndEmptyArrays: true
        }
      },

      /* --------------------------------------------------
       * 🔟 JOIN VISIBILITY SETTINGS
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfileVisibility",
          localField: "companyId",
          foreignField: "companyId",
          as: "visibilitySettings"
        }
      },
      {
        $unwind: {
          path: "$visibilitySettings",
          preserveNullAndEmptyArrays: true
        }
      },

      /* --------------------------------------------------
       * 1️⃣1️⃣ SORT BY PERFORMANCE + PROMOTION
       * -------------------------------------------------- */
      {
        $sort: {
          paymentAmount: -1,
          boostLevel: -1,
          engagementScore: -1,
          createdAt: -1
        }
      },

      /* --------------------------------------------------
       * 1️⃣2️⃣ FINAL PROJECTION
       * -------------------------------------------------- */
      {
        $project: {
          jobId: "$_id",

          /* Job fields */
          jobTitle: 1,
          jobRole: 1,
          jobCategory: 1,
          jobSubCategory: 1,
          employmentType: 1,
          workMode: 1,
          shiftType: 1,
          city: 1,
          state: 1,
          country: 1,
          salaryMin: 1,
          salaryMax: 1,
          salaryType: 1,
          jobDescription: 1,
          requiredSkills: 1,
          createdAt: 1,
          endDate: 1,

          /* Counts */
          likeCount: 1,
          shareCount: 1,
          saveCount: 1,
          applyCount: 1,
          viewCount: 1,

          /* User flags */
          isLiked: 1,
          isSaved: 1,
          isApplied: 1,
          isViewed: 1,
          isShared: 1,

          /* Ranking */
          paymentAmount: 1,
          boostLevel: 1,
          engagementScore: 1,

          /* Company */
          companyId: 1,
          postedBy: {
            companyName: "$companyLogin.companyName",
            name: "$companyLogin.name",
            email: "$companyLogin.email",
            phone: "$companyLogin.phone",
            whatsAppNumber: "$companyLogin.whatsAppNumber",
            position: "$companyLogin.position"
          },

          companyProfile: 1,
          visibilitySettings: 1
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      total: jobs.length,
      jobs
    });

  } catch (error) {
    console.error("❌ TOP RANKED JOB ERROR:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};




