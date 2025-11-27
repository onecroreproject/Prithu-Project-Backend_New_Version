const multer = require("multer");

const storage = multer.memoryStorage();

const companyUpload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

module.exports = companyUpload;
