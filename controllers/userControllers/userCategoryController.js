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

    // Get categoryId from feed
    const feed = await Feed.findById(feedId, { category: 1 }).lean();
    if (!feed || !feed.category) return res.status(404).json({ message: "Feed or category not found" });

    const categoryId = new mongoose.Types.ObjectId(feed.category);

    // Ensure UserCategory doc exists
    let userCategory = await UserCategory.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, interestedCategories: [], nonInterestedCategories: [] } },
      { new: true, upsert: true }
    );

    // ✅ Safely check if already interested
    const alreadyInterested = (userCategory.interestedCategories || []).some(
      c => c.categoryId && c.categoryId.toString() === categoryId.toString()
    );
    if (alreadyInterested) {
      return res.status(200).json({
        message: "You already liked this category",
        data: userCategory
      });
    }

    // If in nonInterested → pull from there first
    const inNonInterested = (userCategory.nonInterestedCategories || []).some(
      c => c.categoryId && c.categoryId.toString() === categoryId.toString()
    );

    if (inNonInterested) {
      await UserCategory.updateOne(
        { userId },
        {
          $pull: { nonInterestedCategories: { categoryId } },
          $push: { interestedCategories: { categoryId, updatedAt: new Date() } }
        }
      );
    } else {
      // Directly push to interested
      await UserCategory.updateOne(
        { userId },
        { $push: { interestedCategories: { categoryId, updatedAt: new Date() } } }
      );
    }

    const updatedDoc = await UserCategory.findOne({ userId })
      .populate("interestedCategories.categoryId", "name")
      .populate("nonInterestedCategories.categoryId", "name")
      .lean();

    res.status(200).json({
      message: "Category marked as interested successfully",
      data: updatedDoc
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

    const feed = await Feed.findById(feedId, { category: 1 }).lean();
    if (!feed || !feed.category) return res.status(404).json({ message: "Feed or category not found" });

    const categoryId = new mongoose.Types.ObjectId(feed.category);

    let userCategory = await UserCategory.findOneAndUpdate(
      { userId },
      { $setOnInsert: { userId, interestedCategories: [], nonInterestedCategories: [] } },
      { new: true, upsert: true }
    );

    // Already in nonInterested → return
    const alreadyNonInterested = (userCategory.nonInterestedCategories || []).some(
      c => c.categoryId.toString() === categoryId.toString()
    );
    if (alreadyNonInterested) {
      return res.status(200).json({
        message: "You already unliked this category",
      });
    }

    // If in interested → pull from there first
    const inInterested = (userCategory.interestedCategories || []).some(
      c => c.categoryId.toString() === categoryId.toString()
    );
    if (inInterested) {
      await UserCategory.updateOne(
        { userId },
        {
          $pull: { interestedCategories: { categoryId } },
          $push: { nonInterestedCategories: { categoryId, updatedAt: new Date() } }
        }
      );
    } else {
      // Directly push to nonInterested
      await UserCategory.updateOne(
        { userId },
        { $push: { nonInterestedCategories: { categoryId, updatedAt: new Date() } } }
      );
    }

    const updatedDoc = await UserCategory.findOne({ userId })
      .populate("interestedCategories.categoryId", "name")
      .populate("nonInterestedCategories.categoryId", "name")
      .lean();

    res.status(200).json({
      message: "Category marked as not interested successfully",
      data: updatedDoc
    });

  } catch (err) {
    console.error("Error marking category as not interested:", err);
    res.status(500).json({
      message: "Error marking category as not interested",
      error: err.message
    });
  }
};

















