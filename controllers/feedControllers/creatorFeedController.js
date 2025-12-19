const Feed = require('../../models/feedModel');
const Categories=require('../../models/categorySchema');
const  feedQueue=require("../../queue/feedPostQueue");
const { logUserActivity } = require("../../middlewares/helper/logUserActivity.js");
const redisClient=require("../../Config/redisConfig.js");
const User=require("../../models/userModels/userModel")



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

    if (!userId) return res.status(400).json({ message: "User ID is required" });

    // Must contain uploaded file
    if (!req.localFile) {
      return res.status(400).json({ message: "No feed file uploaded" });
    }

    // New fields from the create post modal
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

    // Validation
    if (!categoryId || !type) {
      return res.status(400).json({ message: "categoryId and type are required" });
    }

    // Extract hashtags
    const hashtags = extractHashtags(dec || "");

    // Validate category
    const categoryDoc = await Categories.findById(categoryId).lean();
    if (!categoryDoc) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    // FILE INFO from local upload
    const {
      url,
      filename,
      path: localPath,
      fileHash,
      videoDuration,
    } = req.localFile;

    // Duplicate check by hash
    if (fileHash) {
      const duplicateHash = await Feed.findOne({ fileHash }).lean();
      if (duplicateHash) {
        return res.status(409).json({
          message: "This file already exists",
          feedId: duplicateHash._id,
        });
      }
    }

    // Duplicate check by URL
    const duplicateUrl = await Feed.findOne({ contentUrl: url }).lean();
    if (duplicateUrl) {
      return res.status(409).json({
        message: "This file already exists",
        feedId: duplicateUrl._id,
      });
    }

    // Parse new fields
    let parsedPosition = { x: 0, y: 0 };
    if (position) {
      if (typeof position === 'string') {
        try {
          parsedPosition = JSON.parse(position);
        } catch (e) {
          parsedPosition = { x: 0, y: 0 };
        }
      } else {
        parsedPosition = position;
      }
    }

    let parsedAdjustments = {};
    if (adjustments) {
      if (typeof adjustments === 'string') {
        try {
          parsedAdjustments = JSON.parse(adjustments);
        } catch (e) {
          parsedAdjustments = {};
        }
      } else {
        parsedAdjustments = adjustments;
      }
    }

    // Handle tagged users
    const taggedUsers = [];
    if (taggedFriends && taggedFriends.length > 0) {
      for (const friendId of taggedFriends) {
        const friend = await User.findById(friendId).select('userName name');
        if (friend) {
          taggedUsers.push({
            userId: friend._id,
            userName: friend.userName,
            name: friend.name
          });
        }
      }
    }

    // Build feed document with new schema fields
    const feedData = {
      type,                        // image | video
      language,
      category: categoryId,
      createdByAccount: userId,
      roleRef: userRole,

      contentUrl: url,             // full public URL (keeping for backward compatibility)
      localFilename: filename,     // stored filename (for deletion)
      localPath: localPath,        // absolute path on disk
      fileHash,
      duration: videoDuration,

      // New: Files array for multiple files support
      files: [{
        url: url,
        type: type,
        mimeType: req.localFile.mimeType || (type === 'video' ? 'video/mp4' : 'image/jpeg'),
        size: req.localFile.size || 0,
        thumbnail: type === 'video' ? (req.localFile.thumbnailUrl || null) : null,
        duration: videoDuration || null,
        order: 0
      }],

      // New: Edit metadata
      editMetadata: {
        crop: {
          ratio: ratio || "original",
          zoomLevel: parseFloat(zoomLevel) || 1,
          position: parsedPosition
        },
        filters: {
          preset: filter || "original",
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

      // New: Tagged users
      taggedUsers: taggedUsers,

      // New: Audience settings
      audience: audience || "public",

      // New: Location
      location: location ? (typeof location === 'string' ? { name: location } : location) : undefined,

      // Scheduling (MUST MATCH SCHEMA)
      isScheduled: !!scheduleDate,
      scheduleDate: scheduleDate ? new Date(scheduleDate) : null,
      status: scheduleDate ? "Scheduled" : "Published",

      dec: dec || "",
      hashtags,
    };

    // Remove undefined fields
    Object.keys(feedData).forEach(key => {
      if (feedData[key] === undefined) {
        delete feedData[key];
      }
    });

    const newFeed = new Feed(feedData);
    await newFeed.save();

    // Add feed to category
    await Categories.findByIdAndUpdate(categoryId, {
      $addToSet: { feedIds: newFeed._id },
    });

    // Create stats record (if using FeedStats model)
    try {
      const FeedStats = require("../models/feedStatsSchema");
      const stats = new FeedStats({
        feedId: newFeed._id,
        views: 0,
        likes: 0,
        comments: 0,
        shares: 0,
        saves: 0
      });
      await stats.save();

      // Link stats to feed
      newFeed.statsId = stats._id;
      await newFeed.save();
    } catch (statsError) {
      console.log("Feed stats not created:", statsError.message);
      // Continue without stats if model doesn't exist
    }

    // Redis increment hashtags
    if (hashtags.length > 0) {
      hashtags.forEach(tag => {
        redisClient.hincrby("hashtag_counts", tag, 1);
      });
    }

    // Log user activity
    await logUserActivity({
      userId,
      actionType: "CREATE_POST",
      targetId: newFeed._id,
      targetModel: "Feed",
      metadata: { 
        platform: "web",
        hasFilter: filter !== "original",
        hasCrop: ratio !== "original",
        hasTags: taggedUsers.length > 0
      },
    });

    // Populate response with user and category info
    const populatedFeed = await Feed.findById(newFeed._id)
      .populate('category', 'categoryName')
      .populate('createdByAccount', 'userName name profileAvatar')
      .populate('taggedUsers.userId', 'userName name profileAvatar')
      .lean();

    return res.status(201).json({
      message: scheduleDate
        ? "Feed scheduled successfully"
        : "Feed uploaded successfully",
      feed: populatedFeed,
      filterStyle: newFeed.getFilterStyle ? newFeed.getFilterStyle() : '', // Only if method exists
    });

  } catch (err) {
    console.error("Error creating feed:", err);
    return res.status(500).json({
      message: "Server error",
      error: err.message,
    });
  }
};



 
 
 


















 
















exports.creatorFeedScheduleUpload = async (req, res) => {
  try {
    const userId = req.Id;
    const userRole = req.role;

    const { language, categoryId, type, scheduleDate, dec } = req.body;

    // 1️⃣ MUST have uploaded file
    if (!req.localFile) {
      return res.status(400).json({ message: "Feed file is required" });
    }

    // 2️⃣ Validate required inputs
    if (!categoryId || !type) {
      return res.status(400).json({ message: "categoryId and type are required" });
    }

    const categoryDoc = await Categories.findById(categoryId).lean();
    if (!categoryDoc) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    // Extract hashtags
    const hashtags = extractHashtags(dec || "");

    // 3️⃣ FILE INFO from local upload
    const {
      url,
      filename,
      path: localPath,
      fileHash,
      videoDuration,
    } = req.localFile;

    // Duplicate check using hash
    if (fileHash) {
      const duplicateHash = await Feed.findOne({ fileHash }).lean();
      if (duplicateHash) {
        return res.status(409).json({
          message: "This file already exists",
          feedId: duplicateHash._id,
        });
      }
    }

    // Duplicate check using URL
    const duplicateUrl = await Feed.findOne({ contentUrl: url }).lean();
    if (duplicateUrl) {
      return res.status(409).json({
        message: "This file already exists",
        feedId: duplicateUrl._id,
      });
    }

    // 4️⃣ Construct Feed
    const newFeed = new Feed({
      type,
      language,
      category: categoryId,
      createdByAccount: userId,
      roleRef: userRole,

      contentUrl: url,
      localFilename: filename,
      localPath,
      fileHash,
      duration: videoDuration,

      dec: dec || "",
      hashtags,
    });

    // 5️⃣ If scheduleDate exists, schedule the post
    if (scheduleDate) {
      const scheduleTime = new Date(scheduleDate).getTime();
      const now = Date.now();
      const delay = scheduleTime - now;

      console.log("📅 Schedule Date:", scheduleDate);
      console.log("🕓 Current Time:", new Date());
      console.log("⏱️ Delay (ms):", delay);

      newFeed.isScheduled = true;
      newFeed.scheduleDate = new Date(scheduleDate);
      newFeed.status = "Pending";

      await newFeed.save();

      if (delay > 0) {
        // Add job to Bull queue
        await feedQueue.add(
          { feedId: newFeed._id },
          {
            delay,
            removeOnComplete: true,
            removeOnFail: true,
          }
        );
      }

      // Log activity
      await logUserActivity({
        userId,
        actionType: "SCHEDULE_POST",
        targetId: newFeed._id,
        targetModel: "Feed",
        metadata: { platform: "web" },
      });

      return res.status(200).json({
        message: "📅 Feed scheduled successfully",
        data: newFeed,
      });
    }

    // 6️⃣ If no schedule → publish immediately
    newFeed.isScheduled = false;
    newFeed.scheduleDate = null;
    newFeed.status = "Published";

    await newFeed.save();

    return res.status(200).json({
      message: "🟢 Feed uploaded immediately",
      data: newFeed,
    });

  } catch (err) {
    console.error("❌ Error in feed upload:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};










