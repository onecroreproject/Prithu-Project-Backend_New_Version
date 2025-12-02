const CompanyProfile = require("../../../models/Job/CompanyModel/companyProfile");
const CompanyLogin = require("../../../models/Job/CompanyModel/companyLoginSchema");
const { uploadAndReplace } = require("../../../middlewares/utils/jobReplaceImage");
const JobPost=require("../../../models/Job/JobPost/jobSchema");

exports.updateCompanyProfile = async (req, res) => {
  try {
    const companyId = req.companyId || req.body.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const data = req.body;

    // FETCH existing profile for replacing Cloudinary images
    const existingProfile = await CompanyProfile.findOne({ companyId });

    /* ======================================================
     *  🔥 Upload Logo
     * ====================================================== */
    if (req.files?.logo?.[0]) {
      data.logo = await uploadAndReplace(
        req.files.logo[0].buffer,
        "company/logo",
        existingProfile?.logo
      );
    }

    /* ======================================================
     *  🔥 Upload Cover Image
     * ====================================================== */
    if (req.files?.coverImage?.[0]) {
      data.coverImage = await uploadAndReplace(
        req.files.coverImage[0].buffer,
        "company/cover",
        existingProfile?.coverImage
      );
    }

    /* ======================================================
     *  🔥 Convert googleLocation
     * ====================================================== */
    if (data.latitude && data.longitude) {
      data.googleLocation = {
        type: "Point",
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }

    /* ======================================================
     *  🔥 Sync with CompanyLogin
     * ====================================================== */
    const syncFields = {
      name: "name",
      position: "position",
      companyName: "companyName",
      companyEmail: "companyEmail",
      companyPhone: "phone",
    };

    const loginUpdates = {};
    for (let key in syncFields) {
      if (data[key] !== undefined) {
        loginUpdates[syncFields[key]] = data[key];
      }
    }

    if (Object.keys(loginUpdates).length > 0) {
      await CompanyLogin.findByIdAndUpdate(companyId, loginUpdates);
    }

    /* ======================================================
     *  🔥 Create / Update Company Profile
     * ====================================================== */
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
 // from auth middleware
    const jobId = req.params.id;  // from URL params

 
    

    if (!jobId) {
      return res.status(400).json({
        success: false,
        message: "jobId is required",
      });
    }

    // Fetch a single draft job
    const draft = await JobPost.findOne(
      {
        _id: jobId,
        status: "draft", // ensure it's a draft
      }
    ).lean();

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
    console.error("Get Draft By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching draft job",
      error: error.message,
    });
  }
};

