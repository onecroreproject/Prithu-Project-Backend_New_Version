const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const BASE_DIR = path.join(__dirname, "../../media/company");

/* --------------------------------------------------
 * Ensure base directory exists
 * -------------------------------------------------- */
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });
  console.log("📁 Created base directory:", BASE_DIR);
}

/* --------------------------------------------------
 * Helpers
 * -------------------------------------------------- */
const timestamp = () => {
  const now = new Date();
  return `${now.toISOString().split("T")[0]}_${now
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-")}`;
};

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log("📁 Directory created:", dirPath);
  }
};

/* --------------------------------------------------
 * Multer Storage
 * -------------------------------------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        return cb(new Error("companyId missing in request"));
      }

      const companyDir = path.join(BASE_DIR, String(companyId));

      let uploadPath;

      // 🔥 Decide folder based on field name
      if (file.fieldname === "jobImage") {
        uploadPath = path.join(companyDir, "jobs");
      } else if (file.fieldname === "postImage") {
        uploadPath = path.join(companyDir, "posts");
      } else {
        return cb(new Error("Invalid file field"));
      }

      ensureDir(companyDir);
      ensureDir(uploadPath);

      // Store paths for controller use
      if (!req.uploadPaths) req.uploadPaths = {};
      req.uploadPaths[file.fieldname] = uploadPath;

      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    try {
      const ext = path.extname(file.originalname);
      const fileName = `${timestamp()}_${uuidv4()}${ext}`;

      if (!req.savedFiles) req.savedFiles = {};
      req.savedFiles[file.fieldname] = fileName;

      cb(null, fileName);
    } catch (err) {
      cb(err);
    }
  },
});

/* --------------------------------------------------
 * Multer Middleware
 * -------------------------------------------------- */
const companyJobUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("Only image files are allowed"), false);
    }
    cb(null, true);
  },
});

/* --------------------------------------------------
 * Delete Local File Utility
 * -------------------------------------------------- */
function deleteLocalFile(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("🗑️ Deleted file:", filePath);
    }
  } catch (err) {
    console.error("❌ File delete error:", err.message);
  }
}

/* --------------------------------------------------
 * Export
 * -------------------------------------------------- */
module.exports = {
  companyJobUpload,
  deleteLocalFile,
};
