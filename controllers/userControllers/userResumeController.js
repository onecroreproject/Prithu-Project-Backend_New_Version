const Users=require("../../models/userModels/userModel");
const ProfileSettings= require("../../models/profileSettingModel");
const UserProfile =require("../../models/userModels/UserEductionSchema/userFullCuricluamSchema");

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
    // 🔹 Get userId from JWT (Auth middleware should set req.Id)
    const userId = req.Id;
    if (!userId)
      return res.status(401).json({ success: false, message: "Unauthorized access" });

    // 🔹 Fetch basic user data
    const user = await Users.findById(userId).select(
      "_id userName displayName email phoneNumber"
    );
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    // 🔹 Fetch published profile settings
    const profile = await ProfileSettings.findOne({ userId }).lean();
    if (!profile || !profile.isPublished)
      return res.status(403).json({
        success: false,
        message: "Profile is not published or unavailable",
      });

    // 🔹 Fetch detailed resume/user profile info
    const fullProfile = await UserProfile.findOne({ userId })
      .populate("userId", "displayName email phoneNumber")
      .lean();

    // 🔹 Combine data
    const resumeData = {
      ...profile,
      ...fullProfile,
      user,
    };

    // 🔹 Respond
    res.status(200).json({
      success: true,
      data: resumeData,
      message: "Public resume fetched successfully",
    });
  } catch (error) {
    console.error("❌ getPublicResume error:", error);
    res.status(500).json({
      success: false,
      message: "Server error while fetching resume",
      error: error.message,
    });
  }
};

