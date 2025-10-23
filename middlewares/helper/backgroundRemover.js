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
 * @returns {{ secure_url: string, public_id: string }} - Cloudinary response with URL and public ID
 */
async function removeImageBackground(imageUrl) {
  try {
    // Upload image to Cloudinary with background removal
    const result = await cloudinary.uploader.upload(imageUrl, {
      upload_preset: "ml_default", // optional preset
      background_removal: "cloudinary_ai", // AI background removal
      format: "png", // keep transparency
    });

    // Return both URL and public ID
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (error) {
    console.error("Error removing image background:", error);
    throw error;
  }
}

module.exports = { removeImageBackground };
