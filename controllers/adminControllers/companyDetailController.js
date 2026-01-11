const PrithuCompany = require("../../models/companyDetailSchema");

/* =========================================================
   ADMIN: CREATE / UPDATE PRITHU COMPANY (UPSERT)
   ========================================================= */
exports.upsertPrithuCompany = async (req, res) => {
  try {
    const adminId = req.Id; // from auth middleware

    const {
      companyName,
      tagline,
      aboutShort,
      aboutLong,
      email,
      phone,
      address,
      socialMedia,
      logoUrl,
      faviconUrl,
      companyRegistrationNumber,
      gstNumber,
      privacyPolicyUrl,
      termsConditionsUrl,
      seo,
      isActive = true,
    } = req.body;

    if (!companyName) {
      return res.status(400).json({
        success: false,
        message: "companyName is required",
      });
    }

    const payload = {
      companyName,
      tagline,
      aboutShort,
      aboutLong,
      email,
      phone,
      address,
      socialMedia,
      logoUrl,
      faviconUrl,
      companyRegistrationNumber,
      gstNumber,
      privacyPolicyUrl,
      termsConditionsUrl,
      seo,
      isActive,
      updatedBy: adminId,
    };

    // Upsert → only ONE company document exists
    const company = await PrithuCompany.findOneAndUpdate(
      {},
      { $set: payload },
      {
        new: true,
        upsert: true,
      }
    );

    return res.status(200).json({
      success: true,
      message: "Prithu company details saved successfully",
      data: company,
    });
  } catch (err) {
    console.error("❌ Upsert Prithu Company Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================================================
   PUBLIC / USER: GET PRITHU COMPANY DETAILS
   ========================================================= */
exports.getPrithuCompany = async (req, res) => {
  try {
    const company = await PrithuCompany.findOne({ isActive: true })
      .select("-updatedBy") // hide admin-only fields
      .lean();

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company information not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: company,
    });
  } catch (err) {
    console.error("❌ Get Prithu Company Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

/* =========================================================
   ADMIN: TOGGLE COMPANY STATUS (ENABLE / DISABLE)
   ========================================================= */
exports.togglePrithuCompanyStatus = async (req, res) => {
  try {
    const { isActive } = req.body;

    const company = await PrithuCompany.findOneAndUpdate(
      {},
      { $set: { isActive } },
      { new: true }
    );

    if (!company) {
      return res.status(404).json({
        success: false,
        message: "Company record not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `Company ${isActive ? "activated" : "deactivated"} successfully`,
      data: company,
    });
  } catch (err) {
    console.error("❌ Toggle Company Status Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
