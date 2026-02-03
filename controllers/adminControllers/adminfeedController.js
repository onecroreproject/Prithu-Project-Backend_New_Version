const FeedService = require("../../middlewares/services/AdminServices/adminUploadfileService");
const ChildAdmin = require("../../models/childAdminModel");
const Category = require('../../models/categorySchema');
const Feed = require("../../models/feedModel");
const ProfileSettings = require("../../models/profileSettingModel");
const Account = require("../../models/accountSchemaModel");
const User = require("../../models/userModels/userModel");
const { saveFile } = require("../../utils/storageEngine");
const mongoose = require("mongoose");
const { prithuDB } = require("../../database");
const notificationQueue = require("../../queue/notificationQueue");
const fs = require("fs");

// ✅ Helper delete local file
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
    const { categoryId: globalCategoryId, language = "en", caption: globalCaption, designData: globalDesignData, scheduleTime: globalScheduleTime, audience = "public", perFileMetadata } = req.body;

    if (!mediaFiles.length) {
      return res.status(400).json({ success: false, message: "No media files provided" });
    }

    let fileMetadataMap = {};
    if (perFileMetadata) {
      try {
        fileMetadataMap = typeof perFileMetadata === "string" ? JSON.parse(perFileMetadata) : perFileMetadata;
      } catch (e) {
        console.error("Per-file metadata parsing failed", e);
      }
    }

    const { getIO } = require("../../middlewares/webSocket");
    const io = getIO();

    // 1. Upload Shared Audio (if any)
    let uploadedAudio = null;
    if (audioFile) {
      console.log("Processing audio file locally...");
      const audioSave = await saveFile(audioFile, {
        type: 'feed',
        categorySlug: 'shared-audio',
        subType: 'audio'
      });

      if (audioSave?.dbPath) {
        uploadedAudio = {
          url: audioSave.dbPath, // Relative path for DB
          path: audioSave.path,
          mimeType: audioFile.mimetype
        };
      }
    }

    const uploadedFeeds = [];
    const uploadErrors = [];

    // 2. Process Media Files
    for (const file of mediaFiles) {
      try {
        const specificMetadata = fileMetadataMap[file.originalname] || {};
        const categoryId = specificMetadata.categoryId || globalCategoryId;
        const caption = specificMetadata.caption || globalCaption || "";
        const scheduleTime = specificMetadata.scheduleTime || globalScheduleTime;
        const designData = specificMetadata.designData || globalDesignData;

        if (!categoryId) throw new Error("Category ID is required");

        const category = await Category.findById(categoryId).lean();
        if (!category) throw new Error("Category not found");

        const categorySlug = category.name.toLowerCase().replace(/\s+/g, '-');
        const isImage = file.mimetype.startsWith("image/");

        if (io) io.to(adminId).emit("upload_progress", { filename: file.originalname, percent: 10 });

        // Save file locally using storageEngine
        const fileSave = await saveFile(file, {
          type: 'feed',
          categorySlug: categorySlug,
          subType: isImage ? 'image' : 'video'
        });

        if (io) io.to(adminId).emit("upload_progress", { filename: file.originalname, percent: 80 });

        const mediaUrl = fileSave.url; // Full absolute URL for DB

        let fileDesignMetadata = { isTemplate: false, uploadType: 'normal', overlayElements: [] };
        try {
          if (designData) {
            const parsed = typeof designData === "string" ? JSON.parse(designData) : designData;
            fileDesignMetadata = { ...fileDesignMetadata, ...parsed };
          }
        } catch (e) {
          console.error(`Design parsing failed for ${file.originalname}`, e);
        }

        if (fileDesignMetadata.uploadType === 'template') {
          fileDesignMetadata.isTemplate = true;
        }

        const currentUploadType = fileDesignMetadata.isTemplate ? 'template' : 'normal';
        const currentPostType = isImage ? (uploadedAudio ? 'image+audio' : 'image') : 'video';

        const feedDoc = {
          uploadType: currentUploadType,
          postType: currentPostType,
          uploadMode: currentUploadType,
          language,
          category: categoryId,
          duration: file.duration, // Top-level duration
          mediaUrl,
          files: [{
            url: mediaUrl,
            path: fileSave.path,
            type: isImage ? 'image' : 'video',
            uploadMode: currentUploadType,
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
            ...fileDesignMetadata,
            isTemplate: fileDesignMetadata.isTemplate,
            uploadType: currentUploadType,
            postType: currentPostType,
            audioConfig: {
              ...(fileDesignMetadata.audioConfig || {}),
              enabled: !!uploadedAudio,
              audioUrl: uploadedAudio?.url
            }
          },
          editMetadata: fileDesignMetadata.editMetadata || {
            crop: { ratio: "original", zoomLevel: 1, position: { x: 0, y: 0 } },
            filters: { preset: "original", adjustments: {} }
          },
          audience,
          storage: {
            type: 'local',
            urls: { media: mediaUrl, audio: uploadedAudio?.url },
            paths: { media: fileSave.path, audio: uploadedAudio?.path }
          },
          isScheduled: !!scheduleTime,
          scheduleDate: scheduleTime ? new Date(scheduleTime) : null,
          status: scheduleTime ? 'scheduled' : 'published',
          isApproved: true
        };

        const savedFeed = await new Feed(feedDoc).save();
        await Category.findByIdAndUpdate(categoryId, { $addToSet: { feedIds: savedFeed._id } });

        // ✅ REAL-TIME BROADCAST: Fetch creator profile to enrich the feed data for users
        let creatorProfile = null;
        if (roleRef === "Admin") {
          creatorProfile = await ProfileSettings.findOne({ adminId }).select("userName profileAvatar").lean();
        } else if (roleRef === "Child_Admin") {
          creatorProfile = await ProfileSettings.findOne({ childAdminId: adminId }).select("userName profileAvatar").lean();
        }

        if (io) {
          const broadcastData = {
            ...savedFeed.toObject(),
            creatorData: creatorProfile || { userName: "Admin", profileAvatar: null }
          };
          io.emit("new_feed_published", broadcastData);
        }

        uploadedFeeds.push({ id: savedFeed._id, url: mediaUrl, filename: file.originalname });

        if (savedFeed.status === "published") {
          notificationQueue.add("BROADCAST_NEW_FEED", {
            feedId: savedFeed._id,
            senderId: adminId,
            title: "New Fresh Content! 🔥",
            message: `Hi \${username}, check out this new feed! Download it and share 🔥❤️`,
            image: isImage ? mediaUrl : (file.dimensions?.thumbnail ? `${process.env.BACKEND_URL}/media/${file.dimensions.thumbnail}` : `${process.env.BACKEND_URL}/default-video-thumbnail.png`),
          }, {
            removeOnComplete: true,
            attempts: 3,
            backoff: { type: 'exponential', delay: 5000 }
          });
        }

        if (io) io.to(adminId).emit("upload_progress", { filename: file.originalname, percent: 100 });

      } catch (err) {
        uploadErrors.push({ file: file.originalname, error: err.message });
      }
    }
    res.status(201).json({ success: true, uploaded: uploadedFeeds, errors: uploadErrors.length ? uploadErrors : undefined });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkFeedUpload = async (req, res) => {
  try {
    const adminId = req.Id;
    const files = req.localFiles || [];

    if (files.length === 0) {
      return res.status(400).json({ success: false, message: "No files to process" });
    }

    const results = {
      total: files.length,
      successful: 0,
      failed: 0,
      details: []
    };

    for (const [index, file] of files.entries()) {
      try {
        const feedType = file.mimetype.startsWith('image/') ? 'image' :
          file.mimetype.startsWith('video/') ? 'video' : 'audio';

        let categorySlug = 'bulk-upload';
        if (req.body.categoryId) {
          const category = await Category.findById(req.body.categoryId).lean();
          if (category) categorySlug = category.name.toLowerCase().replace(/\s+/g, '-');
        }

        const fileSave = await saveFile(file, {
          type: 'feed',
          categorySlug: categorySlug,
          subType: feedType
        });

        const feedData = {
          type: feedType,
          language: "en",
          category: req.body.categoryId || null,
          contentUrl: fileSave.url,
          files: [{
            url: fileSave.url,
            path: fileSave.path,
            type: feedType,
            mimeType: file.mimetype,
            size: file.size || 0,
            order: 0,
            storageType: "local"
          }],
          dec: req.body.caption || "",
          fileHash: file.fileHash,
          createdByAccount: adminId,
          roleRef: req.role,
          storageType: "local",
          status: "Published"
        };

        const feed = new Feed(feedData);
        await feed.save();

        // ✅ REAL-TIME BROADCAST (Bulk)
        const { getIO } = require("../../middlewares/webSocket");
        const io = getIO();
        if (io) {
          const ProfileSettings = require("../../models/profileSettingModel");
          let creatorProfile = null;
          if (req.role === "Admin") {
            creatorProfile = await ProfileSettings.findOne({ adminId: adminId }).select("userName profileAvatar").lean();
          } else if (req.role === "Child_Admin") {
            creatorProfile = await ProfileSettings.findOne({ childAdminId: adminId }).select("userName profileAvatar").lean();
          }

          const broadcastData = {
            ...feed.toObject(),
            creatorData: creatorProfile || { userName: "Admin", profileAvatar: null }
          };
          io.emit("new_feed_published", broadcastData);
        }

        results.details.push({
          success: true,
          feedId: feed._id,
          filename: file.filename,
          type: feedType,
          storageType: "local"
        });
        results.successful++;
      } catch (error) {
        results.details.push({
          success: false,
          filename: file.filename,
          error: error.message
        });
        results.failed++;
      }
    }

    return res.status(200).json({
      success: true,
      message: "Bulk upload to local storage completed",
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
      return res.status(404).json({ success: false, message: "Feed not found or access denied" });
    }

    feed.formattedUrl = feed.contentUrl || (feed.files && feed.files[0]?.url);
    feed.thumbnailUrl = feed.type === 'video' && feed.files && feed.files[0]?.thumbnail
      ? feed.files[0].thumbnail
      : feed.formattedUrl;

    if (feed.designMetadata?.audioConfig?.audioUrl) {
      feed.audioUrl = feed.designMetadata.audioConfig.audioUrl;
    }

    feed.designState = feed.designMetadata ? {
      elements: feed.designMetadata.overlayElements || [],
      footer: feed.designMetadata.footerConfig || { visible: true, colors: { primary: '#1e5a78', secondary: '#0f3a4d' } },
      mediaDimensions: feed.designMetadata.canvasSettings || { width: 355, height: 400 },
      audioConfig: feed.designMetadata.audioConfig || null,
      themeColors: feed.themeColor
    } : null;

    feed.storageInfo = {
      type: feed.storageType || "local",
      paths: feed.storage?.paths
    };

    return res.status(200).json({ success: true, data: feed });
  } catch (error) {
    console.error("Get feed with design error:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch feed" });
  }
};

exports.updateFeedDesign = async (req, res) => {
  try {
    const { feedId } = req.params;
    const userId = req.Id;
    const { designMetadata } = req.body;

    if (!designMetadata) {
      return res.status(400).json({ success: false, message: "Design metadata is required" });
    }

    const feed = await Feed.findOne({ _id: feedId, createdByAccount: userId });

    if (!feed) {
      return res.status(404).json({ success: false, message: "Feed not found or access denied" });
    }

    feed.designMetadata = { ...feed.designMetadata, ...designMetadata };
    await feed.saveEditHistory(userId, 'Design metadata updated');
    await feed.save();

    return res.status(200).json({
      success: true,
      message: "Design updated successfully",
      data: {
        feedId: feed._id,
        storageType: feed.storageType
      }
    });
  } catch (error) {
    console.error("Update feed design error:", error);
    return res.status(500).json({ success: false, message: "Failed to update design" });
  }
};

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

    if (categoryId) query.category = categoryId;
    if (type) query.type = type;

    if (hasDesign === 'true') {
      query.$or = [
        { 'designMetadata.overlayElements.0': { $exists: true } },
        { 'designMetadata.audioConfig.audioUrl': { $exists: true } }
      ];
    }

    const feeds = await Feed.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('category', 'name icon color')
      .populate('createdByAccount', 'username name profilePic')
      .lean();

    const enrichedFeeds = feeds.map(feed => ({
      ...feed,
      formattedUrl: feed.contentUrl || (feed.files && feed.files[0]?.url),
      storageInfo: {
        type: feed.storageType || "local"
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
    return res.status(500).json({ success: false, message: "Failed to fetch feeds" });
  }
};

exports.duplicateFeedWithDesign = async (req, res) => {
  try {
    const { feedId } = req.params;
    const userId = req.Id;

    const originalFeed = await Feed.findOne({
      _id: feedId,
      $or: [{ createdByAccount: userId }, { audience: "public" }]
    });

    if (!originalFeed) {
      return res.status(404).json({ success: false, message: "Feed not found or access denied" });
    }

    const duplicateData = originalFeed.toObject();
    delete duplicateData._id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;
    delete duplicateData.statsId;

    duplicateData.createdByAccount = userId;
    duplicateData.status = "Published";
    duplicateData.isScheduled = false;
    duplicateData.scheduleDate = null;
    duplicateData.version = 1;
    duplicateData.previousVersions = [];
    duplicateData.dec = `[Duplicate] ${duplicateData.dec}`;

    const duplicateFeed = new Feed(duplicateData);
    await duplicateFeed.save();

    if (duplicateFeed.category) {
      await Category.findByIdAndUpdate(duplicateFeed.category, { $addToSet: { feedIds: duplicateFeed._id } });
    }

    return res.status(201).json({
      success: true,
      message: "Feed duplicated successfully",
      data: { feedId: duplicateFeed._id }
    });
  } catch (error) {
    console.error("Duplicate feed error:", error);
    return res.status(500).json({ success: false, message: "Failed to duplicate feed" });
  }
};

exports.getUploadProgress = (req, res) => {
  const uploadId = req.params.uploadId;
  res.json({ uploadId, progress: 100, status: 'completed' });
};

exports.getAllFeedAdmin = async (req, res) => {
  try {
    const feeds = await Feed.find().sort({ createdAt: -1 }).lean();
    const results = await Promise.all(
      feeds.map(async (feed) => {
        let profile = null;
        if (feed.roleRef === "Admin") {
          profile = await ProfileSettings.findOne({ adminId: feed.createdByAccount }).select("userName profileAvatar").lean();
        } else if (feed.roleRef === "Child_Admin") {
          profile = await ProfileSettings.findOne({ childAdminId: feed.createdByAccount }).select("userName profileAvatar").lean();
        } else if (feed.roleRef === "User") {
          profile = await ProfileSettings.findOne({ userId: feed.createdByAccount }).select("userName profileAvatar").lean();
        }

        return {
          ...feed,
          creator: profile ? { userName: profile.userName || "Unknown", profileAvatar: profile.profileAvatar || null } : { userName: "Unknown", profileAvatar: null },
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
      { $match: { allowToPost: { $in: ["interest", "allow"] }, isActive: true, isBlocked: false } },
      { $lookup: { from: "ProfileSettings", localField: "_id", foreignField: "userId", as: "profileSettings" } },
      { $unwind: { path: "$profileSettings", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          userName: 1,
          email: 1,
          roles: 1,
          allowToPost: 1,
          isActive: 1,
          createdAt: 1,
          lastActiveAt: 1,
          subscription: { isActive: "$subscription.isActive" },
          profile: {
            name: "$profileSettings.name",
            profileAvatar: "$profileSettings.profileAvatar",
            isPublished: "$profileSettings.isPublished"
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
    return res.status(200).json({ success: true, total: users.length, users });
  } catch (error) {
    console.error("❌ GET USERS WILLING TO POST ERROR:", error);
    return res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
};

exports.updateUserPostPermission = async (req, res) => {
  try {
    const { userId } = req.params;
    const { allowToPost } = req.body;
    await User.findByIdAndUpdate(userId, { allowToPost });
    res.status(200).json({ success: true, message: "User post permission updated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update user post permission" });
  }
};
