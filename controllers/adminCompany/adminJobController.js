const CompanyLogin = require("../../models/Job/CompanyModel/companyLoginSchema");
const CompanyProfile = require("../../models/Job/CompanyModel/companyProfile");
const JobPost = require("../../models/Job/JobPost/jobSchema");
const JobEngagement = require("../../models/Job/JobPost/jobEngagementSchema");
const JobPayment = require("../../models/Job/JobPost/jobPaymentSchema");
const JobApplication = require("../../models/userModels/job/userJobApplication");
const mongoose =require("mongoose")


exports.getAllJobs = async (req, res) => {
  try {
    const {
      search,
      status,
      isApproved,
      jobCategory,
      employmentType,
      country,
      state,
      city,
      companyId,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    /* --------------------------------------------------
     * 1️⃣ JOB FILTER
     * -------------------------------------------------- */
    const jobMatch = {};

    if (status) jobMatch.status = status;
    if (isApproved !== undefined)
      jobMatch.isApproved = isApproved === "true";
    if (jobCategory) jobMatch.jobCategory = jobCategory;
    if (employmentType) jobMatch.employmentType = employmentType;
    if (companyId) jobMatch.companyId = companyId;

    if (search) {
      jobMatch.$or = [
        { jobTitle: { $regex: search, $options: "i" } },
        { jobRole: { $regex: search, $options: "i" } },
        { keywordSearch: { $regex: search, $options: "i" } },
      ];
    }

    /* --------------------------------------------------
     * 2️⃣ COMPANY PROFILE LOCATION FILTER
     * -------------------------------------------------- */
    const profileMatch = {};
    if (country) profileMatch["companyProfile.country"] = country;
    if (state) profileMatch["companyProfile.state"] = state;
    if (city) profileMatch["companyProfile.city"] = city;

    /* --------------------------------------------------
     * 3️⃣ AGGREGATION PIPELINE
     * -------------------------------------------------- */
    const pipeline = [
      { $match: jobMatch },

      /* 🔗 JOIN COMPANY LOGIN */
      {
        $lookup: {
          from: "CompanyLogin",
          localField: "companyId",
          foreignField: "_id",
          as: "company",
        },
      },
      { $unwind: "$company" },

      /* 🔗 JOIN COMPANY PROFILE */
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

      /* 🌍 LOCATION FILTER */
      ...(Object.keys(profileMatch).length ? [{ $match: profileMatch }] : []),

      /* 🧹 REMOVE SENSITIVE FIELDS ONLY */
      {
        $unset: [
          "company.password",
          "company.otp",
          "company.otpExpiry",
          "company.__v",

          "companyProfile._id",
          "companyProfile.companyId",
          "companyProfile.createdAt",
          "companyProfile.updatedAt",
        ],
      },

      /* 🔃 SORT */
      {
        $sort: {
          [sortBy]: sortOrder === "asc" ? 1 : -1,
        },
      },
    ];

    const jobs = await JobPost.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      count: jobs.length,
      data: jobs,
    });
  } catch (error) {
    console.error("❌ Get All Jobs Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch jobs",
    });
  }
};





exports.suspendJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required",
      });
    }

    const job = await JobPost.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // If already inactive
    if (job.status === "inactive") {
      return res.status(400).json({
        success: false,
        message: "Job is already inactive",
      });
    }

    job.status = "inactive";
    job.isApproved = false;
    await job.save();

    return res.status(200).json({
      success: true,
      message: "Job rejected successfully",
      jobId: job._id,
      status: job.status,
    });
  } catch (error) {
    console.error("❌ Reject Job Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to reject job",
    });
  }
};





exports.rejectJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required",
      });
    }

    const job = await JobPost.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // 🚫 Prevent deleting active / inactive / draft jobs
    if (job.status !== "closed") {
      return res.status(400).json({
        success: false,
        message: "Only closed jobs can be deleted",
        currentStatus: job.status,
      });
    }

    await JobPost.findByIdAndDelete(jobId);

    return res.status(200).json({
      success: true,
      message: "Job deleted successfully",
      jobId,
    });
  } catch (error) {
    console.error("❌ Delete Job Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete job",
    });
  }
};





exports.approveJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required",
      });
    }

    const job = await JobPost.findById(jobId);

    if (!job) {
      return res.status(404).json({
        success: false,
        message: "Job not found",
      });
    }

    // Already active
    if (job.status === "active" && job.isApproved) {
      return res.status(400).json({
        success: false,
        message: "Job is already approved and active",
      });
    }

    job.status = "active";
    job.isApproved = true;

    await job.save();

   
    return res.status(200).json({
      success: true,
      message: "Job approved and activated successfully",
      jobId: job._id,
      status: job.status,
      isApproved: job.isApproved,
    });
  } catch (error) {
    console.error("❌ Approve Job Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve job",
    });
  }
};





exports.getJobByIdforAdmin = async (req, res) => {
  try {
    const jobId = req.params.jobId;

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "Job ID missing",
      });
    }

    const jobObjectId = new mongoose.Types.ObjectId(jobId);

    /* --------------------------------------------------
     * AGGREGATION PIPELINE
     * -------------------------------------------------- */
    const pipeline = [
      /* ---------------- MATCH JOB ---------------- */
      {
        $match: {
          _id: jobObjectId,
        },
      },

      /* ---------------- JOB ENGAGEMENT ---------------- */
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

      /* ---------------- COMPANY LOGIN ---------------- */
      {
        $lookup: {
          from: "CompanyLogin",
          localField: "companyId",
          foreignField: "_id",
          as: "companyLogin",
        },
      },
      { $unwind: "$companyLogin" },

      /* ---------------- COMPANY PROFILE ---------------- */
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

      /* ---------------- FINAL PROJECTION ---------------- */
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

          /* -------- TOTAL ENGAGEMENT COUNTS -------- */
          likeCount: 1,
          saveCount: 1,
          applyCount: 1,
          shareCount: 1,
          viewCount: 1,

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

