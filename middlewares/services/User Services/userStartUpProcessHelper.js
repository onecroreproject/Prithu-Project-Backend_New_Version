const UserLanguage = require("../../../models/userModels/userLanguageModel");

exports.startUpProcessCheck = async (userId) => {
  if (!userId) return false;

  try {
    // Check if user has both appLanguageCode and feedLanguageCode set and active
    const exists = await UserLanguage.exists({
      userId,
      applanguageCode: { $ne: null },
      feedlanguageCode: { $ne: null },
      active: true
    });

    return !!exists; // true if both languages are set
  } catch (error) {
    console.error("Error in startUpProcessCheck:", error);
    return false;
  }
};
