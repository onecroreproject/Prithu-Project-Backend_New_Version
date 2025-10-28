const Feed = require("../../../models/feedModel");
const Categories = require("../../../models/categorySchema");
const Admin = require("../../../models/adminModels/adminModel");
const ChildAdmin = require("../../../models/childAdminModel");


exports.uploadFeed = async ({ language, categoryId, type, dec }, file, userId) => {
  if (!userId) throw new Error("User ID is required");

  // Determine role
  let userRole = await Admin.findById(userId).select("adminType role");
  let roleType = "Admin";

  if (!userRole) {
    userRole = await ChildAdmin.findById(userId).select("adminType inheritedPermissions");
    if (!userRole) throw new Error("Only Admins or Child Admins can upload feeds");
    roleType = "Child_Admin";
  }

  // Validate required data
  if (!language || !categoryId || !type) throw new Error("Language, type, and categoryId are required");
  if (!file) throw new Error("No file uploaded");

  const fileUrl = file.url || file.secure_url;
  const originalName = file.originalname || file.original_filename || "unknown";
  const fileHash = file.fileHash; // from middleware

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

  // Save feed with description
  const newFeed = new Feed({
    type,
    language,
    category: cat._id,
    duration: file.duration || null,
    createdByAccount: userId,
    contentUrl: fileUrl,
    originalName,
    fileHash,
    roleRef: roleType,
    dec: dec || "", // 🆕 add description here
  });

  await newFeed.save();

  // Link feed to category
  await Categories.updateOne(
    { _id: cat._id },
    { $addToSet: { feedIds: newFeed._id } }
  );

  return {
    feed: newFeed,
    categoryId: cat._id,
    language,
    type,
    roleType,
  };
};

// Multiple files support remains same
exports.uploadFeedsMultiple = async (body, files, userId, options) => {
  if (!files || files.length === 0) throw new Error("No files uploaded");

  const results = [];
  for (const file of files) {
    const result = await exports.uploadFeed(body, file, userId, options);
    results.push(result);
  }
  return results;
};





// Multiple files support
exports.uploadFeedsMultiple = async (body, files, userId, options) => {
  if (!files || files.length === 0) throw new Error("No files uploaded");

  const results = [];
  for (const file of files) {
    const result = await exports.uploadFeed(body, file, userId, options);
    results.push(result);
  }
  return results;
};
