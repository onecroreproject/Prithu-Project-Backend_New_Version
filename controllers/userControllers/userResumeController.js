const Users=require("../../models/userModels/userModel");
const ProfileSettings= require("../../models/profileSettingModel");
const UserProfile =require("../../models/userModels/UserEductionSchema/userFullCuricluamSchema");
const { logUserActivity } = require("../../middlewares/helper/logUserActivity.js");

// ✅ controllers/profileController.js
exports.togglePublish = async (req, res) => {
  try {
    const userId = req.Id;
    const { publish } = req.body; // true or false

    const user = await Users.findById(userId).select("userName");
    if (!user) return res.status(404).json({ message: "User not found" });

    let shareableLink = null;
    if (publish) {
      shareableLink = `https://prithu.app/r/${user.userName}`;
    }
console.log(shareableLink)
    const profile = await ProfileSettings.findOneAndUpdate(
      { userId },
      { isPublished: publish, shareableLink },
      { new: true, upsert: true }
    );

    return res.json({
      success: true,
      isPublished: profile.isPublished,
      shareableLink: profile.shareableLink,
    });
  } catch (error) {
    console.error("Toggle publish error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

exports.getPublicResume = async (req, res) => {
  try {
    const { username } = req.params ;
    const user = await Users.findOne({ userName: username }).select("_id userName displayName");
    if (!user) return res.status(404).json({ message: "User not found" });

    const profile = await ProfileSettings.findOne({ userId: user._id }).lean();
    if (!profile || !profile.isPublished)
      return res.status(403).json({ message: "Link is invalid or unpublished" });

    const fullProfile = await UserProfile.findOne({ userId: user._id })
      .populate("userId", "displayName email phoneNumber")
      .lean();

    res.json({ success: true, data: { ...profile, ...fullProfile, user } });
  } catch (error) {
    console.error("Get public resume error:", error);
    res.status(500).json({ message: "Server error" });
  }
};


// ✅ controllers/resumeController.js
exports.getPublicPortfolio = async (req, res) => {
  try {
    // 🔹 Get username from URL params
    const { username } = req.params;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required in the request parameters",
      });
    }

    // 🔹 Find user by username (case-insensitive match)
    const user = await Users.findOne({ userName: new RegExp(`^${username}$`, "i") }).select(
      "_id userName displayName email phoneNumber"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 🔹 Fetch published profile settings for the user
    const profile = await ProfileSettings.findOne({ userId: user._id }).lean();
    if (!profile || !profile.isPublished) {
      return res.status(403).json({
        success: false,
        message: "This user's profile is not published or unavailable",
      });
    }

    // 🔹 Fetch detailed resume/user profile info
    const fullProfile = await UserProfile.findOne({ userId: user._id })
      .populate("userId", "displayName email phoneNumber")
      .lean();

    // 🔹 Merge all data
    const portfolioData = {
      ...profile,
      ...fullProfile,
      user,
    };


     await logUserActivity({
                userId:user._id,
                actionType: "VIEW_PORTFOLIO",
                targetId: user._id,
                targetModel: "UserCurricluam",
                metadata: { platform: "web" },
              });

    // 🔹 Success response
    res.status(200).json({
      success: true,
      data: portfolioData,
      message: "Public portfolio fetched successfully",
    });
  } catch (error) {
    console.error("❌ getPublicPortfolio error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching public portfolio",
      error: error.message,
    });
  }
};


