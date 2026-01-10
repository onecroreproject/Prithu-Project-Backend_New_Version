const Feed = require('../../models/feedModel');
const Categories=require('../../models/categorySchema');
const  feedQueue=require("../../queue/feedPostQueue");
const { logUserActivity } = require("../../middlewares/helper/logUserActivity.js");
const redisClient=require("../../Config/redisConfig.js");
const User=require("../../models/userModels/userModel")
const { uploadToDrive } = require("../../middlewares/services/googleDriveMedia/googleDriveUploader.js");
const fs = require("fs");
const { getFeedUploadFolder } = require(
  "../../middlewares/services/googleDriveMedia/googleDriveFolderStructure.js"
);
const { oAuth2Client } = require(
  "../../middlewares/services/googleDriveMedia/googleDriverAuth.js" // wherever you export OAuth client
);





const extractHashtags = (text) => {
  const regex = /#([\p{L}\p{N}_]+)/gu;
  const tags = text?.match(regex);
  if (!tags) return [];
  return tags.map(t => t.slice(1).toLowerCase());
};







exports.creatorFeedUpload = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const userRole = req.role;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!req.localFile) {
      return res.status(400).json({ message: "No feed file uploaded" });
    }

    const {
      language = "en",
      categoryId,
      type,
      scheduleDate,
      dec = "",
      audience = "public",
      taggedFriends = [],
      ratio = "original",
      zoomLevel = 1,
      position = { x: 0, y: 0 },
      filter = "original",
      adjustments = {},
      location
    } = req.body;

    if (!categoryId || !type) {
      return res.status(400).json({ message: "categoryId and type are required" });
    }

    const hashtags = extractHashtags(dec || "");

    const categoryDoc = await Categories.findById(categoryId).lean();
    if (!categoryDoc) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    // 🔁 FILE INFO FROM MEMORY (changed)
    const {
      buffer,
      originalName,
      mimeType,
      size,
      fileHash,
      videoDuration
    } = req.localFile;

    let url = null;
    let storageType = "gdrive";
    let driveFileId = null;

    // 🔁 GOOGLE DRIVE UPLOAD (OAuth + buffer)
  
      try {
      // 📁 Resolve Drive folder based on role + media type
const folderId = await getFeedUploadFolder(
  oAuth2Client,
  userRole, // Admin | Child_Admin | User
  type      // image | video
);

// 🚀 Upload to Google Drive (inside folder)
// 🚀 Upload to Google Drive (inside folder)
const uploadResult = await uploadToDrive(
  buffer,
  originalName,
  mimeType,
  folderId
);

driveFileId = uploadResult.fileId;
storageType = "gdrive";

// ✅ IMPORTANT FIX
if (type === "image") {
  // 🖼️ Image → direct Google URL
  url = `https://lh3.googleusercontent.com/d/${driveFileId}`;
} else {
  // 🎥 Video → backend streaming endpoint
  url = `${process.env.BACKEND_URL}/media/${driveFileId}`;
}





      } catch (err) {
        console.error("Drive upload failed:", err.message);
        return res.status(500).json({
          message: "File upload failed"
        });
      }
    



    // 🔁 Duplicate check by hash
    if (fileHash) {
      const duplicateHash = await Feed.findOne({ fileHash }).lean();
      if (duplicateHash) {
        return res.status(409).json({
          message: "This file already exists",
          feedId: duplicateHash._id
        });
      }
    }

    // 🔁 Duplicate check by URL
if (url) {
  const duplicateUrl = await Feed.findOne({ contentUrl: url }).lean();
  if (duplicateUrl) {
    return res.status(409).json({
      message: "This file already exists",
      feedId: duplicateUrl._id
    });
  }
}


    // 🔁 Parse position
    let parsedPosition = { x: 0, y: 0 };
    if (typeof position === "string") {
      try {
        parsedPosition = JSON.parse(position);
      } catch {}
    } else {
      parsedPosition = position;
    }

    // 🔁 Parse adjustments
    let parsedAdjustments = {};
    if (typeof adjustments === "string") {
      try {
        parsedAdjustments = JSON.parse(adjustments);
      } catch {}
    } else {
      parsedAdjustments = adjustments;
    }

    // 🔁 Tagged users
    const taggedUsers = [];
    if (Array.isArray(taggedFriends)) {
      for (const friendId of taggedFriends) {
        const friend = await User.findById(friendId)
          .select("userName name")
          .lean();
        if (friend) {
          taggedUsers.push({
            userId: friend._id,
            userName: friend.userName,
            name: friend.name
          });
        }
      }
    }

    // 🔁 BUILD FEED DATA (structure unchanged)
const feedData = {
  type,
  language,
  category: categoryId,
  createdByAccount: userId,
  roleRef: userRole,

  // ✅ ROOT LEVEL (FIX)
  contentUrl: url,
  storageType: "gdrive",
  driveFileId: driveFileId,

  fileHash,
  duration: videoDuration,

  files: [
    {
      url,
      type,
      mimeType,
      size,
      duration: videoDuration || null,
      storageType: "gdrive",
      driveFileId: driveFileId,
      order: 0
    }
  ],

      editMetadata: {
        crop: {
          ratio,
          zoomLevel: parseFloat(zoomLevel) || 1,
          position: parsedPosition
        },
        filters: {
          preset: filter,
          adjustments: {
            brightness: parsedAdjustments.brightness || 0,
            contrast: parsedAdjustments.contrast || 0,
            saturation: parsedAdjustments.saturation || 0,
            fade: parsedAdjustments.fade || 0,
            temperature: parsedAdjustments.temperature || 0,
            vignette: parsedAdjustments.vignette || 0
          }
        }
      },

      taggedUsers,
      audience,
      location: location
        ? typeof location === "string"
          ? { name: location }
          : location
        : undefined,

      isScheduled: !!scheduleDate,
      scheduleDate: scheduleDate ? new Date(scheduleDate) : null,
      status: scheduleDate ? "Scheduled" : "Published",

      dec,
      hashtags
    };

    Object.keys(feedData).forEach(key => {
      if (feedData[key] === undefined) delete feedData[key];
    });

    const newFeed = await Feed.create(feedData);

    await Categories.findByIdAndUpdate(categoryId, {
      $addToSet: { feedIds: newFeed._id }
    });

    return res.status(201).json({
      message: scheduleDate
        ? "Feed scheduled successfully"
        : "Feed uploaded successfully",
      feed: newFeed
    });

  } catch (err) {
    console.error("Error creating feed:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message
    });
  }
};



 
 
 


















 
















exports.creatorFeedScheduleUpload = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const userRole = req.role;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // 1️⃣ File validation
    if (!req.localFile) {
      return res.status(400).json({ message: "Feed file is required" });
    }

    const {
      language = "en",
      categoryId,
      type,
      scheduleDate,
      dec = "",
      audience = "public",
      taggedFriends = [],
      ratio = "original",
      zoomLevel = 1,
      position = { x: 0, y: 0 },
      filter = "original",
      adjustments = {},
      location
    } = req.body;

    // 2️⃣ Required fields
    if (!categoryId || !type) {
      return res.status(400).json({
        message: "categoryId and type are required"
      });
    }

    const categoryDoc = await Categories.findById(categoryId).lean();
    if (!categoryDoc) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    // 3️⃣ Extract hashtags
    const hashtags = extractHashtags(dec);

    // 4️⃣ File info from memory (for GDrive)
    const {
      buffer,
      originalName,
      mimeType,
      size,
      fileHash,
      videoDuration
    } = req.localFile;

    let url = null;
    let driveFileId = null;
    let storageType = "gdrive";

        try {
      // 📁 Resolve Drive folder based on role + media type
const folderId = await getFeedUploadFolder(
  oAuth2Client,
  userRole, // Admin | Child_Admin | User
  type      // image | video
);

// 🚀 Upload to Google Drive (inside folder)
const uploadResult = await uploadToDrive(
  buffer,
  originalName,
  mimeType,
  folderId
);

      url = uploadResult.url;
      driveFileId = uploadResult.fileId;
      storageType = "gdrive";
    } catch (err) {
      console.error("❌ Drive upload failed:", err.message);
      return res.status(500).json({
        message: "File upload to Google Drive failed"
      });
    }

    if (!url) {
      return res.status(500).json({
        message: "File upload failed. No URL generated."
      });
    }

    // 6️⃣ Duplicate check by hash
    if (fileHash) {
      const duplicateHash = await Feed.findOne({ fileHash }).lean();
      if (duplicateHash) {
        return res.status(409).json({
          message: "This file already exists",
          feedId: duplicateHash._id
        });
      }
    }

    // 7️⃣ Duplicate check by URL
    const duplicateUrl = await Feed.findOne({ contentUrl: url }).lean();
    if (duplicateUrl) {
      return res.status(409).json({
        message: "This file already exists",
        feedId: duplicateUrl._id
      });
    }

    // 8️⃣ Parse position
    let parsedPosition = { x: 0, y: 0 };
    if (typeof position === "string") {
      try {
        parsedPosition = JSON.parse(position);
      } catch {}
    } else {
      parsedPosition = position;
    }

    // 9️⃣ Parse adjustments
    let parsedAdjustments = {};
    if (typeof adjustments === "string") {
      try {
        parsedAdjustments = JSON.parse(adjustments);
      } catch {}
    } else {
      parsedAdjustments = adjustments;
    }

    // 🔟 Tagged users
    const taggedUsers = [];
    if (Array.isArray(taggedFriends)) {
      for (const friendId of taggedFriends) {
        const friend = await User.findById(friendId)
          .select("userName name")
          .lean();
        if (friend) {
          taggedUsers.push({
            userId: friend._id,
            userName: friend.userName,
            name: friend.name
          });
        }
      }
    }

    // 🟢 Build feed data
    const feedData = {
      type,
      language,
      category: categoryId,
      createdByAccount: userId,
      roleRef: userRole,

      // ROOT FILE DATA
      contentUrl: url,
      storageType,
      driveFileId,

      fileHash,
      duration: videoDuration,

      files: [
        {
          url,
          type,
          mimeType,
          size,
          duration: videoDuration || null,
          storageType,
          driveFileId,
          order: 0
        }
      ],

      editMetadata: {
        crop: {
          ratio,
          zoomLevel: parseFloat(zoomLevel) || 1,
          position: parsedPosition
        },
        filters: {
          preset: filter,
          adjustments: {
            brightness: parsedAdjustments.brightness || 0,
            contrast: parsedAdjustments.contrast || 0,
            saturation: parsedAdjustments.saturation || 0,
            fade: parsedAdjustments.fade || 0,
            temperature: parsedAdjustments.temperature || 0,
            vignette: parsedAdjustments.vignette || 0
          }
        }
      },

      taggedUsers,
      audience,
      location: location
        ? typeof location === "string"
          ? { name: location }
          : location
        : undefined,

      dec,
      hashtags,

      isScheduled: !!scheduleDate,
      scheduleDate: scheduleDate ? new Date(scheduleDate) : null,
      status: scheduleDate ? "Scheduled" : "Published"
    };

    // Remove undefined values
    Object.keys(feedData).forEach(key => {
      if (feedData[key] === undefined) delete feedData[key];
    });

    const newFeed = await Feed.create(feedData);

    // 🔵 Attach feed to category
    await Categories.findByIdAndUpdate(categoryId, {
      $addToSet: { feedIds: newFeed._id }
    });

    // 🟡 Handle scheduling
    if (scheduleDate) {
      const scheduleTime = new Date(scheduleDate).getTime();
      const now = Date.now();
      const delay = scheduleTime - now;

      if (delay > 0) {
        await feedQueue.add(
          { feedId: newFeed._id },
          {
            delay,
            removeOnComplete: true,
            removeOnFail: true
          }
        );
      }

      await logUserActivity({
        userId,
        actionType: "SCHEDULE_POST",
        targetId: newFeed._id,
        targetModel: "Feed",
        metadata: { platform: "web" }
      });

      return res.status(200).json({
        message: "📅 Feed scheduled successfully",
        feed: newFeed
      });
    }

    // 🟢 Immediate publish
    return res.status(201).json({
      message: "🟢 Feed uploaded successfully",
      feed: newFeed
    });

  } catch (err) {
    console.error("❌ Error in creatorFeedScheduleUpload:", err);
    return res.status(500).json({
      message: "Upload failed",
      error: err.message
    });
  }
};











