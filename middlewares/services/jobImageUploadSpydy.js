const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const BASE_DIR = path.join(__dirname, "../../media/company");

// Ensure base directory exists
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
  console.log("📁 Created base directory:", BASE_DIR);
}

// Generate timestamp
const timestamp = () => {
  const now = new Date();
  return `${now.toISOString().split("T")[0]}_${now
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-")}`;
};

// Ensure directory exists with log
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log("📁 Directory created:", dirPath);
  }
};

// ---------------------------
// Multer Storage
// ---------------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const companyId = req.companyId;

      if (!companyId) {
        return cb(new Error("companyId missing in request"));
      }

      const companyDir = path.join(BASE_DIR, String(companyId));
      const uploadPath = path.join(companyDir, "jobs");

      // ✅ Create directories only if missing
      ensureDir(companyDir);
      ensureDir(uploadPath);

      req.uploadPath = uploadPath;

      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname);
      const fileName = `${timestamp()}_${uuidv4()}${ext}`;

      req.savedJobFileName = fileName;

      cb(null, fileName);
    } catch (err) {
      cb(err);
    }
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

// Export
module.exports = {
  companyJobUpload,
  deleteLocalJobFile,
};
