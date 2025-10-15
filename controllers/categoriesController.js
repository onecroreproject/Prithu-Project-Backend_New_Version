const Categories= require('../models/categorySchema');
const Feed = require('../models/feedModel');
const Account=require('../models/accountSchemaModel');
const ProfileSettings=require('../models/profileSettingModel');
const mongoose=require('mongoose')
const {feedTimeCalculator}=require("../middlewares/feedTimeCalculator");
const UserLanguage=require('../models/userModels/userLanguageModel');
const  {getLanguageCode}  = require("../middlewares/helper/languageHelper");
const UserCategory = require("../models/userModels/userCategotyModel");



exports.getAllCategories = async (req, res) => {
  try {
    // Step 1: Fetch all categories (only _id + name)
    const categories = await Categories.find({}, { _id: 1, name: 1 })
      .sort({ createdAt: -1 })
      .lean();

    if (!categories.length) {
      return res.status(404).json({ message: "No categories found" });
    }

    // Step 2: Aggregate feed stats by category (category stored as ObjectId)
    const feedStats = await Feed.aggregate([
      {
        $group: {
          _id: "$category", // ObjectId reference to Categories
          totalFeeds: { $sum: 1 },
          videoCount: {
            $sum: { $cond: [{ $eq: ["$type", "video"] }, 1, 0] },
          },
          imageCount: {
            $sum: { $cond: [{ $eq: ["$type", "image"] }, 1, 0] },
          },
        },
      },
    ]);

    // Step 3: Merge category details with feed stats
    const formattedCategories = categories.map((cat) => {
      const stat = feedStats.find((f) => f._id.toString() === cat._id.toString());
      return {
        categoryId: cat._id,
        categoriesName: cat.name,
        totalFeeds: stat ? stat.totalFeeds : 0,
        videoCount: stat ? stat.videoCount : 0,
        imageCount: stat ? stat.imageCount : 0,
      };
    });

    // Step 4: Send success response
    return res.status(200).json({
      message: "Categories retrieved successfully",
      categories: formattedCategories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};






exports.getCategoriesWithFeeds = async (req, res) => {
  try {
    // 1️⃣ Fetch categories that have at least one feed
    const categories = await Categories.find({ feedIds: { $exists: true, $ne: [] } })
      .select("_id name feedIds")
      .lean();

    if (!categories.length) {
      return res.status(404).json({
        message: "No categories with feeds found",
        categories: [],
      });
    }

    // 2️⃣ Optional: filter out categories where all feedIds do not exist in Feed collection
    const filteredCategories = [];
    for (const cat of categories) {
      const feedCount = await Feed.countDocuments({ _id: { $in: cat.feedIds } });
      if (feedCount > 0) {
        filteredCategories.push({
          categoryId: cat._id,
          categoryName: cat.name,
          totalFeeds: feedCount,
        });
      }
    }

    if (!filteredCategories.length) {
      return res.status(404).json({
        message: "No categories with active feeds found",
        categories: [],
      });
    }

    // 3️⃣ Return response
    res.status(200).json({
      message: "Categories with feeds retrieved successfully",
      categories: filteredCategories,
    });
  } catch (error) {
    console.error("Error fetching categories with feeds:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};







// Save interested category (single or multiple)
exports.saveInterestedCategory = async (req, res) => {
  try {
    const { userId, categoryIds } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    // Ensure categoryIds is always an array
    const categories = Array.isArray(categoryIds) ? categoryIds : [categoryIds];

    // Validate all category IDs
    for (const id of categories) {
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({ message: `Invalid categoryId: ${id}` });
      }
    }

    let userCategory = await UserCategory.findOne({ userId });

    if (!userCategory) {
      // Create new document if not exists
      userCategory = new UserCategory({
        userId,
        interestedCategories: categories.map(id => ({ categoryId: id })),
      });
    } else {
      // Add categories to interestedCategories if not already present
      categories.forEach(id => {
        const exists = userCategory.interestedCategories.some(c => c.categoryId.toString() === id);
        if (!exists) {
          userCategory.interestedCategories.push({ categoryId: id });
        } else {
          // Update timestamp if already exists
          userCategory.interestedCategories = userCategory.interestedCategories.map(c =>
            c.categoryId.toString() === id ? { ...c.toObject(), updatedAt: new Date() } : c
          );
        }

        // Remove from nonInterestedCategories if exists
        userCategory.nonInterestedCategories = userCategory.nonInterestedCategories.filter(
          c => c.categoryId.toString() !== id
        );
      });
    }

    await userCategory.save();

    res.status(200).json({ message: "Interested categories saved successfully", userCategory });
  } catch (error) {
    console.error("Error saving interested categories:", error);
    res.status(500).json({ message: "Server error" });
  }
};








exports.getCategoryWithId = async (req, res) => {
  try {
    const categoryId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(categoryId)) {
      return res.status(400).json({ message: "Invalid category ID" });
    }

    // 📌 Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 1️⃣ Find category
    const category = await Categories.findById(categoryId).lean();
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // 2️⃣ Aggregate feeds with account and profile info (with pagination)
    const feeds = await Feed.aggregate([
      { $match: { category: mongoose.Types.ObjectId(categoryId) } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // Lookup account
      {
        $lookup: {
          from: "Accounts",
          localField: "createdByAccount",
          foreignField: "_id",
          as: "account",
        },
      },
      { $unwind: "$account" },

      // Lookup profile using account.userId
      {
        $lookup: {
          from: "ProfileSettings",
          localField: "account.userId",
          foreignField: "userId",
          as: "profile",
        },
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // Project only required fields
      {
        $project: {
          type: 1,
          language: 1,
          category: 1,
          duration: 1,
          contentUrl: 1,
          roleRef: 1,
          createdAt: 1,
          updatedAt: 1,
          userName: "$profile.userName",
          profileAvatar: "$profile.profileAvatar",
        },
      },
    ]);

    // 3️⃣ Get total feeds count for this category
    const totalFeeds = await Feed.countDocuments({ category: categoryId });

    // 4️⃣ Format feeds with timeAgo
    const formattedFeeds = feeds.map((f) => ({
      ...f,
      contentUrl: f.contentUrl,
      timeAgo: feedTimeCalculator(new Date(f.createdAt)),
    }));

    res.status(200).json({
      category: {
        categoryId: category._id,
        categoryName: category.name,
        feeds: formattedFeeds,
        pagination: {
          total: totalFeeds,
          page,
          limit,
          hasMore: skip + feeds.length < totalFeeds,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching category feeds:", error);
    res.status(500).json({ message: "Server error" });
  }
};









exports.getUserContentCategories = async (req, res) => {
  try {
    // 1️⃣ Get userId from token
    const userId = req.user?.id; // assuming middleware sets req.user
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: user not found in token" });
    }

    // 2️⃣ Get user's preferred feed language
    const userLang = await UserLanguage.findOne({ userId }).lean();
    const feedLang = userLang?.feedLanguageCode
      ? getLanguageCode(userLang.feedLanguageCode)
      : null;

    const feedMatch = feedLang ? { language: feedLang } : {};

    // 3️⃣ Find all unique feed category IDs in user's language
    const categoryIds = await Feed.find(feedMatch).distinct("category");

    if (!categoryIds.length) {
      return res.status(404).json({
        message: "No categories with content found",
        categories: [],
      });
    }

    // 4️⃣ Check if user has a UserCategory record
    const userCategory = await UserCategory.findOne({ userId }).lean();

    let filteredCategoryIds = categoryIds;

    // If first time (no record), filter by interested categories
    if (!userCategory) {
      // Here you might want to define default interested categories for first-time users
      // For now, assuming all categories are sent as "interested" for the first time
      filteredCategoryIds = categoryIds;
    } else if (userCategory.interestedCategories?.length > 0) {
      // If record exists, send all categories regardless of interested (per requirement)
      filteredCategoryIds = categoryIds;
    }

    // 5️⃣ Fetch category details
    const categories = await Categories.find({ _id: { $in: filteredCategoryIds } })
      .select("_id name")
      .sort({ name: 1 })
      .lean();

    res.status(200).json({
      message: "Categories with content retrieved successfully",
      language: feedLang
        ? { code: userLang.feedLanguageCode, name: feedLang }
        : { code: null, name: "All Languages" },
      categories,
    });
  } catch (error) {
    console.error("Error fetching content categories:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message,
    });
  }
};








exports.searchCategories = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const  query = req.body.query ;

    if (!query || query.trim() === "") {
      return res.status(400).json({ message: "Query is required" });
    }

    // 1️⃣ Optional user language
    const userLang = await UserLanguage.findOne({ userId }).lean();
    const feedLang = userLang?.feedLanguageCode
      ? getLanguageCode(userLang.feedLanguageCode)
      : null;

    // 2️⃣ Build match condition for feeds
    const feedMatch = feedLang ? { language: feedLang } : {};

    // 3️⃣ Aggregate feeds → categories → filter by search query
    const categories = await Feed.aggregate([
      { $match: feedMatch },
      {
        $addFields: {
          categoryObjId: {
            $cond: [
              {
                $and: [
                  { $ne: ["$category", null] },
                  {
                    $regexMatch: {
                      input: { $toString: "$category" },
                      regex: /^[0-9a-fA-F]{24}$/
                    }
                  }
                ]
              },
              { $toObjectId: "$category" },
              null
            ]
          }
        }
      },
      { $group: { _id: "$categoryObjId" } },
      {
        $lookup: {
          from: "Categories",
          localField: "_id",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
      {
        $match: {
          "category.name": { $regex: query, $options: "i" } // 🔍 filter by search
        }
      },
      { $project: { _id: "$category._id", name: "$category.name" } },
      { $limit: 10 }
    ]);

    if (!categories.length) {
      return res.status(404).json({ message: "No matching categories found" });
    }

    // 4️⃣ Send response
    return res.status(200).json({
      message: "Categories retrieved successfully",
      language: feedLang
        ? { code: userLang.feedLanguageCode, name: feedLang }
        : { code: null, name: "All Languages" },
      categories
    });
  } catch (error) {
    console.error("Error searching categories:", error);
    return res.status(500).json({ message: "Server error" });
  }
};









