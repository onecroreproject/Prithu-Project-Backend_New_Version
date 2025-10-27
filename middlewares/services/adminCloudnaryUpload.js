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
const adminUpload = multer({ storage });

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

// ✅ Middleware: process video duration + hash + duplicate check
const adminProcessFeedFile = async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) return next();

  try {
    await Promise.all(
      files.map(async (file) => {
        const buffer = file.buffer;
        const fileHash = generateFileHash(buffer);
        file.fileHash = fileHash;

        // Check if duplicate feed exists
        const existingFeed = await Feed.findOne({ fileHash }).lean();
        if (existingFeed) {
          throw { status: 409, message: "This file already exists", feedId: existingFeed._id };
        }

        // Check video duration if applicable
        if (file.mimetype.startsWith("video/")) {
          const duration = await getVideoDurationFromBuffer(buffer);
          file.videoDuration = duration;
          if (duration > 60) throw { status: 400, message: "Video duration exceeds 60 seconds" };
        }
      })
    );

    next();
  } catch (err) {
    const status = err.status || 500;
    return res.status(status).json({ message: err.message || "Error processing file(s)" });
  }
};

// ✅ Upload to Cloudinary (preserve duration & fileHash)
const adminUploadToCloudinary = async (req, res, next) => {
  const files = req.files || (req.file ? [req.file] : []);
  if (files.length === 0) return next();

  try {
    const cloudinaryResults = await Promise.all(
      files.map(async (file) => {
        const bufferStream = new Readable();
        bufferStream.push(file.buffer);
        bufferStream.push(null);

        let folder = "others";
        if (req.baseUrl.includes("feed")) {
          folder = file.mimetype.startsWith("image/") ? "feeds/images" : "feeds/videos";
        } else if (req.baseUrl.includes("profile")) {
          folder = "profile/images";
        }

        const isVideo = file.mimetype.startsWith("video/");

        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder,
              resource_type: isVideo ? "video" : "image",
              quality: "auto:good",
              fetch_format: "auto",
              transformation: isVideo ? [] : [{ width: 500, height: 500, crop: "limit" }],
              eager: isVideo ? [{ format: "mp4", quality: "auto" }] : [],
              eager_async: isVideo ? true : false,
            },
            (error, result) => {
              if (error) return reject(error);
              resolve(result);
            }
          );
          bufferStream.pipe(uploadStream);
        });

        // ✅ Include all details for next step
        file.cloudinary = {
          url: result.secure_url,
          public_id: result.public_id,
          fileHash: file.fileHash,
          duration: file.videoDuration || null,
          mimetype: file.mimetype,
          originalname: file.originalname,
        };

        return file.cloudinary;
      })
    );

    req.cloudinaryFiles = cloudinaryResults;
    next();
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return res.status(500).json({ message: "Upload failed" });
  }
};

// ✅ Delete from Cloudinary
const adminDeleteFromCloudinary = async (public_id) => {
  try {
    return await cloudinary.uploader.destroy(public_id, { resource_type: "image" });
  } catch (err) {
    throw new Error("Cloudinary delete failed: " + err.message);
  }
};

module.exports = {
  adminUpload,
  adminProcessFeedFile,
  adminUploadToCloudinary,
  adminDeleteFromCloudinary,
};
