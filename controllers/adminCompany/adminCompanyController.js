const CompanyLogin = require("../../models/Job/CompanyModel/companyLoginSchema");
const CompanyProfile = require("../../models/Job/CompanyModel/companyProfile");
const JobPost = require("../../models/Job/JobPost/jobSchema");
const JobEngagement = require("../../models/Job/JobPost/jobEngagementSchema");
const JobPayment = require("../../models/Job/JobPost/jobPaymentSchema");
const JobApplication = require("../../models/userModels/job/userJobApplication");

/**
 * -------------------------------------------------------
 * 🏢 GET ALL COMPANIES (WITH PROFILE)
 * -------------------------------------------------------
 * Admin / Public listing
 */
exports.getAllCompanies = async (req, res) => {
  try {
    const {
      search,
      businessCategory,
      country,
      state,
      city,
      accountType,
      isVerified,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const baseMatch = {};

    if (accountType) baseMatch.accountType = accountType;
    if (isVerified !== undefined)
      baseMatch.isVerified = isVerified === "true";

    if (search) {
      baseMatch.$or = [
        { companyName: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { companyEmail: { $regex: search, $options: "i" } },
      ];
    }

    const profileMatch = {};
    if (businessCategory) profileMatch["profile.businessCategory"] = businessCategory;
    if (country) profileMatch["profile.country"] = country;
    if (state) profileMatch["profile.state"] = state;
    if (city) profileMatch["profile.city"] = city;

    const pipeline = [
      { $match: baseMatch },

      {
        $lookup: {
          from: "CompanyProfile",
          localField: "_id",
          foreignField: "companyId",
          as: "profile",
        },
      },
      {
        $unwind: {
          path: "$profile",
          preserveNullAndEmptyArrays: true,
        },
      },

      ...(Object.keys(profileMatch).length ? [{ $match: profileMatch }] : []),

      /* ✅ SAFE FIELD REMOVAL */
      {
        $unset: [
          "password",
          "otp",
          "otpExpiry",
          "__v",
          "profile._id",
          "profile.companyId",
          "profile.createdAt",
          "profile.updatedAt",
        ],
      },

      /* ✅ SORT */
      {
        $sort: {
          [sortBy]: sortOrder === "asc" ? 1 : -1,
        },
      },
    ];

    const companies = await CompanyLogin.aggregate(pipeline);

    return res.status(200).json({
      success: true,
      count: companies.length,
      data: companies,
    });
  } catch (error) {
    console.error("❌ Get Companies Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch companies",
    });
  }
};








/**
 * -------------------------------------------------------
 * 🏢 GET SINGLE COMPANY DETAILS
 * -------------------------------------------------------
 */
exports.getCompanyById = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required"
      });
    }

    const company = await CompanyLogin.findById(companyId)
      .select(
        "email name position phone whatsAppNumber companyName companyEmail accountType isVerified status profileAvatar createdAt"
      )
      .lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found"
      });
    }

    const profile = await CompanyProfile.findOne({ companyId }).lean();

    return res.status(200).json({
      success: true,
      data: {
        company,
        profile: profile || null
      }
    });

  } catch (error) {
    console.error("❌ Get Company Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch company details"
    });
  }
};








exports.inactivateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const updatedCompany = await CompanyLogin.findByIdAndUpdate(
      companyId,
      { status: "inactive" },
      { new: true }
    );

    if (!updatedCompany) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Company status updated to inactive",
      companyId: updatedCompany._id,
      status: updatedCompany.status,
    });
  } catch (error) {
    console.error("❌ Inactivate Company Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update company status",
    });
  }
};






exports.activateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const company = await CompanyLogin.findById(companyId);

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    // ❌ Prevent activation if banned
    if (company.status === "banned") {
      return res.status(403).json({
        success: false,
        message: "Banned companies cannot be activated",
      });
    }

    // Already active
    if (company.status === "active") {
      return res.status(400).json({
        success: false,
        message: "Company is already active",
      });
    }

    company.status = "active";
    await company.save();

    return res.status(200).json({
      success: true,
      message: "Company activated successfully",
      companyId: company._id,
    });
  } catch (error) {
    console.error("❌ Activate Company Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to activate company",
    });
  }
};





exports.removeCompany = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    session.startTransaction();

    /* --------------------------------------------------
     * 1️⃣ Verify company exists
     * -------------------------------------------------- */
    const company = await CompanyLogin.findById(companyId).session(session);
    if (!company) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: "Company not found",
      });
    }

    /* --------------------------------------------------
     * 2️⃣ Fetch all jobIds of this company
     * -------------------------------------------------- */
    const jobs = await JobPost.find(
      { companyId },
      { _id: 1 }
    ).session(session);

    const jobIds = jobs.map((j) => j._id);

    /* --------------------------------------------------
     * 3️⃣ Delete dependent data
     * -------------------------------------------------- */

    // Company profile
    await CompanyProfile.deleteOne({ companyId }).session(session);

    // Job engagements (by company + jobIds)
    await JobEngagement.deleteMany({
      $or: [
        { companyId },
        { jobId: { $in: jobIds } },
      ],
    }).session(session);

    // Job applications
    await JobApplication.deleteMany({ companyId }).session(session);

    // Job payments
    await JobPayment.deleteMany({ companyId }).session(session);

    // Job posts
    await JobPost.deleteMany({ companyId }).session(session);

    // Company login (LAST)
    await CompanyLogin.findByIdAndDelete(companyId).session(session);

    /* --------------------------------------------------
     * 4️⃣ Commit transaction
     * -------------------------------------------------- */
    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      success: true,
      message: "Company and all related data removed permanently",
      deleted: {
        companyId,
        jobsDeleted: jobIds.length,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ Remove Company Cascade Error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to remove company and related data",
    });
  }
};