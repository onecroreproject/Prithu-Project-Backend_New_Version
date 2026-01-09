const Feed = require("../../../models/feedModel");
const Categories = require("../../../models/categorySchema");
const Admin = require("../../../models/adminModels/adminModel");
const ChildAdmin = require("../../../models/childAdminModel");


exports.uploadFeed = async ({ language, categoryId, type, dec }, file, userId, roleRef) => {
  

  if (!language || !categoryId || !type)
    throw new Error("Missing fields");
  if (!file)
    throw new Error("No file uploaded");

  const category = await Categories.findById(categoryId);
  if (!category)
    throw new Error("Category not found");

  const newFeed = new Feed({
    type,
    language,
    category: categoryId,
    duration: file.duration || null,
    createdByAccount: userId,
    roleRef, // 👈 DIRECTLY FROM req.role

    contentUrl: file.url,
    localFilename: file.filename,
    localPath: file.path,
    fileHash: file.fileHash,

    dec: dec || "",
  });

  await newFeed.save();

  await Categories.updateOne(
    { _id: categoryId },
    { $addToSet: { feedIds: newFeed._id } }
  );

  return { feed: newFeed };
};



