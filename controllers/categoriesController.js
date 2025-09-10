const Categories= require('../models/categorySchema');
const Feed = require('../models/feedModel');
const Account=require('../models/accountSchemaModel');
const ProfileSettings=require('../models/profileSettingModel');
const mongoose=require('mongoose')
const {feedTimeCalculator}=require("../middlewares/feedTimeCalculator");



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
    const host = `${req.protocol}://${req.get("host")}`; // host for full URL

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

      // Project the fields
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
            profileAvatar: {
              $cond: [
                { $ifNull: ["$profile.profileAvatar", false] },
                { $concat: [host + "/", "$profile.profileAvatar"] },
                null,
              ],
            
          },
        },
      },
    ]);

    if (!feeds.length) {
      return res.status(404).json({ message: "No feeds found in this category" });
    }

    // 3️⃣ Add full URL for feed content and timeAgo
    const formattedFeeds = feeds.map((f) => ({
      ...f,
      contentUrl: `${host}/${f.contentUrl}`,
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



exports.getContentCategories = async (req, res) => {
  try {
    // 1️⃣ Get all categories
    const categories = await Categories.find().select("_id name").lean();

    if (!categories.length) {
      return res.status(404).json({ message: "No categories found" });
    }

    // 2️⃣ Filter categories that have at least one feed
    const categoriesWithContent = [];
    for (const category of categories) {
      const feedCount = await Feed.countDocuments({ category: category._id });
      if (feedCount > 0) {
        categoriesWithContent.push(category);
      }
    }

    if (!categoriesWithContent.length) {
      return res.status(404).json({ message: "No categories with content found" });
    }

    res.status(200).json({
      message: "Categories with content retrieved successfully",
      categories: categoriesWithContent,
    });
  } catch (error) {
    console.error("Error fetching content categories:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




