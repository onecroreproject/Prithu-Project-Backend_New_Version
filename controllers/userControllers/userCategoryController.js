const UserCategory=require('../../models/userModels/userCategotyModel')
const Feed=require('../../models/feedModel')
const mongoose=require('mongoose')


exports.userSelectCategory = async (req, res) => {
  try {
    const { categoryIds } = req.body; // Expecting array of categoryIds
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
      return res.status(400).json({ message: "At least one Category ID is required" });
    }

    // ✅ Ensure UserCategory doc exists
    let userCategory = await UserCategory.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, interestedCategories: [], nonInterestedCategories: [] } },
      { new: true, upsert: true }
    );

    // ✅ Convert existing IDs safely
    const existingInterested = userCategory.interestedCategories
      .filter(item => item.categoryId) // prevent undefined
      .map(item => item.categoryId.toString());

    const bulkOps = [];

    for (const id of categoryIds) {
      const categoryId = id.toString();

      if (existingInterested.includes(categoryId)) {
        // ✅ Already exists → update timestamp
        bulkOps.push({
          updateOne: {
            filter: { userId, "interestedCategories.categoryId": categoryId },
            update: { $set: { "interestedCategories.$.updatedAt": new Date() } }
          }
        });
      } else {
        // ✅ New category → push with timestamp
        bulkOps.push({
          updateOne: {
            filter: { userId },
            update: {
              $push: {
                interestedCategories: {
                  categoryId: new mongoose.Types.ObjectId(categoryId),
                  updatedAt: new Date()
                }
              }
            }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await UserCategory.bulkWrite(bulkOps);
    }

    // ✅ Fetch final updated doc
    const updatedDoc = await UserCategory.findOne({ userId })
      .populate("interestedCategories.categoryId", "name")
      .populate("nonInterestedCategories.categoryId", "name")
      .lean();

    res.status(200).json({
      message: "Categories selected successfully",
      data: updatedDoc
    });
  } catch (err) {
    console.error("Error selecting categories:", err);
    res.status(500).json({
      message: "Error selecting categories",
      error: err.message
    });
  }
};


exports.userInterestedCategory = async (req, res) => {
  try {
    const { feedId } = req.body;
    const userId = req.Id || req.body.userId;

    if (!userId) return res.status(400).json({ message: "User ID is required" });
    if (!feedId) return res.status(400).json({ message: "Feed ID is required" });

    // Get category from feed
    const feed = await Feed.findById(feedId, { category: 1 }).lean();
    if (!feed?.category)
      return res.status(404).json({ message: "Feed or category not found" });

    const categoryId = new mongoose.Types.ObjectId(feed.category);

    // ⚡ SINGLE ATOMIC OPERATION — fastest
    await UserCategory.updateOne(
      { userId },

      {
        $pull: { nonInterestedCategories: categoryId },     // remove from nonInterested
        $addToSet: { interestedCategories: categoryId },     // add to interested
        $set: { [`updatedAtMap.${categoryId}`]: new Date() } // timestamp
      },

      { upsert: true }
    );

    res.status(200).json({
      message: "Category marked as interested successfully",
      categoryId,
    });

  } catch (err) {
    console.error("Error marking category as interested:", err);
    res.status(500).json({
      message: "Error marking category as interested",
      error: err.message
    });
  }
};




exports.userNotInterestedCategory = async (req, res) => {
  try {
    const { feedId } = req.body;
    const userId = req.Id || req.body.userId;

    if (!userId) return res.status(400).json({ message: "User ID is required" });
    if (!feedId) return res.status(400).json({ message: "Feed ID is required" });

    // Get category from feed
    const feed = await Feed.findById(feedId, { category: 1 }).lean();
    if (!feed?.category)
      return res.status(404).json({ message: "Feed or category not found" });

    const categoryId = new mongoose.Types.ObjectId(feed.category);

    // ⚡ SINGLE ATOMIC OPERATION — fastest
    await UserCategory.updateOne(
      { userId },

      {
        $pull: { interestedCategories: categoryId },         // remove from interested
        $addToSet: { nonInterestedCategories: categoryId },  // add to nonInterested
        $set: { [`updatedAtMap.${categoryId}`]: new Date() } // timestamp
      },

      { upsert: true }
    );

    res.status(200).json({
      message: "Category marked as NOT interested successfully",
      categoryId,
    });

  } catch (err) {
    console.error("Error marking category as not interested:", err);
    res.status(500).json({
      message: "Error marking category as not interested",
      error: err.message
    });
  }
};


















