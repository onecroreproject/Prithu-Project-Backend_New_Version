const Frame = require("../../models/frameModel");
const { deleteLocalFrame } = require("../../middlewares/helper/frameUpload");
const fs = require("fs");
const path = require("path");

// Upload frames
exports.uploadFrames = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0)
      return res.status(400).json({ message: "No frame files uploaded" });

    const host = `${req.protocol}://${req.get("host")}`;
    const uploadedFrames = [];

    for (const file of files) {
      const url = `${host}/media/frames/${file._savedName}`;

      const newFrame = await Frame.create({
        name: path.parse(file.originalname).name,
        localPath: file._savedPath,
        url,
      });

      uploadedFrames.push(newFrame);
    }

    return res.json({ success: true, frames: uploadedFrames });

  } catch (err) {
    console.error("Upload frames error:", err);
    return res.status(500).json({ message: "Failed to upload frames" });
  }
};

// Get all active frames
exports.getAllFrames = async (req, res) => {
  try {
    const frames = await Frame.find({ isActive: true });
    res.json({ success: true, frames });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch frames" });
  }
};

// Delete frame
exports.deleteFrame = async (req, res) => {
  try {
    const { id } = req.params;

    const frame = await Frame.findById(id);
    if (!frame) {
      return res.status(404).json({ success: false, message: "Frame not found" });
    }

    // Delete from local storage
    if (frame.localPath) {
      deleteLocalFrame(frame.localPath);
    }

    // Delete from DB
    await Frame.findByIdAndDelete(id);

    res.json({ success: true, message: "Frame deleted successfully" });

  } catch (err) {
    console.error("Delete frame error:", err);
    res.status(500).json({ success: false, message: "Failed to delete frame" });
  }
};
