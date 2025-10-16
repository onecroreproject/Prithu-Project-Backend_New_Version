const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2;
const fetch = require("node-fetch"); // Add this to download remote images

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Folder where frame images are stored
const FRAME_DIR = path.join(__dirname, "./frame"); 
const TEMP_DIR = path.join(__dirname, "../temp");

// Create temp folder if it doesn't exist
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// Frame options
const frames = ["frame1.png", "frame2.png"]; // Add your frame PNGs here
const getRandomFrame = () => frames[Math.floor(Math.random() * frames.length)];

/**
 * Apply frame and upload to Cloudinary
 * @param {String} avatarUrl - original or modified avatar URL
 * @returns {Promise<String>} Cloudinary URL of framed avatar
 */
const applyFrame = async (avatarUrl) => {
  if (!avatarUrl) return null;

  try {
    const framePath = path.join(FRAME_DIR, getRandomFrame());
    const outputFileName = `frame_${Date.now()}.png`;
    const outputPath = path.join(TEMP_DIR, outputFileName);

    // Download avatar if URL is remote
    let inputBuffer;
    if (avatarUrl.startsWith("http")) {
      const response = await fetch(avatarUrl);
      inputBuffer = await response.buffer();
    } else {
      inputBuffer = fs.readFileSync(avatarUrl);
    }

    // Apply frame using sharp
    await sharp(inputBuffer)
      .resize(200, 200)
      .composite([{ input: framePath, gravity: "center" }])
      .toFile(outputPath);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(outputPath, {
      folder: "framed_avatars",
      use_filename: true,
      unique_filename: true,
    });

    // Delete local temp file
    fs.unlinkSync(outputPath);

    return result.secure_url;
  } catch (err) {
    console.error("Error applying frame:", err);
    return avatarUrl; // fallback to original avatar
  }
};

module.exports = { applyFrame };
