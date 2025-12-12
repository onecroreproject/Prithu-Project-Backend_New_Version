const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Base folder: media/frames
const BASE_DIR = path.join(__dirname, "../../media/frames");
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

// Timestamp helper
const timestamp = () => {
  const now = new Date();
  return `${now.toISOString().split("T")[0]}_${now
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-")}`;
};

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, BASE_DIR);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${timestamp()}_${uuidv4()}${ext}`;
    file._savedName = fileName;
    file._savedPath = path.join(BASE_DIR, fileName);
    cb(null, fileName);
  },
});

const frameUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
});

// Delete function
function deleteLocalFrame(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.error("❌ Frame delete failed:", err.message);
  }
}

module.exports = { frameUpload, deleteLocalFrame };
