const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Readable } = require("stream");
const { v4: uuidv4 } = require("uuid");
const { getVideoDurationInSeconds } = require("get-video-duration");
const Feed = require("../../../models/feedModel");




const feedUpload = multer({
  storage: multer.memoryStorage(), // 🔥 NO DISK WRITE
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});



const userProcessFeedFile = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded" });
  }

  try {
    const buffer = req.file.buffer;

    // 🔐 Generate hash
    const fileHash = crypto
      .createHash("md5")
      .update(buffer)
      .digest("hex");

    req.fileHash = fileHash;

    // ❌ Duplicate check
    const existing = await Feed.findOne({ fileHash }).lean();
    if (existing) {
      return res.status(409).json({
        message: "This file already exists",
        feedId: existing._id
      });
    }

    // 🎥 Video duration check
    if (req.file.mimetype.startsWith("video/")) {
      const duration = await getVideoDurationInSeconds(
        Readable.from(buffer)
      );

      if (duration > 60) {
        return res
          .status(400)
          .json({ message: "Video duration exceeds 60 seconds" });
      }

      req.videoDuration = duration;
    }

    next();
  } catch (err) {
    console.error("Feed processing error:", err);
    return res.status(500).json({ message: "Feed processing failed" });
  }
};



const attachFeedFile = (req, res, next) => {
  if (!req.file) return next();

  req.localFile = {
    buffer: req.file.buffer,
    originalName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    fileHash: req.fileHash,
    videoDuration: req.videoDuration || null
  };

  next();
};



module.exports = { attachFeedFile,userProcessFeedFile,feedUpload };