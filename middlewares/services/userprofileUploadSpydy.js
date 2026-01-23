const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Base folder
const BASE_DIR = path.join(__dirname, "../../media");

// Auto-create base folder
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
}

// Create timestamp format
const timestamp = () => {
  const now = new Date();
  const date = now.toISOString().split("T")[0];
  const time = now.toTimeString().split(" ")[0].replace(/:/g, "-");
  return `${date}_${time}`;
};

// Multer disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userId = req.Id; // from auth middleware

    let folderType = "profilepic";

    // 🔥 FIXED: correct detection for cover route
    if (req.baseUrl.includes("/cover")) {
      folderType = "coverpic";
    }

    const uploadPath = path.join(BASE_DIR, "user", userId.toString(), folderType);
    fs.mkdirSync(uploadPath, { recursive: true });

    req.finalFolderType = folderType;
    req.finalFolderPath = uploadPath;

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const userId = req.Id;

    const filename = `${userId}_${timestamp()}_${uuidv4()}${ext}`;

    req.savedFileName = filename;
    cb(null, filename);
  },
});


// Multer handler
const userUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Attach final file info
const attachUserFile = (req, res, next) => {
  if (!req.file) return next();

  // Auto-detect host (http/https + domain)
  const host = `https://${req.get("host")}`;

  req.localFile = {
    url: `${host}/media/user/${req.Id}/${req.finalFolderType}/${req.savedFileName}`,
    filename: req.savedFileName,
    folder: req.finalFolderType,
    path: req.finalFolderPath,
    uploadedAt: new Date(),
  };

  next();
};


// ❗ MUST BE OUTSIDE so controllers can use it
function deleteLocalFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🗑 Deleted old image:", filePath);
    }
  } catch (err) {
    console.error("❌ Failed to delete old image:", err.message);
  }
}

module.exports = { userUpload, attachUserFile, deleteLocalFile };
