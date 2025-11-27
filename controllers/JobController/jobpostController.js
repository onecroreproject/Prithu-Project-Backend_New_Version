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

/* =============================================================================================
   1️⃣ CREATE OR UPDATE JOB POST
   ============================================================================================= */
exports.createOrUpdateJob = async (req, res) => {
  try {
    const companyId = req.companyId||req.body.companyId; // from authentication middleware

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "Unauthorized: companyId missing",
      });
    }

    const body = req.body;
    const jobId = body.jobId || null;

    // 🔹 Fetch company profile snapshot for caching inside job post
    const company = await CompanyLogin.findById(companyId).lean();
    const profile = await CompanyProfile.findOne({ companyId }).lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company account not found",
      });
    }

    // Prepare job snapshot
    const companySnapshot = {
      companyId,
      companyName: company.companyName,
      companyLogo: profile?.logo || "",
      companyIndustry: profile?.businessCategory || "",
      companyWebsite: profile?.socialLinks?.website || "",
    };

    /* =================================================================================
       FILE UPLOADS — Cloudinary (Logo/Cover already handled in company profile)
       ================================================================================= */
    const jobImage = req.files?.jobImage?.[0];

    let finalImage = null;

    if (jobImage) {
      finalImage = await uploadAndReplace(
        jobImage.buffer,
        "jobs/images",
        body.oldImage
      );
    }

    /* =================================================================================
       JOB DATA (NORMALIZED TO MATCH SCHEMA)
       ================================================================================= */
    const jobData = {
      ...companySnapshot,

      jobTitle: body.jobTitle,
      jobRole: body.jobRole,
      jobCategory: body.jobCategory,
      jobSubCategory: body.jobSubCategory,
      employmentType: body.employmentType,
      workMode: body.workMode,
      shiftType: body.shiftType,
      openingsCount: body.openingsCount,
      urgencyLevel: body.urgencyLevel,

      city: body.city,
      state: body.state,
      country: body.country,
      pincode: body.pincode,
      fullAddress: body.fullAddress,
      remoteEligibility: body.remoteEligibility,

      googleLocation:
        body.latitude && body.longitude
          ? {
              type: "Point",
              coordinates: [Number(body.longitude), Number(body.latitude)],
            }
          : undefined,

      jobDescription: body.jobDescription,
      responsibilities: body.responsibilities,
      dailyTasks: body.dailyTasks,
      keyDuties: body.keyDuties,

      requiredSkills: body.requiredSkills,
      preferredSkills: body.preferredSkills,
      technicalSkills: body.technicalSkills,
      softSkills: body.softSkills,
      toolsAndTechnologies: body.toolsAndTechnologies,

      educationLevel: body.educationLevel,
      degreeRequired: body.degreeRequired,
      certificationRequired: body.certificationRequired,
      minimumExperience: body.minimumExperience,
      maximumExperience: body.maximumExperience,
      freshersAllowed: body.freshersAllowed,

      salaryType: body.salaryType,
      salaryMin: body.salaryMin,
      salaryMax: body.salaryMax,
      salaryCurrency: body.salaryCurrency,
      salaryVisibility: body.salaryVisibility,
      benefits: body.benefits,
      perks: body.perks,
      incentives: body.incentives,
      bonuses: body.bonuses,

      hiringManagerName: body.hiringManagerName,
      hiringManagerEmail: body.hiringManagerEmail,
      hiringManagerPhone: body.hiringManagerPhone,
      interviewMode: body.interviewMode,
      interviewLocation: body.interviewLocation,
      interviewRounds: body.interviewRounds,
      hiringProcess: body.hiringProcess,
      interviewInstructions: body.interviewInstructions,

      startDate: body.startDate,
      endDate: body.endDate,
      contractDuration: body.contractDuration,
      jobTimings: body.jobTimings,
      workingHours: body.workingHours,
      workingDays: body.workingDays,
      holidaysType: body.holidaysType,

      resumeRequired: body.resumeRequired,
      coverLetterRequired: body.coverLetterRequired,
      documentsRequired: body.documentsRequired,

      tags: body.tags,
      skillKeywords: body.skillKeywords,
      keywordSearch: body.keywordSearch,

      status: body.status || "draft",
      isApproved: false,
      isFeatured: false,
      isPromoted: false,
      priorityScore: body.isPaid ? 15 : 1,
    };

    if (finalImage) jobData.jobImage = finalImage;

    /* =================================================================================
       CASE A: UPDATE JOB
       ================================================================================= */
    if (jobId) {
      const job = await JobPost.findOne({ _id: jobId, companyId });

      if (!job)
        return res.status(404).json({
          success: false,
          message: "Job not found or unauthorized",
        });

      await JobPost.updateOne({ _id: jobId }, { $set: jobData });

      return res.status(200).json({
        success: true,
        message: "Job updated successfully",
        jobId,
      });
    }

    /* =================================================================================
       CASE B: CREATE NEW JOB
       ================================================================================= */
    const newJob = await JobPost.create(jobData);

    return res.status(201).json({
      success: true,
      message: "Job created successfully",
      job: newJob,
    });
  } catch (error) {
    console.error("❌ Error creating/updating job:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/* =============================================================================================
   2️⃣ GET ALL JOBS (Public + Search + Filters)
   ============================================================================================= */
exports.getAllJobs = async (req, res) => {
  try {
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
console.log(employmentType)
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

    // 1) Try TEXT SEARCH
    let jobs = [];

    if (q) {
      let textFilter = { ...baseFilter, $text: { $search: q } };

      jobs = await JobPost.find(textFilter)
        .sort({ score: { $meta: "textScore" } })
        .lean();

      // 2) If text search gives NO results → fallback to regex
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

    res.status(200).json({
      success: true,
      total: jobs.length,
      jobs,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


/* =============================================================================================
   3️⃣ GET JOB BY ID + Company Snapshot
   ============================================================================================= */
exports.getJobById = async (req, res) => {
  try {
    const job = await JobPost.findById(req.params.id).lean();

    if (!job)
      return res.status(404).json({ success: false, message: "Job not found" });

    // Auto-expire
    if (job.endDate < new Date() && job.status === "active") {
      await JobPost.findByIdAndUpdate(job._id, { status: "expired" });
      job.status = "expired";
    }

    const company = await CompanyLogin.findById(job.companyId).lean();
    const profile = await CompanyProfile.findOne({ companyId: job.companyId }).lean();

    job.company = {
      name: company.companyName,
      logo: profile?.logo,
      industry: profile?.businessCategory,
      website: profile?.socialLinks?.website,
    };

    res.json({ success: true, job });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
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
       * 2️⃣ JOIN PAYMENTS (Paid Jobs First)
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
          paymentAmount: {
            $ifNull: [{ $max: "$paymentInfo.amount" }, 0],
          },
          boostLevel: {
            $ifNull: [{ $max: "$paymentInfo.meta.boostLevel" }, 0],
          },
        },
      },

      /* --------------------------------------------------
       * 3️⃣ JOIN ENGAGEMENT (likes, saves, applies, etc.)
       * -------------------------------------------------- */
      {
        $lookup: {
          from: "jobengagements", // MUST MATCH COLLECTION NAME
          localField: "_id",
          foreignField: "jobId",
          as: "engagementData",
        },
      },

      /* --------------------------------------------------
       * 4️⃣ CALCULATE ENGAGEMENT SCORE
       * -------------------------------------------------- */
      {
        $addFields: {
          engagementScore: {
            $sum: {
              $map: {
                input: "$engagementData",
                as: "e",
                in: {
                  $add: [
                    { $cond: ["$$e.liked", 1, 0] },
                    { $cond: ["$$e.shared", 2, 0] },
                    { $cond: ["$$e.saved", 3, 0] },
                    { $cond: ["$$e.applied", 5, 0] },
                  ],
                },
              },
            },
          },
        },
      },

      /* --------------------------------------------------
       * 5️⃣ FINAL RANKING SORT
       * -------------------------------------------------- */
      {
        $sort: {
          paymentAmount: -1,   // Paid jobs first
          boostLevel: -1,      // Higher boost → higher rank
          isPromoted: -1,
          isFeatured: -1,
          priorityScore: -1,
          engagementScore: -1, // Users interactions
          createdAt: -1,       // Recent jobs
        },
      },

      /* OPTIONAL LIMIT */
      { $limit: 50 },
    ]);

    res.status(200).json({
      success: true,
      total: jobs.length,
      jobs,
    });
  } catch (error) {
    console.error("TOP RANKED ERROR:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};
