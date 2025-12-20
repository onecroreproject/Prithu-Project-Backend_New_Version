const CompanyProfile = require("../../../models/Job/CompanyModel/companyProfile");
const CompanyLogin = require("../../../models/Job/CompanyModel/companyLoginSchema");
const JobPost=require("../../../models/Job/JobPost/jobSchema");
const { deleteLocalCompanyFile } = require("../../../middlewares/services/JobsService/companyUploadSpydy");
const path = require("path");
const mongoose=require("mongoose")

exports.updateCompanyProfile = async (req, res) => {
  try {
    const companyId = req.companyId;

    if (!companyId)
      return res.status(400).json({ success: false, message: "companyId is required" });

    const data = req.body;

    // Fetch existing profile
    const existing = await CompanyProfile.findOne({ companyId });

    // Host for generating URL
    const host = `https://${req.get("host")}`;

    /* ------------------------------------------------------
     *  LOGO
     * ------------------------------------------------------ */
    if (req.files?.logo?.length > 0) {
      const file = req.files.logo[0];

      // Delete old logo
      if (existing?.logo) {
        const filePath = path.join(__dirname, "../../", existing.logo.replace(host, ""));
        deleteLocalCompanyFile(filePath);
      }

      data.logo = `${host}/media/company/${companyId}/logo/${file._savedName}`;
    }

    /* ------------------------------------------------------
     *  COVER IMAGE
     * ------------------------------------------------------ */
    if (req.files?.coverImage?.length > 0) {
      const file = req.files.coverImage[0];

      if (existing?.coverImage) {
        const filePath = path.join(__dirname, "../../", existing.coverImage.replace(host, ""));
        deleteLocalCompanyFile(filePath);
      }

      data.coverImage = `${host}/media/company/${companyId}/cover/${file._savedName}`;
    }

    /* ------------------------------------------------------
     *  PROFILE AVATAR
     * ------------------------------------------------------ */
    if (req.files?.profileAvatar?.length > 0) {
      const file = req.files.profileAvatar[0];

      // Save to CompanyLogin
      await CompanyLogin.findByIdAndUpdate(companyId, {
        profileAvatar: `${host}/media/company/${companyId}/avatar/${file._savedName}`,
      });
    }

    /* ------------------------------------------------------
     *  Convert googleLocation
     * ------------------------------------------------------ */
    if (data.latitude && data.longitude) {
      data.googleLocation = {
        type: "Point",
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    /* ------------------------------------------------------
     *  Sync with CompanyLogin
     * ------------------------------------------------------ */
    const syncMap = {
      name: "name",
      position: "position",
      companyName: "companyName",
      companyEmail: "companyEmail",
      companyPhone: "phone",
    };

    const loginUpdates = {};
    Object.keys(syncMap).forEach((key) => {
      if (data[key] !== undefined) loginUpdates[syncMap[key]] = data[key];
    });

    if (Object.keys(loginUpdates).length > 0) {
      await CompanyLogin.findByIdAndUpdate(companyId, loginUpdates);
    }

    /* ------------------------------------------------------
     *  Save or Update Company Profile
     * ------------------------------------------------------ */
    let profile = await CompanyProfile.findOne({ companyId });

    if (!profile) {
      data.companyId = companyId;
      profile = await CompanyProfile.create(data);
    } else {
      await CompanyProfile.updateOne({ companyId }, { $set: data });
      profile = await CompanyProfile.findOne({ companyId });
    }

    return res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      profile,
    });

  } catch (error) {
    console.error("❌ Error updating company profile:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating profile",
      error: error.message,
    });
  }
};





exports.getRecentDrafts = async (req, res) => {
  try {
    const companyId = req.companyId; // from auth middleware

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No companyId found",
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch draft jobs
    const drafts = await JobPost.find(
      {
        companyId,
        status: "draft",
      },
      {
        jobTitle: 1,
        jobRole: 1,
        jobCategory: 1,
        jobSubCategory: 1,
        updatedAt: 1,
        createdAt: 1,
        employmentType: 1,
        city: 1,
        state: 1,
        salaryMin: 1,
        salaryMax: 1,
      }
    )
      .sort({ updatedAt: -1 }) // Recent drafts first
      .skip(skip)
      .limit(limit)
      .lean();

    // Count total drafts
    const totalDrafts = await JobPost.countDocuments({
      companyId,
      status: "draft",
    });

    return res.status(200).json({
      success: true,
      message: "Recent draft jobs fetched successfully",
      page,
      limit,
      totalDrafts,
      totalPages: Math.ceil(totalDrafts / limit),
      drafts,
    });
  } catch (error) {
    console.error("Get Recent Drafts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching drafts",
      error: error.message,
    });
  }
};



exports.getDraftById = async (req, res) => {
  try {
    const companyId = req.companyId;   // from auth middleware
    const jobId = req.params.id;       // from URL params

    if (!companyId || !jobId) {
      return res.status(400).json({
        success: false,
        message: "companyId and jobId are required",
      });
    }

    // ✅ Validate Mongo ObjectId
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid jobId",
      });
    }

    /* --------------------------------------------------
     * 🔍 FETCH DRAFT JOB (SCHEMA SAFE)
     * -------------------------------------------------- */
    const draft = await JobPost.findOne({
      _id: jobId,
      companyId,

    }).lean();

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: "Draft job not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Draft job fetched successfully",
      draft,
    });

  } catch (error) {
    console.error("❌ Get Draft By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching draft job",
      error: error.message,
    });
  }
};






exports.getCompanyProfile = async (req, res) => {
  try {
    const companyId = req.companyId; // from middleware / JWT
    

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    /* --------------------------------------------------
     * 1️⃣ FETCH COMPANY LOGIN INFORMATION
     * -------------------------------------------------- */
    const companyLogin = await CompanyLogin.findById(companyId)
      .select("-password -otp -otpExpiry") // remove sensitive fields
      .lean();

    if (!companyLogin) {
      return res.status(404).json({
        success: false,
        message: "Company login not found",
      });
    }

    /* --------------------------------------------------
     * 2️⃣ FETCH COMPANY PROFILE
     * -------------------------------------------------- */
    const companyProfile = await CompanyProfile.findOne({ companyId })
      .lean();

    // Profile may not exist if company hasn't filled it yet
    if (!companyProfile) {
      return res.status(200).json({
        success: true,
        profileCompleted: false,
        company: companyLogin,
        profile: null,
      });
    }

    /* --------------------------------------------------
     * 3️⃣ SEND COMPLETE COMPANY INFO
     * -------------------------------------------------- */
    return res.status(200).json({
      success: true,
      profileCompleted: true,
      company: companyLogin,
      profile: companyProfile,
    });

  } catch (error) {
    console.error("GET COMPANY PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};




exports.getSingleCompanyProfile = async (req, res) => {
  try {
    const companyId = req.params.companyId; // FIXED — always string

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    /* --------------------------------------------------
     * 1️⃣ FETCH COMPANY LOGIN INFORMATION
     * -------------------------------------------------- */
    const companyLogin = await CompanyLogin.findById(companyId)
      .select("-password -otp -otpExpiry")
      .lean();

    if (!companyLogin) {
      return res.status(404).json({
        success: false,
        message: "Company login not found",
      });
    }

    /* --------------------------------------------------
     * 2️⃣ FETCH COMPANY PROFILE
     * -------------------------------------------------- */
    const companyProfile = await CompanyProfile.findOne({ companyId }).lean();

    /* --------------------------------------------------
     * 3️⃣ FETCH ALL JOBS POSTED BY THIS COMPANY
     * -------------------------------------------------- */
    const companyJobs = await JobPost.find({ companyId })
      .sort({ createdAt: -1 }) // latest first
      .lean();

    /* --------------------------------------------------
     * Profile not created yet
     * -------------------------------------------------- */
    if (!companyProfile) {
      return res.status(200).json({
        success: true,
        profileCompleted: false,
        company: companyLogin,
        profile: null,
        jobs: companyJobs, // 👉 still return jobs even if profile missing
      });
    }

    /* --------------------------------------------------
     * 4️⃣ SEND COMPLETE COMPANY INFO
     * -------------------------------------------------- */
    return res.status(200).json({
      success: true,
      profileCompleted: true,
      company: companyLogin,
      profile: companyProfile,
      jobs: companyJobs, // 👉 INCLUDED in response
    });

  } catch (error) {
    console.error("GET COMPANY PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};









