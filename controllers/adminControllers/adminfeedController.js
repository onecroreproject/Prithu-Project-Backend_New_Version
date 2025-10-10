const FeedService = require("../../middlewares/services/AdminServices/adminUploadfileService");
const ChildAdmin =require("../../models/childAdminModel");
const Category=require('../../models/categorySchema');
const Feed=require("../../models/feedModel");
const ProfileSettings=require("../../models/profileSettingModel");
const Account=require("../../models/accountSchemaModel");



exports.adminFeedUpload = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "User ID is required" });
    console.log(userId)
    const { language, categoryId, type } = req.body;

    // Validate inputs
    if (!language || !categoryId || !type || !["image", "video"].includes(type)) {
      return res.status(400).json({ message: "Invalid language, categoryId or type" });
    }

    // Ensure files
    const originalFiles = req.files || [];
    if (originalFiles.length === 0) return res.status(400).json({ message: "No files uploaded" });

    const cloudFiles = req.cloudinaryFiles || [];
    if (cloudFiles.length !== originalFiles.length) {
      return res.status(400).json({ message: "Mismatch between uploaded files and Cloudinary files" });
    }

    // ✅ Track already uploaded files to prevent duplicates
    const uploadedFilesSet = new Set();

    const feedResults = await Promise.all(
      cloudFiles.map((cloudFile, index) => {
        const fileKey = cloudFile.url || cloudFile.secure_url || originalFiles[index].originalname;
        if (uploadedFilesSet.has(fileKey)) return null; // skip duplicate
        uploadedFilesSet.add(fileKey);

        return FeedService.uploadFeed(
          { language, categoryId, type },
          {
            ...cloudFile,
            originalname: originalFiles[index].originalname,
            mimetype: originalFiles[index].mimetype,
          },
          userId
        );
      })
    );

    const filteredResults = feedResults.filter(Boolean); // remove nulls

    return res.status(201).json({
      message: filteredResults.length > 1 ? "All feeds uploaded successfully" : "Feed uploaded successfully",
      feeds: filteredResults.map(r => r.feed),
      categories: filteredResults.map(r => r.categoryId),
      languages: filteredResults.map(r => r.language),
      roleTypes: filteredResults.map(r => r.roleType),
      types: filteredResults.map(r => r.type),
    });
  } catch (error) {
    console.error("Error uploading feed:", error);
    return res.status(500).json({ message: error.message || "Server error" });
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

        // Case 1: roleRef available (Admin, Child_Admin, Creator, Account)
        if (feed.roleRef && feed.roleRef === "Admin" || feed.roleRef === "Child_Admin" ) {
          // Check in ProfileSettings by matching correct role field
          profile = await ProfileSettings.findOne(
              { userId: feed.createdByAccount }, // fallback for direct user ref
          )
            .select("userName profileAvatar")
            .lean();
        }

        // Case 2: No profile found but feed belongs to Account
        if (!profile && feed.roleRef === "Account") {
          const account = await Account.findById(feed.createdByAccount)
            .populate("userId")
            .lean();

          if (account) {
            profile = await ProfileSettings.findOne({ userId: account.userId })
              .select("userName profileAvatar")
              .lean();
          }
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
