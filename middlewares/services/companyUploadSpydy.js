const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Base -> media/company/
const BASE_DIR = path.join(__dirname, "../../media/company");
if (!fs.existsSync(BASE_DIR)) {
  fs.mkdirSync(BASE_DIR, { recursive: true });

}

// Timestamp helper
const timestamp = () => {
  const now = new Date();
  return `${now.toISOString().split("T")[0]}_${now
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-")}`;
};

// Ensure directory exists (SAFE + LOG)
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Multer disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {

    console.log(file)

    try {
      const companyId = req.companyId;

      if (!companyId) {
        return cb(new Error("companyId missing in request"));
      }

      let folderType = "logo";
      if (file.fieldname === "coverImage") folderType = "cover";
      if (file.fieldname === "profileAvatar") folderType = "avatar";
      if (file.fieldname.startsWith("galleryImages")) folderType = "gallery";

      const companyDir = path.join(BASE_DIR, String(companyId));
      const uploadPath = path.join(companyDir, folderType);

      // ✅ Ensure directories exist (with log)
      ensureDir(companyDir);
      ensureDir(uploadPath);

      file._folder = folderType;
      file._uploadPath = uploadPath;

      cb(null, uploadPath);
    } catch (err) {
      cb(err);
    }
  },

  filename: (req, file, cb) => {
    try {
      const companyId = req.companyId;
      const ext = path.extname(file.originalname);
      const fileName = `${companyId}_${timestamp()}_${uuidv4()}${ext}`;

      file._savedName = fileName;
      file._savedPath = path.join(file._uploadPath, fileName);

      cb(null, fileName);
    } catch (err) {
      cb(err);
    }
  },
});

const companyUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Delete local file
function deleteLocalCompanyFile(filePath) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
   
    }
  } catch (err) {
    console.log("❌ Failed to delete company file:", err.message);
  }
}

module.exports = { companyUpload, deleteLocalCompanyFile };
