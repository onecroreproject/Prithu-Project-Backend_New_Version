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
const DEFAULT_COVER_PHOTO = "https://res.cloudinary.com/demo/image/upload/v1730123456/default-cover.jpg";
const Following =require("../../models/userFollowingModel");
const CreatorFollower =require("../../models/creatorFollowerModel");
const Visibility = require("../../models/profileVisibilitySchema");
const Feed =require("../../models/feedModel");
const {calculateProfileCompletion} =require("../../middlewares/helper/profileCompletionCalulator");



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
  body("country").optional().isString(), // ✅ Added validation
  body("city").optional().isString(), // ✅ Added validation
];

// ------------------- User Profile Update -------------------
exports.userProfileDetailUpdate = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    // ✅ Validation
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    // ✅ Allowed fields (added country, city)
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
      "privacy",
      "maritalDate",
      "country", // ✅ Added
      "city", // ✅ Added
    ];

    const updateData = {};
    for (const field of allowedFields) {
      let value = req.body[field];
      if (["dateOfBirth", "maritalDate"].includes(field) && (!value || value === "null"))
        value = null;
      if (value !== undefined) updateData[field] = value;
    }

    // ✅ Parse & clean social links
    if (req.body.socialLinks) {
      try {
        let links = {};

        if (typeof req.body.socialLinks === "string") {
          links = JSON.parse(req.body.socialLinks);
        } else if (Array.isArray(req.body.socialLinks)) {
          const valid = req.body.socialLinks.find((item) => {
            try {
              return item && JSON.parse(item);
            } catch {
              return false;
            }
          });
          if (valid) links = JSON.parse(valid);
        } else if (typeof req.body.socialLinks === "object") {
          links = req.body.socialLinks;
        }

        if (Object.keys(links).length > 0) {
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
      } catch (err) {
        console.warn("⚠️ Invalid socialLinks data:", err.message);
      }
    }

    // ✅ Find or create profile
    const profile = await Profile.findOne({ userId });

    // ✅ Handle Cloudinary avatar
    if (req.cloudinaryFile) {
      if (profile?.profileAvatarId && profile.profileAvatarId !== req.cloudinaryFile.public_id) {
        await userDeleteFromCloudinary(profile.profileAvatarId);
      }

      updateData.profileAvatar = req.cloudinaryFile.url;
      updateData.profileAvatarId = req.cloudinaryFile.public_id;

      try {
        const { secure_url, public_id } = await removeImageBackground(req.cloudinaryFile.url);
        updateData.modifyAvatar = secure_url;
        updateData.modifyAvatarPublicId = public_id;
      } catch (err) {
        console.error("⚠️ Background removal failed:", err.message);
      }
    }

    // ✅ Handle username
    const userName = req.body.userName?.trim();
    if (userName) updateData.userName = userName;

    // ✅ Update or create profile
    const updatedProfile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // ✅ Sync username in User model
    if (userName) {
      await User.findByIdAndUpdate(userId, { $set: { userName } }, { new: true });
    }

    // ✅ Populate updated profile
    const populatedProfile = await Profile.findById(updatedProfile._id)
      .populate("userId", "userName email role")
      .lean();

    return res.status(200).json({
      message: "✅ User profile updated successfully",
      profile: populatedProfile,
    });
  } catch (error) {
    console.error("❌ Error in userProfileDetailUpdate:", error);
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
  let links = {};

  try {
    if (Array.isArray(req.body.socialLinks)) {
      // Handle array input (e.g., multiple form entries)
      const lastValid = req.body.socialLinks
        .slice() // copy to avoid mutating original
        .reverse()
        .find((item) => {
          if (!item || item === "undefined" || item === "null") return false;
          try {
            JSON.parse(item);
            return true;
          } catch {
            return false;
          }
        });

      if (lastValid) links = JSON.parse(lastValid);
    } else if (typeof req.body.socialLinks === "string") {
      if (req.body.socialLinks && req.body.socialLinks !== "undefined" && req.body.socialLinks !== "null") {
        links = JSON.parse(req.body.socialLinks);
      }
    } else if (typeof req.body.socialLinks === "object") {
      links = req.body.socialLinks;
    }

    // Assign only if we have valid links
    if (Object.keys(links).length > 0) {
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
  } catch (err) {
    console.warn("Invalid socialLinks data, skipping:", err.message);
  }
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
  const { secure_url, public_id } = await removeImageBackground(req.cloudinaryFile.url);

  updateData.modifyAvatar = secure_url;
  updateData.modifyAvatarPublicId = public_id; 
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
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });

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
      if ((field === "dateOfBirth" || field === "maritalDate") && (!value || value === "null"))
        value = null;
      if (value !== undefined) updateData[field] = value;
    });

    // ✅ Handle social media links safely
    if (req.body.socialLinks) {
      let links = {};

      try {
        if (Array.isArray(req.body.socialLinks)) {
          const lastValid = req.body.socialLinks
            .slice()
            .reverse()
            .find((item) => {
              if (!item || item === "undefined" || item === "null") return false;
              try {
                JSON.parse(item);
                return true;
              } catch {
                return false;
              }
            });
          if (lastValid) links = JSON.parse(lastValid);
        } else if (typeof req.body.socialLinks === "string") {
          if (req.body.socialLinks && req.body.socialLinks !== "undefined" && req.body.socialLinks !== "null") {
            links = JSON.parse(req.body.socialLinks);
          }
        } else if (typeof req.body.socialLinks === "object") {
          links = req.body.socialLinks;
        }

        if (Object.keys(links).length > 0) {
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
      } catch (err) {
        console.warn("Invalid socialLinks data, skipping:", err.message);
      }
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

        try {
          const { secure_url, public_id: bgRemovedId } = await removeImageBackground(url);
          updateData.modifyAvatar = secure_url;
          updateData.modifyAvatarPublicId = bgRemovedId;
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
      { childAdminId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // ✅ Ensure unique username across child admins
    if (userName) {
      const existing = await ChildAdmin.findOne({ userName }).lean();
      if (existing && existing._id.toString() !== childAdminId.toString())
        return res.status(400).json({ message: "Username already exists" });

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
      parentAdmin = await Admin.findById(populatedProfile.childAdminId.parentAdminId)
        .select("userName email adminType")
        .lean();
    }

    return res.status(200).json({
      message: "Child Admin profile updated successfully",
      profile: { ...populatedProfile, parentAdmin },
    });

  } catch (error) {
    console.error("Error in childAdminProfileDetailUpdate:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};




exports.toggleFieldVisibility = async (req, res) => {
  try {
    const userId = req.Id;       // From token middleware
    const role = req.role;        // From token middleware
    const { field, value, type = "general" } = req.body;

    if (!field || typeof value !== "boolean") {
      return res.status(400).json({ message: "Field and value are required" });
    }
 
    // Determine which profile to update based on role
    let profileQuery = {};
    if (role === "Admin") profileQuery = { adminId: userId, };
    else if (role === "Child_Admin") profileQuery = { childAdminId: userId,};
    else if (role === "User") profileQuery = { userId: userId,};
    else return res.status(403).json({ message: "Unauthorized role" });
 
    const profile = await Profile.findOne(profileQuery);
    if (!profile) return res.status(404).json({ message: "ProfileSettings not found" });
 
    // Toggle fields
    if (type === "general") {
      if (!(field in profile.visibility)) {
        return res.status(400).json({ message: "Invalid field for general visibility" });
      }
      profile.visibility[field] = value;
    } else if (type === "social") {
      if (!(field in profile.socialLinksVisibility)) {
        return res.status(400).json({ message: "Invalid field for social link visibility" });
      }
      profile.socialLinksVisibility[field] = value;
    } else {
      return res.status(400).json({ message: "Invalid type" });
    }
 
    await profile.save();
    return res.json({ success: true, message: "Visibility updated", profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
 
 
 
// Get visibility settings for logged-in user
exports.getVisibilitySettings = async (req, res) => {
  try {
    const userId = req.Id;   // From token middleware
    const role = req.role;    // From token middleware
  
 
    let profileQuery = {};
    if (role === "Admin") profileQuery = { adminId: userId};
    else if (role === "Child_Admin") profileQuery = { childAdminId: userId};
     else if (role === "User") profileQuery = { userId: userId,};
    else return res.status(403).json({ message: "Unauthorized role" });
 
    const profile = await Profile.findOne(profileQuery).select("visibility socialLinksVisibility");
    if (!profile) return res.status(404).json({ message: "ProfileSettings not found" });
 
    return res.json({
      success: true,
      visibility: profile.visibility,
      socialLinksVisibility: profile.socialLinksVisibility,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
 
 







exports.updateFieldVisibilityWeb = async (req, res) => {
  try {
    const userId = req.Id;  // From token middleware
    const role = req.role;  // From token middleware
    const { field, value, type = "general" } = req.body;

    // Validate input
    const allowedValues = ["public", "followers", "private"];
    if (!field || !allowedValues.includes(value)) {
      return res.status(400).json({
        message: "Invalid request. Field and value ('public' | 'followers' | 'private') required.",
      });
    }

    // Determine which profile to update
    let profileQuery = {};
    if (role === "Admin") profileQuery = { adminId: userId };
    else if (role === "Child_Admin") profileQuery = { childAdminId: userId };
    else if (role === "User") profileQuery = { userId: userId };
    else return res.status(403).json({ message: "Unauthorized role" });

    // Fetch profile
    const profile = await Profile.findOne(profileQuery).populate("visibility");
    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Fetch or create visibility doc
    let visibility = await Visibility.findById(profile.visibility);
    if (!visibility) {
      visibility = new Visibility();
      profile.visibility = visibility._id;
    }

    // Update field
    if (!(field in visibility.toObject())) {
      return res.status(400).json({ message: "Invalid visibility field name" });
    }

    visibility[field] = value;
    await visibility.save();
    await profile.save();

    return res.json({
      success: true,
      message: `Visibility for '${field}' updated to '${value}'`,
      visibility,
    });
  } catch (err) {
    console.error("❌ Visibility Update Error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};





exports.getVisibilitySettingsWeb = async (req, res) => {
  try {
    const userId = req.Id;   // From token middleware
    const role = req.role;   // From token middleware

    // Determine which profile to fetch
    let profileQuery = {};
    if (role === "Admin") profileQuery = { adminId: userId };
    else if (role === "Child_Admin") profileQuery = { childAdminId: userId };
    else if (role === "User") profileQuery = { userId: userId };
    else return res.status(403).json({ message: "Unauthorized role" });

    // Get visibility
    const profile = await Profile.findOne(profileQuery).populate("visibility");
    if (!profile || !profile.visibility) {
      return res.status(404).json({ message: "Visibility settings not found" });
    }

    return res.json({
      success: true,
      visibility: profile.visibility,
    });
  } catch (err) {
    console.error("❌ Get Visibility Error:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
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
        theme language privacy notifications socialLinks country city coverPhoto
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
      country="" ,
      city="" ,
      coverPhoto="",
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
        country,
         city,
          coverPhoto,
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













// Upload or Update Cover Photo
exports.updateCoverPhoto = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    if (!req.cloudinaryFile)
      return res.status(400).json({ message: "Cover photo file is missing" });

    const profile = await Profile.findOne({ userId });

    // Delete old photo if exists and not same
    if (profile?.coverPhotoId && profile.coverPhotoId !== req.cloudinaryFile.public_id) {
      await userDeleteFromCloudinary(profile.coverPhotoId);
    }

    // Prepare new data
    const updateData = {
      coverPhoto: req.cloudinaryFile.url,
      coverPhotoId: req.cloudinaryFile.public_id,
      modifiedCoverPhoto: req.cloudinaryFile.url,
      modifiedCoverPhotoId: req.cloudinaryFile.public_id,
    };

    // Create or Update
    const updatedProfile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    ).populate("userId", "userName email role");

    return res.status(200).json({
      message: "Cover photo updated successfully",
      coverPhoto: updatedProfile.coverPhoto,
      profile: updatedProfile,
    });
  } catch (error) {
    console.error("Error updating cover photo:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.deleteCoverPhoto = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    const profile = await Profile.findOne({ userId });
    if (!profile)
      return res.status(404).json({ message: "Profile not found" });

    // Delete from Cloudinary if exists
    if (profile.coverPhotoId) {
      await userDeleteFromCloudinary(profile.coverPhotoId);
    }

    // Replace with default cover photo
    profile.coverPhoto = DEFAULT_COVER_PHOTO;
    profile.coverPhotoId = null;
    profile.modifiedCoverPhoto = DEFAULT_COVER_PHOTO;
    profile.modifiedCoverPhotoId = null;
    await profile.save();

    return res.status(200).json({
      message: "Cover photo deleted successfully, default applied",
      coverPhoto: DEFAULT_COVER_PHOTO,
    });
  } catch (error) {
    console.error("Error deleting cover photo:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};




exports.getProfileCompletion = async (req, res) => {
  try {
    const userId = req.Id || req.params.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const profile = await Profile.findOne({ userId }).lean();

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // ✅ Get both completion percentage and missing fields
    const { completion, missingFields } = calculateProfileCompletion(profile);

    return res.status(200).json({
      success: true,
      userId,
      completionPercentage: completion,
      missingFields,
      message: `Profile completion is ${completion}%`,
    });
  } catch (error) {
    console.error("Error fetching profile completion:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while calculating profile completion",
      error: error.message,
    });
  }
};







exports.getProfileOverview = async (req, res) => {
  try {
    // 1️⃣ Get user ID from token (middleware should attach req.Id)
    const userId = req.Id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: user ID not found" });
    }

    // 2️⃣ Check if profile exists (optional validation)
    const profileExists = await Profile.exists({ userId: new mongoose.Types.ObjectId(userId) });
    if (!profileExists) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // 3️⃣ Get follower count (people following this user)
    const creatorData = await CreatorFollower.findOne(
      { creatorId: userId },
      { followerIds: 1 }
    ).lean();
    const followerCount = creatorData?.followerIds?.length || 0;

    // 4️⃣ Get following count (people this user follows)
    const followingData = await Following.findOne(
      { userId: userId },
      { followingIds: 1 }
    ).lean();
    const followingCount = followingData?.followingIds?.length || 0;

    // 5️⃣ Get total posts count (from Feed schema)
    const postCount = await Feed.countDocuments({
      createdByAccount: new mongoose.Types.ObjectId(userId),
      roleRef: "User",
      status: "Published",
    });

    // 6️⃣ Send clean overview
    return res.status(200).json({
      message: "Profile overview fetched successfully",
      data: {
        userId,
        followerCount,
        followingCount,
        postCount,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching profile overview:", error);
    return res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
};











 

