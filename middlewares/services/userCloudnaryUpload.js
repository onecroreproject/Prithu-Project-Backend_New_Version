const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { Readable } = require("stream");
const crypto = require("crypto");
const Feed = require("../../models/feedModel");
const { getVideoDurationInSeconds } = require("get-video-duration");

// ✅ Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer memory storage
const storage = multer.memoryStorage();
const userUpload = multer({ storage });

// ✅ Generate file hash (synchronous)
const generateFileHash = (buffer) =>
  crypto.createHash("md5").update(buffer).digest("hex");

// ✅ Get video duration from buffer
const getVideoDurationFromBuffer = async (buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return await getVideoDurationInSeconds(stream);
};

// ✅ Middleware: check duplicates & video duration
const userProcessFeedFile = async (req, res, next) => {
  if (!req.file) return next();

  try {
    const buffer = req.file.buffer;

    // Generate file hash (sync)
    const fileHash = generateFileHash(buffer);

    // Get video duration (async only if video)
    let videoDuration = null;
    if (req.file.mimetype.startsWith("video/")) {
      videoDuration = await getVideoDurationFromBuffer(buffer);
    }

    req.fileHash = fileHash;
    req.videoDuration = videoDuration;

    // ✅ Check duplicates
    const existingFeed = await Feed.findOne({ fileHash }).lean();
    if (existingFeed) {
      return res.status(409).json({
        message: "This file already exists",
        feedId: existingFeed._id,
      });
    }

    // ✅ Check video duration limit (60 sec)
    if (videoDuration && videoDuration > 60) {
      return res
        .status(400)
        .json({ message: "Video duration exceeds 60 seconds" });
    }

    next();
  } catch (err) {
    console.error("Error processing feed file:", err);
    return res.status(500).json({ message: "Error processing file" });
  }
};

// ✅ Upload to Cloudinary (extended safely for cover photo)
const userUploadToCloudinary = async (req, res, next) => {
  if (!req.file) return next();

  try {
    // ✅ Restrict cover uploads to images only
    if (req.uploadType === "cover" && !req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({
        message: "Only image files are allowed for cover photo",
      });
    }

    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);

    // ✅ Folder logic (existing + cover support)
    let folder = "others";

    if (req.baseUrl.includes("feed")) {
      folder = req.file.mimetype.startsWith("image/")
        ? "feeds/images"
        : "feeds/videos";
    } else if (req.baseUrl.includes("profile")) {
      folder = "profile/images";
    }

    // ✅ If route specifically set uploadType = 'cover'
    if (req.uploadType === "cover") {
      folder = "profile/cover";
    }

    const isVideo = req.file.mimetype.startsWith("video/");
    let transformation = [];

    // ✅ Apply resizing only for images
    if (!isVideo) {
      if (req.uploadType === "cover") {
        transformation = [
          { width: 1500, height: 500, crop: "fill", gravity: "center" },
        ];
      } else {
        transformation = [{ width: 500, height: 500, crop: "limit" }];
      }
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: isVideo ? "video" : "image",
          quality: "auto:good",
          fetch_format: "auto",
          transformation,
          eager: isVideo ? [{ format: "mp4", quality: "auto" }] : [],
          eager_async: isVideo,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      bufferStream.pipe(stream);
    });

    // ✅ Attach everything for next middleware/controller
    req.cloudinaryFile = {
      url: result.secure_url,
      public_id: result.public_id,
      fileHash: req.fileHash,
      duration: req.videoDuration || null,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
    };

    next();
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).json({ message: "Upload failed" });
  }
};

// ✅ Delete from Cloudinary
const userDeleteFromCloudinary = async (public_id) => {
  try {
    return await cloudinary.uploader.destroy(public_id, {
      resource_type: "image",
    });
  } catch (err) {
    throw new Error("Cloudinary delete failed: " + err.message);
  }
};

module.exports = {
  userUpload,
  userProcessFeedFile,
  userUploadToCloudinary,
  userDeleteFromCloudinary,
};
