const UserActivity = require("../../models/userModels/userActivitySchema");


exports.getMyActivities = async (req, res) => {
  try {
    const userId = req.Id;
    const activities = await UserActivity.find({ userId })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("targetId", "title userName companyName");

    res.json({ success: true, activities });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};