const path = require("path");
const { getVideoDurationInSeconds } = require("get-video-duration");
const Feed = require("../../../models/feedModel");
const Categories = require("../../../models/categorySchema");
const Admin = require("../../../models/adminModels/adminModel");
const ChildAdmin = require("../../../models/childAdminModel");

exports.uploadFeed = async ({ language, categoryId, type }, file, userId) => {
  if (!userId) throw new Error("User ID is required");

  // Determine role
  let userRole = await Admin.findById(userId).select("adminType role");
  let roleType = "Admin";

  if (!userRole) {
    userRole = await ChildAdmin.findOne({ userId }).select("childAdminType inheritedPermissions");
    if (!userRole) throw new Error("Only Admins or Child Admins can upload feeds");
    roleType = "Child_Admin";
  }

  if (!language || !categoryId || !type) throw new Error("Language, type, and categoryId are required");
  if (!file) throw new Error("No file uploaded");

  const fileUrl = file.url || file.secure_url;
  const originalName = file.originalname || file.original_filename || "unknown";
  const fileHash = file.fileHash; // ✅ coming from processFeedFile middleware

  if (!fileUrl) throw new Error("Uploaded file does not have a valid URL");

  // Validate file type
  if (type === "image" && !(file.mimetype || file.resource_type)?.startsWith("image/")) {
    throw new Error("Uploaded file is not an image");
  }
  if (type === "video" && !(file.mimetype || file.resource_type)?.startsWith("video/")) {
    throw new Error("Uploaded file is not a video");
  }

  // Ensure category exists
  const cat = await Categories.findById(categoryId);
  if (!cat) throw new Error(`Category with ID "${categoryId}" does not exist`);

  // ✅ Prevent duplicate feed by fileHash, URL or originalName
  const existFeed = await Feed.findOne({
    $or: [{ fileHash }, { contentUrl: fileUrl }, { originalName }]
  });
  if (existFeed) throw new Error("This file has already been uploaded");

  // Save feed
  const newFeed = new Feed({
    type,
    language,
    category: cat._id,
    duration: type === "video" ? file.duration || null : null,
    createdByAccount: userId,
    contentUrl: fileUrl,
    originalName,
    fileHash, // ✅ store hash in DB
    roleRef: roleType,
  });
  await newFeed.save();

  await Categories.updateOne({ _id: cat._id }, { $addToSet: { feedIds: newFeed._id } });

  return {
    feed: newFeed,
    categoryId: cat._id,
    language,
    type,
    roleType,
  };
};





// ✅ Multiple files support
exports.uploadFeedsMultiple = async (body, files, userId, options) => {
  if (!files || files.length === 0) throw new Error("No files uploaded");

  const results = [];
  for (const file of files) {
    const result = await exports.uploadFeed(body, file, userId, options);
    results.push(result);
  }
  return results;
};
