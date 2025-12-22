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
const {deleteLocalFile} = require("../../middlewares/services/jobImageUploadSpydy.js");
const { upsertJobGeo, removeJobGeo } = require("../../middlewares/helper/jobGeo.js");


exports.createOrUpdateJob = async (req, res) => {
  try {
    const companyId = req.companyId;
    const body = req.body || {};

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId missing",
      });
    }

    /* --------------------------------------------------------
     * 🛡️ HELPERS (CRITICAL FOR multipart/form-data)
     * -------------------------------------------------------- */
    const safeValue = (val) =>
      Array.isArray(val) ? val[0] : val;

    const safeString = (val) => {
      const v = safeValue(val);
      return typeof v === "string" ? v.trim() : "";
    };

    const safeNumber = (val, def = 0) => {
      const n = Number(safeValue(val));
      return isNaN(n) ? def : n;
    };

    const safeBoolean = (val) =>
      val === true || val === "true";

    const safeArray = (val) =>
      Array.isArray(val)
        ? val.map(v => String(v).trim()).filter(Boolean)
        : [];

    const safeDate = (val) => {
      const raw = safeValue(val);
      if (!raw) return null;
      const d = new Date(raw);
      return isNaN(d.getTime()) ? null : d;
    };

    /* --------------------------------------------------------
     * 🎓 QUALIFICATION NORMALIZER (FIXES CastError)
     * -------------------------------------------------------- */
    const normalizeQualification = (q = {}) => {
      const pick = (v) => (Array.isArray(v) ? v[0] : v);

      const educationLevel =
        typeof pick(q.educationLevel) === "string"
          ? pick(q.educationLevel).trim()
          : "";

      const course =
        typeof pick(q.course) === "string"
          ? pick(q.course).trim()
          : "";

      const specialization =
        typeof pick(q.specialization) === "string"
          ? pick(q.specialization).trim()
          : "";

      let fullQualification = "";
      if (educationLevel) fullQualification += educationLevel;
      if (course)
        fullQualification += fullQualification
          ? ` - ${course}`
          : course;
      if (specialization)
        fullQualification += ` (${specialization})`;

      return {
        educationLevel,
        course,
        specialization,
        fullQualification: fullQualification || undefined,
      };
    };

    /* --------------------------------------------------------
     * ✅ JOB TITLE (MANDATORY)
     * -------------------------------------------------------- */
    const jobTitle = safeString(body.jobTitle);

    if (!jobTitle) {
      return res.status(400).json({
        success: false,
        message: "Job title is required",
      });
    }

    let jobId = safeValue(body.id) || null;
    const incomingStatus = safeString(body.status) || "draft";

    /* --------------------------------------------------------
     * 🚫 CREATE GUARD
     * -------------------------------------------------------- */
    if (!jobId && incomingStatus !== "draft") {
      return res.status(400).json({
        success: false,
        message:
          "Only draft jobs can be created. Submit/active jobs must already exist.",
      });
    }

    /* --------------------------------------------------------
     * ♻️ REUSE EXISTING DRAFT
     * -------------------------------------------------------- */
    if (!jobId && incomingStatus === "draft") {
      const existingDraft = await JobPost.findOne({
        companyId,
        jobTitle,
        status: "draft",
      });

      if (existingDraft) {
        jobId = existingDraft._id;
      }
    }

    /* --------------------------------------------------------
     * 🏢 FETCH COMPANY
     * -------------------------------------------------------- */
    const company = await CompanyLogin.findById(companyId).lean();
    const profile = await CompanyProfile.findOne({ companyId }).lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    /* --------------------------------------------------------
     * 🌍 GOOGLE LOCATION
     * -------------------------------------------------------- */
    const latitude = safeString(body.latitude);
    const longitude = safeString(body.longitude);

    let googleLocation = null;
    if (latitude && longitude) {
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      if (!isNaN(lat) && !isNaN(lng)) {
        googleLocation = {
          type: "Point",
          coordinates: [lng, lat],
        };
      }
    }

    /* --------------------------------------------------------
     * 🎓 BUILD QUALIFICATIONS (SAFE)
     * -------------------------------------------------------- */
    let qualifications = [];

    if (Array.isArray(body.qualifications)) {
      qualifications = body.qualifications
        .map(normalizeQualification)
        .filter(q =>
          q.educationLevel || q.course || q.specialization
        );
    }

    /* --------------------------------------------------------
     * 🧱 BUILD JOB PAYLOAD
     * -------------------------------------------------------- */
    const jobData = {
      companyId,
      companyName: company.companyName,
      companyLogo: profile?.logo || "",
      companyIndustry: profile?.businessCategory || "",
      companyWebsite: profile?.socialLinks?.website || "",

      jobTitle,
      jobRole: safeArray(body.jobRole),
      jobIndustry: safeString(body.jobIndustry),

      employmentType: safeString(body.employmentType) || undefined,
      contractDuration:
        safeString(body.employmentType) === "contract"
          ? safeNumber(body.contractDuration, null)
          : null,
      contractDurationUnit:
        safeString(body.employmentType) === "contract"
          ? safeString(body.contractDurationUnit)
          : null,

      workMode: safeString(body.workMode) || undefined,
      shiftType: safeString(body.shiftType) || undefined,
      openingsCount: safeNumber(body.openingsCount, 1),
      urgencyLevel: safeString(body.urgencyLevel) || undefined,

      country: safeString(body.country),
      state: safeString(body.state),
      city: safeString(body.city),
      area: safeString(body.area),
      pincode: safeString(body.pincode),
      fullAddress: safeString(body.fullAddress),

      remoteEligibility: safeBoolean(body.remoteEligibility),

      latitude,
      longitude,
      googleLocation,

      jobDescription: safeString(body.jobDescription),

      requiredSkills: safeArray(body.requiredSkills),

      qualifications,
      degreeRequired: qualifications
        .map(q => q.fullQualification)
        .filter(Boolean),

      certificationRequired: safeArray(body.certificationRequired),

      minimumExperience: safeNumber(body.minimumExperience, 0),
      maximumExperience: safeNumber(body.maximumExperience, 0),
      freshersAllowed: safeBoolean(body.freshersAllowed),

      salaryType: safeString(body.salaryType) || undefined,
      salaryMin: safeNumber(body.salaryMin, 0),
      salaryMax: safeNumber(body.salaryMax, 0),
      salaryCurrency: safeString(body.salaryCurrency) || "INR",

      benefits: safeArray(body.benefits),

      startDate: safeDate(body.startDate),
      endDate: safeDate(body.endDate),

      status: incomingStatus,
    };

    /* --------------------------------------------------------
     * 📅 DATE VALIDATION (NON-DRAFT)
     * -------------------------------------------------------- */
    if (incomingStatus !== "draft") {
      if (!jobData.startDate || !jobData.endDate) {
        return res.status(400).json({
          success: false,
          message: "Start date and End date are required",
        });
      }

      if (jobData.startDate > jobData.endDate) {
        return res.status(400).json({
          success: false,
          message: "End date must be after start date",
        });
      }
    }

    /* --------------------------------------------------------
     * 🖼️ JOB IMAGE
     * -------------------------------------------------------- */
    if (req.file) {
      jobData.jobImage = `https://${req.get("host")}/media/company/${companyId}/jobs/${req.savedJobFileName}`;
    }

    if (safeBoolean(body.removeExistingImage)) {
      jobData.jobImage = null;
    }

    /* --------------------------------------------------------
     * ✏️ UPDATE JOB
     * -------------------------------------------------------- */
    if (jobId) {
      const existingJob = await JobPost.findOne({ _id: jobId, companyId });
      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "Job not found",
        });
      }

      if (!jobData.jobImage && !safeBoolean(body.removeExistingImage)) {
        jobData.jobImage = existingJob.jobImage;
      }

      await JobPost.updateOne({ _id: jobId }, { $set: jobData });

      return res.status(200).json({
        success: true,
        message: `Job ${incomingStatus} updated successfully`,
        jobId,
      });
    }

    /* --------------------------------------------------------
     * ➕ CREATE JOB (DRAFT ONLY)
     * -------------------------------------------------------- */
    const newJob = await JobPost.create(jobData);

    return res.status(201).json({
      success: true,
      message: "Draft job created successfully",
      jobId: newJob._id,
    });

  } catch (error) {
    console.error("❌ createOrUpdateJob error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};























/* =============================================================================================
   2️⃣ GET ALL JOBS (Public + Search + Filters)
   ============================================================================================= */
exports.getAllJobs = async (req, res) => {
  try {
    const userId = req.Id;

    const {
      jobId,
      keyword,
      search,
      country,
      state,
      city,
      area,
      employmentType,
      workMode,
      jobIndustry,
      jobRole,
      requiredSkills,
      experience,
      salaryRange,
      minExp,
      maxExp,
      minSalary,
      maxSalary,
      companyId,
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
        _id: jobId,
        status: "active",
        $or: [{ isApproved: true }, { isApproved: { $exists: false } }]
      }).lean();

      return res.status(200).json({
        success: true,
        total: job ? 1 : 0,
        jobs: job ? [job] : []
      });
    }

    /* ---------------------------------------------------
     * 2️⃣ BASE FILTER
     * --------------------------------------------------- */
    const baseFilter = {
      status: "active",
      $or: [{ isApproved: true }, { isApproved: { $exists: false } }]
    };

    if (companyId) {
      const ids = companyId.split(",");
      baseFilter.companyId = ids.length > 1 ? { $in: ids } : ids[0];
    }

    if (employmentType) {
      baseFilter.employmentType = { $in: employmentType.split(",") };
    }

    if (workMode) {
      baseFilter.workMode = { $in: workMode.split(",") };
    }

    if (jobIndustry) {
      baseFilter.jobIndustry = new RegExp(jobIndustry, "i");
    }

    if (jobRole) {
      baseFilter.jobRole = { $in: jobRole.split(",") };
    }

    if (requiredSkills) {
      baseFilter.requiredSkills = { $in: requiredSkills.split(",") };
    }

    /* ---------------------------------------------------
     * 3️⃣ EXPERIENCE FILTER
     * --------------------------------------------------- */
    if (experience) {
      const [minE, maxE] = experience.split("-").map(Number);
      baseFilter.$and = [
        { minimumExperience: { $lte: maxE } },
        { maximumExperience: { $gte: minE } }
      ];
    }

    if (minExp) baseFilter.minimumExperience = { $gte: Number(minExp) };
    if (maxExp) baseFilter.maximumExperience = { $lte: Number(maxExp) };

    /* ---------------------------------------------------
     * 4️⃣ SALARY FILTER
     * --------------------------------------------------- */
    if (salaryRange) {
      const [minS, maxS] = salaryRange.split("-").map(Number);
      baseFilter.$and = [
        ...(baseFilter.$and || []),
        { salaryMin: { $lte: maxS } },
        { salaryMax: { $gte: minS } }
      ];
    }

    if (minSalary) baseFilter.salaryMin = { $gte: Number(minSalary) };
    if (maxSalary) baseFilter.salaryMax = { $lte: Number(maxSalary) };

    /* ---------------------------------------------------
     * 5️⃣ LOCATION FILTER (TEXT)
     * --------------------------------------------------- */
    if (!geoEnabled) {
      if (country) baseFilter.country = new RegExp(`^${country}$`, "i");
      if (state) baseFilter.state = new RegExp(`^${state}$`, "i");
      if (city) baseFilter.city = new RegExp(`^${city}$`, "i");
      if (area) baseFilter.area = new RegExp(area, "i");
    }

    /* ---------------------------------------------------
     * 6️⃣ FETCH JOBS
     * --------------------------------------------------- */
    let jobs = [];

    // 🌍 GEO SEARCH
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
            query: baseFilter
          }
        },
        { $sort: { isFeatured: -1, isPromoted: -1, priorityScore: -1, createdAt: -1 } }
      ]);
    }

    if (geoEnabled && jobs.length === 0) {
  jobs = await JobPost.find({
    status: "active",
    isApproved: true,
    state: new RegExp(state, "i"),
    country: new RegExp(country, "i")
  });
}


    // 🔍 TEXT SEARCH
    else if (q) {
      jobs = await JobPost.find({
        ...baseFilter,
        $text: { $search: q }
      })
        .sort({ score: { $meta: "textScore" } })
        .lean();
    }

    // 📄 NORMAL FETCH
    else {
      jobs = await JobPost.find(baseFilter)
        .sort({ isFeatured: -1, isPromoted: -1, priorityScore: -1, createdAt: -1 })
        .lean();
    }
console.log(jobs)
    /* ---------------------------------------------------
     * 7️⃣ FINAL RESPONSE
     * --------------------------------------------------- */
    return res.status(200).json({
      success: true,
      total: jobs.length,
      jobs
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

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Job ID missing",
      });
    }

    const jobObjectId = new mongoose.Types.ObjectId(jobId);
    const userObjectId = userId ? new mongoose.Types.ObjectId(userId) : null;

    const pipeline = [
      /* --------------------------------------------------
       * 1️⃣ MATCH JOB
       * -------------------------------------------------- */
      {
        $match: {
          _id: jobObjectId,
          status: { $in: ["active"] },
          isApproved: true,
        },
      },

      /* --------------------------------------------------
       * 2️⃣ JOB ENGAGEMENT LOOKUP
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
       * 3️⃣ GLOBAL ENGAGEMENT COUNTS
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
          shareCount: {
            $size: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: { $eq: ["$$e.shared", true] },
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
       * 4️⃣ CURRENT USER ENGAGEMENT
       * -------------------------------------------------- */
      ...(userObjectId
        ? [
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
          ]
        : []),

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
       * 6️⃣ COMPANY LOGIN
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
       * 7️⃣ COMPANY PROFILE
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
       * 8️⃣ FINAL PROJECTION (100% SCHEMA SAFE)
       * -------------------------------------------------- */
      {
        $project: {
          jobId: "$_id",

          /* Job Basics */
          jobTitle: 1,
          jobRole: 1,
          jobIndustry: 1,

          employmentType: 1,
          contractDuration: 1,
          contractDurationUnit: 1,

          workMode: 1,
          shiftType: 1,
          openingsCount: 1,
          urgencyLevel: 1,

          /* Location */
          country: 1,
          state: 1,
          city: 1,
          area: 1,
          pincode: 1,
          fullAddress: 1,
          remoteEligibility: 1,
          latitude: 1,
          longitude: 1,
          googleLocation: 1,

          /* Description */
          jobDescription: 1,
          requiredSkills: 1,

          /* Qualifications */
          qualifications: 1,
          degreeRequired: 1,
          certificationRequired: 1,
          minimumExperience: 1,
          maximumExperience: 1,
          freshersAllowed: 1,

          /* Salary */
          salaryType: 1,
          salaryMin: 1,
          salaryMax: 1,
          salaryCurrency: 1,

          benefits: 1,

          /* Timeline */
          startDate: 1,
          endDate: 1,

          /* Media */
          jobImage: 1,

          /* Status */
          status: 1,
          createdAt: 1,
          updatedAt: 1,

          /* Engagement counts */
          likeCount: 1,
          saveCount: 1,
          applyCount: 1,
          shareCount: 1,
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
            email: "$companyLogin.email",
            phone: "$companyLogin.phone",
            whatsAppNumber: "$companyLogin.whatsAppNumber",
            position: "$companyLogin.position",
          },

          companyProfile: 1,
        },
      },
    ];

    const jobData = await JobPost.aggregate(pipeline);

    if (!jobData || jobData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
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




