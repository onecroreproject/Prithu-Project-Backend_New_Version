const Feed = require('../../models/feedModel');
const Categories=require('../../models/categorySchema');
const  feedQueue=require("../../queue/feedPostQueue");
const { logUserActivity } = require("../../middlewares/helper/logUserActivity.js");
const redisClient=require("../../Config/redisConfig.js")



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

    const { language, categoryId, type, scheduleDate, dec } = req.body;

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

    // Build feed document
    const newFeed = new Feed({
      type,                        // image | video
      language,
      category: categoryId,
      createdByAccount: userId,
      roleRef: userRole,

      contentUrl: url,             // full public URL
      localFilename: filename,     // stored filename (for deletion)
      localPath: localPath,        // absolute path on disk
      fileHash,
      duration: videoDuration,

      // Scheduling (MUST MATCH SCHEMA)
      isScheduled: !!scheduleDate,
      scheduleDate: scheduleDate ? new Date(scheduleDate) : null,
      status: scheduleDate ? "Pending" : "Published",

      dec: dec || "",
      hashtags,
    });

    await newFeed.save();

    // Add feed to category
    await Categories.findByIdAndUpdate(categoryId, {
      $addToSet: { feedIds: newFeed._id },
    });

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
      metadata: { platform: "web" },
    });

    return res.status(201).json({
      message: scheduleDate
        ? "Feed scheduled successfully"
        : "Feed uploaded successfully",
      feed: newFeed,
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










