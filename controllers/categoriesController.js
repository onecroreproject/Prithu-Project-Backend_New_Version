const Categories= require('../models/categorySchema');
const Feed = require('../models/feedModel');
const Account=require('../models/accountSchemaModel');
const ProfileSettings=require('../models/profileSettingModel');
const mongoose=require('mongoose')
const {feedTimeCalculator}=require("../middlewares/feedTimeCalculator");
const UserLanguage=require('../models/userModels/userLanguageModel');
const  {getLanguageCode}  = require("../middlewares/helper/languageHelper");



exports.getAllCategories = async (req, res) => {
  try {
    // Step 1: Fetch all categories (only id + name)
    const categories = await Categories.find({}, { _id: 1, name: 1 })
      .sort({ createdAt: -1 })
      .lean();

    if (!categories.length) {
      return res.status(404).json({ message: "No categories found" });
    }

    // Step 2: Aggregate feed stats by category (category stored as string ID)
    const feedStats = await Feed.aggregate([
      {
        $group: {
          _id: "$category", // category field holds categoryId as string
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
      const stat = feedStats.find((f) => f._id === cat._id.toString());
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






exports.getCategoryWithId = async (req, res) => {
  try {
    const categoryId = req.params.id;

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
      { $match: { category: categoryId } },
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
          hasMore: skip + feeds.length < totalFeeds, // ✅ check if next page exists
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
    const userId = req.Id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "userId is required" });

    // 1️⃣ Optional user language
    const userLang = await UserLanguage.findOne({ userId }).lean();
    const feedLang = userLang?.feedLanguageCode
      ? getLanguageCode(userLang.feedLanguageCode)
      : null;
  console.log(feedLang)
    // 2️⃣ Build match condition
    const feedMatch = feedLang ? { language: feedLang } : {};

    // 3️⃣ Aggregate feeds → distinct categories → join categories safely
    const categories = await Feed.aggregate([
      { $match: feedMatch },
      // Convert string category to ObjectId if valid, else keep null
      {
        $addFields: {
          categoryObjId: {
            $cond: [
              { $and: [
                { $ne: ["$category", null] },
                { $regexMatch: { input: { $toString: "$category" }, regex: /^[0-9a-fA-F]{24}$/ } }
              ] },
              { $toObjectId: "$category" },
              null
            ]
          }
        }
      },
      { $group: { _id: "$categoryObjId" } }, // distinct categories
      {
        $lookup: {
          from: "Categories", // must match actual DB collection name
          localField: "_id",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },
      { $project: { _id: "$category._id", name: "$category.name" } },
    ]);

    if (!categories.length) {
      return res.status(404).json({ message: "No categories with content found" });
    }

    // 4️⃣ Send response
    res.status(200).json({
      message: "Categories with content retrieved successfully",
      language: feedLang
        ? { code: userLang.feedLanguageCode, name: feedLang }
        : { code: null, name: "All Languages" },
      categories,
    });

  } catch (error) {
    console.error("Error fetching content categories:", error);
    res.status(500).json({ message: "Server error", error: error.message });
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









