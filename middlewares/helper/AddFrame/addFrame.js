// utils/applyFrame.js
const cloudinary = require("cloudinary").v2;
const Frame = require("../../../models/frameModel");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.applyFrame = async (avatarPublicId) => {
  if (!avatarPublicId) return null;

  const frames = await Frame.find({ isActive: true });
  if (!frames.length) return cloudinary.url(avatarPublicId);

  const randomFrame = frames[Math.floor(Math.random() * frames.length)];

  // 🧠 Ensure no duplicate folder name
  const cleanFrameId = randomFrame.publicId.replace(/^frames\//, "");

  const framedUrl = cloudinary.url(avatarPublicId, {
    transformation: [
      { width: 200, height: 200, crop: "fill", gravity: "center" },
      {
        overlay: `image:frames:${cleanFrameId}`,
        width: 200,
        height: 200,
        crop: "fit",
        gravity: "center",
      },
    ],
  });

  return framedUrl;
};
