const axios = require("axios");
const FormData = require("form-data");
const cloudinary = require("cloudinary").v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * removeImageBackground
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Cloudinary URL of the background-removed image
 */
async function removeImageBackground(imageUrl) {
  try {
    // Upload image to Cloudinary with background removal
    const result = await cloudinary.uploader.upload(imageUrl, {
      upload_preset: "ml_default", // Optional preset
      background_removal: "cloudinary_ai", // AI background removal
      format: "png", // Keep transparency
    });

    // Returns the new image URL
    return result.secure_url;
  } catch (error) {
    console.error("Error removing image background:", error);
    throw error;
  }
}

module.exports = { removeImageBackground };
