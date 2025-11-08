
const cloudinary = require("cloudinary").v2;
const dotenv = require("dotenv");

dotenv.config();

// 🔹 Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// 🔹 Upload image to Cloudinary
const uploadToCloudinary = async (filePath, folder = "job_posts") => {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder,
      resource_type: "image",
    });
    return result.secure_url; // ✅ return the public HTTPS URL
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload image to Cloudinary");
  }
};

// 🔹 Optionally delete an image from Cloudinary
const deleteFromCloudinary = async (publicId) => {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error("Failed to delete image from Cloudinary:", error);
  }
};

module.exports = { uploadToCloudinary, deleteFromCloudinary };
