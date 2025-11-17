const Feed = require('../../models/feedModel');
const { getVideoDurationInSeconds } = require('get-video-duration');
const fs = require('fs');
const path =require ('path');
const Account=require("../../models/accountSchemaModel");
const {feedTimeCalculator}=require("../../middlewares/feedTimeCalculator");
const {getActiveCreatorAccount}=require("../../middlewares/creatorAccountactiveStatus");
const Categories=require('../../models/categorySchema');
const mongoose=require("mongoose");
const { getLanguageCode, getLanguageName } = require("../../middlewares/helper/languageHelper");
const  feedQueue=require("../../queue/feedPostQueue");
const { logUserActivity } = require("../../middlewares/helper/logUserActivity.js");



const extractHashtags = (text) => {
  const regex = /#(\w+)/g;
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

    if (!req.cloudinaryFile) {
      return res.status(400).json({ message: "No file uploaded to Cloudinary" });
    }

    const { language, categoryId, type, scheduleDate, dec } = req.body;

    if (!language || !categoryId || !type) {
      return res
        .status(400)
        .json({ message: "Language, categoryId, and type are required" });
    }

    // ✅ Extract hashtags
    console.log(dec)
    const hashtags = extractHashtags(dec); // <-- FIXED

    // normalize language
    const normalizedLang = getLanguageCode(language);
    if (!normalizedLang) {
      return res.status(400).json({ message: "Invalid language" });
    }

    const categoryDoc = await Categories.findById(categoryId).lean();
    if (!categoryDoc) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    const { url, public_id } = req.cloudinaryFile;
    const fileHash = req.fileHash || null;
    const videoDuration = req.videoDuration || null;

    if (fileHash) {
      const existingByHash = await Feed.findOne({ fileHash }).lean();
      if (existingByHash) {
        return res.status(409).json({
          message: "This file already exists",
          feedId: existingByHash._id,
        });
      }
    }

    const existingByUrl = await Feed.findOne({ contentUrl: url }).lean();
    if (existingByUrl) {
      return res.status(409).json({
        message: "This file already exists",
        feedId: existingByUrl._id,
      });
    }

    // ✅ Create new feed with hashtags included
    const newFeed = new Feed({
      type,
      language: normalizedLang,
      category: categoryId,
      createdByAccount: userId,
      roleRef: userRole,
      contentUrl: url,
      cloudinaryId: public_id,
      fileHash,
      duration: videoDuration,
      scheduledAt: scheduleDate ? new Date(scheduleDate) : null,
      isPosted: scheduleDate ? false : true,
      dec: dec || "",
      hashtags: hashtags,                
    });

    await newFeed.save();

    // Update category feed list
    await Categories.findByIdAndUpdate(categoryId, {
      $addToSet: { feedIds: newFeed._id },
    });

    // ---------------------------------------
    // 🚀 REDIS INCREMENT HASHTAGS (SCALABLE)
    // ---------------------------------------
    if (hashtags.length > 0) {
      hashtags.forEach(tag => {
        redisClient.hincrby("hashtag_counts", tag, 1);  
      });
    }

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
      feed: {
        ...newFeed.toObject(),
        languageName: getLanguageName(normalizedLang),
      },
    });

  } catch (err) {
    console.error("Error creating feed:", err);

    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "Duplicate resource", error: err.message });
    }

    return res
      .status(500)
      .json({ message: "Server error", error: err.message });
  }
};


 
 
 


















 
















exports.creatorFeedScheduleUpload = async (req, res) => {
  try {
    const { language, categoryId, type, scheduleDate, dec } = req.body;
    const { url: fileUrl, public_id: cloudinaryId } = req.cloudinaryFile || {};

    if (!fileUrl) {
      return res.status(400).json({ message: "File upload required" });
    }

    const newFeed = new Feed({
      type,
      language,
      category: categoryId,
      dec,
      contentUrl: fileUrl,
      cloudinaryId,
      createdByAccount: req.Id,
      roleRef: req.Role,
    });

    // 🕒 Handle schedule
    if (scheduleDate) {
      const scheduleTime = new Date(scheduleDate).getTime();
      const now = Date.now();
      const delay = scheduleTime - now;

      console.log("📅 Schedule Date:", scheduleDate);
      console.log("🕓 Current Time:", new Date());
      console.log("⏱️ Delay (ms):", delay);

      if (delay > 0) {
        newFeed.isScheduled = true;
        newFeed.scheduleDate = new Date(scheduleDate);
        newFeed.status = "Pending";
        await newFeed.save();

        await feedQueue.add(
          { feedId: newFeed._id },
          {
            delay,
            removeOnComplete: true,
            removeOnFail: true,
          }
        );

        await logUserActivity({
                userId,
                actionType: "SCHEDULE_POST",
                targetId: newFeed._id,
                targetModel: "Feed",
                metadata: { platform: "web" },
              });

        return res.status(200).json({
          message: "✅ Feed scheduled successfully",
          data: newFeed,
        });
      }
    }

    // 🟢 Publish immediately if delay <= 0 or no scheduleDate
    newFeed.status = "Published";
    await newFeed.save();

    return res.status(200).json({
      message: "✅ Feed uploaded immediately",
      data: newFeed,
    });
  } catch (err) {
    console.error("❌ Error in feed upload:", err);
    res.status(500).json({ message: "Upload failed", error: err.message });
  }
};









