const FeedService = require("../../middlewares/services/AdminServices/adminUploadfileService");
const ChildAdmin =require("../../models/childAdminModel")

exports.adminFeedUpload = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Single file upload
    if (req.file) {
      const result = await FeedService.uploadFeed(req.body, req.file, userId);
      return res.status(201).json({
        message: "Feed uploaded successfully",
        feeds: [result.feed], // always return array
        categories: [result.category],
        roleType: result.roleType
      });
    }

    // ✅ Multiple files upload
    if (req.files && req.files.length > 0) {
      const results = await FeedService.uploadFeedsMultiple(req.body, req.files, userId);
      return res.status(201).json({
        message: "All feeds uploaded successfully",
        feeds: results.map(r => r.feed),
        categories: results.map(r => r.category),
        roleTypes: results.map(r => r.roleType)
      });
    }

    return res.status(400).json({ message: "No files uploaded" });

  } catch (error) {
    console.error("Error uploading feed:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};



exports.childAdminFeedUpload = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Check if user is a Child Admin
    const childAdmin = await ChildAdmin.findOne({ userId });
    if (!childAdmin) {
      return res.status(403).json({ message: "Only Child Admins can upload feeds" });
    }

    // ✅ Single file upload
    if (req.file) {
      const result = await FeedService.uploadFeed(req.body, req.file, userId);
      return res.status(201).json({
        message: "Feed uploaded successfully",
        feeds: [result.feed],
        categories: [result.category],
        roleType: result.roleType
      });
    }

    // ✅ Multiple files upload
    if (req.files && req.files.length > 0) {
      const results = await FeedService.uploadFeedsMultiple(req.body, req.files, userId);
      return res.status(201).json({
        message: "All feeds uploaded successfully",
        feeds: results.map(r => r.feed),
        categories: results.map(r => r.category),
        roleTypes: results.map(r => r.roleType)
      });
    }

    return res.status(400).json({ message: "No files uploaded" });

  } catch (error) {
    console.error("Error uploading feed by Child Admin:", error);
    return res.status(500).json({ message: error.message || "Server error" });
  }
};