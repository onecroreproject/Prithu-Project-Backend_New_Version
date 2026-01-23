// ✅ controllers/searchController.js
const Categories = require("../models/categorySchema");
const ProfileSettings = require("../models/profileSettingModel");
const Hashtag = require("../models/hashTagModel");
const Feed = require("../models/feedModel");
const { feedTimeCalculator } = require('../middlewares/feedTimeCalculator');
const mongoose = require("mongoose");





exports.globalSearch = async (req, res) => {
  try {
    const userId = req.Id ? new mongoose.Types.ObjectId(req.Id) : null;

    const query = req.query.q?.trim();
    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query cannot be empty.",
      });
    }

    const prefixRegex =
      query.length === 1
        ? new RegExp("^" + query, "i")
        : new RegExp(query, "i");



    /* -------------------------------------------
       2️⃣ FULL FEED SEARCH (await it!)
    --------------------------------------------*/

    const feedsRaw = await Feed.aggregate([
      {
        $match: {
          status: "Published",
          $or: [{ dec: prefixRegex }, { hashtags: prefixRegex }],
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 10 },

      /* ----- ACCOUNT LOOKUPS ----- */
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
                { case: { $eq: ["$roleRef", "User"] }, then: { $arrayElemAt: ["$user", 0] } },
              ],
              default: null,
            },
          },
        },
      },

      /* ----- PROFILE SETTINGS ----- */
      {
        $lookup: {
          from: "ProfileSettings",
          let: {
            adminId: { $cond: [{ $eq: ["$roleRef", "Admin"] }, "$createdByAccount", null] },
            userId: { $cond: [{ $eq: ["$roleRef", "User"] }, "$createdByAccount", null] },
            childAdminId: { $cond: [{ $eq: ["$roleRef", "Child_Admin"] }, "$createdByAccount", null] },
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $or: [
                    { $eq: ["$adminId", "$$adminId"] },
                    { $eq: ["$childAdminId", "$$childAdminId"] },
                    { $eq: ["$userId", "$$userId"] },
                  ],
                },
              },
            },
            { $limit: 1 },
            { $project: { userName: 1, profileAvatar: 1, modifyAvatar: 1 } },
          ],
          as: "profile",
        },
      },

      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      /* ----- LIKE/DISLIKE/DOWNLOAD/SHARE COUNTS ----- */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: "$likedFeeds" },
            { $match: { $expr: { $eq: ["$likedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" },
          ],
          as: "likesCount",
        },
      },
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: "$disLikeFeeds" },
            { $match: { $expr: { $eq: ["$disLikeFeeds.feedId", "$$feedId"] } } },
            { $count: "count" },
          ],
          as: "dislikesCount",
        },
      },
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: "$downloadedFeeds" },
            { $match: { $expr: { $eq: ["$downloadedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" },
          ],
          as: "downloadsCount",
        },
      },
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: "$sharedFeeds" },
            { $match: { $expr: { $eq: ["$sharedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" },
          ],
          as: "sharesCount",
        },
      },

      /* ----- VIEWS / COMMENTS ----- */
      {
        $lookup: {
          from: "UserViews",
          let: { feedId: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } }, { $count: "count" }],
          as: "viewsCount",
        },
      },
      {
        $lookup: {
          from: "UserComments",
          let: { feedId: "$_id" },
          pipeline: [{ $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } }, { $count: "count" }],
          as: "commentsCount",
        },
      },

      /* ----- CURRENT USER ACTIONS ----- */
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$userId", userId] } } },
            {
              $project: {
                isLiked: {
                  $in: ["$$feedId", { $map: { input: "$likedFeeds", as: "x", in: "$$x.feedId" } }],
                },
                isSaved: {
                  $in: ["$$feedId", { $map: { input: "$savedFeeds", as: "x", in: "$$x.feedId" } }],
                },
                isDisliked: {
                  $in: ["$$feedId", { $map: { input: "$disLikeFeeds", as: "x", in: "$$x.feedId" } }],
                },
              },
            },
          ],
          as: "userActions",
        },
      },

      /* ----- FOLLOWING STATUS ----- */
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
                    { $eq: ["$followerId", userId] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "followInfo",
        },
      },
      { $addFields: { isFollowing: { $gt: [{ $size: "$followInfo" }, 0] } } },

      /* ----- FINAL PROJECTION ----- */
      {
        $project: {
          feedId: "$_id",
          type: 1,
          language: 1,
          category: 1,
          contentUrl: 1,
          createdByAccount: 1,
          createdAt: 1,
          dec: 1,
          images: 1,
          video: 1,
          hashtags: 1,

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
          themeColor: 1,
        },
      },
    ]);

    /* -------------------------------------------
       ENRICH FEEDS
    --------------------------------------------*/
    const enrichedFeeds = feedsRaw.map(feed => ({
      ...feed,
      avatarToUse:
        feed.modifyAvatarFromProfile ||
        feed.profileAvatar ||
        process.env.DEFAULT_AVATAR,

      themeColor: feed.themeColor || {
        primary: "#262e39",
        secondary: "#6e7782",
        accent: "#a7373a",
        gradient: "linear-gradient(135deg, #262e39, #6e7782, #a7373a)",
        text: "#ffffff",
      },

      timeAgo: feedTimeCalculator(feed.createdAt),
    }));


    /* -------------------------------------------
       3️⃣ RUN JOB + PEOPLE + CATEGORY FETCHES
    --------------------------------------------*/
    const [categories, people] = await Promise.all([
      Hashtag.find({ tag: prefixRegex })
        .select("tag count updatedAt")
        .limit(10),

      ProfileSettings.find({
        $or: [
          { userName: prefixRegex },
          { name: prefixRegex },
          { lastName: prefixRegex },
        ],
      })
        .select("userName profileAvatar name userId")
        .limit(10),
    ]);


    /* -------------------------------------------
       RETURN FINAL RESPONSE
    --------------------------------------------*/
    return res.status(200).json({
      success: true,
      query,
      categories,
      people,
      feeds: enrichedFeeds,
    });

  } catch (error) {
    console.error("❌ Search Error:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while searching.",
      error: error.message,
    });
  }
};

