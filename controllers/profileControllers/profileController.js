const { body, validationResult } = require("express-validator");
const Profile = require("../../models/profileSettingModel");
const User = require("../../models/userModels/userModel");
const Admin = require("../../models/adminModels/adminModel");
const ChildAdmin = require("../../models/childAdminModel");
const UserLanguage=require('../../models/userModels/userLanguageModel')
const mongoose=require('mongoose')

// ✅ Validation middleware
exports.validateUserProfileUpdate = [
  body("phoneNumber").optional().isMobilePhone().withMessage("Invalid phone number"),
  body("bio").optional().isString(),
  body("maritalStatus").optional().isString(),
  body("dateOfBirth").optional().isISO8601().toDate(),
  body("profileAvatar").optional().isString(),
  body("userName").optional().isString(),
  body("displayName").optional().isString(),
  body("theme").optional().isIn(["light", "dark"]),
  body("language").optional().isString(),
  body("timezone").optional().isString(),
  body("details").optional(),
  body("notifications").optional().isObject(),
  body("privacy").optional().isObject(),
];



exports.userNameChecking=async (req,res)=>{
  
}
// ✅ Update profile controller
exports.userProfileDetailUpdate = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // ✅ Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }

    // ✅ Collect allowed fields
    const allowedFields = [
      "phoneNumber",
      "bio",
      "displayName",
      "dateOfBirth",
      "maritalStatus",
      "theme",
      "language",
      "timezone",
      "details",
      "notifications",
      "privacy",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.file?.path) updateData.profileAvatar = req.file.path;

    const userName = req.body.userName;

    if (Object.keys(updateData).length === 0 && !userName) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    // ---- Update Profile for user ----
    let profile = await Profile.findOneAndUpdate(
      { userId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // ---- Handle username uniqueness ----
    if (userName) {
      const existing = await User.findOne({ userName }).lean();
      if (existing && existing._id.toString() !== userId.toString()) {
        return res.status(400).json({ message: "Username already exists" });
      }

      await User.findByIdAndUpdate(
        userId,
        { userName, $set: { profileSettings: profile._id } },
        { new: true }
      ).lean();

      profile.userName = userName;
      await profile.save();
    }

    // ✅ Populate linked user (with username & email)
    const populatedProfile = await Profile.findById(profile._id)
      .populate("userId", "userName email")
      .lean();

    return res.status(200).json({
      message: "Profile updated successfully",
      profile: populatedProfile,
    });
  } catch (error) {
    console.error("Error in userProfileDetailUpdate:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};


exports.adminProfileDetailUpdate =  async (req, res) => {
    try {
      const adminId = req.Id || req.body.adminId;
      if (!adminId) {
        return res.status(400).json({ message: "adminId is required" });
      }

      // ---- Check validation errors ----
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Validation failed", errors: errors.array() });
      }

      // ---- Allowed fields for profile update ----
      const allowedFields = [
        "phoneNumber",
        "bio",
        "displayName",
        "dateOfBirth",
        "maritalStatus",
        "theme",
        "language",
        "timezone",
        "details",
        "notifications",
        "privacy",
      ];

      const updateData = {};
      allowedFields.forEach((field) => {
        if (req.body[field] !== undefined) updateData[field] = req.body[field];
      });

      if (req.file?.path) updateData.profileAvatar = req.file.path;

      const userName = req.body.userName;

      if (Object.keys(updateData).length === 0 && !userName) {
        return res.status(400).json({ message: "No fields provided for update" });
      }

      // ---- Update or create profile ----
      let profile = await Profile.findOneAndUpdate(
        { adminId },
        { $set: updateData },
        { new: true, upsert: true }
      );

      // ---- Handle username uniqueness ----
      if (userName) {
        const existing = await Admin.findOne({ userName }).lean();
        if (existing && existing._id.toString() !== adminId.toString()) {
          return res.status(400).json({ message: "Username already exists" });
        }

        await Admin.findByIdAndUpdate(
          adminId,
          { userName, profileSettings: profile._id },
          { new: true }
        ).lean();

        profile.userName = userName;
        await profile.save();
      }

      // ---- Populate linked admin info ----
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




exports.childAdminProfileDetailUpdate = async (req, res) => {
  try {
    const childAdminId = req.Id || req.body.childAdminId;
    if (!childAdminId) {
      return res.status(400).json({ message: "childAdminId is required" });
    }

    // ---- Validate request body ----
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ message: "Validation failed", errors: errors.array() });
    }

    // ---- Fetch Child Admin ----
    const childAdmin = await ChildAdmin.findById(childAdminId).lean();
    if (!childAdmin) {
      return res.status(404).json({ message: "Child Admin not found" });
    }

    // ---- Allowed profile fields ----
    const allowedFields = [
      "phoneNumber",
      "bio",
      "displayName",
      "dateOfBirth",
      "maritalStatus",
      "theme",
      "language",
      "timezone",
      "details",
      "notifications",
      "privacy",
    ];

    const updateData = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    });

    if (req.file?.path) updateData.profileAvatar = req.file.path;

    const userName = req.body.userName;

    if (Object.keys(updateData).length === 0 && !userName) {
      return res.status(400).json({ message: "No fields provided for update" });
    }

    // ---- Update or create profile ----
    let profile = await Profile.findOneAndUpdate(
      { childAdminId },
      { $set: updateData },
      { new: true, upsert: true }
    );

    // ---- Handle username uniqueness ----
    if (userName) {
      const existing = await ChildAdmin.findOne({ userName }).lean();
      if (existing && existing._id.toString() !== childAdminId.toString()) {
        return res.status(400).json({ message: "Username already exists" });
      }

      await ChildAdmin.findByIdAndUpdate(
        childAdminId,
        { userName, profileSettings: profile._id },
        { new: true }
      ).lean();

      profile.userName = userName;
      await profile.save();
    }

    // ---- Populate linked child admin info ----
    const populatedProfile = await Profile.findById(profile._id)
      .populate("childAdminId", "userName email role parentAdminId")
      .lean();

    // ---- Fetch parent admin if exists ----
    let parentAdmin = null;
    if (populatedProfile.childAdminId?.parentAdminId) {
      parentAdmin = await Admin.findById(populatedProfile.childAdminId.parentAdminId)
        .select("userName email adminType")
        .lean();
    }

    return res.status(200).json({
      message: "Child Admin profile updated successfully",
      profile: {
        ...populatedProfile,
        parentAdmin,
      },
    });
  } catch (error) {
    console.error("Error in childAdminProfileDetailUpdate:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};










exports.getUserProfileDetail = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const profile = await Profile.findOne(
      { userId },
      "bio displayName maritalStatus phoneNumber dateOfBirth profileAvatar timezone"
    )
      .populate("userId", "userName email")
      .lean();

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    const host = req.protocol + "://" + req.get("host");
    const profileAvatarUrl = profile.profileAvatar
      ? host + "/" + profile.profileAvatar.replace(/^\/+/, "")
      : null;

    return res.status(200).json({
      message: "Profile fetched successfully",
      profile: {
        bio: profile.bio || null,
        displayName: profile.displayName || null,
        maritalStatus: profile.maritalStatus || null,
        phoneNumber: profile.phoneNumber || null,
        dateOfBirth: profile.dateOfBirth || null,
        userName: profile.userId?.userName || null,
        profileAvatar: profileAvatarUrl,
        timezone: profile.timezone || null,
        userEmail: profile.userId?.email || null,
      },
    });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};





exports.getAdminProfileDetail = async (req, res) => {
  try {
    const adminId = req.Id || req.body.adminId;
    if (!adminId) return res.status(400).json({ message: "Admin ID is required" });

    const profile = await Profile.findOne(
      { adminId },
      "bio displayName maritalStatus phoneNumber dateOfBirth profileAvatar timezone"
    )
      .populate("adminId", "userName email adminType")
      .lean();

    if (!profile) return res.status(404).json({ message: "Admin profile not found" });

    const host = req.protocol + "://" + req.get("host");
    const profileAvatarUrl = profile.profileAvatar
      ? host + "/" + profile.profileAvatar.replace(/^\/+/, "")
      : null;

    return res.status(200).json({
      message: "Admin profile fetched successfully",
      profile: {
        bio: profile.bio || null,
        displayName: profile.displayName || null,
        maritalStatus: profile.maritalStatus || null,
        phoneNumber: profile.phoneNumber || null,
        dateOfBirth: profile.dateOfBirth || null,
        userName: profile.adminId?.userName || null,
        profileAvatar: profileAvatarUrl,
        timezone: profile.timezone || null,
        userEmail: profile.adminId?.email || null,
        adminType: profile.adminId?.adminType || null,
      },
    });
  } catch (error) {
    console.error("Error fetching admin profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};




exports.getChildAdminProfileDetail = async (req, res) => {
  try {
    const childAdminId = req.Id || req.body.childAdminId;
    if (!childAdminId) return res.status(400).json({ message: "Child Admin ID is required" });

    const profile = await Profile.findOne(
      { childAdminId },
      "bio displayName maritalStatus phoneNumber dateOfBirth profileAvatar timezone"
    )
      .populate({
        path: "childAdminId",
        select: "userName email adminType parentAdminId"
      })
      .lean();

    if (!profile) return res.status(404).json({ message: "Child Admin profile not found" });

    // Fetch parent admin if exists
    let parentAdmin = null;
    if (profile.childAdminId?.parentAdminId) {
      parentAdmin = await Admin.findById(profile.childAdminId.parentAdminId)
        .select("userName email adminType")
        .lean();
    }

    const host = req.protocol + "://" + req.get("host");
    const profileAvatarUrl = profile.profileAvatar
      ? host + "/" + profile.profileAvatar.replace(/^\/+/, "")
      : null;

    return res.status(200).json({
      message: "Child Admin profile fetched successfully",
      profile: {
        bio: profile.bio || null,
        displayName: profile.displayName || null,
        maritalStatus: profile.maritalStatus || null,
        phoneNumber: profile.phoneNumber || null,
        dateOfBirth: profile.dateOfBirth || null,
        userName: profile.childAdminId?.userName || null,
        profileAvatar: profileAvatarUrl,
        timezone: profile.timezone || null,
        userEmail: profile.childAdminId?.email || null,
        adminType: profile.childAdminId?.adminType || null,
        parentAdmin: parentAdmin
          ? {
              userName: parentAdmin.userName,
              email: parentAdmin.email,
              adminType: parentAdmin.adminType,
            }
          : null,
      },
    });
  } catch (error) {
    console.error("Error fetching child admin profile:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};







 

