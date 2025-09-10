const Feed = require('../../models/feedModel');
const { getVideoDurationInSeconds } = require('get-video-duration');
const fs = require('fs');
const Tags = require('../../models/categorySchema');
const path =require ('path');
const Account=require("../../models/accountSchemaModel");
const {feedTimeCalculator}=require("../../middlewares/feedTimeCalculator");
const {getActiveCreatorAccount}=require("../../middlewares/creatorAccountactiveStatus");
const Categories=require('../../models/categorySchema');
const User=require('../../models/userModels/userModel');
const mongoose=require("mongoose")


 
 
exports.creatorFeedUpload = async (req, res) => {
  try {
    const accountId = req.accountId || req.body.accountId;
    const creatorRole = req.role || req.body.role;
    const userId = req.Id || req.body.userId;

    if (!accountId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Ensure account is Creator
    const userRole = await Account.findById(accountId).select("type");
    if (!userRole || userRole.type !== "Creator") {
      return res.status(403).json({ message: "Only Creators can upload feeds" });
    }

    const activeAccount = await getActiveCreatorAccount(userId);
    if (!activeAccount) {
      return res.status(403).json({ message: "Active Creator account required to upload feed" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { language, categoryId, type } = req.body;
    if (!language || !categoryId || !type) {
      return res.status(400).json({ message: "Language, categoryId, and type are required" });
    }

    // Validate categoryId exists
    const categoryDoc = await Categories.findById(categoryId);
    if (!categoryDoc) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    // Prevent duplicate file upload
    const newFileName = path.basename(req.file.path);
    const existFeed = await Feed.findOne({ contentUrl: { $regex: `${newFileName}$` } });
    if (existFeed) {
      return res.status(400).json({ message: "The file has already been uploaded" });
    }

    // Video duration check (only for video type)
    let videoDuration = null;
    if (type === "video" && req.file.mimetype.startsWith("video/")) {
      videoDuration = await getVideoDurationInSeconds(req.file.path);
      if (videoDuration >= 90.0) {
        return res.status(400).json({ message: "Upload video below 90 seconds" });
      }
    }

    // Create and save feed
    const newFeed = new Feed({
      type,
      language,
      category: categoryId,
      duration: videoDuration,
      createdByAccount: activeAccount._id,
      contentUrl: req.file.path.replace(/\\/g, "/"), // ✅ normalize path
      roleRef: creatorRole,
    });

    await newFeed.save();

    // Optional: push feedId into category (if you still want denormalized data)
    await Categories.findByIdAndUpdate(categoryId, {
      $push: { feedIds: newFeed._id },
    });

    return res.status(201).json({
      message: "Feed created successfully",
      feed: newFeed,
    });
  } catch (error) {
    console.error("Error creating feed:", error);
    return res.status(500).json({ message: "Server error", error: error.message });
  }
};






exports.creatorFeedDelete = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const accountId = req.Id;
    const activeAccount = await getActiveCreatorAccount(accountId);
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
    const accountId = req.Id || req.body.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "Account ID is required" });
    }

    // ✅ Fetch account
    const account = await Account.findById(accountId).lean();
    if (!account) {
      return res.status(400).json({ message: "Account not found" });
    }

    // ✅ Ensure active creator account
    const activeAccount = await getActiveCreatorAccount(account.userId);
    if (!activeAccount) {
      return res.status(403).json({
        message: "Only active Creator account can fetch feeds",
      });
    }

    const creatorId = activeAccount._id;

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

    const host = `${req.protocol}://${req.get("host")}`;
    const feedsFormatted = feeds.map(feed => ({
      feedId: feed._id,
      contentUrl: `${host}/${feed.contentUrl}`,
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
    const accountId = req.accountId;
    if (!accountId) {
      return res.status(400).json({ message: "User ID is required" });
    }
 
    const activeAccount = await getActiveCreatorAccount(accountId);
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
 
    return res.status(200).json({
      message: "Creator feeds retrieved successfully",
      count: feedsWithTimeAgo.length,
      feeds: feedsWithTimeAgo,
    });
  } catch (error) {
    console.error("Error fetching creator feeds:", error);
    return res.status(500).json({ message: "Server error", error });
  }
};







exports.creatorFeedScheduleUpload = async (req, res) => {
  console.log("working")
  try {
    const accountId = req.Id;
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

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { language, category, type, scheduledAt } = req.body;

    if (!language || !category || !type) {
      return res
        .status(400)
        .json({ message: "Language, category, and type required" });
    }

    const newFileName = path.basename(req.file.path);
    const existFeed = await Feed.findOne({
      contentUrl: { $regex: `${newFileName}$` },
    });
    if (existFeed) {
      return res.status(400).json({ message: "The file has already been uploaded" });
    }

    let videoDuration = null;
    if (type === "video" && req.file.mimetype.startsWith("video/")) {
      videoDuration = await getVideoDurationInSeconds(req.file.path);
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

    // ✅ Capitalize first letter of category
    const formattedCategory = category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();

    // Create feed
    const newFeed = new Feed({
      type,
      language,
      category: formattedCategory,
      duration: videoDuration,
      createdByAccount: creatorId,
      contentUrl: req.file.path,
      scheduledAt: scheduleDate,
      isPosted: scheduleDate ? false : true,
    });
    await newFeed.save();

    // ✅ Handle Category collection
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

    await Account.findByIdAndUpdate(creatorId, { $push: { feeds: newFeed._id } });

    return res.status(201).json({
      message: scheduleDate
        ? "Feed scheduled successfully (category will update when posted)"
        : "Feed created successfully",
      feed: newFeed,
    });
  } catch (error) {
    console.error("Error creating feed:", error);
    return res.status(500).json({ message: "Server error" });
  }
};






