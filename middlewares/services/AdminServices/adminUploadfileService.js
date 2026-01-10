const Feed = require("../../../models/feedModel");
const Categories = require("../../../models/categorySchema");
const Admin = require("../../../models/adminModels/adminModel");
const ChildAdmin = require("../../../models/childAdminModel");


exports.uploadFeed = async (
  feedData,
  file,
  userId,
  roleRef
) => {
  const {
    language,
    categoryId,
    type,
    dec,
    contentUrl,
    storageType,
    driveFileId
  } = feedData;

  if (!language || !categoryId || !type)
    throw new Error("Missing fields");

  if (!file || !contentUrl)
    throw new Error("Invalid file data");

  const category = await Categories.findById(categoryId);
  if (!category)
    throw new Error("Category not found");

  const newFeed = new Feed({
    type,
    language,
    category: categoryId,
    duration: file.duration || null,
    createdByAccount: userId,
    roleRef,

    // ✅ ROOT LEVEL
    contentUrl,
    storageType,
    driveFileId,

    // ✅ FILES ARRAY (SCHEMA REQUIRED)
    files: [
      {
        url: contentUrl,
        type,
        mimeType: file.mimetype,
        size: file.size || 0,
        duration: file.duration || null,
        storageType,
        driveFileId,
        order: 0
      }
    ],

    dec: dec || "",
  });

  await newFeed.save();

  await Categories.updateOne(
    { _id: categoryId },
    { $addToSet: { feedIds: newFeed._id } }
  );

  return { feed: newFeed };
};




