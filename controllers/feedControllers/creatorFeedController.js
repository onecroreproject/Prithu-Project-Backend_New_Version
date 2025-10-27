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



exports.creatorFeedUpload = async (req, res) => {
  try {
   
    const userId = req.Id || req.body.userId;
    const userRole=req.role;
    if (!userId) return res.status(400).json({ message: "User ID is required" });
 
 
    // ✅ Ensure file uploaded to Cloudinary
    if (!req.cloudinaryFile) return res.status(400).json({ message: "No file uploaded to Cloudinary" });
 
    const { language, categoryId, type, scheduleDate } = req.body;
    if (!language || !categoryId || !type) {
      return res.status(400).json({ message: "Language, categoryId, and type are required" });
    }
 
    // ✅ Normalize language
    const normalizedLang = getLanguageCode(language);
    if (!normalizedLang) return res.status(400).json({ message: "Invalid language" });
 
    // ✅ Validate category
    const categoryDoc = await Categories.findById(categoryId).lean();
    if (!categoryDoc) return res.status(400).json({ message: "Invalid categoryId" });
 
    const { url, public_id } = req.cloudinaryFile;
    const fileHash = req.fileHash || null;
    const videoDuration = req.videoDuration || null; // duration from middleware if video
 
    // ✅ Check duplicate by fileHash or URL
    if (fileHash) {
      const existingByHash = await Feed.findOne({ fileHash }).lean();
      if (existingByHash) return res.status(409).json({ message: "This file already exists", feedId: existingByHash._id });
    }
    const existingByUrl = await Feed.findOne({ contentUrl: url }).lean();
    if (existingByUrl) return res.status(409).json({ message: "This file already exists", feedId: existingByUrl._id });
 
    // ✅ Create feed
    const newFeed = new Feed({
      type,
      language: normalizedLang,
      category: categoryId,
      createdByAccount: userId,
      contentUrl: url,
      cloudinaryId: public_id,
      roleRef:userRole,
      fileHash,
      duration: videoDuration, // optional for videos
      scheduledAt: scheduleDate ? new Date(scheduleDate) : null,
      isPosted: scheduleDate ? false : true,
    });
 
    await newFeed.save();
 
    // ✅ Update category
    await Categories.findByIdAndUpdate(categoryId, { $addToSet: { feedIds: newFeed._id } });
 
    return res.status(201).json({
      message: scheduleDate ? "Feed scheduled successfully" : "Feed uploaded successfully",
      feed: {
        ...newFeed.toObject(),
        languageName: getLanguageName(normalizedLang),
      },
    });
  } catch (err) {
    console.error("Error creating feed:", err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "Duplicate resource", error: err.message });
    }
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
 
 
 


















 
















exports.creatorFeedScheduleUpload = async (req, res) => {
  try {
    const userId = req.Id || req.body.accountId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // const activeAccount = await getActiveCreatorAccount(userId);
    // if (!activeAccount) {
    //   return res
    //     .status(403)
    //     .json({ message: "Only active Creator account can upload feeds" });
    // }
    const creatorId = userId;

    if (!req.cloudinaryFile) {
      return res.status(400).json({ message: "No file uploaded to Cloudinary" });
    }

    const { language, category, type, scheduledAt } = req.body;
    if (!language || !category || !type) {
      return res
        .status(400)
        .json({ message: "Language, category, and type required" });
    }

    // Video duration check
    let videoDuration = null;
    if (type === "video") {
      videoDuration = await getVideoDurationInSeconds(req.file.path); // optional
      if (videoDuration >= 90.0) {
        return res.status(400).json({ message: "Upload video below 90 seconds" });
      }
    }

    // Parse scheduledAt
    let scheduleDate = null;
    if (scheduledAt) {
      scheduleDate = new Date(scheduledAt);
      if (isNaN(scheduleDate.getTime())) {
        return res.status(400).json({ message: "Invalid scheduledAt date" });
      }
    }

    // Capitalize first letter of category
    const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

    // Create feed using Cloudinary file
    const newFeed = new Feed({
      type,
      language,
      category: formattedCategory,
      duration: videoDuration,
      roleRef:req.role,
      createdByAccount: creatorId,
      contentUrl: req.cloudinaryFile.url,     // Cloudinary URL
      cloudinaryId: req.cloudinaryFile.public_id, // Cloudinary public_id
      scheduledAt: scheduleDate,
      isPosted: scheduleDate ? false : true,
    });

    await newFeed.save();

    // Handle Category collection
    let categoryDoc = await Categories.findOne({
      name: { $regex: new RegExp(`^${formattedCategory}$`, "i") },
    });

    if (categoryDoc) {
      await Categories.findByIdAndUpdate(categoryDoc._id, {
        $addToSet: { feedIds: newFeed._id },
      });
    } else {
      categoryDoc = new Categories({
        name: formattedCategory,
        feedIds: [newFeed._id],
      });
      await categoryDoc.save();
    }

    // Update Account feeds
    await Account.findByIdAndUpdate(creatorId, { $push: { feeds: newFeed._id } });

    return res.status(201).json({
      message: scheduleDate
        ? "Feed scheduled successfully (category will update when posted)"
        : "Feed created successfully",
      feed: newFeed,
    });
  } catch (error) {
    console.error("Error creating scheduled feed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};






