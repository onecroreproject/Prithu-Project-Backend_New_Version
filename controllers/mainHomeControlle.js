const User = require("../models/userModels/userModel"); // prithuDB


exports.getManiBoardStats = async (req, res) => {
  try {
    const [
      totalUsers,
    ] = await Promise.all([
      // 👤 Users (only active users, optional)
      User.countDocuments({ isActive: true }),

    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
      },
    });
  } catch (error) {
    console.error("❌ Dashboard stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard statistics",
    });
  }
};