const CompanyProfile = require("../../../models/Job/CompanyModel/companyProfile");
const CompanyLogin = require("../../../models/Job/CompanyModel/companyLoginSchema");
const { uploadAndReplace } = require("../../../middlewares/utils/jobReplaceImage");

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
