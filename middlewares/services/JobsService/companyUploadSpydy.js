const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// Base -> media/company/
const BASE_DIR = path.join(__dirname, "../../media/company");
if (!fs.existsSync(BASE_DIR)) fs.mkdirSync(BASE_DIR, { recursive: true });

// Timestamp helper
const timestamp = () => {
  const now = new Date();
  return `${now.toISOString().split("T")[0]}_${now
    .toTimeString()
    .split(" ")[0]
    .replace(/:/g, "-")}`;
};

// Multer disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const companyId = req.companyId;

    let folderType = "logo";
    if (file.fieldname === "coverImage") folderType = "cover";
    if (file.fieldname === "profileAvatar") folderType = "avatar";

    const uploadPath = path.join(BASE_DIR, String(companyId), folderType);
    fs.mkdirSync(uploadPath, { recursive: true });

    file._folder = folderType;
    file._uploadPath = uploadPath;

    cb(null, uploadPath);
  },

  filename: (req, file, cb) => {
    const companyId = req.companyId;
    const ext = path.extname(file.originalname);
    const fileName = `${companyId}_${timestamp()}_${uuidv4()}${ext}`;

    file._savedName = fileName;
    file._savedPath = path.join(file._uploadPath, fileName);

    cb(null, fileName);
  },
});

const companyUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Delete local file
function deleteLocalCompanyFile(filePath) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    console.log("❌ Failed to delete company file:", err.message);
  }
}

module.exports = { companyUpload, deleteLocalCompanyFile };
