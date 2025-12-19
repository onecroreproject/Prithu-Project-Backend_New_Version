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
const { upsertJobGeo, removeJobGeo } = require("../../middlewares/helper/jobGeo.js");




exports.createOrUpdateJob = async (req, res) => {
  try {
    const companyId = req.companyId;
    const body = req.body || {};

    if (!companyId) {
      return res.status(400).json({ success: false, message: "companyId missing" });
    }

    const jobId = body.id || body.jobId || null;
    const incomingStatus = body.status || "draft"; // draft | submit | active

    /* --------------------------------------------------------
     * 1️⃣ FETCH COMPANY
     * -------------------------------------------------------- */
    const company = await CompanyLogin.findById(companyId).lean();
    const profile = await CompanyProfile.findOne({ companyId }).lean();

    if (!company) {
      return res.status(404).json({ success: false, message: "Company not found" });
    }

    /* --------------------------------------------------------
     * 2️⃣ RESOLVE GOOGLE LOCATION
     * -------------------------------------------------------- */
    let googleLocation = null;

    if (body.googleLocation?.coordinates?.length === 2) {
      googleLocation = {
        type: "Point",
        coordinates: body.googleLocation.coordinates.map(Number),
      };
    } else if (
      profile?.googleLocation?.coordinates?.length === 2 &&
      profile.googleLocation.coordinates.some(v => v !== 0)
    ) {
      googleLocation = profile.googleLocation;
    }

    /* --------------------------------------------------------
     * 3️⃣ BUILD JOB PAYLOAD
     * -------------------------------------------------------- */
    const jobData = {
      companyId,
      companyName: company.companyName,
      companyLogo: profile?.logo || "",
      companyIndustry: profile?.businessCategory || "",
      companyWebsite: profile?.socialLinks?.website || "",

      ...body,
      ...(googleLocation && { googleLocation }),

      remoteEligibility: body.remoteEligibility === true || body.remoteEligibility === "true",
      freshersAllowed: body.freshersAllowed === true || body.freshersAllowed === "true",

      salaryMin: Number(body.salaryMin) || 0,
      salaryMax: Number(body.salaryMax) || 0,
      openingsCount: Number(body.openingsCount) || 1,
      minimumExperience: Number(body.minimumExperience) || 0,
      maximumExperience: Number(body.maximumExperience) || 0,

      status: incomingStatus,
    };

    if (req.file) {
      jobData.jobImage = `https://${req.get("host")}/media/company/${companyId}/jobs/${req.savedJobFileName}`;
    }

    /* --------------------------------------------------------
     * 4️⃣ UPDATE (ID PRESENT)
     * -------------------------------------------------------- */
    if (jobId) {
      const existingJob = await JobPost.findOne({ _id: jobId, companyId });
      if (!existingJob) {
        return res.status(404).json({ success: false, message: "Job not found" });
      }

      await JobPost.updateOne({ _id: jobId }, { $set: jobData });

      if (googleLocation?.coordinates?.length === 2) {
        await upsertJobGeo(jobId, googleLocation.coordinates);
      } else {
        await removeJobGeo(jobId);
      }

      return res.status(200).json({
        success: true,
        message: "Job updated successfully",
        jobId,
      });
    }

    /* --------------------------------------------------------
     * 5️⃣ CREATE (NO ID)
     * -------------------------------------------------------- */
    const newJob = await JobPost.create(jobData);

    if (googleLocation?.coordinates?.length === 2) {
      await upsertJobGeo(newJob._id, googleLocation.coordinates);
    }

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      job: newJob,
    });

  } catch (error) {
    console.error("❌ createOrUpdateJob error:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
};














/* =============================================================================================
   2️⃣ GET ALL JOBS (Public + Search + Filters)
   ============================================================================================= */
exports.getAllJobs = async (req, res) => {
  try {
    const userId = req.Id || req.body?.userId;

    const {
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
      location,
      lat,
      lng,
      radius
    } = req.query;

    const q = keyword || search;
    const geoEnabled = lat && lng;

    /* ---------------------------------------------------
     * 1️⃣ SINGLE JOB FETCH
     * --------------------------------------------------- */
    if (jobId) {
      const job = await JobPost.findOne({
        $or: [{ _id: jobId }, { jobId }],
        status: "active",
        $or: [
          { isApproved: true },
          { isApproved: { $exists: false } }
        ]
      })
        .populate("companyId", "companyName industry")
        .lean();

      if (!job) {
        return res.status(200).json({ success: true, total: 0, jobs: [] });
      }

      return res.status(200).json({
        success: true,
        total: 1,
        jobs: [job]
      });
    }

    /* ---------------------------------------------------
     * 2️⃣ BASE FILTER (NON-GEO)
     * --------------------------------------------------- */
    const baseFilter = {
      status: "active",
      $or: [
        { isApproved: true },
        { isApproved: { $exists: false } }
      ]
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
        ...(baseFilter.$and || []),
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

    /* ---------------------------------------------------
     * 3️⃣ LOCATION TEXT FILTER (ONLY IF NO GEO)
     * --------------------------------------------------- */
    const locationQuery = location || city;

    if (locationQuery && !geoEnabled) {
      baseFilter.$and = [
        ...(baseFilter.$and || []),
        {
          $or: [
            { city: new RegExp(locationQuery, "i") },
            { state: new RegExp(locationQuery, "i") },
            { country: new RegExp(locationQuery, "i") }
          ]
        }
      ];
    }

    if (state && !geoEnabled) baseFilter.state = new RegExp(`^${state}$`, "i");
    if (country && !geoEnabled) baseFilter.country = new RegExp(`^${country}$`, "i");

    /* ---------------------------------------------------
     * 4️⃣ FETCH JOBS
     * --------------------------------------------------- */
    let jobs = [];

    // ✅ GEO SEARCH (PRIORITY)
    if (geoEnabled) {
      jobs = await JobPost.aggregate([
        {
          $geoNear: {
            near: {
              type: "Point",
              coordinates: [Number(lng), Number(lat)]
            },
            distanceField: "distance",
            maxDistance: (Number(radius) || 10) * 1000,
            spherical: true,
            query: {
              status: "active",
              $or: [
                { isApproved: true },
                { isApproved: { $exists: false } }
              ]
            }
          }
        },
        { $sort: { isFeatured: -1, priorityScore: -1, createdAt: -1 } }
      ]);
    }

    // 🔍 TEXT SEARCH
    else if (q) {
      jobs = await JobPost.find({
        ...baseFilter,
        $text: { $search: q }
      })
        .populate("companyId", "companyName industry")
        .sort({ score: { $meta: "textScore" } })
        .lean();
    }

    // 📄 NORMAL FETCH
    else {
      jobs = await JobPost.find(baseFilter)
        .populate("companyId", "companyName industry")
        .sort({ isFeatured: -1, priorityScore: -1, createdAt: -1 })
        .lean();
    }

    /* ---------------------------------------------------
     * 5️⃣ COMPANY LOGOS
     * --------------------------------------------------- */
    const companyIds = [
      ...new Set(
        jobs
          .map(j =>
            typeof j.companyId === "object"
              ? j.companyId?._id?.toString()
              : j.companyId?.toString()
          )
          .filter(Boolean)
      )
    ];

    const companyProfiles = await CompanyProfile.find(
      { companyId: { $in: companyIds } },
      { companyId: 1, logo: 1 }
    ).lean();

    const companyLogoMap = {};
    companyProfiles.forEach(cp => {
      companyLogoMap[cp.companyId.toString()] = cp.logo;
    });

    /* ---------------------------------------------------
     * 6️⃣ ENGAGEMENT
     * --------------------------------------------------- */
    const jobIds = jobs.map(j => j._id);
    const engagementData = await JobEngagement.find({
      jobId: { $in: jobIds }
    }).lean();

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

    /* ---------------------------------------------------
     * 7️⃣ FINAL RESPONSE
     * --------------------------------------------------- */
    const finalJobs = jobs.map(job => {
      const cid =
        typeof job.companyId === "object"
          ? job.companyId?._id?.toString()
          : job.companyId?.toString();

      return {
        ...job,
        companyLogo: companyLogoMap[cid] || null,
        ...engagementMap[job._id]
      };
    });

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




