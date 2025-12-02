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
const { uploadAndReplace } = require("../../middlewares/utils/jobReplaceImage");
const {logCompanyActivity} =require("../../middlewares/utils/jobActivityLoogerFunction");

/* =============================================================================================
   1️⃣ CREATE OR UPDATE JOB POST
   ============================================================================================= */
exports.createOrUpdateJob = async (req, res) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Unauthorized: companyId missing",
      });
    }

    const body = req.body || {};

    // Accept either jobId or id for backward compatibility
    const jobId = body.jobId || body.id || null;

    // --- Helper: normalize status ---
    const normalizeStatus = (s) => {
      if (s === null || s === undefined) return undefined;
      const lower = String(s).trim().toLowerCase();
      // map common variants if needed (keep mapping minimal)
      if (lower === "submit" || lower === "submitted") return "submit";
      if (lower === "active") return "active";
      if (lower === "draft") return "draft";
      if (lower === "inactive") return "inactive";
      if (lower === "expired") return "expired";
      if (lower === "closed") return "closed";
      return lower;
    };

    // --- Helper: Extract array-like fields robustly from req.body ---
    // Supports:
    // - real arrays: req.body.field === ['a','b']
    // - repeated param: field=a&field=b => req.body.field === ['a','b'] (common)
    // - indexed: field[0]=a, field[1]=b => parsed as body['field[0]'] etc
    // - JSON string: '["a","b"]'
    // - comma separated string: "a,b"
    const extractArrayField = (name) => {
      // 1) direct array
      const val = body[name];
      if (Array.isArray(val)) return val.map(String).filter(v => v !== '');

      // 2) direct string that might be JSON or comma separated
      if (typeof val === 'string') {
        const trimmed = val.trim();
        // try JSON parse
        try {
          const parsed = JSON.parse(trimmed);
          if (Array.isArray(parsed)) return parsed.map(String).filter(v => v !== '');
        } catch (e) {
          // not JSON
        }
        // fallback split by comma
        const parts = trimmed.split(',').map(p => p.trim()).filter(p => p !== '');
        return parts.length ? parts : [];
      }

      // 3) collect indexed keys like "responsibilities[0]" / "responsibilities[1]"
      const indexedKeys = Object.keys(body).filter(k => k.startsWith(`${name}[`));
      if (indexedKeys.length > 0) {
        // map by index
        const withIndex = indexedKeys.map(k => {
          const idxMatch = k.match(/\[(\d+)\]/);
          const idx = idxMatch ? Number(idxMatch[1]) : 0;
          return { key: k, idx, value: body[k] };
        }).sort((a,b) => a.idx - b.idx);

        return withIndex.map(i => String(i.value)).filter(v => v !== '');
      }

      // 4) collect bracketed "name[]" style keys if present (body may have 'name[]' key)
      if (body[`${name}[]`]) {
        const v2 = body[`${name}[]`];
        if (Array.isArray(v2)) return v2.map(String).filter(v => v !== '');
        if (typeof v2 === 'string') return v2.split(',').map(p => p.trim()).filter(p => p !== '');
      }

      return [];
    };

    /* =======================================================================================
       🏢 Company Snapshot
    ======================================================================================= */
    const company = await CompanyLogin.findById(companyId).lean();
    const profile = await CompanyProfile.findOne({ companyId }).lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company account not found",
      });
    }

    const companySnapshot = {
      companyId,
      companyName: company.companyName,
      companyLogo: profile?.logo || "",
      companyIndustry: profile?.businessCategory || "",
      companyWebsite: profile?.socialLinks?.website || "",
    };

    /* =======================================================================================
       📝 File Upload (multer)
    ======================================================================================= */
    const jobImage = req.files?.jobImage?.[0];
    let finalImage = null;

    if (jobImage) {
      // uploadAndReplace should accept buffer and optional oldImage and return new URL/path
      finalImage = await uploadAndReplace(jobImage.buffer, "jobs/images", body.oldImage);
    }

    /* =======================================================================================
       📝 VALIDATION FOR ACTIVE ONLY
       If the incoming status indicates active (or no status provided), and this is a create,
       ensure required fields are present. Drafts bypass this strictness.
    ======================================================================================= */
    const incomingStatus = normalizeStatus(body.status);
    if ((incomingStatus === "active" || !body.status) && !jobId) {
      const requiredFields = [
        "jobTitle",
        "employmentType",
        "workMode",
        "jobDescription",
      ];

      const missing = requiredFields.filter((f) => !body[f]);
      if (missing.length > 0 && incomingStatus !== "draft") {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
          fields: missing,
        });
      }
    }

    /* =======================================================================================
       🛠 Normalize & build jobData payload
    ======================================================================================= */
    const jobData = {
      ...companySnapshot,

      jobTitle: body.jobTitle || "",
      jobRole: body.jobRole || "",
      jobCategory: body.jobCategory || "",
      jobSubCategory: body.jobSubCategory || "",
      employmentType: body.employmentType || null,
      workMode: body.workMode || null,
      shiftType: body.shiftType || null,
      openingsCount: Number(body.openingsCount) || 1,
      urgencyLevel: body.urgencyLevel || null,
      city: body.city || "",
      state: body.state || "",
      country: body.country || "",
      pincode: body.pincode || "",
      fullAddress: body.fullAddress || "",
      // remoteEligibility might come as "true"/"false" or boolean
      remoteEligibility: body.remoteEligibility === "true" || body.remoteEligibility === true || false,

      googleLocation:
        body.latitude && body.longitude
          ? {
              type: "Point",
              coordinates: [Number(body.longitude), Number(body.latitude)],
            }
          : undefined,

      jobDescription: body.jobDescription || "",
      responsibilities: extractArrayField("responsibilities"),
      dailyTasks: extractArrayField("dailyTasks"),
      keyDuties: extractArrayField("keyDuties"),

      requiredSkills: extractArrayField("requiredSkills"),
      preferredSkills: extractArrayField("preferredSkills"),
      technicalSkills: extractArrayField("technicalSkills"),
      softSkills: extractArrayField("softSkills"),
      toolsAndTechnologies: extractArrayField("toolsAndTechnologies"),

      educationLevel: body.educationLevel || "",
      degreeRequired: body.degreeRequired || "",
      certificationRequired: extractArrayField("certificationRequired"),
      minimumExperience: Number(body.minimumExperience) || 0,
      maximumExperience: Number(body.maximumExperience) || 0,
      freshersAllowed: body.freshersAllowed === "true" || body.freshersAllowed === true || false,

      salaryType: body.salaryType || "monthly",
      salaryMin: Number(body.salaryMin) || 0,
      salaryMax: Number(body.salaryMax) || 0,
      salaryCurrency: body.salaryCurrency || "INR",
      salaryVisibility: body.salaryVisibility || "public",
      benefits: extractArrayField("benefits"),
      perks: extractArrayField("perks"),
      incentives: body.incentives || "",
      bonuses: body.bonuses || "",

      hiringManagerName: body.hiringManagerName || "",
      hiringManagerEmail: body.hiringManagerEmail || "",
      hiringManagerPhone: body.hiringManagerPhone || "",
      interviewMode: body.interviewMode || null,
      interviewLocation: body.interviewLocation || "",
      interviewRounds: extractArrayField("interviewRounds"),
      hiringProcess: extractArrayField("hiringProcess"),
      interviewInstructions: body.interviewInstructions || "",

      startDate: body.startDate || null,
      endDate: body.endDate || null,
      contractDuration: body.contractDuration || "",
      jobTimings: body.jobTimings || "",
      workingHours: body.workingHours || "",
      workingDays: body.workingDays || "",
      holidaysType: body.holidaysType || "",

      resumeRequired: body.resumeRequired === "true" || body.resumeRequired === true,
      coverLetterRequired: body.coverLetterRequired === "true" || body.coverLetterRequired === true,
      documentsRequired: extractArrayField("documentsRequired"),

      tags: extractArrayField("tags"),
      skillKeywords: extractArrayField("skillKeywords"),
      keywordSearch: extractArrayField("keywordSearch"),

      // Status normalized; default to 'draft' if not present
      status: normalizeStatus(body.status) || "draft",
      isApproved: false,
      isFeatured: false,
      isPromoted: false,
      priorityScore: normalizeStatus(body.status) === "active" ? 10 : 1,
    };

    if (finalImage) jobData.jobImage = finalImage;

    /* =======================================================================================
       🟦 UPDATE JOB (including draft updates)
    ======================================================================================= */
    if (jobId) {
      const existingJob = await JobPost.findOne({ _id: jobId, companyId });

      if (!existingJob) {
        return res.status(404).json({
          success: false,
          message: "Job not found or unauthorized",
        });
      }

      // If existing job is a draft → always UPDATE in place
      if (existingJob.status === "draft") {
        await JobPost.updateOne({ _id: jobId }, { $set: jobData });

        await logCompanyActivity({
          companyId,
          action: "JOB_DRAFT_UPDATED",
          description: `Draft updated for job: ${existingJob.jobTitle}`,
          jobId: existingJob._id,
          changes: body,
          req,
        });

        return res.status(200).json({
          success: true,
          message: "Draft updated successfully",
          jobId,
        });
      }

      // Normal update for non-draft job
      await JobPost.updateOne({ _id: jobId }, { $set: jobData });

      await logCompanyActivity({
        companyId,
        action: jobData.status === "draft" ? "JOB_DRAFT_SAVED" : "JOB_UPDATED",
        description: `${jobData.status === "draft" ? "Draft saved for" : "Updated"} job: ${existingJob.jobTitle}`,
        jobId: existingJob._id,
        changes: body,
        req,
      });

      return res.status(200).json({
        success: true,
        message: "Job updated successfully",
        jobId,
      });
    }

    /* =======================================================================================
       🟩 CREATE NEW JOB
    ======================================================================================= */
    const newJob = await JobPost.create(jobData);

    await logCompanyActivity({
      companyId,
      action: jobData.status === "draft" ? "JOB_DRAFT_SAVED" : "JOB_CREATED",
      description: `${jobData.status === "draft" ? "Draft created for" : "Created"} job: ${jobData.jobTitle || "Untitled Job"}`,
      jobId: newJob._id,
      changes: body,
      req,
    });

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      job: newJob,
    });

  } catch (error) {
    console.error("❌ Error in createOrUpdateJob:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};





/* =============================================================================================
   2️⃣ GET ALL JOBS (Public + Search + Filters)
   ============================================================================================= */
exports.getAllJobs = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId; // logged-in user's ID

    const {
      jobCategory,
      jobRole,
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
    } = req.query;

    const q = keyword || search;

    const baseFilter = { status: "active", isApproved: true };

    if (jobCategory) baseFilter.jobCategory = jobCategory;
    if (jobRole) baseFilter.jobRole = jobRole;

    if (employmentType) {
      const types = employmentType.split(",");
      baseFilter.employmentType = types.length > 1 ? { $in: types } : types[0];
    }

    if (workMode) {
      const modes = workMode.split(",");
      baseFilter.workMode = modes.length > 1 ? { $in: modes } : modes[0];
    }

    if (city) baseFilter.city = city;
    if (state) baseFilter.state = state;
    if (country) baseFilter.country = country;

    if (tags) baseFilter.tags = { $in: tags.split(",") };

    if (minExp) baseFilter.minimumExperience = { $gte: Number(minExp) };
    if (maxExp) baseFilter.maximumExperience = { $lte: Number(maxExp) };
    if (minSalary) baseFilter.salaryMin = { $gte: Number(minSalary) };
    if (maxSalary) baseFilter.salaryMax = { $lte: Number(maxSalary) };

    let jobs = [];

    /* -------------------------------------------
     * 1️⃣ TEXT SEARCH
     * ------------------------------------------- */
    if (q) {
      let textFilter = { ...baseFilter, $text: { $search: q } };

      jobs = await JobPost.find(textFilter)
        .sort({ score: { $meta: "textScore" } })
        .lean();

      // Fallback to regex
      if (jobs.length === 0) {
        let regexFilter = {
          ...baseFilter,
          $or: [
            { jobTitle: new RegExp(q, "i") },
            { jobRole: new RegExp(q, "i") },
            { jobDescription: new RegExp(q, "i") },
            { keywordSearch: new RegExp(q, "i") },
          ],
        };

        jobs = await JobPost.find(regexFilter)
          .sort({ createdAt: -1 })
          .lean();
      }
    } else {
      // No search → normal listing
      jobs = await JobPost.find(baseFilter)
        .sort({ isFeatured: -1, priorityScore: -1, createdAt: -1 })
        .lean();
    }

    /* -----------------------------------------------
     * 2️⃣ FETCH ALL ENGAGEMENTS FOR ALL JOBS
     * ----------------------------------------------- */
    const jobIds = jobs.map((j) => j._id);

    const engagementData = await JobEngagement.find({ jobId: { $in: jobIds } })
      .lean();

    /* -----------------------------------------------
     * 3️⃣ PROCESS ENGAGEMENT DATA PER JOB
     * ----------------------------------------------- */
    const engagementMap = {}; // key: jobId => { counts + user flags }

    jobIds.forEach((id) => {
      engagementMap[id] = {
        likeCount: 0,
        shareCount: 0,
        saveCount: 0,
        applyCount: 0,
        viewCount: 0,
        isLiked: false,
        isSaved: false,
        isApplied: false,
        isViewed: false,
      };
    });

    engagementData.forEach((e) => {
      const j = engagementMap[e.jobId];

      if (!j) return;

      // Global counts
      if (e.liked) j.likeCount++;
      if (e.shared) j.shareCount++;
      if (e.saved) j.saveCount++;
      if (e.applied) j.applyCount++;
      if (e.view) j.viewCount++;

      // Current user flags
      if (e.userId?.toString() === userId?.toString()) {
        j.isLiked = e.liked;
        j.isSaved = e.saved;
        j.isApplied = e.applied;
        j.isViewed = e.view;
      }
    });

    /* -----------------------------------------------
     * 4️⃣ ATTACH ENGAGEMENT INFO TO EACH JOB
     * ----------------------------------------------- */
    const finalJobs = jobs.map((job) => ({
      ...job,
      ...engagementMap[job._id],
    }));

    /* -----------------------------------------------
     * 5️⃣ SEND RESPONSE
     * ----------------------------------------------- */
    res.status(200).json({
      success: true,
      total: finalJobs.length,
      jobs: finalJobs,
    });

  } catch (error) {
    console.error("GET ALL JOBS ERROR:", error);
    res.status(500).json({ success: false, error: error.message });
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
       * 2️⃣ JOIN PAYMENT DETAILS
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "JobPostPayment",
          localField: "_id",
          foreignField: "jobId",
          as: "paymentInfo",
        },
      },

      {
        $addFields: {
          paymentAmount: { $ifNull: [{ $max: "$paymentInfo.amount" }, 0] },
          boostLevel: {
            $ifNull: [{ $max: "$paymentInfo.meta.boostLevel" }, 0],
          },
        },
      },

      /* --------------------------------------------------
       * 3️⃣ JOIN ENGAGEMENT DATA
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
       * 4️⃣ COMPUTE GLOBAL COUNTS
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
       * 5️⃣ CURRENT USER'S ENGAGEMENT
       * -------------------------------------------------- */
      {
        $addFields: {
          userEngagement: {
            $first: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: {
                  $eq: ["$$e.userId", userObjectId],
                },
              },
            },
          },
        },
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
          isShared: { $ifNull: ["$userEngagement.shared", false] },
        },
      },

      /* --------------------------------------------------
       * 7️⃣ ENGAGEMENT SCORE (OPTIONAL)
       * -------------------------------------------------- */
      {
        $addFields: {
          engagementScore: {
            $add: [
              "$likeCount",
              { $multiply: ["$shareCount", 2] },
              { $multiply: ["$saveCount", 3] },
              { $multiply: ["$applyCount", 5] },
            ],
          },
        },
      },

      /* --------------------------------------------------
       * 8️⃣ JOIN COMPANY LOGIN
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
       * 9️⃣ JOIN COMPANY PROFILE
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
       * 🔟 JOIN COMPANY VISIBILITY SETTINGS
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfileVisibility",
          localField: "companyId",
          foreignField: "companyId",
          as: "visibilitySettings",
        },
      },
      {
        $unwind: {
          path: "$visibilitySettings",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* --------------------------------------------------
       * 1️⃣1️⃣ FINAL PROJECTION
       * -------------------------------------------------- */
      {
        $project: {
          jobId: "$_id",

          /* Job info */
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

          /* Engagement */
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

          /* Payment + ranking */
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
            position: "$companyLogin.position",
          },

          companyProfile: 1,
          visibilitySettings: 1,
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
      return res.status(404).json({
        success: false,
        message: "Job not found or unauthorized",
      });

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

    const jobs = await JobPost.find({ companyId })
      .sort({ createdAt: -1 })
      .lean();

    if (!jobs.length)
      return res.status(404).json({ success: false, message: "No jobs found" });

    const enhanced = await Promise.all(
      jobs.map(async (job) => {
        const engagements = await JobEngagement.find({ jobId: job._id }).lean();
        const payments = await Payment.findOne({
          jobId: job._id,
          status: "success",
        }).lean();

        const stats = {
          likes: engagements.filter((e) => e.liked).length,
          shares: engagements.filter((e) => e.shared).length,
          saved: engagements.filter((e) => e.saved).length,
          applied: engagements.filter((e) => e.applied).length,
        };

        const engagementScore =
          stats.likes * 2 +
          stats.shares * 3 +
          stats.saved * 1 +
          stats.applied * 6 +
          (payments ? 25 : 0);

        return {
          ...job,
          stats,
          engagementScore,
          isPaid: !!payments,
        };
      })
    );

    res.json({
      success: true,
      total: enhanced.length,
      jobs: enhanced,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};



exports.getTopRankedJobs = async (req, res) => {
  try {
    const userId = req.Id; // logged-in user
    const userObjectId = new mongoose.Types.ObjectId(userId);

    const jobs = await JobPost.aggregate([
      /* --------------------------------------------------
       * 1️⃣ FILTER ACTIVE + APPROVED JOBS
       * -------------------------------------------------- */
      {
        $match: {
          status: "active",
          isApproved: true,
        },
      },

      /* --------------------------------------------------
       * 2️⃣ JOIN PAYMENT DETAILS
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "JobPostPayment",
          localField: "_id",
          foreignField: "jobId",
          as: "paymentInfo",
        },
      },

      {
        $addFields: {
          paymentAmount: { $ifNull: [{ $max: "$paymentInfo.amount" }, 0] },
          boostLevel: {
            $ifNull: [{ $max: "$paymentInfo.meta.boostLevel" }, 0],
          },
        },
      },

      /* --------------------------------------------------
       * 3️⃣ JOIN ENGAGEMENT DATA
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
       * 4️⃣ COMPUTE GLOBAL COUNTS
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
       * 5️⃣ CURRENT USER'S ENGAGEMENT
       * -------------------------------------------------- */
      {
        $addFields: {
          userEngagement: {
            $first: {
              $filter: {
                input: "$engagementData",
                as: "e",
                cond: {
                  $eq: ["$$e.userId", userObjectId],
                },
              },
            },
          },
        },
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
          isShared: { $ifNull: ["$userEngagement.shared", false] },
        },
      },

      /* --------------------------------------------------
       * 7️⃣ WEIGHTED ENGAGEMENT SCORE
       * -------------------------------------------------- */
      {
        $addFields: {
          engagementScore: {
            $add: [
              "$likeCount",
              { $multiply: ["$shareCount", 2] },
              { $multiply: ["$saveCount", 3] },
              { $multiply: ["$applyCount", 5] },
            ],
          },
        },
      },

      /* --------------------------------------------------
       * 8️⃣ JOIN COMPANY LOGIN
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
       * 9️⃣ JOIN COMPANY PROFILE
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
       * 🔟 JOIN COMPANY VISIBILITY SETTINGS
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "CompanyProfileVisibility",
          localField: "companyId",
          foreignField: "companyId",
          as: "visibilitySettings",
        },
      },
      {
        $unwind: {
          path: "$visibilitySettings",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* --------------------------------------------------
       * 1️⃣1️⃣ SORT BY RANKING
       * -------------------------------------------------- */
      {
        $sort: {
          paymentAmount: -1,
          boostLevel: -1,
          engagementScore: -1,
          createdAt: -1,
        },
      },

      /* --------------------------------------------------
       * 1️⃣2️⃣ LIMIT
       * -------------------------------------------------- */
      { $limit: 50 },

      /* --------------------------------------------------
       * 1️⃣3️⃣ CLEAN FINAL PROJECTION
       * -------------------------------------------------- */
      {
        $project: {
          jobId: "$_id",

          /* Job info */
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

          /* Ranking */
          paymentAmount: 1,
          boostLevel: 1,
          engagementScore: 1,

          /* Engagement Counts */
          likeCount: 1,
          shareCount: 1,
          saveCount: 1,
          applyCount: 1,
          viewCount: 1,

          /* Logged-in user flags */
          isLiked: 1,
          isSaved: 1,
          isApplied: 1,
          isViewed: 1,
          isShared: 1,

          /* Company Data */
          companyId: 1,

          postedBy: {
            name: "$companyLogin.name",
            email: "$companyLogin.email",
            phone: "$companyLogin.phone",
            companyName: "$companyLogin.companyName",
            whatsAppNumber: "$companyLogin.whatsAppNumber",
            position: "$companyLogin.position",
          },

          companyProfile: 1,
          visibilitySettings: 1,
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      total: jobs.length,
      jobs,
    });

  } catch (error) {
    console.error("❌ TOP RANKED JOB ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



