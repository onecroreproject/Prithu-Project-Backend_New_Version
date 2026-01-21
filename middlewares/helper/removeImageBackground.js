const fs = require("fs");
const path = require("path");
const { removeBackground } = require("@imgly/background-removal-node");

/**
 * removeImageBackground
 * @param {string} imageSource - Local path to the image
 * @returns {{ secure_url: string, public_id: string, localPath: string }} - Local storage info
 */
async function removeImageBackground(imageSource) {
  try {
    // 🟢 Define and create target directory if it doesn't exist
    const targetDir = path.join(__dirname, "../../media/user/modifyAvatar");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 🟢 Generate filename with timestamp
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') + "_" +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');

    const extension = ".png"; // Always save as PNG for transparency
    const filename = `avatar_${timestamp}${extension}`;
    const targetPath = path.join(targetDir, filename);

    // 🟢 Remove background using IMG.LY
    console.log("🔄 Removing background from image...");

    // Read the image file
    const imageBuffer = fs.readFileSync(imageSource);

    // Convert to Blob
    const imageBlob = new Blob([imageBuffer]);

    // Remove background
    const blob = await removeBackground(imageBlob, {
      output: {
        format: 'image/png',
        quality: 0.8
      }
    });

    // Convert Blob back to Buffer
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save the result
    fs.writeFileSync(targetPath, buffer);

    // 🟢 Build relative URL for API response
    const relativeUrl = `/media/user/modifyAvatar/${filename}`;

    console.log("✅ Background removed successfully");
    return {
      secure_url: relativeUrl,
      public_id: filename,
      localPath: targetPath,
    };
  } catch (error) {
    console.error("❌ Error in removeImageBackground:", error);
    throw error;
  }
}

module.exports = { removeImageBackground };