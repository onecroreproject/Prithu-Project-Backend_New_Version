
const Users = require("../../models/userModels/userModel")
const ProfileSettings=require("../../models/profileSettingModel")
const UserLanguage=require('../../models/userModels/userLanguageModel')


exports.getUserDetailWithId = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId; // from auth middleware or body
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // ✅ Fetch user (only necessary fields)
    const user = await Users.findById(userId)
      .select("name email phone role createdAt")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Fetch profile settings
    const profile = await ProfileSettings.findOne({ userId })
      .select("bio avatar theme notifications")
      .lean();

    // ✅ Fetch language preference
    const language = await UserLanguage.findOne({ userId })
      .select("appLanguageCode appNativeCode feedLanguageCode feedNativeCode")
      .lean();

    // ✅ Merge results into one response
    const userDetails = {
      ...user,
      profile: profile || {},
      language: language || { appLanguageCode: "en", feedLanguageCode: "en" }
    };

    return res.status(200).json({ success: true, user: userDetails });
  } catch (err) {
    console.error("Error fetching user details:", err);
    return res.status(500).json({ 
      success: false, 
      message: "Cannot fetch user details", 
      error: err.message 
    });
  }
};


// Set or update App Language
exports.setAppLanguage = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const { code, native } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ message: "userId and appLanguageCode are required" });
    }

    const updated = await UserLanguage.findOneAndUpdate(
      { userId },
      { appLanguageCode: code, appNativeCode: native },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({ success: true, appLanguage: updated.appLanguageCode });
  } catch (err) {
    console.error("Error setting app language:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get App Language
exports.getAppLanguage = async (req, res) => {
  try {
    const userId = req.Id || req.query.userId;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const userLang = await UserLanguage.findOne({ userId }).select("appLanguageCode appNativeCode").lean();

    return res.status(200).json({
      success: true,
      appLanguage: userLang ? userLang.appLanguageCode : "en",
      native: userLang ? userLang.appNativeCode : "English"
    });
  } catch (err) {
    console.error("Error fetching app language:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};



// Set or update Feed Language
exports.setFeedLanguage = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const { code, native } = req.body;

    if (!userId || !code) {
      return res.status(400).json({ message: "userId and feedLanguageCode are required" });
    }

    const updated = await UserLanguage.findOneAndUpdate(
      { userId },
      { feedLanguageCode: code, feedNativeCode: native },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({ success: true, feedLanguage: updated.feedLanguageCode });
  } catch (err) {
    console.error("Error setting feed language:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

// Get Feed Language
exports.getFeedLanguage = async (req, res) => {
  try {
    const userId = req.Id || req.query.userId;
    if (!userId) return res.status(400).json({ message: "User ID is required" });

    const userLang = await UserLanguage.findOne({ userId }).select("feedLanguageCode feedNativeCode").lean();

    return res.status(200).json({
      success: true,
      feedLanguage: userLang ? userLang.feedLanguageCode : "en",
      native: userLang ? userLang.feedNativeCode : "English"
    });
  } catch (err) {
    console.error("Error fetching feed language:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};





