const path = require("path");
const { getVideoDurationInSeconds } = require("get-video-duration");
const Feed = require("../../../models/feedModel");
const Categories = require("../../../models/categorySchema");
const Admin = require("../../../models/adminModels/adminModel");

exports.uploadFeed = async ({ language, category, type }, file, userId, options = { autoCreateCategory: true }) => {
  if (!userId) throw new Error("User ID is required");

  // ✅ Check role (Admin or Child_Admin)
  let userRole = await Admin.findById(userId).select("adminType role");
  let roleType = "Admin";

  if (!userRole) {
    userRole = await ChildAdmin.findOne({ userId }).select("childAdminType inheritedPermissions");
    if (!userRole) throw new Error("Only Admins or Child Admins can upload feeds");
    roleType = "Child_Admin";
  }

  if (!language || !category || !type) {
    throw new Error("Language, type, and category are required");
  }

  if (!file) throw new Error("No file uploaded");

  const newFileName = path.basename(file.path);

  // ✅ Check duplicate feed
  const existFeed = await Feed.findOne({ contentUrl: { $regex: `${newFileName}$` } });
  if (existFeed) throw new Error("The file has already been uploaded");

  // ✅ Video duration validation
  let videoDuration = null;
  if (type === "video" && file.mimetype.startsWith("video/")) {
    videoDuration = await getVideoDurationInSeconds(file.path);
    if (videoDuration >= 90) throw new Error("Upload video below 90 seconds");
  }

  const formattedCategory = category.trim().charAt(0).toUpperCase() + category.trim().slice(1);

  // ✅ Check category existence
  let cat = await Categories.findOne({ name: { $regex: `^${formattedCategory}$`, $options: "i" } });
  if (!cat) {
    if (!options.autoCreateCategory) throw new Error(`Category "${formattedCategory}" does not exist`);
    cat = new Categories({ name: formattedCategory, feedIds: [] });
    await cat.save();
  }

  // ✅ Save feed
  const newFeed = new Feed({
    type,
    language,
    category: formattedCategory,
    duration: videoDuration,
    createdByAccount: userId,
    contentUrl: file.path,
    roleRef: roleType, // Save Admin or Child_Admin role
  });
  await newFeed.save();

  // ✅ Add feed to category
  await Categories.updateOne({ _id: cat._id }, { $addToSet: { feedIds: newFeed._id } });

  return {
    message: "Feed created successfully",
    feed: newFeed,
    category: cat,
    roleType
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
