const Feed = require('../../models/feedModel');
const User = require('../../models/userModels/userModel');
const { feedTimeCalculator } = require('../../middlewares/feedTimeCalculator');
const UserFeedActions = require('../../models/userFeedInterSectionModel.js');
const Account = require("../../models/accountSchemaModel.js");
const mongoose = require("mongoose");
const UserComment = require("../../models/userCommentModel.js");
const UserView = require("../../models/userModels/userViewFeedsModel.js");
const UserLanguage = require('../../models/userModels/userLanguageModel.js');
const UserCategory = require('../../models/userModels/userCategotyModel.js');
const ProfileSettings = require('../../models/profileSettingModel');
const { applyFrame } = require("../../middlewares/helper/AddFrame/addFrame.js");
const { extractThemeColor } = require("../../middlewares/helper/extractThemeColor.js");
const ImageStats = require("../../models/userModels/MediaSchema/imageViewModel.js");
const VideoStats = require("../../models/userModels/MediaSchema/videoViewStatusModel");
const cloudinary = require("cloudinary").v2;
const HiddenPost = require("../../models/userModels/hiddenPostSchema.js")
const {deleteFeedFile}=require("../../middlewares/services/feedUploadSpydy.js");
const Categories=require("../../models/categorySchema.js");
const path = require("path");
// const { google } = require("googleapis");
const { oAuth2Client } = require("../../middlewares/services/googleDriveMedia/googleDriverAuth");



// const drive = google.drive({
//   version: "v3",
//   auth: oAuth2Client,
// });

exports.getAllFeedsByUserId = async (req, res) => {
  try {
    const rawUserId = req.Id || req.body.userId;
    if (!rawUserId)
      return res.status(404).json({ message: "User ID Required" });

    const userId = new mongoose.Types.ObjectId(rawUserId);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 10)));

    /* -----------------------------------------------------
       1️⃣ FETCH HIDDEN POSTS
    ------------------------------------------------------*/
    const hiddenPosts = await HiddenPost.find({ userId })
      .select("postId -_id")
      .lean();

    const hiddenPostIds = hiddenPosts.map((h) => h.postId);

    /* -----------------------------------------------------
       2️⃣ FETCH NON-INTERESTED CATEGORIES
    ------------------------------------------------------*/
    const userCategories = await UserCategory.findOne({ userId })
      .select("nonInterestedCategories")
      .lean();

    const notInterestedCategoryIds =
      userCategories?.nonInterestedCategories || [];


    const feeds = await Feed.aggregate([
      {
        $match: {
          _id: { $nin: hiddenPostIds },
          category: { $nin: notInterestedCategoryIds },
          $or: [
            { isScheduled: { $ne: true } },
            {
              $and: [
                { isScheduled: true },
                { scheduleDate: { $lte: new Date() } },
              ],
            },
          ],
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },

      /* ============================================
         FETCH ACCOUNT DATA
      ============================================ */
      { $lookup: { from: "Admin", localField: "createdByAccount", foreignField: "_id", as: "admin" } },
      { $lookup: { from: "Child_Admin", localField: "createdByAccount", foreignField: "_id", as: "childAdmin" } },
      { $lookup: { from: "User", localField: "createdByAccount", foreignField: "_id", as: "user" } },

      {
        $addFields: {
          accountData: {
            $switch: {
              branches: [
                { case: { $eq: ["$roleRef", "Admin"] }, then: { $arrayElemAt: ["$admin", 0] } },
                { case: { $eq: ["$roleRef", "Child_Admin"] }, then: { $arrayElemAt: ["$childAdmin", 0] } },
                { case: { $eq: ["$roleRef", "User"] }, then: { $arrayElemAt: ["$user", 0] } }
              ],
              default: null
            }
          }
        }
      },

      /* ============================================
         PROFILE SETTINGS
      ============================================ */
      {
        $lookup: {
          from: "ProfileSettings",
          let: {
            adminId: { $cond: [{ $eq: ["$roleRef", "Admin"] }, "$createdByAccount", null] },
            userId: { $cond: [{ $eq: ["$roleRef", "User"] }, "$createdByAccount", null] },
            childAdminId: { $cond: [{ $eq: ["$roleRef", "Child_Admin"] }, "$createdByAccount", null] }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$adminId", "$$adminId"] },
                    { $eq: ["$childAdminId", "$$childAdminId"] },
                    { $eq: ["$userId", "$$userId"] }
                  ]
                }
              }
            },
            { $limit: 1 },
            { $project: { userName: 1, profileAvatar: 1, modifyAvatar: 1 } }
          ],
          as: "profile"
        }
      },

      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      /* ============================================
         LIKE COUNT
      ============================================ */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$likedFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$likedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "likesCount"
        }
      },

      /* ============================================
         DISLIKE COUNT
      ============================================ */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$disLikeFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$disLikeFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "dislikesCount"
        }
      },

      /* ============================================
         DOWNLOAD COUNT
      ============================================ */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$downloadedFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$downloadedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "downloadsCount"
        }
      },

      /* ============================================
         SHARE COUNT (CORRECT)
      ============================================ */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$sharedFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$sharedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "sharesCount"
        }
      },

      /* ============================================
         VIEWS & COMMENTS COUNT
      ============================================ */
      {
        $lookup: {
          from: "UserViews",
          let: { feedId: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } }, { $count: "count" }],
          as: "viewsCount"
        }
      },

      {
        $lookup: {
          from: "UserComments",
          let: { feedId: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } }, { $count: "count" }],
          as: "commentsCount"
        }
      },

      /* ============================================
         CURRENT USER ACTIONS
      ============================================ */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", userId] } } },
            {
              $project: {
                isLiked: {
                  $in: ["$$feedId", { $map: { input: "$likedFeeds", as: "f", in: "$$f.feedId" } }]
                },
                isSaved: {
                  $in: ["$$feedId", { $map: { input: "$savedFeeds", as: "f", in: "$$f.feedId" } }]
                },
                isDisliked: {
                  $in: ["$$feedId", { $map: { input: "$disLikeFeeds", as: "f", in: "$$f.feedId" } }]
                }
              }
            }
          ],
          as: "userActions"
        }
      },

      /* ============================================
         FOLLOW DATA
      ============================================ */
      {
        $lookup: {
          from: "Follows",
          let: { creatorId: "$createdByAccount" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$creatorId", "$$creatorId"] },
                    { $eq: ["$followerId", userId] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: "followInfo"
        }
      },

      {
        $addFields: {
          isFollowing: { $gt: [{ $size: "$followInfo" }, 0] }
        }
      },

      /* ============================================
         FINAL OUTPUT PROJECTION
      ============================================ */
      {
        $project: {
          feedId: "$_id",
          type: 1,
          language: 1,
          category: 1,
          contentUrl: 1,
          roleRef: 1,
          createdByAccount: 1,
          createdAt: 1,
          dec: 1,

          userName: "$profile.userName",
          profileAvatar: "$profile.profileAvatar",
          modifyAvatarFromProfile: "$profile.modifyAvatar",

          likesCount: { $ifNull: [{ $arrayElemAt: ["$likesCount.count", 0] }, 0] },
          dislikesCount: { $ifNull: [{ $arrayElemAt: ["$dislikesCount.count", 0] }, 0] },
          downloadsCount: { $ifNull: [{ $arrayElemAt: ["$downloadsCount.count", 0] }, 0] },
          shareCount: { $ifNull: [{ $arrayElemAt: ["$sharesCount.count", 0] }, 0] },
          viewsCount: { $ifNull: [{ $arrayElemAt: ["$viewsCount.count", 0] }, 0] },
          commentsCount: { $ifNull: [{ $arrayElemAt: ["$commentsCount.count", 0] }, 0] },

          isLiked: { $arrayElemAt: ["$userActions.isLiked", 0] },
          isSaved: { $arrayElemAt: ["$userActions.isSaved", 0] },
          isDisliked: { $arrayElemAt: ["$userActions.isDisliked", 0] },

          isFollowing: 1,
          themeColor: 1
        }
      }
    ]);

    /* ============================================
       POST-PROCESSING
    ============================================ */
    const enrichedFeeds = await Promise.all(
      feeds.map(async (feed) => {
        const avatarToUse =
          feed.modifyAvatarFromProfile ||
          feed.profileAvatar ||
          process.env.DEFAULT_AVATAR;

        const themeColor = feed.themeColor || {
          primary: "#fff",
          secondary: "#ccc",
          accent: "#999",
          text: "#000",
          gradient: "linear-gradient(135deg,#fff,#ccc,#999)",
        };

        return {
          ...feed,
          avatarToUse,
          themeColor,
          timeAgo: feedTimeCalculator(feed.createdAt),
        };
      })
    );

    res.status(200).json({
      message: "Feeds retrieved successfully",
      feeds: enrichedFeeds,
      page,
      limit,
    });
  } catch (err) {
    console.error("Error in getAllFeedsByUserId:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};





/* ------------------------------------------------
   CLEAN TAG VALUE (“#Music” → “music”)
--------------------------------------------------- */
function normalizeTag(str) {
  if (!str) return "";
  return str.trim().replace(/^#+/, "").toLowerCase();
}



/* ------------------------------------------------
   MAIN FUNCTION
--------------------------------------------------- */

exports.getFeedsByHashtag = async (req, res) => {
  try {
    const rawUserId = req.Id || req.body.userId;
    const tagRaw = req.params.tag;

    if (!rawUserId)
      return res.status(400).json({ message: "User ID required" });

    const tag = normalizeTag(tagRaw);
    if (!tag) return res.status(400).json({ message: "Hashtag required" });

    const userId = new mongoose.Types.ObjectId(rawUserId);

    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(5, Math.min(50, Number(req.query.limit || 10)));
    const skip = (page - 1) * limit;

    /* -------------------------------------------------
       1) Hidden Posts
    -------------------------------------------------- */
    const hiddenPosts = await HiddenPost.find({ userId })
      .select("postId -_id")
      .lean();
    const hiddenPostIds = hiddenPosts.map((x) => x.postId);

    /* -------------------------------------------------
       2) User "Not Interested" Categories
    -------------------------------------------------- */
    const userCat = await UserCategory.findOne({ userId }).lean();
    const notCats = userCat?.nonInterestedCategories || [];

    /* -------------------------------------------------
       3) AGGREGATION PIPELINE
    -------------------------------------------------- */
    const pipeline = [
      {
        $match: {
          _id: { $nin: hiddenPostIds },
          category: { $nin: notCats },
          hashtags: { $in: [tag] },
          $or: [
            { isScheduled: { $ne: true } },
            { $and: [{ isScheduled: true }, { scheduleDate: { $lte: new Date() } }] }
          ],
          status: "Published"
        }
      },

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      /* -------------------------------------------------
         ACCOUNT LOOKUP (Admin / Child_Admin / User)
      -------------------------------------------------- */
      { $lookup: { from: "Admin", localField: "createdByAccount", foreignField: "_id", as: "admin" } },
      { $lookup: { from: "Child_Admin", localField: "createdByAccount", foreignField: "_id", as: "childAdmin" } },
      { $lookup: { from: "User", localField: "createdByAccount", foreignField: "_id", as: "user" } },

      {
        $addFields: {
          accountData: {
            $switch: {
              branches: [
                { case: { $eq: ["$roleRef", "Admin"] }, then: { $arrayElemAt: ["$admin", 0] } },
                { case: { $eq: ["$roleRef", "Child_Admin"] }, then: { $arrayElemAt: ["$childAdmin", 0] } },
                { case: { $eq: ["$roleRef", "User"] }, then: { $arrayElemAt: ["$user", 0] } }
              ],
              default: null
            }
          }
        }
      },

      /* -------------------------------------------------
         PROFILE SETTINGS
      -------------------------------------------------- */
      {
        $lookup: {
          from: "ProfileSettings",
          let: {
            adminId: { $cond: [{ $eq: ["$roleRef", "Admin"] }, "$createdByAccount", null] },
            childAdminId: { $cond: [{ $eq: ["$roleRef", "Child_Admin"] }, "$createdByAccount", null] },
            userId: { $cond: [{ $eq: ["$roleRef", "User"] }, "$createdByAccount", null] },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$adminId", "$$adminId"] },
                    { $eq: ["$childAdminId", "$$childAdminId"] },
                    { $eq: ["$userId", "$$userId"] }
                  ]
                }
              }
            },
            { $project: { userName: 1, profileAvatar: 1, modifyAvatar: 1 } },
            { $limit: 1 }
          ],
          as: "profile"
        }
      },

      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      /* -------------------------------------------------
         LIKE / DISLIKE / SAVE / VIEW / COMMENT COUNTS
      -------------------------------------------------- */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { fid: "$_id" },
          pipeline: [
            { $unwind: "$likedFeeds" },
            { $match: { $expr: { $eq: ["$likedFeeds.feedId", "$$fid"] } } },
            { $count: "count" }
          ],
          as: "likesCount"
        }
      },

      {
        $lookup: {
          from: "UserComments",
          let: { fid: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$fid"] } } }, { $count: "count" }],
          as: "commentsCount"
        }
      },

      {
        $lookup: {
          from: "UserViews",
          let: { fid: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$fid"] } } }, { $count: "count" }],
          as: "viewsCount"
        }
      },

      /* -------------------------------------------------
         CURRENT USER ACTION FLAGS
      -------------------------------------------------- */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { fid: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", userId] } } },
            {
              $project: {
                isLiked: { $in: ["$$fid", { $map: { input: "$likedFeeds", as: "i", in: "$$i.feedId" } }] },
                isSaved: { $in: ["$$fid", { $map: { input: "$savedFeeds", as: "i", in: "$$i.feedId" } }] },
                isDisliked: { $in: ["$$fid", { $map: { input: "$disLikeFeeds", as: "i", in: "$$i.feedId" } }] },
              }
            }
          ],
          as: "userActions"
        }
      },

      /* -------------------------------------------------
         FOLLOW CHECK
      -------------------------------------------------- */
      {
        $lookup: {
          from: "Follows",
          let: { creatorId: "$createdByAccount" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$creatorId", "$$creatorId"] }, { $eq: ["$followerId", userId] }] } } },
            { $limit: 1 }
          ],
          as: "followInfo"
        }
      },

      /* -------------------------------------------------
         FINAL PROJECTION
      -------------------------------------------------- */
      {
        $project: {
          feedId: "$_id",
          type: 1,
          contentUrl: 1,
          dec: 1,
          category: 1,
          hashtags: 1,
          createdAt: 1,
          duration: 1,
          roleRef: 1,
          createdByAccount: 1,

          userName: "$profile.userName",
          profileAvatar: "$profile.profileAvatar",
          modifyAvatarFromProfile: "$profile.modifyAvatar",

          likesCount: { $ifNull: [{ $arrayElemAt: ["$likesCount.count", 0] }, 0] },
          commentsCount: { $ifNull: [{ $arrayElemAt: ["$commentsCount.count", 0] }, 0] },
          viewsCount: { $ifNull: [{ $arrayElemAt: ["$viewsCount.count", 0] }, 0] },

          isLiked: { $arrayElemAt: ["$userActions.isLiked", 0] },
          isSaved: { $arrayElemAt: ["$userActions.isSaved", 0] },
          isDisliked: { $arrayElemAt: ["$userActions.isDisliked", 0] },

          isFollowing: { $gt: [{ $size: "$followInfo" }, 0] },

          themeColor: 1
        }
      }
    ];

    /* -------------------------------------------------
       EXECUTE PIPELINE
    -------------------------------------------------- */
    const feeds = await Feed.aggregate(pipeline);

    /* -------------------------------------------------
       CLEAN FINAL FEED FORMAT
    -------------------------------------------------- */
    const finalFeeds = feeds.map((f) => ({
      ...f,
      avatarToUse:
        f.modifyAvatarFromProfile ||
        f.profileAvatar ||
        process.env.DEFAULT_AVATAR,

      timeAgo: feedTimeCalculator(f.createdAt),

      themeColor:
        f.themeColor ||
        {
          primary: "#fff",
          secondary: "#ccc",
          accent: "#999",
          text: "#000",
          gradient: "linear-gradient(135deg,#fff,#ccc,#999)"
        }
    }));

    return res.json({
      success: true,
      tag,
      page,
      limit,
      feeds: finalFeeds
    });
  } catch (error) {
    console.error("🔥 Hashtag Feed Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


/**
 * ✅ Get a single feed by feedId
 * Used when navigating from notifications
 */
exports.getSingleFeedById = async (req, res) => {
  try {
    const rawUserId = req.Id || req.body.userId;
    const feedId = req.params.feedId;

    if (!rawUserId)
      return res.status(404).json({ message: "User ID Required" });

    if (!feedId)
      return res.status(400).json({ message: "Feed ID is required" });

    const userId = new mongoose.Types.ObjectId(rawUserId);
    const feedObjectId = new mongoose.Types.ObjectId(feedId);

    // SAME PIPELINE AS getAllFeedsByUserId BUT MATCH ONE FEED
    const result = await Feed.aggregate([
      { $match: { _id: feedObjectId } },

      // ----- SAME LOOKUPS -----
      { $lookup: { from: "Admin", localField: "createdByAccount", foreignField: "_id", as: "admin" } },
      { $lookup: { from: "Child_Admin", localField: "createdByAccount", foreignField: "_id", as: "childAdmin" } },
      { $lookup: { from: "User", localField: "createdByAccount", foreignField: "_id", as: "user" } },

      {
        $addFields: {
          accountData: {
            $switch: {
              branches: [
                { case: { $eq: ["$roleRef", "Admin"] }, then: { $arrayElemAt: ["$admin", 0] } },
                { case: { $eq: ["$roleRef", "Child_Admin"] }, then: { $arrayElemAt: ["$childAdmin", 0] } },
                { case: { $eq: ["$roleRef", "User"] }, then: { $arrayElemAt: ["$user", 0] } }
              ],
              default: null
            }
          }
        }
      },

      {
        $lookup: {
          from: "ProfileSettings",
          let: {
            adminId: { $cond: [{ $eq: ["$roleRef", "Admin"] }, "$createdByAccount", null] },
            userId: { $cond: [{ $eq: ["$roleRef", "User"] }, "$createdByAccount", null] },
            childAdminId: { $cond: [{ $eq: ["$roleRef", "Child_Admin"] }, "$createdByAccount", null] }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$adminId", "$$adminId"] },
                    { $eq: ["$childAdminId", "$$childAdminId"] },
                    { $eq: ["$userId", "$$userId"] }
                  ]
                }
              }
            },
            { $limit: 1 },
            { $project: { userName: 1, profileAvatar: 1, modifyAvatar: 1 } }
          ],
          as: "profile"
        }
      },

      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // ---------- COUNTS ----------
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$likedFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$likedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "likesCount"
        }
      },
      {
        $lookup: {
          from: "UserComments",
          let: { feedId: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } }, { $count: "count" }],
          as: "commentsCount"
        }
      },

      // ---------- ACTIONS ----------
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", userId] } } },
            {
              $project: {
                isLiked: {
                  $in: ["$$feedId", { $map: { input: "$likedFeeds", in: "$$this.feedId" } }]
                },
                isSaved: {
                  $in: ["$$feedId", { $map: { input: "$savedFeeds", in: "$$this.feedId" } }]
                }
              }
            }
          ],
          as: "userActions"
        }
      },

      {
        $project: {
          feedId: "$_id",
          type: 1,
          contentUrl: 1,
          createdByAccount: 1,
          createdAt: 1,
          dec: 1,
          category: 1,
          language: 1,

          userName: "$profile.userName",
          profileAvatar: "$profile.profileAvatar",

          likesCount: { $ifNull: [{ $arrayElemAt: ["$likesCount.count", 0] }, 0] },
          commentsCount: { $ifNull: [{ $arrayElemAt: ["$commentsCount.count", 0] }, 0] },

          isLiked: { $arrayElemAt: ["$userActions.isLiked", 0] },
          isSaved: { $arrayElemAt: ["$userActions.isSaved", 0] },
        }
      }
    ]);

    if (!result.length) {
      return res.status(404).json({ message: "Feed not found" });
    }

    res.status(200).json({
      message: "Feed retrieved successfully",
      feed: result[0]
    });

  } catch (err) {
    console.error("Error in getSingleFeedById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};




exports.singleFeedById = async (req, res) => {
  try {
    const feedId = req.params.feedId;

    if (!feedId)
      return res.status(400).json({ message: "Feed ID is required" });

    const feedObjectId = new mongoose.Types.ObjectId(feedId);

    const feed = await Feed.findById(feedObjectId).lean();

    if (!feed) {
      return res.status(404).json({ message: "Feed not found" });
    }

    res.status(200).json({
      message: "Feed retrieved successfully",
      feed
    });

  } catch (err) {
    console.error("Error in getSingleFeedById:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};





exports.getFeedsByAccountId = async (req, res) => {
  try {
    const accountId = req.accountId || req.body.accountId;
    if (!accountId) return res.status(400).json({ message: "accountId required" });

    // 1️ Find corresponding userId from Account
    const account = await Account.findById(accountId).lean();
    if (!account) return res.status(404).json({ message: "Account not found" });
    const userId = account.userId;

    // 2️ Get user's feed language preference
    const userLang = await UserLanguage.findOne({ userId }).lean();
    const feedLangCode = userLang?.feedLanguageCode || null;

    // 3️ Get user's category preferences
    const userCat = await UserCategory.findOne({ userId }).lean();
    const excludedCategories = (userCat?.nonInterestedCategories || []).map(c => c.toString());

    // 4️ Filter feeds based on language and category
    const feedFilter = {};
    if (feedLangCode) feedFilter.language = feedLangCode;
    if (excludedCategories.length) feedFilter.category = { $nin: excludedCategories };

    const feeds = await Feed.find(feedFilter).sort({ createdAt: -1 }).lean();
    if (!feeds.length) return res.status(404).json({ message: "No feeds found" });

    const feedIds = feeds.map(f => f._id);
    const accountIds = feeds.map(f => f.createdByAccount);

    // 5️ Aggregate total likes, shares, downloads
    const actionsAgg = await UserFeedActions.aggregate([
      { $project: { likedFeeds: 1, downloadedFeeds: 1, sharedFeeds: 1 } },
      {
        $facet: {
          likes: [
            { $unwind: { path: "$likedFeeds", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$likedFeeds.feedId", count: { $sum: 1 } } }
          ],
          downloads: [
            { $unwind: { path: "$downloadedFeeds", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$downloadedFeeds.feedId", count: { $sum: 1 } } }
          ],
          shares: [
            { $unwind: { path: "$sharedFeeds", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$sharedFeeds.feedId", count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    const likesCount = {};
    const downloadsCount = {};
    const sharesCount = {};
    if (actionsAgg[0]) {
      (actionsAgg[0].likes || []).forEach(l => {
        if (l._id) likesCount[l._id.toString()] = l.count;
      });
      (actionsAgg[0].downloads || []).forEach(d => {
        if (d._id) downloadsCount[d._id.toString()] = d.count;
      });
      (actionsAgg[0].shares || []).forEach(s => {
        if (s._id) sharesCount[s._id.toString()] = s.count;
      });
    }

    // 6️ Get current account actions (Liked, Saved, Disliked)
    const userActionsDoc = await UserFeedActions.findOne({ accountId }).lean();
    const likedFeedIds = (userActionsDoc?.likedFeeds || []).map(f => f.feedId.toString());
    const savedFeedIds = (userActionsDoc?.savedFeeds || []).map(f => f.feedId.toString());
    const dislikedFeedIds = (userActionsDoc?.disLikeFeeds || []).map(f => f.feedId.toString());

    // 7️ Get views count
    const viewsAgg = await UserView.aggregate([
      { $match: { feedId: { $in: feedIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } }
    ]);
    const viewsCount = {};
    viewsAgg.forEach(v => {
      viewsCount[v._id.toString()] = v.count;
    });

    // 8️ Get comment counts
    const commentsAgg = await UserComment.aggregate([
      { $match: { feedId: { $in: feedIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } }
    ]);
    const commentsCount = {};
    commentsAgg.forEach(c => {
      commentsCount[c._id.toString()] = c.count;
    });

    // 9️ Get Accounts → Profile Settings
    const accountsList = await Account.find(
      { _id: { $in: accountIds } },
      { _id: 1, userId: 1 }
    ).lean();

    const userIds = accountsList.map(a => a.userId);
    const profiles = await ProfileSettings.find(
      { userId: { $in: userIds } },
      { userName: 1, profileAvatar: 1, userId: 1 }
    ).lean();

    const accountToUserId = {};
    accountsList.forEach(acc => {
      accountToUserId[acc._id.toString()] = acc.userId.toString();
    });

    const userIdToProfile = {};
    profiles.forEach(p => {
      userIdToProfile[p.userId.toString()] = p;
    });

    //  Build final response
    const enrichedFeeds = feeds.map(feed => {
      const fid = feed._id.toString();
      const contentUrl = feed.contentUrl;
      const creatorUserId = accountToUserId[feed.createdByAccount?.toString()] || null;
      const profile = creatorUserId ? userIdToProfile[creatorUserId] : null;

      return {
        feedId: fid,
        type: feed.type,
        language: feed.language,
        category: feed.category,
        contentUrl,
        likesCount: likesCount[fid] || 0,
        downloadsCount: downloadsCount[fid] || 0,
        shareCount: sharesCount[fid] || 0,
        viewsCount: viewsCount[fid] || 0,
        commentsCount: commentsCount[fid] || 0,
        isLiked: likedFeedIds.includes(fid),
        isSaved: savedFeedIds.includes(fid),
        isDisliked: dislikedFeedIds.includes(fid),
        userName: profile?.userName || "Unknown",
        profileAvatar: profile?.profileAvatar,
      };
    });

    res.status(200).json({
      message: "Filtered feeds retrieved successfully",
      feeds: enrichedFeeds,
    });

  } catch (err) {
    console.error("Error fetching filtered feeds by accountId:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};



exports.getFeedsByCreator = async (req, res) => {
  try {
    const feedId = req.params.feedId;
    const rawUserId = req.Id || req.body.userId;

    if (!feedId) return res.status(400).json({ message: "Feed ID required" });
    if (!rawUserId) return res.status(404).json({ message: "User ID Required" });

    const userId = new mongoose.Types.ObjectId(rawUserId);

    /* -----------------------------------------------------
       1️⃣ Get feed → extract creator ID
    ------------------------------------------------------*/
    const feed = await Feed.findById(feedId).lean();
    if (!feed) return res.status(404).json({ message: "Feed not found" });

    const creatorId = feed.createdByAccount;

    /* -----------------------------------------------------
       2️⃣ Fetch hidden posts & uninterested categories of logged user
    ------------------------------------------------------*/
    const hiddenPosts = await HiddenPost.find({ userId })
      .select("postId -_id")
      .lean();

    const hiddenPostIds = hiddenPosts.map((h) => h.postId);

    const userCategories = await UserCategory.findOne({ userId })
      .select("nonInterestedCategories")
      .lean();

    const notInterestedCategoryIds =
      userCategories?.nonInterestedCategories || [];

    /* -----------------------------------------------------
       3️⃣ MAIN PIPELINE (same as home feed, only changed match)
    ------------------------------------------------------*/
    const feeds = await Feed.aggregate([
      {
        $match: {
          createdByAccount: new mongoose.Types.ObjectId(creatorId),
          _id: { $nin: hiddenPostIds },
          category: { $nin: notInterestedCategoryIds },
          $or: [
            { isScheduled: { $ne: true } },
            {
              $and: [
                { isScheduled: true },
                { scheduleDate: { $lte: new Date() } },
              ],
            },
          ],
        },
      },
      { $sort: { createdAt: -1 } },

      /* ========================= PROFILE (Admin / User / ChildAdmin) ========================= */
      { $lookup: { from: "Admin", localField: "createdByAccount", foreignField: "_id", as: "admin" } },
      { $lookup: { from: "Child_Admin", localField: "createdByAccount", foreignField: "_id", as: "childAdmin" } },
      { $lookup: { from: "User", localField: "createdByAccount", foreignField: "_id", as: "user" } },

      {
        $addFields: {
          accountData: {
            $switch: {
              branches: [
                { case: { $eq: ["$roleRef", "Admin"] }, then: { $arrayElemAt: ["$admin", 0] } },
                { case: { $eq: ["$roleRef", "Child_Admin"] }, then: { $arrayElemAt: ["$childAdmin", 0] } },
                { case: { $eq: ["$roleRef", "User"] }, then: { $arrayElemAt: ["$user", 0] } }
              ],
              default: null
            }
          }
        }
      },

      /* ========================= PROFILE SETTINGS ========================= */
      {
        $lookup: {
          from: "ProfileSettings",
          let: {
            adminId: { $cond: [{ $eq: ["$roleRef", "Admin"] }, "$createdByAccount", null] },
            userId: { $cond: [{ $eq: ["$roleRef", "User"] }, "$createdByAccount", null] },
            childAdminId: { $cond: [{ $eq: ["$roleRef", "Child_Admin"] }, "$createdByAccount", null] }
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$adminId", "$$adminId"] },
                    { $eq: ["$childAdminId", "$$childAdminId"] },
                    { $eq: ["$userId", "$$userId"] }
                  ]
                }
              }
            },
            { $limit: 1 },
            { $project: { userName: 1, profileAvatar: 1, modifyAvatar: 1 } }
          ],
          as: "profile"
        }
      },

      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      /* ========================= LIKES COUNT ========================= */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$likedFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$likedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "likesCount"
        }
      },

      /* ========================= DISLIKE COUNT ========================= */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$disLikeFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$disLikeFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "dislikesCount"
        }
      },

      /* ========================= DOWNLOAD COUNT ========================= */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$downloadedFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$downloadedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "downloadsCount"
        }
      },

      /* ========================= SHARES COUNT ========================= */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: { path: "$sharedFeeds", preserveNullAndEmptyArrays: true } },
            { $match: { $expr: { $eq: ["$sharedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "sharesCount"
        }
      },

      /* ========================= VIEWS & COMMENTS COUNT ========================= */
      {
        $lookup: {
          from: "UserViews",
          let: { feedId: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } }, { $count: "count" }],
          as: "viewsCount"
        }
      },

      {
        $lookup: {
          from: "UserComments",
          let: { feedId: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } }, { $count: "count" }],
          as: "commentsCount"
        }
      },

      /* ========================= USER ACTIONS ========================= */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", userId] } } },
            {
              $project: {
                isLiked: {
                  $in: ["$$feedId", { $map: { input: "$likedFeeds", as: "f", in: "$$f.feedId" } }]
                },
                isSaved: {
                  $in: ["$$feedId", { $map: { input: "$savedFeeds", as: "f", in: "$$f.feedId" } }]
                },
                isDisliked: {
                  $in: ["$$feedId", { $map: { input: "$disLikeFeeds", as: "f", in: "$$f.feedId" } }]
                }
              }
            }
          ],
          as: "userActions"
        }
      },

      /* ========================= FOLLOW STATUS CHECK ========================= */
      {
        $lookup: {
          from: "Follows",
          let: { creatorId: "$createdByAccount" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$creatorId", "$$creatorId"] },
                    { $eq: ["$followerId", userId] }
                  ]
                }
              }
            },
            { $limit: 1 }
          ],
          as: "followInfo"
        }
      },

      {
        $addFields: {
          isFollowing: { $gt: [{ $size: "$followInfo" }, 0] }
        }
      },

      /* ========================= FINAL PROJECTION ========================= */
      {
        $project: {
          feedId: "$_id",
          type: 1,
          language: 1,
          category: 1,
          contentUrl: 1,
          roleRef: 1,
          createdByAccount: 1,
          createdAt: 1,
          dec: 1,

          userName: "$profile.userName",
          profileAvatar: "$profile.profileAvatar",
          modifyAvatarFromProfile: "$profile.modifyAvatar",

          likesCount: { $ifNull: [{ $arrayElemAt: ["$likesCount.count", 0] }, 0] },
          dislikesCount: { $ifNull: [{ $arrayElemAt: ["$dislikesCount.count", 0] }, 0] },
          downloadsCount: { $ifNull: [{ $arrayElemAt: ["$downloadsCount.count", 0] }, 0] },
          shareCount: { $ifNull: [{ $arrayElemAt: ["$sharesCount.count", 0] }, 0] },
          viewsCount: { $ifNull: [{ $arrayElemAt: ["$viewsCount.count", 0] }, 0] },
          commentsCount: { $ifNull: [{ $arrayElemAt: ["$commentsCount.count", 0] }, 0] },

          isLiked: { $arrayElemAt: ["$userActions.isLiked", 0] },
          isSaved: { $arrayElemAt: ["$userActions.isSaved", 0] },
          isDisliked: { $arrayElemAt: ["$userActions.isDisliked", 0] },

          isFollowing: 1,
          themeColor: 1
        }
      }
    ]);

    /* ========================= POST PROCESSING ========================= */
    const enrichedFeeds = await Promise.all(
      feeds.map(async (feed) => {
        const avatarToUse =
          feed.modifyAvatarFromProfile ||
          feed.profileAvatar ||
          process.env.DEFAULT_AVATAR;

        const themeColor = feed.themeColor || {
          primary: "#fff",
          secondary: "#ccc",
          accent: "#999",
          text: "#000",
          gradient: "linear-gradient(135deg,#fff,#ccc,#999)"
        };

        return {
          ...feed,
          avatarToUse,
          themeColor,
          timeAgo: feedTimeCalculator(feed.createdAt)
        };
      })
    );

    res.status(200).json({
      message: "Creator feeds loaded",
      creatorId,
      feeds: enrichedFeeds
    });

  } catch (err) {
    console.error("Error in getFeedsByCreator:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};





exports.getUserHidePost = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // 1️⃣ Fetch only the hiddenPostIds (super lightweight)
    const user = await User.findById(userId)
      .select("hiddenPostIds")
      .lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const hiddenIds = user.hiddenPostIds || [];

    // 2️⃣ If empty → return early (faster)
    if (hiddenIds.length === 0) {
      return res.status(200).json({
        message: "No hidden posts found",
        count: 0,
        data: [],
      });
    }

    // 3️⃣ Fetch hidden posts (optimized with projection + lean)
    const hiddenPosts = await Feed.find(
      { _id: { $in: hiddenIds } },
      {
        _id: 1,
        title: 1,
        content: 1,
        contentUrl: 1,
        createdAt: 1,
        createdByAccount: 1,
      }
    )
      .populate("createdByAccount", "_id userName profileImage")
      .lean();

    return res.status(200).json({
      message: "Hidden posts fetched successfully",
      count: hiddenPosts.length,
      data: hiddenPosts,
    });

  } catch (err) {
    console.error("Error fetching hidden posts:", err);
    return res.status(500).json({
      message: "Error fetching hidden posts",
      error: err.message,
    });
  }
};







exports.getUserInfoAssociatedFeed = async (req, res) => {
  try {
    let feedId = req.params.feedId || req.body.feedId;
    const userId = req.Id || req.body.userId;

    if (!feedId) {
      return res.status(400).json({ message: "feedId is required" });
    }
    feedId = feedId.trim();

    const feedWithCreator = await mongoose.connection
      .collection("Feeds")
      .aggregate([
        // 1️⃣ Match feed by ID
        { $match: { _id: new mongoose.Types.ObjectId(feedId) } },

        // 2️⃣ Lookup Account
        {
          $lookup: {
            from: "Accounts",
            localField: "createdByAccount",
            foreignField: "_id",
            as: "account",
          },
        },
        { $unwind: "$account" },

        // 3️⃣ Lookup ProfileSettings
        {
          $lookup: {
            from: "ProfileSettings",
            let: { userId: "$account.userId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      "$userId",
                      {
                        $cond: [
                          { $eq: [{ $type: "$$userId" }, "string"] },
                          { $toObjectId: "$$userId" },
                          "$$userId",
                        ],
                      },
                    ],
                  },
                },
              },
              {
                $project: {
                  bio: 1,
                  displayName: 1,
                  profileAvatar: 1,
                  userName: 1,
                },
              },
            ],
            as: "profile",
          },
        },
        { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

        // 4️⃣ Lookup total posts by this account
        {
          $lookup: {
            from: "Feeds",
            let: { accId: "$createdByAccount" },
            pipeline: [
              { $match: { $expr: { $eq: ["$createdByAccount", "$$accId"] } } },
              { $count: "totalPosts" },
            ],
            as: "postStats",
          },
        },
        {
          $addFields: {
            totalPosts: {
              $ifNull: [{ $arrayElemAt: ["$postStats.totalPosts", 0] }, 0],
            },
          },
        },

        // 5️⃣ Lookup Followers (count + ids)
        {
          $lookup: {
            from: "CreatorFollowers",
            let: { accId: "$createdByAccount" },
            pipeline: [
              {
                $match: { $expr: { $eq: ["$creatorId", "$$accId"] } }
              },
              {
                $project: {
                  _id: 0,
                  followerIds: 1,
                  followersCount: { $size: { $ifNull: ["$followerIds", []] } }
                }
              }
            ],
            as: "followersData"
          }
        },
        {
          $addFields: {
            followersCount: {
              $ifNull: [{ $arrayElemAt: ["$followersData.followersCount", 0] }, 0]
            },
            followerIds: {
              $ifNull: [{ $arrayElemAt: ["$followersData.followerIds", 0] }, []]
            }
          }
        },

        // 6️⃣ Final response fields
        {
          $project: {
            _id: 1,
            accountId: "$createdByAccount",
            totalPosts: 1,
            followersCount: 1,
            followerIds: 1,
            "profile.displayName": 1,
            "profile.bio": 1,
            "profile.profileAvatar": 1,
            "profile.userName": 1,
          },
        },
      ])
      .toArray();

    if (!feedWithCreator || feedWithCreator.length === 0) {
      return res.status(404).json({ message: "Feed not found" });
    }

    let data = feedWithCreator[0];

    // ✅ Add host to profileAvatar if needed
    if (data.profile && data.profile.profileAvatar) {
      data.profile.profileAvatar = data.profile.profileAvatar; // adjust with full URL if required
    }

    // ✅ Add isFollowing (check if current userId is in followerIds)
    let isFollowing = false;
    if (userId && data.followerIds) {
      isFollowing = data.followerIds.some(
        (id) => id.toString() === userId.toString()
      );
    }
    data.isFollowing = isFollowing;

    res.status(200).json({
      message: "Feed with creator details fetched successfully",
      data,
    });
  } catch (err) {
    console.error("Error fetching feed with user profile:", err);
    res.status(500).json({
      message: "Error fetching feed with user profile",
      error: err.message,
    });
  }
};








exports.getTrendingFeeds = async (req, res) => {
  try {
    const rawUserId = req.Id || req.body.userId;
    const userId = rawUserId ? new mongoose.Types.ObjectId(rawUserId) : null;

    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    /* -----------------------------------------
       1️⃣ Today date range
    ----------------------------------------- */
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    /* -----------------------------------------
       2️⃣ Fetch TODAY’s Feeds
    ----------------------------------------- */
    const feeds = await Feed.find({
      createdAt: { $gte: todayStart, $lte: todayEnd }
    })
      .populate("createdByAccount", "_id roleRef")
      .lean();

    if (!feeds.length) {
      return res.status(404).json({ message: "No trending feeds for today" });
    }

    /* -----------------------------------------
       3️⃣ Build trending list with extra fields
    ----------------------------------------- */
    const enriched = await Promise.all(
      feeds.map(async (feed) => {
        const feedId = feed._id;
        const roleRef = feed.roleRef;
        const creatorId = feed.createdByAccount?._id;

        /* ---------------------------------------------------------
           A. Fetch Profile
        --------------------------------------------------------- */
        let profileQuery = {};
        if (roleRef === "Admin") profileQuery = { adminId: creatorId };
        else if (roleRef === "Child_Admin") profileQuery = { childAdminId: creatorId };
        else profileQuery = { userId: creatorId };

        const profile = await ProfileSettings.findOne(profileQuery, {
          userName: 1,
          profileAvatar: 1
        }).lean();

        /* ---------------------------------------------------------
           B. User Feed Actions (likes, shares, downloads)
        --------------------------------------------------------- */
        const actionAgg = await UserFeedActions.aggregate([
          {
            $project: {
              likedFeeds: 1,
              sharedFeeds: 1,
              downloadedFeeds: 1
            }
          },
          {
            $project: {
              likes: {
                $size: {
                  $filter: {
                    input: "$likedFeeds",
                    cond: { $eq: ["$$this.feedId", feedId] }
                  }
                }
              },
              shares: {
                $size: {
                  $filter: {
                    input: "$sharedFeeds",
                    cond: { $eq: ["$$this.feedId", feedId] }
                  }
                }
              },
              downloads: {
                $size: {
                  $filter: {
                    input: "$downloadedFeeds",
                    cond: { $eq: ["$$this.feedId", feedId] }
                  }
                }
              }
            }
          },
          {
            $group: {
              _id: null,
              totalLikes: { $sum: "$likes" },
              totalShares: { $sum: "$shares" },
              totalDownloads: { $sum: "$downloads" }
            }
          }
        ]);

        const totalLikes = actionAgg[0]?.totalLikes || 0;
        const totalShares = actionAgg[0]?.totalShares || 0;
        const totalDownloads = actionAgg[0]?.totalDownloads || 0;

        /* ---------------------------------------------------------
           C. View Count based on ImageStats / VideoStats
        --------------------------------------------------------- */
        let totalViews = 0;

        if (feed.type === "image") {
          const img = await ImageStats.findOne({ imageId: feedId }).lean();
          totalViews = img?.totalViews || 0;
        } else if (feed.type === "video") {
          const vid = await VideoStats.findOne({ videoId: feedId }).lean();
          totalViews = vid?.totalViews || 0;
        }

        /* ---------------------------------------------------------
           D. Check If Current User Liked / Saved / Disliked
        --------------------------------------------------------- */
        const userAction = await UserFeedActions.findOne({ userId }, {
          likedFeeds: 1,
          savedFeeds: 1,
          disLikeFeeds: 1
        }).lean();

        const isLiked =
          userAction?.likedFeeds?.some((f) => f.feedId.toString() === feedId.toString()) || false;

        const isSaved =
          userAction?.savedFeeds?.some((f) => f.feedId.toString() === feedId.toString()) || false;

        const isDisliked =
          userAction?.disLikeFeeds?.some((f) => f.feedId.toString() === feedId.toString()) || false;

        /* ---------------------------------------------------------
           E. Trending Score
        --------------------------------------------------------- */
        const feedAgeHours = (Date.now() - new Date(feed.createdAt)) / (1000 * 60 * 60);
        const decay = feedAgeHours <= 24 ? 1 : Math.exp(-feedAgeHours / 48);

        const score =
          (totalLikes * 3 + totalShares * 5 + totalViews * 1 + totalDownloads * 4) * decay;

        return {
          ...feed,
          totalLikes,
          totalShares,
          totalDownloads,
          totalViews,

          isLiked,
          isSaved,
          isDisliked,

          createdByProfile: {
            userName: profile?.userName || "Unknown User",
            profileAvatar: profile?.profileAvatar || null
          },

          score
        };
      })
    );

    /* ---------------------------------------------------------
       4️⃣ Sort & Rank Trending
    --------------------------------------------------------- */
    enriched.sort((a, b) => b.score - a.score);

    const maxScore = enriched.length ? Math.max(...enriched.map((f) => f.score)) : 0;

    const response = enriched.map((f, index) => ({
      ...f,
      rank: index + 1,
      trendingScore: maxScore ? Math.round((f.score / maxScore) * 100) : 0
    }));

    res.status(200).json({
      message: "Today's Trending Feeds",
      count: response.length,
      data: response
    });

  } catch (err) {
    console.error("Error fetching trending feeds:", err);
    res.status(500).json({
      message: "Internal server error",
      error: err.message
    });
  }
};





exports.getFeedById = async (req, res) => {
  try {
    const { feedId } = req.params;

    // 🧩 Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(feedId)) {
      return res.status(400).json({ message: "Invalid feed ID" });
    }

    // 🔍 Find feed by ID and populate optional references
    const feed = await Feed.findById(feedId)
      .populate("category", "name")
      .populate("createdByAccount", "userName profileAvatar roleRef")
      .lean();

    if (!feed) {
      return res.status(404).json({ message: "Feed not found" });
    }

    // ✅ Normalize response
    res.status(200).json({
      _id: feed._id,
      type: feed.type,
      language: feed.language,
      category: feed.category?.name || "Uncategorized",
      contentUrl: feed.contentUrl,
      caption: feed.dec || "",
      duration: feed.duration || null,
      status: feed.status,
      createdAt: feed.createdAt,
      createdBy: feed.createdByAccount?.userName || "Unknown",
      profileAvatar: feed.createdByAccount?.profileAvatar || null,
    });
  } catch (err) {
    console.error("Error fetching feed:", err);
    res.status(500).json({ message: "Server error fetching feed" });
  }
};





exports.deleteFeed = async (req, res) => {
  try {
    const { feedId } = req.body;
    const drive = google.drive({
  version: "v3",
  auth: oAuth2Client
});


    if (!feedId) {
      return res.status(400).json({
        success: false,
        message: "feedId is required in body",
      });
    }

    // 1️⃣ Fetch feed
    const feed = await Feed.findById(feedId).lean();
    if (!feed) {
      return res.status(404).json({
        success: false,
        message: "Feed not found",
      });
    }

    const deleteTasks = [];

    /* --------------------------------------------------
       2️⃣ DELETE GOOGLE DRIVE FILE (NEW)
    -------------------------------------------------- */
    if (
      feed.storageType === "gdrive" &&
      feed.driveFileId
    ) {
      deleteTasks.push(
        drive.files.delete({
          fileId: feed.driveFileId,
        }).catch(err => {
          console.error(
            `⚠️ Failed to delete Drive file ${feed.driveFileId}:`,
            err.message
          );
        })
      );
    }

    /* --------------------------------------------------
       3️⃣ DELETE LOCAL FILE (BACKWARD COMPAT)
    -------------------------------------------------- */
    if (feed.localPath) {
      deleteFeedFile(feed.localPath);
    } else if (feed.localFilename) {
      const typeFolder = feed.type === "video" ? "videos" : "images";
      const filePath = path.join(
        __dirname,
        "../../media/feed/user",
        String(feed.createdByAccount),
        typeFolder,
        feed.localFilename
      );
      deleteFeedFile(filePath);
    }

    /* --------------------------------------------------
       4️⃣ DB CLEANUP TASKS
    -------------------------------------------------- */
    deleteTasks.push(Feed.findByIdAndDelete(feedId));

    deleteTasks.push(
      UserComment.deleteMany({ feedId })
    );

    deleteTasks.push(
      UserFeedActions.updateMany(
        {},
        {
          $pull: {
            likedFeeds: { feedId },
            savedFeeds: { feedId },
            downloadedFeeds: { feedId },
            disLikeFeeds: { feedId },
            sharedFeeds: { feedId },
          },
        }
      )
    );

    deleteTasks.push(
      UserView.deleteMany({ feedId })
    );

    if (feed.category) {
      deleteTasks.push(
        Categories.findByIdAndUpdate(feed.category, {
          $pull: { feedIds: feedId },
        })
      );
    }

    /* --------------------------------------------------
       5️⃣ EXECUTE ALL
    -------------------------------------------------- */
    await Promise.all(deleteTasks);

    return res.status(200).json({
      success: true,
      message: "Feed and all related data deleted successfully",
    });

  } catch (error) {
    console.error("❌ Delete Feed Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while deleting feed",
      error: error.message,
    });
  }
};






































