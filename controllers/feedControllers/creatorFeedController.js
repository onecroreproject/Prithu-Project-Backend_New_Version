const Feed = require('../../models/feedModel');
const Categories = require('../../models/categorySchema');
const feedQueue = require("../../queue/feedPostQueue");
const { logUserActivity } = require("../../middlewares/helper/logUserActivity.js");
const User = require("../../models/userModels/userModel");
const { saveFile } = require("../../utils/storageEngine");
const fs = require("fs");

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
      categoryIds: inputCategoryIds,
      type, // image | video
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

    const categoryIds = Array.isArray(inputCategoryIds) ? inputCategoryIds : (categoryId ? [categoryId] : (inputCategoryIds ? [inputCategoryIds] : []));

    if (!categoryIds.length || !type) {
      return res.status(400).json({ message: "categoryIds and type are required" });
    }

    const categoryDoc = await Categories.findById(categoryIds[0]).lean();
    if (!categoryDoc) {
      return res.status(400).json({ message: "Invalid categoryId" });
    }

    const categorySlug = categoryDoc.name.toLowerCase().replace(/\s+/g, '-');
    const hashtags = extractHashtags(dec || "");

    const {
      buffer,
      originalName,
      mimeType,
      size,
      fileHash,
      videoDuration
    } = req.localFile;

    // 🚀 Save file locally
    const fileSave = await saveFile({
      buffer,
      originalname: originalName,
      mimetype: mimeType,
      size
    }, {
      type: 'feed',
      categorySlug: categorySlug,
      subType: type
    });

    const url = fileSave.url; // Store full absolute URL in DB

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

    // 🔁 BUILD FEED DATA
    const feedData = {
      type,
      language,
      category: categoryIds,
      createdByAccount: userId,
      roleRef: userRole,
      contentUrl: url,
      storageType: "local",
      fileHash,
      duration: videoDuration,
      files: [
        {
          url,
          path: fileSave.path,
          type,
          mimeType,
          size,
          duration: videoDuration || null,
          storageType: "local",
          order: 0
        }
      ],
      editMetadata: {
        crop: {
          ratio,
          zoomLevel: parseFloat(zoomLevel) || 1,
          position: typeof position === "string" ? JSON.parse(position) : position
        },
        filters: {
          preset: filter,
          adjustments: typeof adjustments === "string" ? JSON.parse(adjustments) : (adjustments || {})
        }
      },
      taggedUsers: [],
      audience,
      location: location ? (typeof location === "string" ? { name: location } : location) : undefined,
      isScheduled: !!scheduleDate,
      scheduleDate: scheduleDate ? new Date(scheduleDate) : null,
      status: scheduleDate ? "Scheduled" : "Published",
      dec,
      hashtags
    };

    // Tagged users processing
    if (Array.isArray(taggedFriends)) {
      for (const friendId of taggedFriends) {
        const friend = await User.findById(friendId).select("userName name").lean();
        if (friend) {
          feedData.taggedUsers.push({
            userId: friend._id,
            userName: friend.userName,
            name: friend.name
          });
        }
      }
    }

    const newFeed = await Feed.create(feedData);

    await Categories.updateMany(
      { _id: { $in: categoryIds } },
      { $addToSet: { feedIds: newFeed._id } }
    );

    return res.status(201).json({
      message: scheduleDate ? "Feed scheduled successfully" : "Feed uploaded successfully",
      feed: newFeed
    });

  } catch (err) {
    console.error("Error creating feed:", err);
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};

exports.creatorFeedScheduleUpload = async (req, res) => {
  // Logic is very similar to creatorFeedUpload, often they can be merged or one calls another
  // For brevity and based on existing structure, I'll update it to use local storage as well
  return exports.creatorFeedUpload(req, res);
};

exports.creatorFeedDelete = async (req, res) => {
  try {
    const { feedId } = req.params;
    const userId = req.Id;

    const feed = await Feed.findOne({ _id: feedId, createdByAccount: userId });
    if (!feed) {
      return res.status(404).json({ message: "Feed not found or access denied" });
    }

    // Logic for deleting local file could be added here if desired
    // For now, just mark as deleted in DB or delete doc
    await Feed.findByIdAndDelete(feedId);

    // Also remove from category
    if (feed.category && feed.category.length) {
      await Categories.updateMany(
        { _id: { $in: feed.category } },
        { $pull: { feedIds: feedId } }
      );
    }

    return res.status(200).json({ message: "Feed deleted successfully" });
  } catch (err) {
    return res.status(500).json({ message: "Server error", error: err.message });
  }
};
