// utils/applyFrame.js
const cloudinary = require("cloudinary").v2;
const Frame = require("../../../models/frameModel");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Get proper overlay ID for Cloudinary
 * @param {string} publicId - Frame publicId from DB
 * @returns {string}
 */
function getOverlayId(publicId) {
  const parts = publicId.split("/");
  // Format: folder:filename for Cloudinary overlay
  return parts.length === 2 ? `${parts[0]}:${parts[1]}` : publicId;
}

/**
 * Apply frame behind avatar with hidden overflow
 * @param {string} avatarPublicId
 * @returns {string} Cloudinary URL
 */
exports.applyFrame = async (avatarPublicId) => {
  if (!avatarPublicId) return null;

  try {
    // 1️⃣ Get active frames
    const frames = await Frame.find({ isActive: true });
    if (!frames.length) return cloudinary.url(avatarPublicId);

    // 2️⃣ Pick a random frame
    const randomFrame = frames[Math.floor(Math.random() * frames.length)];
    const overlayId = getOverlayId(randomFrame.publicId);

    // 3️⃣ Fetch metadata (optional, for debugging)
    const frameMeta = await cloudinary.api.resource(randomFrame.publicId, { resource_type: "image" });
    const avatarMeta = await cloudinary.api.resource(avatarPublicId, { resource_type: "image" });


    const targetSize = 500; // Standard avatar size

    // 4️⃣ Generate Cloudinary URL
    const framedUrl =
      `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/` +
      `c_thumb,g_face,h_${targetSize},w_${targetSize}/` + 
      `l_${overlayId},c_fill,fl_relative,w_1.0,h_1.0,g_center/fl_layer_apply/` + 
      `${avatarPublicId}`; 


    return framedUrl;

  } catch (err) {
    console.error("Error in applyFrame:", err);
    return cloudinary.url(avatarPublicId);
  }
};