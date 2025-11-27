const cloudinary = require("../../Config/cloudinayConfig");

// Extract public_id from URL
const getPublicId = (url) => {
  try {
    const parts = url.split("/");
    const folderName = parts[parts.length - 2];
    const fileName = parts.pop().split(".")[0];
    return `${folderName}/${fileName}`;
  } catch (err) {
    return null;
  }
};

exports.uploadAndReplace = async (fileBuffer, folder, oldUrl = null) => {
  try {
    // Delete old file
    if (oldUrl) {
      const publicId = getPublicId(oldUrl);
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    }

    // Upload new file buffer
    const result = await cloudinary.uploader.upload_stream({
      folder,
      resource_type: "image",
      quality: "auto",
      crop: "scale"
    });

    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) reject(error);
          else resolve(result.secure_url);
        }
      );
      stream.end(fileBuffer);
    });
  } catch (err) {
    console.error("❌ Cloudinary upload error:", err);
    throw err;
  }
};
