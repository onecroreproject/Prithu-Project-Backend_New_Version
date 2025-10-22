// controllers/frameController.js
const cloudinary = require("cloudinary").v2;
const Frame = require("../../models/frameModel");
const fs = require("fs");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Upload a frame
exports.uploadFrames = async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0)
      return res.status(400).json({ message: "No frame files uploaded" });

    const uploadedFrames = [];

    for (const file of files) {
      // Upload each frame to Cloudinary
      const result = await cloudinary.uploader.upload(file.path, {
        folder: "frames",
        use_filename: true,
        unique_filename: true,
      });

      // Save to MongoDB
      const newFrame = await Frame.create({
        name: file.originalname.split(".")[0],
        publicId: result.public_id,
        url: result.secure_url,
      });

      uploadedFrames.push(newFrame);

      // Delete local temp file
      fs.unlinkSync(file.path);
    }

    res.json({ success: true, frames: uploadedFrames });
  } catch (err) {
    console.error("Upload frames error:", err);
    res.status(500).json({ message: "Failed to upload frames" });
  }
};



// controllers/frameController.js (add)
exports.getAllFrames = async (req, res) => {
  try {
    const frames = await Frame.find({ isActive: true });
    res.json({ success: true, frames });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch frames" });
  }
};



exports.deleteFrame = async (req, res) => {
  try {
    const { id } = req.params;

    // Find frame in DB
    const frame = await Frame.findById(id);
    if (!frame) {
      return res.status(404).json({ success: false, message: "Frame not found" });
    }

    // Delete from Cloudinary
    if (frame.publicId) {
      await cloudinary.uploader.destroy(frame.publicId);
    }

    // Delete from MongoDB
    await Frame.findByIdAndDelete(id);

    res.json({ success: true, message: "Frame deleted successfully" });
  } catch (err) {
    console.error("Delete frame error:", err);
    res.status(500).json({ success: false, message: "Failed to delete frame" });
  }
};


