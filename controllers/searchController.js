// ✅ controllers/searchController.js
const Categories = require("../models/categorySchema");
const ProfileSettings = require("../models/profileSettingModel");
const JobPost = require("../models/JobPost/jobSchema");


exports.globalSearch = async (req, res) => {
  try {
    const query = req.query.q?.trim();

    if (!query || query.length < 1) {
      return res.status(400).json({
        success: false,
        message: "Search query cannot be empty.",
      });
    }

    const prefix = new RegExp(`^${query}`, "i"); 

    const [categories, people, jobs] = await Promise.all([
      Categories.find({ name: prefix })
        .select("name createdAt")
        .limit(10),

      ProfileSettings.find({
        $or: [
          { userName: prefix },
          { name: prefix },
          { lastName: prefix }
        ]
      })
        .select("userName profileAvatar name")
        .limit(10),

      JobPost.find({
        $or: [
          { title: prefix },
          { role: prefix },
          { companyName: prefix },
          { jobRole: prefix }
        ],
        status: "active",
      })
        .select("title role companyName location")
        .limit(10),
    ]);

    res.status(200).json({
      success: true,
      query,
      categories,
      people,
      jobs,
    });
  } catch (error) {
    console.error("❌ Search Error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred while searching.",
      error: error.message,
    });
  }
};

