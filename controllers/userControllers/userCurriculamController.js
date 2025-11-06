// controllers/userProfile/userProfileController.js
const UserProfile = require("../../models/userModels/UserEductionSchema/userFullCuricluamSchema");

/* ===============================
   🧾 CREATE OR GET PROFILE
=============================== */

// Create user profile if not exists
exports.createOrGetProfile = async (req, res) => {
  try {
    const userId = req.user?._id || req.body.userId;
    if (!userId) return res.status(400).json({ message: "User ID required" });

    let profile = await UserProfile.findOne({ userId });

    if (!profile) {
      profile = await UserProfile.create({ userId });
    }

    res.status(200).json(profile);
  } catch (error) {
    console.error("Error creating/getting profile:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/* ===============================
   🎓 EDUCATION CRUD
=============================== */

// Add education entry
exports.addEducation = async (req, res) => {

  try {
    const userId = req.Id ;
    const { educationData } = req.body;
    if (!userId || !educationData)
      return res.status(400).json({ message: "User ID and education data required" });

    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $push: { education: educationData } },
      { new: true, upsert: true }
    );

    res.status(201).json(profile.education);
  } catch (error) {
    console.error("Add education error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Update education by ID
exports.updateEducation = async (req, res) => {
  try {
    const { userId, educationId } = req.params;
    const updatedData = req.body;

    const profile = await UserProfile.findOneAndUpdate(
      { userId, "education._id": educationId },
      { $set: { "education.$": updatedData } },
      { new: true }
    );

    if (!profile) return res.status(404).json({ message: "Education not found" });

    res.status(200).json(profile.education);
  } catch (error) {
    console.error("Update education error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

// Delete education entry
exports.deleteEducation = async (req, res) => {
  try {
    const { userId, educationId } = req.params;

    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $pull: { education: { _id: educationId } } },
      { new: true }
    );

    res.status(200).json(profile.education);
  } catch (error) {
    console.error("Delete education error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/* ===============================
   💼 EXPERIENCE CRUD
=============================== */

exports.addExperience = async (req, res) => {
  try {
    const userId = req.Id;
    const { experienceData } = req.body;
    console.log({userId,experienceData})
      if (!userId || !experienceData)
      return res.status(400).json({ message: "User ID and exprience data required" });
    console.log(experienceData)
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $push: { experience: experienceData } },
      { new: true, upsert: true }
    );
    res.status(201).json(profile.experience);
  } catch (error) {
    console.error("Add experience error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.updateExperience = async (req, res) => {
  try {
    const { userId, experienceId } = req.params;
    const updatedData = req.body;

    const profile = await UserProfile.findOneAndUpdate(
      { userId, "experience._id": experienceId },
      { $set: { "experience.$": updatedData } },
      { new: true }
    );

    if (!profile) return res.status(404).json({ message: "Experience not found" });

    res.status(200).json(profile.experience);
  } catch (error) {
    console.error("Update experience error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.deleteExperience = async (req, res) => {
  try {
    const { userId, experienceId } = req.params;
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $pull: { experience: { _id: experienceId } } },
      { new: true }
    );
    res.status(200).json(profile.experience);
  } catch (error) {
    console.error("Delete experience error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/* ===============================
   🧠 SKILL CRUD
=============================== */

exports.addSkill = async (req, res) => {
  try {
    const { userId, skillData } = req.body;
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $push: { skills: skillData } },
      { new: true, upsert: true }
    );
    res.status(201).json(profile.skills);
  } catch (error) {
    console.error("Add skill error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.updateSkill = async (req, res) => {
  try {
    const { userId, skillId } = req.params;
    const updatedData = req.body;

    const profile = await UserProfile.findOneAndUpdate(
      { userId, "skills._id": skillId },
      { $set: { "skills.$": updatedData } },
      { new: true }
    );

    if (!profile) return res.status(404).json({ message: "Skill not found" });

    res.status(200).json(profile.skills);
  } catch (error) {
    console.error("Update skill error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.deleteSkill = async (req, res) => {
  try {
    const { userId, skillId } = req.params;
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $pull: { skills: { _id: skillId } } },
      { new: true }
    );
    res.status(200).json(profile.skills);
  } catch (error) {
    console.error("Delete skill error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/* ===============================
   🏅 CERTIFICATIONS CRUD
=============================== */

exports.addCertification = async (req, res) => {
  try {
    const { userId, certificationData } = req.body;
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $push: { certifications: certificationData } },
      { new: true, upsert: true }
    );
    res.status(201).json(profile.certifications);
  } catch (error) {
    console.error("Add certification error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.updateCertification = async (req, res) => {
  try {
    const { userId, certificationId } = req.params;
    const updatedData = req.body;

    if (!userId || !certificationId) {
      return res
        .status(400)
        .json({ message: "User ID and certification ID are required" });
    }

    const profile = await UserProfile.findOneAndUpdate(
      { userId, "certifications._id": certificationId },
      { $set: { "certifications.$": updatedData } },
      { new: true }
    );

    if (!profile) {
      return res.status(404).json({ message: "Certification not found" });
    }

    res.status(200).json({
      success: true,
      message: "Certification updated successfully",
      certifications: profile.certifications,
    });
  } catch (error) {
    console.error("Update certification error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

exports.deleteCertification = async (req, res) => {
  try {
    const { userId, certificationId } = req.params;
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      { $pull: { certifications: { _id: certificationId } } },
      { new: true }
    );
    res.status(200).json(profile.certifications);
  } catch (error) {
    console.error("Delete certification error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};

/* ===============================
   🧍‍♂️ GET FULL PROFILE
=============================== */

exports.getFullProfile = async (req, res) => {
  try {
    const userId =req.Id;
    const profile = await UserProfile.findOne({ userId }).populate("userId", "name email role");

    if (!profile) return res.status(404).json({ message: "Profile not found" });

    res.status(200).json(profile);
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Server error", error });
  }
};
