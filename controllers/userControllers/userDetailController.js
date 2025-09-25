
const Users = require("../../models/userModels/userModel")
const ProfileSettings=require("../../models/profileSettingModel")
const UserLanguage=require('../../models/userModels/userLanguageModel');
const { getLanguageCode, getLanguageName } = require("../../middlewares/helper/languageHelper");



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
    const { appLanguage } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const appCode = appLanguage ? getLanguageCode(appLanguage) : null;
    if (!appCode) {
      return res.status(400).json({ message: "Invalid or missing appLanguage" });
    }

    const userLanguage = await UserLanguage.findOneAndUpdate(
      { userId },
      {
        appLanguageCode: appCode,
        appNativeCode: getLanguageName(appCode),
        active: true,
      },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      message: "App language updated successfully",
      data: userLanguage,
    });
  } catch (error) {
    console.error("Error in setAppLanguage:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// Get App Language
exports.getAppLanguage = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const userLanguage = await UserLanguage.findOne({ userId, active: true })
      .select("appLanguageCode appNativeCode")
      .lean();

    if (!userLanguage) {
      return res.status(404).json({ message: "No app language set" });
    }

    return res.status(200).json({
      message: "App language fetched successfully",
      data: userLanguage,
    });
  } catch (error) {
    console.error("Error in getAppLanguage:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};



// Set or update Feed Language
exports.setFeedLanguage = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const { feedLanguage } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const feedCode = feedLanguage ? getLanguageCode(feedLanguage) : null;
    if (!feedCode) {
      return res.status(400).json({ message: "Invalid or missing feedLanguage" });
    }

    const userLanguage = await UserLanguage.findOneAndUpdate(
      { userId },
      {
        feedLanguageCode: feedCode,
        feedNativeCode: getLanguageName(feedCode),
        active: true,
      },
      { new: true, upsert: true }
    ).lean();

    return res.status(200).json({
      message: "Feed language updated successfully",
      data: userLanguage,
    });
  } catch (error) {
    console.error("Error in setFeedLanguage:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


// Get Feed Language
exports.getFeedLanguage = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    const userLanguage = await UserLanguage.findOne({ userId, active: true })
      .select("feedLanguageCode feedNativeCode")
      .lean();

    if (!userLanguage) {
      return res.status(404).json({ message: "No feed language set" });
    }

    return res.status(200).json({
      message: "Feed language fetched successfully",
      data: userLanguage,
    });
  } catch (error) {
    console.error("Error in getFeedLanguage:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};



exports.checkUsernameAvailability = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username || username.trim() === "") {
      return res.status(400).json({ message: "Username is required" });
    }

    // Normalize: lowercase and trim
    const formattedUsername = username.trim().toLowerCase();

    // Case-insensitive search in DB
    const userExists = await Users.findOne({
      userName: { $regex: new RegExp(`^${formattedUsername}$`, "i") }
    }).lean();

    if (userExists) {
      return res.status(200).json({
        available: false,
        message: "Username not available",
      });
    }

    return res.status(200).json({
      available: true,
      message: "Username available",
    });
  } catch (error) {
    console.error("Error checking username availability:", error);
    return res.status(500).json({ message: "Server error" });
  }
};


exports.checkEmailAvailability = async (req, res) => {
  try {
    const { email } = req.query;

    if (!email || email.trim() === "") {
      return res.status(400).json({ message: "Email is required" });
    }

    // Normalize: lowercase and trim
    const formattedEmail = email.trim().toLowerCase();

    // Case-insensitive search in DB
    const emailExists = await Users.findOne({
      email: { $regex: new RegExp(`^${formattedEmail}$`, "i") }
    }).lean();

    if (emailExists) {
      return res.status(200).json({
        available: false,
        message: "Email not available",
      });
    }

    return res.status(200).json({
      available: true,
      message: "Email available",
    });
  } catch (error) {
    console.error("Error checking email availability:", error);
    return res.status(500).json({ message: "Server error" });
  }
};



exports.getUserReferalCode = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    // Fetch user from database
    const user = await Users.findById(userId).select("referralCode").lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Send referral code in response
    return res.status(200).json({
      success: true,
      referralCode: user.referralCode || null, // if not set, return null
    });
  } catch (error) {
    console.error("Error fetching referral code:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};





