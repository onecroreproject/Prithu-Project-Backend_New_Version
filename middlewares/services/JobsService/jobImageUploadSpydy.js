const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const BASE_DIR = path.join(__dirname, "../../../media/company");
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

// Generate timestamp
const timestamp = () => {
  const now = new Date();
  return `${now.toISOString().split("T")[0]}_${now
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-")}`;
};

// ---------------------------
// Multer Storage
// ---------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const companyId = req.companyId;
    const uploadPath = path.join(BASE_DIR, String(companyId), "jobs");

    fs.mkdirSync(uploadPath, { recursive: true });

    req.uploadPath = uploadPath;

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fileName = `${timestamp()}_${uuidv4()}${ext}`;

    req.savedJobFileName = fileName;

    cb(null, fileName);
  },
});

// ---------------------------
// Multer Configuration
// ---------------------------
const companyJobUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only images allowed"), false);
    }
    cb(null, true);
  },
});

// ---------------------------
// Delete Job Image (Local)
// ---------------------------
function deleteLocalJobFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🗑️ Deleted local job image:", filePath);
    }
  } catch (err) {
    console.error("❌ Error deleting job image:", err.message);
  }
}

// Export both
module.exports = {
  companyJobUpload,
  deleteLocalJobFile,
};
