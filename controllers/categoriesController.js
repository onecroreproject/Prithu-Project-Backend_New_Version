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
    const categories = await Categories.find({}, { _id: 1, name: 1 })
      .sort({ createdAt: -1 })
      .lean();

    if (!categories.length) {
      return res.status(404).json({ message: "No categories found" });
    }

    const formattedCategories = categories.map(cat => ({
      categoryId: cat._id,
      categoriesName: cat.name,
    }));

    return res.status(200).json({
      message: "Categories retrieved successfully",
      categories: formattedCategories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



exports.getCategoryWithId = async (req, res) => {
  try {
    const categoryId = req.params.id;

    // 1️⃣ Find category
    const category = await Categories.findById(categoryId).lean();
    if (!category) {
      return res.status(404).json({ message: "Category not found" });
    }

    // 2️⃣ Aggregate feeds with account and profile info
    const feeds = await Feed.aggregate([
      { $match: { category: categoryId } },
      { $sort: { createdAt: -1 } },

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

      // Project the fields (host removed)
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

    if (!feeds.length) {
      return res.status(404).json({ message: "No feeds found in this category" });
    }

    // 3️⃣ Add full URL for feed content and timeAgo
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









