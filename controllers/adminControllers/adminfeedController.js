const FeedService = require("../../middlewares/services/AdminServices/adminUploadfileService");
const ChildAdmin =require("../../models/childAdminModel");
const Category=require('../../models/categorySchema');
const Feed=require("../../models/feedModel");
const ProfileSettings=require("../../models/profileSettingModel");
const Account=require("../../models/accountSchemaModel");
const User=require("../../models/userModels/userModel");
const { uploadToDrive } = require("../../middlewares/services/googleDriveMedia/googleDriveUploader");
const { getFeedUploadFolder } = require("../../middlewares/services/googleDriveMedia/googleDriveFolderStructure");
const { oAuth2Client } = require("../../middlewares/services/googleDriveMedia/googleDriverAuth");



exports.adminFeedUpload = async (req, res) => {
  try {
    const adminId = req.Id;
    const roleRef = req.role; // "Admin" | "Child_Admin"

    const { 
      language, 
      categoryId, 
      type, 
      dec, 
      audience = "public",
      location,
      taggedFriends = [],
      ratio = "original",
      zoomLevel = 1,
      position = { x: 0, y: 0 },
      filter = "original",
      adjustments = {},
      scheduleDate
    } = req.body;

    if (!adminId) {
      return res.status(400).json({ message: "User ID missing" });
    }

    if (!language || !categoryId || !type) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const files = req.localFiles || [];
    if (files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // 📁 Resolve Drive folder once per request
    const folderId = await getFeedUploadFolder(
      oAuth2Client,
      roleRef,
      type
    );

    const results = [];
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      try {
        const file = files[i];
        const description = Array.isArray(dec) ? dec[i] : dec;

        if (!file.buffer) {
          throw new Error("File buffer missing");
        }

        // 🚀 Upload to Google Drive (NO fallback)
        const uploadResult = await uploadToDrive(
          file.buffer,
          file.originalname || file.filename,
          file.mimetype,
          folderId
        );

        const driveUrl = uploadResult.url;
        const driveFileId = uploadResult.fileId;

        if (!driveUrl || !driveFileId) {
          throw new Error("Drive upload failed");
        }

        // ✅ Feed data (ROOT LEVEL DRIVE INFO)
        const feedData = {
          language,
          categoryId,        // ✅ correct schema field
          type,
          dec: description,
          audience,
          location,

          contentUrl: driveUrl,
          storageType: "gdrive",
          driveFileId,

          taggedFriends: Array.isArray(taggedFriends)
            ? taggedFriends
            : [],

          editMetadata: {
            crop: {
              ratio,
              zoomLevel: parseFloat(zoomLevel) || 1,
              position:
                typeof position === "string"
                  ? JSON.parse(position)
                  : position
            },
            filters: {
              preset: filter,
              adjustments:
                typeof adjustments === "string"
                  ? JSON.parse(adjustments)
                  : adjustments
            }
          },

          isScheduled: !!scheduleDate,
          scheduleDate: scheduleDate
            ? new Date(scheduleDate)
            : null,
          status: scheduleDate ? "Scheduled" : "Published"
        };

        const feed = await FeedService.uploadFeed(
          feedData,
          {
            ...file,
            url: driveUrl,
            storageType: "gdrive",
            driveFileId
          },
          adminId,
          roleRef
        );

        results.push(feed);

      } catch (err) {
        console.error(`Error processing file ${i}:`, err);
        errors.push({
          fileIndex: i,
          filename: files[i]?.filename,
          error: err.message
        });
      }
    }

    if (results.length === 0) {
      return res.status(500).json({
        message: "All file uploads failed",
        errors
      });
    }

    return res.status(201).json({
      message:
        results.length > 1
          ? `${results.length} feeds uploaded successfully`
          : "Feed uploaded successfully",
      feeds: results.map(r => r.feed || r),
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (err) {
    console.error("Admin feed upload error:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
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


