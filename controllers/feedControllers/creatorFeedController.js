const Feed = require('../../models/feedModel');
const { getVideoDurationInSeconds } = require('get-video-duration');
const fs = require('fs');
const path =require ('path');
const Account=require("../../models/accountSchemaModel");
const {feedTimeCalculator}=require("../../middlewares/feedTimeCalculator");
const {getActiveCreatorAccount}=require("../../middlewares/creatorAccountactiveStatus");
const Categories=require('../../models/categorySchema');
const User=require('../../models/userModels/userModel');
const mongoose=require("mongoose");
const { getLanguageCode, getLanguageName } = require("../../middlewares/helper/languageHelper");
const CreatorFollowing=require('../../models/creatorFollowerModel');


 
exports.creatorFeedUpload = async (req, res) => {
  try {
    const accountId = req.accountId || req.body.accountId;
    const userId = req.Id || req.body.userId;

    if (!accountId) return res.status(400).json({ message: "User ID is required" });

    // ✅ Ensure Creator
    const userRole = await Account.findById(accountId).select("type").lean();
    if (!userRole || userRole.type !== "Creator") {
      return res.status(403).json({ message: "Only Creators can upload feeds" });
    }

    // ✅ Ensure active account
    const activeAccount = await getActiveCreatorAccount(userId);
    if (!activeAccount) {
      return res.status(403).json({ message: "Active Creator account required to upload feed" });
    }

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
      createdByAccount: accountId,
      contentUrl: url,
      cloudinaryId: public_id,
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











exports.creatorFeedDelete = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const accountId = req.Id;
    const userId=req.Id;
    const activeAccount = await getActiveCreatorAccount(userId);
    if (!activeAccount) {
      await session.abortTransaction();
      return res
        .status(403)
        .json({ message: "Only active Creator account can delete feeds" });
    }
    const creatorId = activeAccount._id;
    const { feedId } = req.body;

    if (!feedId) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Feed ID is required" });
    }

    const feed = await Feed.findById(feedId).session(session);
    if (!feed) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Feed not found" });
    }

    // ✅ Check creator ownership
    if (feed.createdByAccount.toString() !== creatorId.toString()) {
      await session.abortTransaction();
      return res.status(403).json({ message: "Unauthorized to delete this feed" });
    }

    // Delete feed
    await Feed.findByIdAndDelete(feedId).session(session);

    // Remove feed from creator account
    await Account.findByIdAndUpdate(
      creatorId,
      { $pull: { feeds: feedId } },
      { new: true, session }
    );

    // Remove feed from categories
    await Category.updateMany(
      { feedIds: feedId },
      { $pull: { feedIds: feedId } },
      { session }
    );

    // Optional: delete empty categories
    await Category.deleteMany({ feedIds: { $size: 0 } }).session(session);

    await session.commitTransaction();
    session.endSession();

    // Delete file from uploads
    if (feed.contentUrl) {
      const folder = feed.type === "video" ? "videos" : "images";
      const filePath = path.join(__dirname, "../uploads", folder, path.basename(feed.contentUrl));
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete file:", err);
      });
    }

    return res.status(200).json({ message: "Feed deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error deleting feed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};





exports.getCreatorPost = async (req, res) => {
  try {
    console.log(req)
    const accountId = req.accountId || req.body.accountId;
    console.log(accountId)
    let creatorId
    if (!accountId) {
      return res.status(400).json({ message: "Account ID is required" });
    }
 
    // ✅ Fetch account
    const account = await Account.findById(accountId).lean();
    if (!account) {
      return res.status(400).json({ message: "Account not found" });
    }
 
    if(req.accountId){
    // ✅ Ensure active creator account
    const activeAccount = await getActiveCreatorAccount(account.userId);
    if (!activeAccount) {
      return res.status(403).json({
        message: "Only active Creator account can fetch feeds",
      });
    }
    creatorId = activeAccount._id
  }
    creatorId =  req.body.accountId
 
    // ✅ Run queries in parallel (feeds + count)
    const [feeds, feedCount] = await Promise.all([
      Feed.find(
        { createdByAccount: creatorId },
        { contentUrl: 1, createdAt: 1 }
      )
        .sort({ createdAt: -1 })
        .lean(),
      Feed.countDocuments({ createdByAccount: creatorId })
    ]);
 
    if (!feeds || feeds.length === 0) {
      return res.status(404).json({
        message: "No feeds found for this creator",
        feedCount: 0,
        feeds: [],
      });
    }
 
   
    const feedsFormatted = feeds.map(feed => ({
      feedId: feed._id,
      contentUrl:feed.contentUrl,
      timeAgo: feedTimeCalculator(feed.createdAt),
    }));
 
    return res.status(200).json({
      message: "Creator feeds retrieved successfully",
      feedCount, // ✅ optimized with countDocuments
      feeds: feedsFormatted,
    });
 
  } catch (error) {
    console.error("Error fetching creator feeds:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};
 






exports.getCreatorFeeds = async (req, res) => {
  try {
    const accountId = req.accountId || req.body.accountId;
    const userId = req.Id || req.body.userId;

    if (!accountId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Check if user has an active Creator account
    const activeAccount = await getActiveCreatorAccount(userId);
    if (!activeAccount) {
      return res
        .status(403)
        .json({ message: "Only active Creator account can fetch feeds" });
    }

    const creatorId = activeAccount._id;

    // ✅ Fetch feeds created by this creator account
    const feeds = await Feed.find({ createdByAccount: creatorId }).sort({ createdAt: -1 });

    if (!feeds || feeds.length === 0) {
      return res.status(404).json({ message: "No feeds found for this creator" });
    }

    // ✅ Add timeAgo property
    const feedsWithTimeAgo = feeds.map((feed) => ({
      ...feed.toObject(),
      timeAgo: feedTimeCalculator(feed.createdAt),
    }));

    // ✅ Get follower count from followerIds array
    const creatorFollowDoc = await CreatorFollowing.findOne(
      { creatorId: creatorId },
      "followerIds"
    );

    const followerCount = creatorFollowDoc ? creatorFollowDoc.followerIds.length : 0;

    return res.status(200).json({
      message: "Creator feeds retrieved successfully",
      count: feedsWithTimeAgo.length,
      followerCount, // ✅ real number of followers
      feeds: feedsWithTimeAgo,
    });
  } catch (error) {
    console.error("Error fetching creator feeds:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};









exports.creatorFeedScheduleUpload = async (req, res) => {
  try {
    const accountId = req.Id || req.body.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const activeAccount = await getActiveCreatorAccount(accountId);
    if (!activeAccount) {
      return res
        .status(403)
        .json({ message: "Only active Creator account can upload feeds" });
    }
    const creatorId = activeAccount._id;

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
      createdByAccount: creatorId,
      contentUrl: req.cloudinaryFile.url,     // Cloudinary URL
      cloudinaryId: req.cloudinaryFile.public_id, // Cloudinary public_id
      scheduledAt: scheduleDate,
      isPosted: scheduleDate ? false : true,
    });

    await newFeed.save();

    // Handle Category collection
    let categoryDoc = await Category.findOne({
      name: { $regex: new RegExp(`^${formattedCategory}$`, "i") },
    });

    if (categoryDoc) {
      await Category.findByIdAndUpdate(categoryDoc._id, {
        $addToSet: { feedIds: newFeed._id },
      });
    } else {
      categoryDoc = new Category({
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






