const fs = require("fs");
const path = require("path");
const { removeBackground } = require("@imgly/background-removal-node");

async function removeImageBackground(imageSource) {
  try {
    const targetDir = path.join(__dirname, "../../media/user/modifyAvatar");
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const filename = `avatar_${Date.now()}.png`;
    const targetPath = path.join(targetDir, filename);

    const imageBuffer = fs.readFileSync(imageSource);

    // ✅ If your input is PNG change type to "image/png"
    const imageBlob = new Blob([imageBuffer], { type: "image/jpeg" });

    const resultBlob = await removeBackground(imageBlob);

    const arrayBuffer = await resultBlob.arrayBuffer();
    const outputBuffer = Buffer.from(arrayBuffer);

    fs.writeFileSync(targetPath, outputBuffer);

    return {
      secure_url: `/media/user/modifyAvatar/${filename}`,
      public_id: filename,
      localPath: targetPath,
    };
  } catch (error) {
    throw error;
  }
}

module.exports = { removeImageBackground };
