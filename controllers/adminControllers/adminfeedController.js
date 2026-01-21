const FeedService = require("../../middlewares/services/AdminServices/adminUploadfileService");
const ChildAdmin = require("../../models/childAdminModel");
const Category = require('../../models/categorySchema');
const Feed = require("../../models/feedModel");
const ProfileSettings = require("../../models/profileSettingModel");
const Account = require("../../models/accountSchemaModel");
const User = require("../../models/userModels/userModel");
const { uploadToDrive } = require("../../middlewares/services/googleDriveMedia/googleDriveUploader");
const { getFeedUploadFolder } = require("../../middlewares/services/googleDriveMedia/googleDriveFolderStructure");
const { oAuth2Client } = require("../../middlewares/services/googleDriveMedia/googleDriverAuth");
const mongoose = require("mongoose");
const { prithuDB } = require("../../database")





// Helper to check database connection
// ✅ Helper delete local file
const fs = require("fs");
const deleteLocalAdminFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error("❌ Local file delete failed:", err.message);
  }
};

// ✅ DB Connection checker
const checkDBConnection = () => {
  return prithuDB.readyState === 1;
};

exports.adminFeedUpload = async (req, res) => {
  try {
    const adminId = req.Id || "68edd60dff4c9aa0a69663ba";
    const roleRef = req.role || "Admin";
    const mediaFiles = req.localFiles || [];
    const audioFile = req.localAudioFile || null;
    const { categoryId, language = "en", caption = "", designData, scheduleTime, isScheduled = false, audience = "public" } = req.body;
    if (!categoryId || !mediaFiles.length) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    const category = await Category.findById(categoryId).lean();
    if (!category) return res.status(404).json({ success: false, message: "Category not found" });
    // Parse Template/Design Metadata
    let baseDesignMetadata = { isTemplate: false, uploadType: 'normal', overlayElements: [] };
    try {
      if (designData) {
        const parsed = typeof designData === "string" ? JSON.parse(designData) : designData;
        baseDesignMetadata = { ...baseDesignMetadata, ...parsed };
      }
    } catch (e) {
      console.error("Design parsing failed", e);
    }

    // Explicitly set template flag if uploadType is template
    if (baseDesignMetadata.uploadType === 'template') {
      baseDesignMetadata.isTemplate = true;
    }
    // 1. Upload Shared Audio (if any)

    let uploadedAudio = null;
    if (audioFile) {

      const audioFolder = await getFeedUploadFolder(oAuth2Client, roleRef, "audio");
      console.log("working in controller")
      const upload = await uploadToDrive(audioFile.buffer, audioFile.originalname, audioFile.mimetype, audioFolder);
      if (upload?.fileId) {
        uploadedAudio = {
          url: `/media/${upload.fileId}`,
          driveFileId: upload.fileId,
          mimeType: audioFile.mimetype
        };
        deleteLocalAdminFile(audioFile.path);
      }
    }
    const uploadedFeeds = [];
    const uploadErrors = [];

    // 2. Process Media Files
    for (const file of mediaFiles) {
      try {
        const isImage = file.mimetype.startsWith("image/");
        const folderId = await getFeedUploadFolder(oAuth2Client, roleRef, isImage ? "image" : "video");

        const upload = await uploadToDrive(file.buffer, file.originalname, file.mimetype, folderId);
        if (!upload?.fileId) throw new Error("G-Drive upload failed");
        const driveFileId = upload.fileId;
        const mediaUrl = isImage
          ? `https://lh3.googleusercontent.com/d/${driveFileId}`
          : `/media/${driveFileId}`;
        // Prepare feed document
        const currentPostType = isImage ? (uploadedAudio ? 'image+audio' : 'image') : 'video';
        const currentUploadType = baseDesignMetadata.isTemplate ? 'template' : 'normal';

        const feedDoc = {
          uploadType: currentUploadType,
          postType: currentPostType,
          uploadMode: currentUploadType,
          language,
          category: categoryId,
          mediaUrl,
          files: [{
            url: mediaUrl,
            type: isImage ? 'image' : 'video',
            uploadMode: currentUploadType,
            driveFileId,
            mimeType: file.mimetype,
            size: file.size,
            dimensions: file.dimensions,
            duration: file.duration
          }],
          audioFile: uploadedAudio,
          caption,
          fileHash: file.fileHash,
          postedBy: { userId: adminId, role: roleRef },
          roleRef,
          designMetadata: {
            ...baseDesignMetadata,
            isTemplate: baseDesignMetadata.isTemplate,
            uploadType: currentUploadType,
            postType: currentPostType,
            audioConfig: {
              ...(baseDesignMetadata.audioConfig || {}),
              enabled: !!uploadedAudio,
              audioFileId: uploadedAudio?.driveFileId
            }
          },
          audience,
          storage: {
            type: 'gdrive',
            drive: { fileId: driveFileId, audioFileId: uploadedAudio?.driveFileId },
            urls: { media: mediaUrl, audio: uploadedAudio?.url }
          },
          isScheduled: !!scheduleTime,
          scheduleDate: scheduleTime ? new Date(scheduleTime) : null,
          status: scheduleTime ? 'scheduled' : 'published',
          isApproved: true // Admin uploads are auto-approved
        };
        const savedFeed = await new Feed(feedDoc).save();

        // Update Category
        await Category.findByIdAndUpdate(categoryId, { $addToSet: { feedIds: savedFeed._id } });
        uploadedFeeds.push({ id: savedFeed._id, url: mediaUrl });
        deleteLocalAdminFile(file.path);
      } catch (err) {
        uploadErrors.push({ file: file.originalname, error: err.message });
      }
    }
    res.status(201).json({ success: true, uploaded: uploadedFeeds, errors: uploadErrors.length ? uploadErrors : undefined });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get single feed with design metadata
exports.getFeedWithDesign = async (req, res) => {
  try {
    const { feedId } = req.params;
    const userId = req.Id;

    const feed = await Feed.findOne({
      _id: feedId,
      $or: [
        { audience: "public" },
        { audience: "followers" },
        { createdByAccount: userId },
        { allowedUsers: userId }
      ]
    })
      .populate('category', 'name icon color')
      .populate('createdByAccount', 'username name profilePic')
      .lean();

    if (!feed) {
      return res.status(404).json({
        success: false,
        message: "Feed not found or access denied"
      });
    }

    // Add virtuals manually
    feed.formattedUrl = feed.contentUrl || (feed.files && feed.files[0]?.url);
    feed.thumbnailUrl = feed.type === 'video' && feed.files && feed.files[0]?.thumbnail
      ? feed.files[0].thumbnail
      : feed.formattedUrl;

    if (feed.designMetadata?.audioConfig?.audioFile) {
      feed.audioUrl = feed.designMetadata.audioConfig.audioFile;
    }

    // Get design state
    feed.designState = feed.designMetadata ? {
      elements: feed.designMetadata.overlayElements || [],
      footer: feed.designMetadata.footerConfig || { visible: true, colors: { primary: '#1e5a78', secondary: '#0f3a4d' } },
      mediaDimensions: feed.designMetadata.canvasSettings || { width: 355, height: 400 },
      audioConfig: feed.designMetadata.audioConfig || null,
      themeColors: feed.themeColor
    } : null;

    // Add Google Drive info
    feed.storageInfo = {
      type: feed.storageType || "gdrive",
      driveFileId: feed.driveFileId,
      cloudMetadata: feed.cloudMetadata
    };

    return res.status(200).json({
      success: true,
      data: feed
    });

  } catch (error) {
    console.error("Get feed with design error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch feed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Update feed design metadata
exports.updateFeedDesign = async (req, res) => {
  try {
    const { feedId } = req.params;
    const userId = req.Id;
    const { designMetadata } = req.body;

    if (!designMetadata) {
      return res.status(400).json({
        success: false,
        message: "Design metadata is required"
      });
    }

    const feed = await Feed.findOne({
      _id: feedId,
      createdByAccount: userId
    });

    if (!feed) {
      return res.status(404).json({
        success: false,
        message: "Feed not found or access denied"
      });
    }

    // Update design metadata
    feed.designMetadata = {
      ...feed.designMetadata,
      ...designMetadata
    };

    // Save to edit history
    await feed.saveEditHistory(userId, 'Design metadata updated');
    await feed.save();

    return res.status(200).json({
      success: true,
      message: "Design updated successfully",
      data: {
        feedId: feed._id,
        designPreview: {
          hasOverlays: feed.designMetadata?.overlayElements?.length > 0,
          overlayCount: feed.designMetadata?.overlayElements?.length || 0,
          hasAudio: !!feed.designMetadata?.audioConfig?.audioFile,
          hasFooter: feed.designMetadata?.footerConfig?.visible || false,
          themeColors: feed.themeColor
        },
        storageType: feed.storageType
      }
    });

  } catch (error) {
    console.error("Update feed design error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update design",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get feeds with design elements
exports.getFeedsWithDesign = async (req, res) => {
  try {
    const userId = req.Id;
    const { page = 1, limit = 20, categoryId, type, hasDesign = true } = req.query;
    const skip = (page - 1) * limit;

    const query = {
      $or: [
        { audience: "public" },
        { audience: "followers" },
        { createdByAccount: userId },
        { allowedUsers: userId }
      ],
      isDeleted: false,
      status: { $in: ["Published", "Scheduled"] }
    };

    if (categoryId) {
      query.category = categoryId;
    }

    if (type) {
      query.type = type;
    }

    if (hasDesign === 'true') {
      query.$or = [
        { 'designMetadata.overlayElements.0': { $exists: true } },
        { 'designMetadata.audioConfig.audioFile': { $exists: true } }
      ];
    }

    const feeds = await Feed.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('category', 'name icon color')
      .populate('createdByAccount', 'username name profilePic')
      .lean();

    // Add virtuals
    const enrichedFeeds = feeds.map(feed => ({
      ...feed,
      formattedUrl: feed.contentUrl || (feed.files && feed.files[0]?.url),
      thumbnailUrl: feed.type === 'video' && feed.files && feed.files[0]?.thumbnail
        ? feed.files[0].thumbnail
        : feed.contentUrl || (feed.files && feed.files[0]?.url),
      designPreview: {
        hasOverlays: feed.designMetadata?.overlayElements?.length > 0,
        overlayCount: feed.designMetadata?.overlayElements?.length || 0,
        hasAudio: !!feed.designMetadata?.audioConfig?.audioFile,
        hasFooter: feed.designMetadata?.footerConfig?.visible || false,
        themeColors: feed.themeColor
      },
      storageInfo: {
        type: feed.storageType || "gdrive",
        driveFileId: feed.driveFileId
      }
    }));

    const total = await Feed.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: {
        feeds: enrichedFeeds,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error("Get feeds with design error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch feeds",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Bulk feed upload (simplified - Google Drive only)
exports.bulkFeedUpload = async (req, res) => {
  try {
    const adminId = req.Id;
    const files = req.localFiles || [];

    if (files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files to process"
      });
    }

    const results = {
      total: files.length,
      successful: 0,
      failed: 0,
      details: []
    };

    // Process sequentially to avoid connection issues
    for (const [index, file] of files.entries()) {
      try {
        const feedType = file.mimetype.startsWith('image/') ? 'image' :
          file.mimetype.startsWith('video/') ? 'video' : 'audio';

        // Upload to Google Drive first
        const folderId = await getFeedUploadFolder(oAuth2Client, req.role, feedType);
        const uploadResult = await uploadToDrive(
          file.buffer,
          file.originalname || file.filename,
          file.mimetype,
          folderId
        );

        if (!uploadResult?.fileId) {
          throw new Error("Google Drive upload failed");
        }

        const driveFileId = uploadResult.fileId;
        let contentUrl;

        if (feedType === 'image') {
          contentUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;
        } else {
          contentUrl = `https://drive.google.com/uc?id=${driveFileId}&export=download`;
        }

        const feedData = {
          type: feedType,
          language: "en",
          category: req.body.categoryId || null,
          contentUrl: contentUrl,
          files: [{
            url: contentUrl,
            type: feedType,
            mimeType: file.mimetype,
            size: file.size || 0,
            order: 0,
            storageType: "gdrive",
            driveFileId: driveFileId
          }],
          dec: req.body.caption || "",
          fileHash: file.fileHash,
          createdByAccount: adminId,
          roleRef: req.role,
          storageType: "gdrive",
          driveFileId: driveFileId,
          status: "Published"
        };

        const feed = new Feed(feedData);
        await feed.save();

        results.details.push({
          success: true,
          feedId: feed._id,
          filename: file.filename,
          type: feedType,
          driveFileId: driveFileId,
          storageType: "gdrive"
        });
        results.successful++;

        console.log(`✅ Bulk upload: File ${index + 1}/${files.length} uploaded to Google Drive`);
      } catch (error) {
        results.details.push({
          success: false,
          filename: file.filename,
          error: error.message
        });
        results.failed++;
        console.error(`❌ Bulk upload: Failed to process ${file.filename}:`, error.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk upload to Google Drive completed",
      data: results
    });

  } catch (error) {
    console.error("Bulk upload error:", error);
    return res.status(500).json({
      success: false,
      message: "Bulk upload failed",
      error: error.message
    });
  }
};

// Duplicate feed with design
exports.duplicateFeedWithDesign = async (req, res) => {
  try {
    const { feedId } = req.params;
    const userId = req.Id;

    // Find original feed
    const originalFeed = await Feed.findOne({
      _id: feedId,
      $or: [
        { createdByAccount: userId },
        { audience: "public" }
      ]
    });

    if (!originalFeed) {
      return res.status(404).json({
        success: false,
        message: "Feed not found or access denied"
      });
    }

    // Create duplicate with new ID
    const duplicateData = originalFeed.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.statsId;

    // Update metadata for duplicate
    duplicateData.createdByAccount = userId;
    duplicateData.status = "Published";
    duplicateData.isScheduled = false;
    duplicateData.scheduleDate = null;
    duplicateData.version = 1;
    duplicateData.previousVersions = [];

    // Add duplication note to description
    duplicateData.dec = `[Duplicate] ${duplicateData.dec}`;

    const duplicateFeed = new Feed(duplicateData);
    await duplicateFeed.save();

    // Update category
    if (duplicateFeed.category) {
      await Category.findByIdAndUpdate(
        duplicateFeed.category,
        { $addToSet: { feedIds: duplicateFeed._id } }
      );
    }

    return res.status(201).json({
      success: true,
      message: "Feed duplicated successfully",
      data: {
        feedId: duplicateFeed._id,
        designPreview: {
          hasOverlays: duplicateFeed.designMetadata?.overlayElements?.length > 0,
          overlayCount: duplicateFeed.designMetadata?.overlayElements?.length || 0,
          hasAudio: !!duplicateFeed.designMetadata?.audioConfig?.audioFile,
          hasFooter: duplicateFeed.designMetadata?.footerConfig?.visible || false,
          themeColors: duplicateFeed.themeColor
        },
        storageType: duplicateFeed.storageType
      }
    });

  } catch (error) {
    console.error("Duplicate feed error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to duplicate feed",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get upload progress (for large uploads)
exports.getUploadProgress = (req, res) => {
  const uploadId = req.params.uploadId;
  // In a real app, you'd track upload progress in Redis or similar
  res.json({
    uploadId,
    progress: 100,
    status: 'completed'
  });
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


