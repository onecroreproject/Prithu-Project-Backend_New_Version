/************************************************************************************************
 * JOB CONTROLLER — FULLY UPDATED FOR NEW SCHEMAS
 * Ultra-optimized: supports millions of job posts.
 * Company-based job posting system (NO USER POSTING)
 ************************************************************************************************/

const mongoose = require("mongoose");
const JobCompanyPost=require("../../models/Job/CompanyModel/companyJobPostImageSchema.js")
const JobApplication=require("../../models/userModels/job/userJobApplication.js")
const {jobDB}=require("../../database.js")
const JobPost = require("../../models/Job/JobPost/jobSchema");
const JobEngagement = require("../../models/Job/JobPost/jobEngagementSchema");
const Payment = require("../../models/Job/JobPost/jobPaymentSchema");
const CompanyLogin = require("../../models/Job/CompanyModel/companyLoginSchema");
const CompanyProfile = require("../../models/Job/CompanyModel/companyProfile");
const {logCompanyActivity} =require("../../middlewares/services/JobsService/jobActivityLoogerFunction");
const {deleteLocalFile} = require("../../middlewares/services/jobImageUploadSpydy.js");
const { upsertJobGeo, removeJobGeo } = require("../../middlewares/helper/jobGeo.js");
const CompanyProfileVisibility = require("../../models/Job/CompanyModel/companyProfileVisibilitySchema.js");

const mapCompany = (job, companyMap, companyLoginMap = new Map()) => {
  // 🔥 Company Profile (existing logic)
  const company = companyMap.get(String(job.companyId)) || {};

  // 🔥 Company Login (NEW – hiring info)
  const companyLogin = companyLoginMap.get(String(job.companyId)) || null;

 

  return {
    ...job,

    /* ---------------------------------------------------
     * 🔥 COMPANY DATA (FROM CompanyProfile)
     * --------------------------------------------------- */
    companyName: company.companyName || job.companyName,
    companyLogo: company.logo || null,
    companyCoverImage:company.coverImage||null,

    country: company.country || job.country,
    state: company.state || job.state,
    city: company.city || job.city,
    area: company.address || job.area,
    pincode: company.pincode || job.pincode,

    latitude: company.googleLocation?.coordinates?.[1] || null,
    longitude: company.googleLocation?.coordinates?.[0] || null,
    googleLocation: company.googleLocation || null,

    companyId: job.companyId,

    /* ---------------------------------------------------
     * ✅ HIRING INFO (FROM CompanyLogin)
     * --------------------------------------------------- */
    hiringInfo: companyLogin
      ? {
          name: companyLogin.name,
          position: companyLogin.position,
          email: companyLogin.email,
          phone: companyLogin.phone,
          whatsAppNumber: companyLogin.whatsAppNumber,
          accountType: companyLogin.accountType,
          companyName: companyLogin.companyName
        }
      : null
  };
};






const applyCompanyVisibility = (job, visibility) => {
  console.log(visibility)
  if (!visibility) return job;

  const filteredJob = { ...job };

  /* ---------------- COMPANY CONTACT ---------------- */
  if (visibility.companyPhone === "private") {
    delete filteredJob.companyPhone;
  }

  if (visibility.companyWhatsAppNumber === "private") {
    delete filteredJob.companyWhatsAppNumber;
  }

  if (visibility.companyEmail === "private") {
    delete filteredJob.companyEmail;
  }

  /* ---------------- LOCATION ---------------- */
  if (visibility.address === "private") {
    delete filteredJob.area;
    delete filteredJob.pincode;
  }

  if (visibility.googleLocation === "private") {
    delete filteredJob.latitude;
    delete filteredJob.longitude;
    delete filteredJob.googleLocation;
  }

  /* ---------------- HIRING INFO ---------------- */
  if (filteredJob.hiringInfo) {
    if (visibility.hiringEmail === "private") {
      delete filteredJob.hiringInfo.email;
    }

    if (visibility.hrPhone === "private") {
      delete filteredJob.hiringInfo.phone;
      delete filteredJob.hiringInfo.whatsAppNumber;
    }

    if (visibility.hrName === "private") {
      delete filteredJob.hiringInfo.name;
    }
  }

  return filteredJob;
};







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
 * 🖼️ JOB IMAGE
 * -------------------------------------------------------- */
if (req.file) {
  jobData.jobImage = `https://${req.get("host")}/media/company/${companyId}/jobs/${req.savedJobFileName}`;
}

if (safeBoolean(body.removeExistingImage)) {
  jobData.jobImage = null;
}

/* --------------------------------------------------------
 * 🖼️ JOB POST IMAGE → JobCompanyPost (SAFE UPSERT)
 * -------------------------------------------------------- */
if (req.files?.postImage?.[0]) {
  const postImageUrl = `https://${req.get("host")}/media/company/${companyId}/posts/${req.savedFiles.postImage}`;

  // 🔍 find existing post image
  const existingPost = await JobCompanyPost.findOne({
    companyId,
    postId: jobId,
  }).lean();

  // 🗑️ delete old image if exists
  if (existingPost?.postImage) {
    deleteLocalFile(existingPost.postImage);
  }

  // ♻️ upsert post image
  await JobCompanyPost.findOneAndUpdate(
    { companyId, postId: jobId },
    {
      companyId,
      companyName: company.companyName,
      companyLogo: profile?.logo || "",
      postId: jobId,
      postImage: postImageUrl,
      status: "active",
    },
    { upsert: true, new: true }
  );
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



















exports.getAllJobs = async (req, res) => {
  try {
    console.log("🔍 Incoming Query Params:", req.query);

    const {
      jobId,
      keyword,
      search,
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
      radius,
      city,
      state,
    } = req.query;

    const q = keyword || search;
    const geoEnabled =
      lat &&
      lng &&
      radius &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      Number(lat) !== 0 &&
      Number(lng) !== 0;

    /* ---------------------------------------------------
     * 1️⃣ SINGLE JOB FETCH (UNCHANGED)
     * --------------------------------------------------- */
    if (jobId) {
      const job = await JobPost.findOne({
        _id: jobId,
        status: "active",
        $or: [{ isApproved: true }, { isApproved: { $exists: false } }],
      }).lean();

      if (!job) {
        return res.json({ success: true, total: 0, jobs: [] });
      }

      const companyProfile = await CompanyProfile.findOne({
        companyId: job.companyId,
      }).lean();

      const companyLogin = await CompanyLogin.findById(job.companyId)
        .select("name position email phone whatsAppNumber accountType companyName")
        .lean();

      const visibility = await CompanyProfileVisibility.findOne({
        companyId: job.companyId,
      }).lean();

      /* 🔹 ENGAGEMENT (SINGLE JOB) */
      const userId = req.Id || req.userId;
      let engagement = null;

      if (userId) {
        engagement = await JobEngagement.findOne({
          userId,
          jobId: job._id,
        }).lean();
      }

      const mappedJob = mapCompany(
        job,
        new Map([[String(job.companyId), companyProfile]]),
        new Map([[String(job.companyId), companyLogin]])
      );

      const finalJob = applyCompanyVisibility(mappedJob, visibility);

      return res.json({
        success: true,
        total: 1,
        jobs: [
          {
            ...finalJob,
            isApplied: engagement?.applied ?? false,
            isLiked: engagement?.liked ?? false,
            isSaved: engagement?.saved ?? false,
            isShared: engagement?.shared ?? false,
            isViewed: engagement?.view ?? false,
          },
        ],
      });
    }

    /* ---------------------------------------------------
     * 2️⃣ BASE FILTER (UNCHANGED)
     * --------------------------------------------------- */
    const baseFilter = {
      status: "active",
      $or: [{ isApproved: true }, { isApproved: { $exists: false } }],
    };

    if (companyId) baseFilter.companyId = companyId;
    if (employmentType) baseFilter.employmentType = employmentType;
    if (workMode) baseFilter.workMode = workMode;
    if (jobIndustry) baseFilter.jobIndustry = new RegExp(jobIndustry, "i");
    if (jobRole) baseFilter.jobRole = { $in: jobRole.split(",") };
    if (requiredSkills)
      baseFilter.requiredSkills = { $in: requiredSkills.split(",") };

    if (experience) {
      const [minE, maxE] = experience.split("-").map(Number);
      baseFilter.$and = [
        { minimumExperience: { $lte: maxE } },
        { maximumExperience: { $gte: minE } },
      ];
    }

    if (minExp) baseFilter.minimumExperience = { $gte: Number(minExp) };
    if (maxExp) baseFilter.maximumExperience = { $lte: Number(maxExp) };

    if (salaryRange) {
      const [minS, maxS] = salaryRange.split("-").map(Number);
      baseFilter.$and = [
        ...(baseFilter.$and || []),
        { salaryMin: { $lte: maxS } },
        { salaryMax: { $gte: minS } },
      ];
    }

    if (minSalary) baseFilter.salaryMin = { $gte: Number(minSalary) };
    if (maxSalary) baseFilter.salaryMax = { $lte: Number(maxSalary) };

    /* ---------------------------------------------------
     * 3️⃣ FETCH JOBS (UNCHANGED PRIORITY LOGIC)
     * --------------------------------------------------- */
    let jobs = [];

    if (geoEnabled) {
      try {
        const nearbyCompanies = await CompanyProfile.aggregate([
          {
            $geoNear: {
              near: {
                type: "Point",
                coordinates: [Number(lng), Number(lat)],
              },
              key: "googleLocation",
              distanceField: "distance",
              maxDistance: Number(radius) * 1000,
              spherical: true,
              query: {
                "googleLocation.coordinates": { $ne: [0, 0] },
              },
            },
          },
          { $project: { companyId: 1 } },
        ]);

        const companyIds = nearbyCompanies.map(c => c.companyId);

        if (companyIds.length) {
          jobs = await JobPost.find({
            ...baseFilter,
            companyId: { $in: companyIds },
          })
            .sort({
              isFeatured: -1,
              isPromoted: -1,
              priorityScore: -1,
              createdAt: -1,
            })
            .lean();
        }
      } catch (err) {
        console.error("⚠️ Geo fallback:", err.message);
      }
    }

    if (!jobs.length && city) {
      const cityCompanies = await CompanyProfile.find({
        city: new RegExp(`^${city}$`, "i"),
      }).select("companyId");

      const companyIds = cityCompanies.map(c => c.companyId);

      if (companyIds.length) {
        jobs = await JobPost.find({
          ...baseFilter,
          companyId: { $in: companyIds },
        }).lean();
      }
    }

    if (!jobs.length && state) {
      const stateCompanies = await CompanyProfile.find({
        state: new RegExp(`^${state}$`, "i"),
      }).select("companyId");

      const companyIds = stateCompanies.map(c => c.companyId);

      if (companyIds.length) {
        jobs = await JobPost.find({
          ...baseFilter,
          companyId: { $in: companyIds },
        }).lean();
      }
    }

    if (!jobs.length && q) {
      jobs = await JobPost.find({
        ...baseFilter,
        $text: { $search: q },
      }).lean();
    }

    if (!jobs.length) {
      jobs = await JobPost.find(baseFilter)
        .sort({
          isFeatured: -1,
          isPromoted: -1,
          priorityScore: -1,
          createdAt: -1,
        })
        .lean();
    }

    /* ---------------------------------------------------
     * 4️⃣ BULK COMPANY DATA (UNCHANGED)
     * --------------------------------------------------- */
    const companyIds = [...new Set(jobs.map(j => String(j.companyId)))];

    const companyProfiles = await CompanyProfile.find({
      companyId: { $in: companyIds },
    }).lean();

    const companyLogins = await CompanyLogin.find({
      _id: { $in: companyIds },
      status: "active",
    })
      .select("name position email phone whatsAppNumber accountType companyName")
      .lean();

    const visibilitySettings = await CompanyProfileVisibility.find({
      companyId: { $in: companyIds },
    }).lean();

    const companyProfileMap = new Map(
      companyProfiles.map(c => [String(c.companyId), c])
    );
    const companyLoginMap = new Map(
      companyLogins.map(c => [String(c._id), c])
    );
    const visibilityMap = new Map(
      visibilitySettings.map(v => [String(v.companyId), v])
    );

    /* ---------------------------------------------------
     * 4.5️⃣ USER ENGAGEMENT (NEW — SAFE ADDITION)
     * --------------------------------------------------- */
    const userId = req.Id || req.userId;
    let engagementMap = new Map();

    if (userId && jobs.length) {
      const jobIds = jobs.map(j => j._id);

      const engagements = await JobEngagement.find({
        userId,
        jobId: { $in: jobIds },
      }).lean();

      engagementMap = new Map(
        engagements.map(e => [String(e.jobId), e])
      );
    }

    /* ---------------------------------------------------
     * 5️⃣ FINAL RESPONSE (ENGAGEMENT FIXED)
     * --------------------------------------------------- */
    const finalJobs = jobs.map(job => {
      const mappedJob = mapCompany(job, companyProfileMap, companyLoginMap);
      const visibility = visibilityMap.get(String(job.companyId)) || null;
      const jobWithVisibility = applyCompanyVisibility(mappedJob, visibility);
      const engagement = engagementMap.get(String(job._id));

      return {
        ...jobWithVisibility,
        isApplied: engagement?.applied ?? false,
        isLiked: engagement?.liked ?? false,
        isSaved: engagement?.saved ?? false,
        isShared: engagement?.shared ?? false,
        isViewed: engagement?.view ?? false,
      };
    });

    return res.json({
      success: true,
      total: finalJobs.length,
      jobs: finalJobs,
    });
  } catch (error) {
    console.error("❌ GET ALL JOBS ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
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

    /* --------------------------------------------------
     * AGGREGATION PIPELINE
     * -------------------------------------------------- */
    const pipeline = [
      {
        $match: {
          _id: jobObjectId,
          status: "active",
          isApproved: true,
        },
      },

      /* --------------------------------------------------
       * 🔁 JOB ENGAGEMENT (ALL USERS → COUNTS)
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "JobEngagement",
          localField: "_id",
          foreignField: "jobId",
          as: "engagementData",
        },
      },

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
       * 👤 USER ENGAGEMENT FLAGS (LOGGED-IN ONLY)
       * -------------------------------------------------- */
      ...(userObjectId
        ? [
            {
              $lookup: {
                from: "JobEngagement",
                let: { jobId: "$_id", userId: userObjectId },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$jobId", "$$jobId"] },
                          { $eq: ["$userId", "$$userId"] },
                        ],
                      },
                    },
                  },
                  { $limit: 1 },
                ],
                as: "userEngagement",
              },
            },
            {
              $addFields: {
                userEngagement: { $arrayElemAt: ["$userEngagement", 0] },
              },
            },
          ]
        : []),

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
       * 🏢 COMPANY LOGIN
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
       * 🏢 COMPANY PROFILE
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
       * 📦 FINAL PROJECTION
       * -------------------------------------------------- */
      {
        $project: {
          jobId: "$_id",

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

          jobDescription: 1,
          requiredSkills: 1,
          qualifications: 1,
          degreeRequired: 1,
          certificationRequired: 1,

          minimumExperience: 1,
          maximumExperience: 1,
          freshersAllowed: 1,

          salaryType: 1,
          salaryMin: 1,
          salaryMax: 1,
          salaryCurrency: 1,

          benefits: 1,
          startDate: 1,
          endDate: 1,
          jobImage: 1,

          status: 1,
          createdAt: 1,
          updatedAt: 1,

          /* COUNTS */
          likeCount: 1,
          saveCount: 1,
          applyCount: 1,
          shareCount: 1,
          viewCount: 1,

          /* USER FLAGS */
          isLiked: 1,
          isSaved: 1,
          isApplied: 1,
          isViewed: 1,
          isShared: 1,

          companyId: 1,

          hiringInfo: {
            name: "$companyLogin.name",
            position: "$companyLogin.position",
            email: "$companyLogin.email",
            phone: "$companyLogin.phone",
            whatsAppNumber: "$companyLogin.whatsAppNumber",
          },

          companyProfile: 1,
        },
      },
    ];

    const jobData = await JobPost.aggregate(pipeline);

    if (!jobData.length) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    let job = jobData[0];

    /* --------------------------------------------------
     * 🔐 APPLY VISIBILITY RULES (UNCHANGED)
     * -------------------------------------------------- */
    const visibility = await CompanyProfileVisibility.findOne({
      companyId: job.companyId,
    }).lean();

    if (visibility) {
      if (visibility.address === "private") {
        delete job.area;
        delete job.pincode;
      }

      if (visibility.googleLocation === "private") {
        delete job.latitude;
        delete job.longitude;
        delete job.googleLocation;
      }

      if (job.hiringInfo) {
        if (visibility.hiringEmail === "private")
          delete job.hiringInfo.email;

        if (visibility.hrPhone === "private") {
          delete job.hiringInfo.phone;
          delete job.hiringInfo.whatsAppNumber;
        }

        if (visibility.hrName === "private")
          delete job.hiringInfo.name;
      }
    }

    return res.status(200).json({
      success: true,
      job,
      companyProfile: job.companyProfile,
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







exports.getAllActiveJobLocations = async (req, res) => {
  try {
    const pipeline = [
      /* ---------------- ACTIVE JOBS ONLY ---------------- */
      {
        $match: {
          status: "active",
        },
      },

      /* ---------------- JOIN COMPANY PROFILE ---------------- */
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

      /* ---------------- RESOLVE LOCATION ---------------- */
      {
        $addFields: {
          location: {
            country: { $ifNull: ["$companyProfile.country", "$country"] },
            state: { $ifNull: ["$companyProfile.state", "$state"] },
            city: { $ifNull: ["$companyProfile.city", "$city"] },
            pincode: { $ifNull: ["$companyProfile.pincode", "$pincode"] },
            address: { $ifNull: ["$companyProfile.address", "$fullAddress"] },

            googleLocation: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ["$companyProfile.googleLocation", null] },
                    { $ne: ["$companyProfile.googleLocation.coordinates", [0, 0]] },
                  ],
                },
                then: "$companyProfile.googleLocation",
                else: "$googleLocation",
              },
            },
          },
        },
      },

      /* ---------------- CLEAN GEO DATA ---------------- */
      {
        $match: {
          "location.googleLocation.coordinates": { $ne: [0, 0] },
        },
      },

      /* ---------------- FINAL PROJECTION ---------------- */
      {
        $project: {
          _id: 0,
          jobId: "$_id",
          companyId: 1,
          location: 1,
        },
      },
    ];

    const locations = await jobDB
      .model("JobPost")
      .aggregate(pipeline);

    return res.status(200).json({
      success: true,
      total: locations.length,
      locations,
    });
  } catch (error) {
    console.error("❌ GET ALL LOCATIONS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};






exports.getPlatformStats = async (req, res) => {
  try {
    const [
      activeJobs,
      totalCompanies,
      totalApplications,
      shortlistedApplications
    ] = await Promise.all([

      /* ---------------- ACTIVE JOBS ---------------- */
      JobPost.countDocuments({
        status: "active",
        isApproved: true
      }),

      /* ---------------- ACTIVE COMPANIES ---------------- */
      CompanyLogin.countDocuments({
        status: "active"
      }),

      /* ---------------- TOTAL APPLICATIONS ---------------- */
      JobApplication.countDocuments(),

      /* ---------------- SHORTLISTED APPLICATIONS ---------------- */
      JobApplication.countDocuments({
        status: "shortlisted"
      })
    ]);

    /* ---------------- CALCULATIONS ---------------- */
    const hiringRate =
      activeJobs > 0
        ? Math.min(
            Math.round((totalApplications / activeJobs) * 100),
            100
          )
        : 0;

    const satisfaction =
      totalApplications > 0
        ? Math.min(
            Math.round((shortlistedApplications / totalApplications) * 100),
            100
          )
        : 0;

    return res.status(200).json({
      success: true,
      data: {
        activeJobs,            // 1.2k+
        hiringRate,            // 85%
        companies: totalCompanies, // 240+
        satisfaction           // 98%
      }
    });

  } catch (error) {
    console.error("❌ PLATFORM STATS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch platform statistics"
    });
  }
};





// GET /api/jobs
// GET /api/jobs/:jobId/similar
exports.getSimilarJobs = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { limit = 6 } = req.query;

    /* --------------------------------------------------
     * 🔍 BASE JOB
     * -------------------------------------------------- */
    const baseJob = await JobPost.findOne({
      _id: jobId,
      status: "active",
      isApproved: true,
    }).lean();

    if (!baseJob) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    /* --------------------------------------------------
     * 🧠 SIMILARITY CONDITIONS
     * -------------------------------------------------- */
    const conditions = [];

    if (baseJob.jobIndustry) {
      conditions.push({
        jobIndustry: { $regex: baseJob.jobIndustry, $options: "i" },
      });
    }

    if (baseJob.jobRole?.length) {
      conditions.push({
        jobRole: { $in: baseJob.jobRole },
      });
    }

    if (baseJob.jobTitle) {
      conditions.push({
        jobTitle: {
          $regex: baseJob.jobTitle.split(" ")[0],
          $options: "i",
        },
      });
    }

    /* --------------------------------------------------
     * 🧩 AGGREGATION PIPELINE
     * -------------------------------------------------- */
    const jobs = await JobPost.aggregate([
      {
        $match: {
          _id: { $ne: baseJob._id },
          status: "active",
          isApproved: true,
          $or: conditions,
        },
      },

      /* -------- Company Profile -------- */
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

      /* -------- Company Login (HR + Company Name) -------- */
      {
        $lookup: {
          from: "CompanyLogin",
          localField: "companyId",
          foreignField: "_id",
          as: "companyLogin",
        },
      },
      {
        $unwind: {
          path: "$companyLogin",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* --------------------------------------------------
       * 🎯 FINAL SHAPE
       * -------------------------------------------------- */
      {
        $project: {
          jobTitle: 1,
          jobRole: 1,
          jobIndustry: 1,
          city: 1,
          workMode: 1,
          employmentType: 1,
          salaryMin: 1,
          salaryMax: 1,
          createdAt: 1,

          /* ---- Company Profile ---- */
          companyProfile: {
            logo: "$companyProfile.logo",
            coverImage: "$companyProfile.coverImage",
            businessCategory: "$companyProfile.businessCategory",
            city: "$companyProfile.city",
            state: "$companyProfile.state",
            country: "$companyProfile.country",
            employeeCount: "$companyProfile.employeeCount",
            yearEstablished: "$companyProfile.yearEstablished",
            socialLinks: "$companyProfile.socialLinks",
          },

          /* ---- Company Login / HR ---- */
          company: {
            companyName: "$companyLogin.companyName",
            hrName: "$companyLogin.name",
            hrPosition: "$companyLogin.position",
            hrPhone: "$companyLogin.phone",
            hrWhatsApp: "$companyLogin.whatsAppNumber",
            hrEmail: "$companyLogin.companyEmail",
            profileAvatar: "$companyLogin.profileAvatar",
            companyId:"$companyLogin._id"
          },
        },
      },

      { $sort: { isFeatured: -1, priorityScore: -1, createdAt: -1 } },
      { $limit: Number(limit) },
    ]);

    return res.status(200).json({
      success: true,
      count: jobs.length,
      jobs,
    });

  } catch (error) {
    console.error("❌ getSimilarJobs error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};






