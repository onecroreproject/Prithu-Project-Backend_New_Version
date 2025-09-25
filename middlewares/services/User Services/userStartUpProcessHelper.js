const UserLanguage = require("../../../models/userModels/userLanguageModel");
const ProfileSettings = require("../../../models/profileSettingModel");

exports.startUpProcessCheck = async (userId) => {
  if (!userId) {
    return {
      appLanguage: false,
      feedLanguage: false,
      gender: false
    };
  }

  try {
    // ✅ Step 1: Get UserLanguage entry
    const lang = await UserLanguage.findOne(
      { userId, active: true },
      { appLanguageCode: 1, feedLanguageCode: 1 }
    ).lean();

    const appLanguage = !!lang?.appLanguageCode;
    const feedLanguage = !!lang?.feedLanguageCode;

    // ✅ Step 2: Get ProfileSettings entry
    const profile = await ProfileSettings.findOne(
      { userId },
      { gender: 1 }
    ).lean();

    const gender = !!profile?.gender;

    // ✅ Return detailed status
    return {
      appLanguage,
      feedLanguage,
      gender
    };
  } catch (error) {
    console.error("Error in startUpProcessCheck:", error);
    return {
      appLanguage: false,
      feedLanguage: false,
      gender: false
    };
  }
};