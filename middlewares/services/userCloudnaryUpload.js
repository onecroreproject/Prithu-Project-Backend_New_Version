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
 
// ✅ Generate file hash for duplicates
const generateFileHash = (buffer) =>
  crypto.createHash("md5").update(buffer).digest("hex");
 
// ✅ Get video duration from buffer
const getVideoDurationFromBuffer = async (buffer) => {
  const stream = new Readable();
  stream.push(buffer);
  stream.push(null);
  return await getVideoDurationInSeconds(stream);
};
 
// Middleware: check duplicates & video duration in parallel
const userProcessFeedFile = async (req, res, next) => {
  if (!req.file) return next();
console.log("hi")
  try {
    const buffer = req.file.buffer;
 
    // Start parallel tasks
    const hashPromise = generateFileHash(buffer);
    const durationPromise =
      req.file.mimetype.startsWith("video/") ? getVideoDurationFromBuffer(buffer) : Promise.resolve(null);
 
    // Wait for results
    const [fileHash, videoDuration] = await Promise.all([hashPromise, durationPromise]);
 
    req.fileHash = fileHash;
    req.videoDuration = videoDuration;
 
    // ✅ Check duplicates
    const existingFeed = await Feed.findOne({ fileHash }).lean();
    if (existingFeed) {
      return res.status(409).json({ message: "This file already exists", feedId: existingFeed._id });
    }
 
    // ✅ Check video duration limit
    if (videoDuration && videoDuration > 60) {
      return res.status(400).json({ message: "Video duration exceeds 30 seconds" });
    }
 
    next();
  } catch (err) {
    console.error("Error processing feed file:", err);
    return res.status(500).json({ message: "Error processing file" });
  }
};
 
// Upload to Cloudinary with compression
const userUploadToCloudinary = async (req, res, next) => {
  if (!req.file) return next();
 
  try {
    const bufferStream = new Readable();
    bufferStream.push(req.file.buffer);
    bufferStream.push(null);
 
    // Decide folder
    let folder = "others";
    if (req.baseUrl.includes("feed")) {
      folder = req.file.mimetype.startsWith("image/") ? "feeds/images" : "feeds/videos";
    } else if (req.baseUrl.includes("profile")) {
      folder = "profile/images";
    }
 
    const isVideo = req.file.mimetype.startsWith("video/");
 
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: isVideo ? "video" : "image", // ✅ explicitly set video
          quality: "auto:good",
          fetch_format: "auto",
          transformation: isVideo ? [] : [{ width: 500, height: 500, crop: "limit" }],
          eager: isVideo ? [{ format: "mp4", quality: "auto" }] : [],
          eager_async: isVideo ? true : false, // ✅ async for large video
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
 
      bufferStream.pipe(stream);
    });
 
    req.cloudinaryFile = {
      url: result.secure_url,
      public_id: result.public_id,
    };
 
    next();
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).json({ message: "Upload failed" });
  }
};
 
 
 
// Delete from Cloudinary
const userDeleteFromCloudinary = async (public_id) => {
  try {
    return await cloudinary.uploader.destroy(public_id, { resource_type: "image" });
  } catch (err) {
    throw new Error("Cloudinary delete failed: " + err.message);
  }
};
 
module.exports = {
  userUpload,
  userProcessFeedFile, // replaces checkFeedDuplicate + checkVideoDuration
  userUploadToCloudinary,
  userDeleteFromCloudinary,
};
 