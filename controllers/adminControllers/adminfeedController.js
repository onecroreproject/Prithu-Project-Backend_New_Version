const FeedService = require("../../middlewares/services/AdminServices/adminUploadfileService");
const ChildAdmin =require("../../models/childAdminModel");
const Category=require('../../models/categorySchema');
const Feed=require("../../models/feedModel");
const ProfileSettings=require("../../models/profileSettingModel");
const Account=require("../../models/accountSchemaModel");
const User=require("../../models/userModels/userModel");



exports.adminFeedUpload = async (req, res) => {
  try {
    const adminId = req.Id;
    const roleRef = req.role; // "Admin" | "Child_Admin"
    const { language, categoryId, type, dec } = req.body;

    if (!adminId) return res.status(400).json({ message: "User ID missing" });
    if (!language || !categoryId || !type)
      return res.status(400).json({ message: "Missing required fields" });

    const files = req.localFiles || [];
    if (files.length === 0)
      return res.status(400).json({ message: "No files uploaded" });

    const results = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const description = Array.isArray(dec) ? dec[i] : dec;

      const feed = await FeedService.uploadFeed(
        { language, categoryId, type, dec: description },
        file,
        adminId,
        roleRef
      );

      results.push(feed);
    }

    return res.status(201).json({
      message: results.length > 1 ? "All feeds uploaded" : "Feed uploaded",
      feeds: results.map((r) => r.feed),
    });

  } catch (err) {
    console.error("Admin feed upload error:", err);
    return res.status(500).json({ message: err.message });
  }
};












exports.childAdminFeedUpload = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Check if user is a Child Admin
    const childAdmin = await ChildAdmin.findOne({ userId });
    if (!childAdmin) {
      return res.status(403).json({ message: "Only Child Admins can upload feeds" });
    }

    const { language, categoryId } = req.body;

    // ✅ Validate language
    if (!language) {
      return res.status(400).json({ message: "Language is required" });
    }

    // ✅ Validate categoryId
    if (!categoryId) {
      return res.status(400).json({ message: "CategoryId is required" });
    }

    // ✅ Ensure category exists
    const categoryDoc = await Category.findById(categoryId);
    if (!categoryDoc) {
      return res.status(404).json({ message: "Category not found" });
    }

    // ✅ Single file upload
    if (req.file) {
      const result = await FeedService.uploadFeed(
        { ...req.body, language, categoryId },
        req.file,
        userId
      );

      return res.status(201).json({
        message: "Feed uploaded successfully",
        feeds: [result.feed],
        categories: [result.categoryId],
        language: result.language,
        roleType: result.roleType
      });
    }

    // ✅ Multiple files upload
    if (req.files && req.files.length > 0) {
      const results = await FeedService.uploadFeedsMultiple(
        { ...req.body, language, categoryId },
        req.files,
        userId
      );

      return res.status(201).json({
        message: "All feeds uploaded successfully",
        feeds: results.map(r => r.feed),
        categories: results.map(r => r.categoryId),
        languages: results.map(r => r.language),
        roleTypes: results.map(r => r.roleType)
      });
    }

    return res.status(400).json({ message: "No files uploaded" });

  } catch (error) {
    console.error("Error uploading feed by Child Admin:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};




exports.getAllFeedAdmin = async (req, res) => {
  try {
    // Get all feeds
    const feeds = await Feed.find().sort({ createdAt: -1 }).lean();

    const results = await Promise.all(
      feeds.map(async (feed) => {
        let profile = null;
        
if (feed.roleRef === "Admin") {
  profile = await ProfileSettings.findOne({ adminId: feed.createdByAccount })
    .select("userName profileAvatar")
    .lean();
} else if (feed.roleRef === "Child_Admin") {
  profile = await ProfileSettings.findOne({ childAdminId: feed.createdByAccount })
    .select("userName profileAvatar")
    .lean();
} else if (feed.roleRef === "Account") {
  profile = await ProfileSettings.findOne({ accountId: feed.createdByAccount })
    .select("userName profileAvatar")
    .lean();
} else if (feed.roleRef === "User") {
  profile = await ProfileSettings.findOne({ userId: feed.createdByAccount })
    .select("userName profileAvatar")
    .lean();
}

        return {
          ...feed,
          creator: profile
            ? {
                userName: profile.userName || "Unknown",
                profileAvatar: profile.profileAvatar || null,
              }
            : { userName: "Unknown", profileAvatar: null },
        };
      })
    );

    res.status(200).json({ success: true, feeds: results });
  } catch (err) {
    console.error("Error in getAllFeedAdmin:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
};




exports.getUsersWillingToPost = async (req, res) => {
  try {
    const users = await User.aggregate([
      /* -------------------------------------------
       * 1️⃣ FILTER USERS WILLING TO POST
       * ----------------------------------------- */
      {
        $match: {
          allowToPost: { $in: ["interest", "allow"] },
          isActive: true,
          isBlocked: false,
        },
      },

      /* -------------------------------------------
       * 2️⃣ JOIN PROFILE SETTINGS
       * ----------------------------------------- */
      {
        $lookup: {
          from: "ProfileSettings",
          localField: "_id",
          foreignField: "userId",
          as: "profileSettings",
        },
      },
      {
        $unwind: {
          path: "$profileSettings",
          preserveNullAndEmptyArrays: true,
        },
      },

      /* -------------------------------------------
       * 3️⃣ FINAL PROJECTION
       * ----------------------------------------- */
      {
        $project: {
          _id: 1,
          userName: 1,
          email: 1,
          roles: 1,
          accountType: 1,
          allowToPost: 1,
          isActive: 1,
          createdAt: 1,
          lastActiveAt: 1,

          /* ---- SUBSCRIPTION ---- */
          subscription: {
            isActive: "$subscription.isActive",
          },

          /* ---- PROFILE DETAILS ---- */
          profile: {
            name: "$profileSettings.name",
            lastName: "$profileSettings.lastName",
            gender: "$profileSettings.gender",
            bio: "$profileSettings.bio",
            profileSummary: "$profileSettings.profileSummary",

            phoneNumber: "$profileSettings.phoneNumber",
            whatsAppNumber: "$profileSettings.whatsAppNumber",

            city: "$profileSettings.city",
            country: "$profileSettings.country",

            profileAvatar: "$profileSettings.profileAvatar",
            coverPhoto: "$profileSettings.coverPhoto",

            socialLinks: "$profileSettings.socialLinks",

            isPublished: "$profileSettings.isPublished",
          },
        },
      },

      /* -------------------------------------------
       * 4️⃣ SORT LATEST FIRST
       * ----------------------------------------- */
      {
        $sort: { createdAt: -1 },
      },
    ]);

    return res.status(200).json({
      success: true,
      total: users.length,
      users,
    });
  } catch (error) {
    console.error("❌ GET USERS WILLING TO POST ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
    });
  }
};



exports.updateUserPostPermission = async (req, res) => {
  try {
    const { userId } = req.params;
    const { allowToPost } = req.body;

    if (!userId || !allowToPost) {
      return res.status(400).json({
        success: false,
        message: "userId and allowToPost are required"
      });
    }

    if (!["allow", "interest", "notallow"].includes(allowToPost)) {
      return res.status(400).json({
        success: false,
        message: "Invalid allowToPost value"
      });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { allowToPost },
      { new: true }
    ).select("userName email allowToPost");

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "User post permission updated",
      user: updatedUser
    });

  } catch (error) {
    console.error("❌ UPDATE USER POST STATUS ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user status"
    });
  }
};


