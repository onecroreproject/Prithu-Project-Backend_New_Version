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

    // Create a case-insensitive regex
    const regex = new RegExp(query, "i");

    // Run all three queries in parallel for speed
    const [categories, people, jobs] = await Promise.all([
      // 🔹 Category search (by name)
      Categories.find({ name: regex })
        .select("name createdAt")
        .limit(10),

      // 🔹 People search (by userName or name)
      ProfileSettings.find({
        $or: [{ userName: regex }, { name: regex }, { lastName: regex }],
      })
        .select("userName profileAvatar name")
        .limit(10),

      // 🔹 Job search (by title, role, companyName)
      JobPost.find({
        $or: [
          { title: regex },
          { role: regex },
          { companyName: regex },
          { jobRole: regex },
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
