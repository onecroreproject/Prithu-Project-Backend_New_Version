const { body, validationResult } = require("express-validator");
const mongoose = require("mongoose");
const Profile = require("../../models/profileSettingModel");
const User = require("../../models/userModels/userModel");
const Admin = require("../../models/adminModels/adminModel");
const ChildAdmin = require("../../models/childAdminModel");
const UserLanguage = require('../../models/userModels/userLanguageModel');
const { calculateAge } = require("../../middlewares/helper/calculateAge");
const { userDeleteFromCloudinary } = require("../../middlewares/services/userCloudnaryUpload");
const { adminDeleteFromCloudinary } = require("../../middlewares/services/adminCloudnaryUpload");
const { removeImageBackground } = require("../../middlewares/helper/backgroundRemover"); 


// ------------------- Validation Middleware -------------------
exports.validateUserProfileUpdate = [
  body("phoneNumber").optional().isMobilePhone().withMessage("Invalid phone number"),
  body("bio").optional().isString(),
  body("maritalStatus").optional().isString(),
  body("maritalDate").optional().isString(),
  body("dateOfBirth").optional().isISO8601().toDate(),
  body("profileAvatar").optional().isString(),
  body("userName").optional().isString(),
  body("displayName").optional().isString(),
  body("theme").optional().isIn(["light", "dark"]),
  body("language").optional().isString(),
  body("timezone").optional().isString(),
  body("details").optional(),
  body("gender").optional(),
  body("notifications").optional().isObject(),
  body("privacy").optional().isObject(),
];


// ------------------- User Profile Update -------------------
exports.userProfileDetailUpdate = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });

    const allowedFields = [
      "phoneNumber",
      "bio",
      "displayName",
      "dateOfBirth",
      "maritalStatus",
      "theme",
      "language",
      "timezone",
      "gender",
      "details",
      "notifications",
      "privacy"
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      let value = req.body[field];
      if ((field === "dateOfBirth" || field === "maritalDate") && (!value || value === "null"))
        value = null;
      if (value !== undefined) updateData[field] = value;
    });

    // ✅ Handle social media links
    if (req.body.socialLinks && typeof req.body.socialLinks === "object") {
      updateData.socialLinks = {
        facebook: req.body.socialLinks.facebook || "",
        instagram: req.body.socialLinks.instagram || "",
        twitter: req.body.socialLinks.twitter || "",
        linkedin: req.body.socialLinks.linkedin || "",
        github: req.body.socialLinks.github || "",
        youtube: req.body.socialLinks.youtube || "",
        website: req.body.socialLinks.website || ""
      };
    }

    const profile = await Profile.findOne({ userId });

    // ✅ Handle Cloudinary avatar
    if (req.cloudinaryFile) {
      // Delete old avatar if exists
      if (profile?.profileAvatarId && profile.profileAvatarId !== req.cloudinaryFile.public_id) {
        await userDeleteFromCloudinary(profile.profileAvatarId);
      }

      // Set new avatar
      updateData.profileAvatar = req.cloudinaryFile.url;
      updateData.profileAvatarId = req.cloudinaryFile.public_id;

      // Remove background and save to modifyAvatar
      try {
        const bgRemovedUrl = await removeImageBackground(req.cloudinaryFile.url);
        updateData.modifyAvatar = bgRemovedUrl;
      } catch (err) {
        console.error("Error removing background:", err);
      }
    }

    // ✅ Handle username update
    const userName = req.body.userName?.trim();
    if (userName) updateData.userName = userName;

    // ✅ Upsert profile (create if first-time, update if exists)
    const updatedProfile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // ✅ Update username in User collection
    if (userName) {
      await User.findByIdAndUpdate(userId, { $set: { userName } }, { new: true });
    }

    // ✅ Populate user details
    const populatedProfile = await Profile.findById(updatedProfile._id)
      .populate("userId", "userName email role")
      .lean();

    return res.status(200).json({
      message: "User profile updated successfully",
      profile: populatedProfile,
    });

  } catch (error) {
    console.error("Error in userProfileDetailUpdate:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};




// ------------------- Admin Profile Update -------------------

exports.adminProfileDetailUpdate = async (req, res) => {
  try {
    const adminId = req.Id || req.body.adminId;
    if (!adminId) return res.status(400).json({ message: "adminId is required" });

    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });

    // ✅ Allowed fields to update
    const allowedFields = [
      "phoneNumber",
      "bio",
      "displayName",
      "dateOfBirth",
      "maritalStatus",
      "theme",
      "maritalDate",
      "language",
      "timezone",
      "details",
      "notifications",
      "privacy",
      "gender",
    ];

    const updateData = {};

    // ✅ Handle basic fields
    allowedFields.forEach((field) => {
      let value = req.body[field];
      if ((field === "dateOfBirth" || field === "maritalDate") && (!value || value === "null"))
        value = null;
      if (value !== undefined) updateData[field] = value;
    });

    // ✅ Handle social media links safely
 if (req.body.socialLinks) {
  let links;
console.log(req.body.socialLinks)
  if (Array.isArray(req.body.socialLinks)) {
    // If multiple entries, pick the last valid JSON string
    const lastValid = req.body.socialLinks.reverse().find((item) => {
      try {
        JSON.parse(item);
        return true;
      } catch {
        return false;
      }
    });
    links = JSON.parse(lastValid);
  } else if (typeof req.body.socialLinks === "string") {
    links = JSON.parse(req.body.socialLinks);
  } else {
    links = req.body.socialLinks;
  }

  updateData.socialLinks = {
    facebook: links.facebook || "",
    instagram: links.instagram || "",
    twitter: links.twitter || "",
    linkedin: links.linkedin || "",
    github: links.github || "",
    youtube: links.youtube || "",
    website: links.website || "",
  };
}


    // ✅ Handle Cloudinary avatar upload
    if (req.cloudinaryFiles?.length > 0) {
      const { url, public_id } = req.cloudinaryFiles[0];
      const oldProfile = await Profile.findOne({ adminId });

      if (!oldProfile?.profileAvatarId || oldProfile.profileAvatarId !== public_id) {
        if (oldProfile?.profileAvatarId) await adminDeleteFromCloudinary(oldProfile.profileAvatarId);
        updateData.profileAvatar = url;
        updateData.profileAvatarId = public_id;

        try {
          const bgRemovedUrl = await removeImageBackground(url);
          updateData.modifyAvatar = bgRemovedUrl;
        } catch (err) {
          console.error("Error removing background:", err);
        }
      }
    }

    // ✅ Handle username update
    const userName = req.body.userName?.trim();
    if (Object.keys(updateData).length === 0 && !userName)
      return res.status(400).json({ message: "No fields provided for update" });

    const profile = await Profile.findOneAndUpdate(
      { adminId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    if (userName) {
      const existing = await Admin.findOne({ userName }).lean();
      if (existing && existing._id.toString() !== adminId.toString())
        return res.status(400).json({ message: "Username already exists" });

      await Admin.findByIdAndUpdate(
        adminId,
        { $set: { userName, profileSettings: profile._id } },
        { new: true }
      );

      await Profile.findOneAndUpdate(
        { adminId },
        { $set: { userName } },
        { new: true }
      );
    }

    // ✅ Populate and return updated profile
    const populatedProfile = await Profile.findById(profile._id)
      .populate("adminId", "userName email role")
      .lean();

    return res.status(200).json({
      message: "Admin profile updated successfully",
      profile: populatedProfile,
    });

  } catch (error) {
    console.error("Error in adminProfileDetailUpdate:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};





// ------------------- Child Admin Profile Update -------------------
exports.childAdminProfileDetailUpdate = async (req, res) => {
  try {
    const childAdminId = req.Id || req.body.childAdminId;
    if (!childAdminId)
      return res.status(400).json({ message: "childAdminId is required" });

    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res
        .status(400)
        .json({ message: "Validation failed", errors: errors.array() });

    const childAdmin = await ChildAdmin.findById(childAdminId).lean();
    if (!childAdmin)
      return res.status(404).json({ message: "Child Admin not found" });

    const allowedFields = [
      "phoneNumber",
      "bio",
      "displayName",
      "dateOfBirth",
      "maritalStatus",
      "theme",
      "maritalDate",
      "language",
      "timezone",
      "details",
      "notifications",
      "privacy",
      "gender",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      let value = req.body[field];
      if (
        (field === "dateOfBirth" || field === "maritalDate") &&
        (!value || value === "null")
      )
        value = null;
      if (value !== undefined) updateData[field] = value;
    });

    // ✅ Handle social media links
    if (req.body.socialLinks && typeof req.body.socialLinks === "object") {
      updateData.socialLinks = {
        facebook: req.body.socialLinks.facebook || "",
        instagram: req.body.socialLinks.instagram || "",
        twitter: req.body.socialLinks.twitter || "",
        linkedin: req.body.socialLinks.linkedin || "",
        github: req.body.socialLinks.github || "",
        youtube: req.body.socialLinks.youtube || "",
        website: req.body.socialLinks.website || "",
      };
    }

    // ✅ Handle Cloudinary avatar
    if (req.cloudinaryFiles?.length > 0) {
      const { url, public_id } = req.cloudinaryFiles[0];
      const oldProfile = await Profile.findOne({ childAdminId });

      if (!oldProfile?.profileAvatarId || oldProfile.profileAvatarId !== public_id) {
        if (oldProfile?.profileAvatarId)
          await adminDeleteFromCloudinary(oldProfile.profileAvatarId);

        updateData.profileAvatar = url;
        updateData.profileAvatarId = public_id;

        // Optional: Remove background for modified avatar
        try {
          const bgRemovedUrl = await removeImageBackground(url);
          updateData.modifyAvatar = bgRemovedUrl;
        } catch (err) {
          console.error("Error removing background:", err);
        }
      }
    }

    // ✅ Handle username update
    const userName = req.body.userName?.trim();
    if (Object.keys(updateData).length === 0 && !userName)
      return res
        .status(400)
        .json({ message: "No fields provided for update" });

    const profile = await Profile.findOneAndUpdate(
      { childAdminId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // ✅ Ensure unique username across child admins
    if (userName) {
      const existing = await ChildAdmin.findOne({ userName }).lean();
      if (existing && existing._id.toString() !== childAdminId.toString())
        return res
          .status(400)
          .json({ message: "Username already exists" });

      await ChildAdmin.findByIdAndUpdate(
        childAdminId,
        { $set: { userName, profileSettings: profile._id } },
        { new: true }
      );

      await Profile.findOneAndUpdate(
        { childAdminId },
        { $set: { userName } },
        { new: true }
      );
    }

    // ✅ Populate child admin + parent admin data
    const populatedProfile = await Profile.findById(profile._id)
      .populate("childAdminId", "userName email role parentAdminId")
      .lean();

    let parentAdmin = null;
    if (populatedProfile?.childAdminId?.parentAdminId) {
      parentAdmin = await Admin.findById(
        populatedProfile.childAdminId.parentAdminId
      )
        .select("userName email adminType")
        .lean();
    }

    return res.status(200).json({
      message: "Child Admin profile updated successfully",
      profile: { ...populatedProfile, parentAdmin },
    });
  } catch (error) {
    console.error("Error in childAdminProfileDetailUpdate:", error);
    return res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};














exports.getUserProfileDetail = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Fetch all necessary fields, including socialLinks
    const profile = await Profile.findOne(
      { userId },
      `
        bio displayName maritalStatus phoneNumber dateOfBirth
        profileAvatar modifyAvatar timezone maritalDate gender
        theme language privacy notifications socialLinks
      `
    )
      .populate("userId", "userName email")
      .lean();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // ✅ Define avatar URLs
    const profileAvatarUrl = profile.profileAvatar || null;
    const modifyAvatarUrl = profile.modifyAvatar || null;

    // ✅ Extract fields with defaults
    const {
      bio = null,
      displayName = null,
      maritalStatus = null,
      phoneNumber = null,
      dateOfBirth = null,
      timezone = null,
      maritalDate = null,
      gender = null,
      theme = "light",
      language = "en",
      privacy = {},
      notifications = {},
      socialLinks = {},
      userId: user = {},
    } = profile;

    // ✅ Build response
    return res.status(200).json({
      message: "Profile fetched successfully",
      profile: {
        bio,
        displayName,
        maritalStatus,
        phoneNumber,
        dateOfBirth,
        age: calculateAge(dateOfBirth),
        gender,
        userName: user.userName || null,
        userEmail: user.email || null,
        profileAvatar: profileAvatarUrl,
        modifyAvatar: modifyAvatarUrl,
        timezone,
        maritalDate,
        theme,
        language,
        privacy,
        notifications,
        socialLinks: {
          facebook: socialLinks.facebook || "",
          instagram: socialLinks.instagram || "",
          twitter: socialLinks.twitter || "",
          linkedin: socialLinks.linkedin || "",
          github: socialLinks.github || "",
          youtube: socialLinks.youtube || "",
          website: socialLinks.website || "",
        },
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};







exports.getAdminProfileDetail = async (req, res) => {
  try {
    const userId = req.Id;
    const role = req.role;

    console.log({ userId, role });

    if (!userId || !role) {
      return res.status(400).json({ message: "User ID and role are required" });
    }

    let profileQuery = {};
    let populateOptions = {};
    let profileType = "";

    if (role === "Admin") {
      profileQuery = { adminId: userId };
      populateOptions = {
        path: "adminId",
        select: "userName email adminType profileSettings",
      };
      profileType = "Admin";
    } else if (role === "Child_Admin") {
      profileQuery = { childAdminId: userId };
      populateOptions = {
        path: "childAdminId",
        select: "userName email adminType parentAdminId profileSettings",
      };
      profileType = "Child_Admin";
    } else {
      return res.status(403).json({ message: "Unauthorized role" });
    }

    const profile = await Profile.findOne(
      profileQuery,
      "bio displayName maritalStatus phoneNumber dateOfBirth profileAvatar modifyAvatar timezone maritalDate socialLinks"
    )
      .populate(populateOptions)
      .lean();

    if (!profile) {
      return res.status(404).json({
        message: `${profileType} profile not found`,
        profile: null,
      });
    }

    // ✅ Fetch parent admin if Child_Admin
    let parentAdmin = null;
    if (role === "Child_Admin" && profile.childAdminId?.parentAdminId) {
      parentAdmin = await Admin.findById(profile.childAdminId.parentAdminId)
        .select("userName email adminType")
        .lean();
    }

    // ✅ Helper function for age calculation
    const calculateAge = (dob) => {
      if (!dob) return null;
      const birthDate = new Date(dob);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age;
    };

    // ✅ Avatar URLs
    const profileAvatarUrl = profile.profileAvatar || null;
    const modifyAvatarUrl = profile.modifyAvatar || null;

    // ✅ Extract social links (with null safety)
    const socialLinks = {
      facebook: profile.socialLinks?.facebook || null,
      instagram: profile.socialLinks?.instagram || null,
      linkedin: profile.socialLinks?.linkedin || null,
      twitter: profile.socialLinks?.twitter || null,
      youtube: profile.socialLinks?.youtube || null,
    };

    // ✅ Final response
    return res.status(200).json({
      message: `${profileType} profile fetched successfully`,
      profile: {
        bio: profile.bio || null,
        displayName: profile.displayName || null,
        maritalStatus: profile.maritalStatus || null,
        phoneNumber: profile.phoneNumber || null,
        dateOfBirth: profile.dateOfBirth || null,
        age: calculateAge(profile.dateOfBirth),
        userName:
          role === "Admin"
            ? profile.adminId?.userName
            : profile.childAdminId?.userName || null,
        userEmail:
          role === "Admin"
            ? profile.adminId?.email
            : profile.childAdminId?.email || null,
        adminType:
          role === "Admin"
            ? profile.adminId?.adminType
            : profile.childAdminId?.adminType || null,
        profileAvatar: profileAvatarUrl,
        modifyAvatar: modifyAvatarUrl,
        timezone: profile.timezone || null,
        maritalDate: profile.maritalDate || null,
        socialLinks, // ✅ Added field
        parentAdmin: parentAdmin
          ? {
              userName: parentAdmin.userName,
              email: parentAdmin.email,
              adminType: parentAdmin.adminType,
            }
          : null,
        profileSettings:
          role === "Admin"
            ? profile.adminId?.profileSettings
            : profile.childAdminId?.profileSettings || null,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};












 

