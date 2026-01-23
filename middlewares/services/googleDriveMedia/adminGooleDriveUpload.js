const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");
const { getVideoDurationInSeconds } = require("get-video-duration");
const sharp = require("sharp");
const Feed = require("../../../models/feedModel");
const BASE_MEDIA_DIR = path.join(__dirname, "../../media");
const TEMPORARY_UPLOAD_DIR = path.join(BASE_MEDIA_DIR, "temp_admin");
// Ensure temp directory exists
if (!fs.existsSync(TEMPORARY_UPLOAD_DIR)) {
  fs.mkdirSync(TEMPORARY_UPLOAD_DIR, { recursive: true });
}
const deleteLocalAdminFile = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn("⚠️ Temp file cleanup failed:", err.message);
  }
};
const validateFile = (file) => {
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
  const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav'];
  
  if (file.mimetype.startsWith('image/') && !allowedImageTypes.includes(file.mimetype)) throw new Error('Invalid image format');
  if (file.mimetype.startsWith('video/') && !allowedVideoTypes.includes(file.mimetype)) throw new Error('Invalid video format');
  if (file.mimetype.startsWith('audio/') && !allowedAudioTypes.includes(file.mimetype)) throw new Error('Invalid audio format');
  
  return true;
};
const feedStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, TEMPORARY_UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `temp_${uuidv4()}${ext}`);
  }
});
const adminUploadFeed = multer({
  storage: feedStorage,
  limits: { fileSize: 100 * 1024 * 1024, files: 21 },
  fileFilter: (req, file, cb) => {
    try { validateFile(file); cb(null, true); }
    catch (error) { cb(error); }
  }
});
const generateFileHash = (filePath) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
};
const adminProcessFeedFile = async (req, res, next) => {
  const mediaFiles = req.files?.files || [];
  const audioFiles = req.files?.audio || [];
  if (mediaFiles.length === 0) return next();
  try {
    const results = await Promise.all(mediaFiles.map(async (file) => {
      try {
        const fileHash = await generateFileHash(file.path);
        file._fileHash = fileHash;
        const duplicate = await Feed.findOne({ fileHash }).select("_id").lean();
        if (duplicate) throw new Error(`DUPLICATE:${duplicate._id}`);
        if (file.mimetype.startsWith("video/")) {
          const duration = await getVideoDurationInSeconds(file.path);
          if (duration > 120) throw new Error("VIDEO_TOO_LONG");
          file._duration = Math.round(duration);
        }
        return { success: true, file };
      } catch (err) {
        deleteLocalAdminFile(file.path);
        return { success: false, error: err.message, file };
      }
    }));
    const failed = results.filter(r => !r.success);
    if (failed.some(f => f.error.startsWith("DUPLICATE:"))) {
      const dup = failed.find(f => f.error.startsWith("DUPLICATE:"));
      return res.status(409).json({ success: false, message: "Feed already exists", feedId: dup.error.split(":")[1] });
    }
    req.files.files = results.filter(r => r.success).map(r => r.file);
    req.files.audio = audioFiles;
    next();
  } catch (err) {
    next(err);
  }
};
const attachAdminFeedFiles = async (req, res, next) => {
  const mediaFiles = req.files?.files || [];
  const audioFiles = req.files?.audio || [];
  if (mediaFiles.length === 0) return next();
  try {
    req.localFiles = await Promise.all(mediaFiles.map(async (file) => {
      const fileInfo = {
        path: file.path,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        fileHash: file._fileHash,
        duration: file._duration || null,
        buffer: fs.readFileSync(file.path)
      };
      if (file.mimetype.startsWith("image/")) {
        const meta = await sharp(file.path).metadata();
        fileInfo.dimensions = { width: meta.width, height: meta.height, ratio: meta.width / meta.height };
      }
      return fileInfo;
    }));
    if (audioFiles.length > 0) {
      const audio = audioFiles[0];
      req.localAudioFile = {
        path: audio.path,
        mimetype: audio.mimetype,
        originalname: audio.originalname,
        buffer: fs.readFileSync(audio.path)
      };
    }
    next();
  } catch (err) {
    next(err);
  }
};
module.exports = { adminUploadFeed, adminProcessFeedFile, attachAdminFeedFiles, deleteLocalAdminFile };