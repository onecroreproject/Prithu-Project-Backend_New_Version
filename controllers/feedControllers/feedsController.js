const Feed = require('../../models/feedModel');
const User = require('../../models/userModels/userModel');
const Creator = require('../../models/creatorModel');
const { feedTimeCalculator } = require('../../middlewares/feedTimeCalculator');
const UserFeedActions =require('../../models/userFeedInterSectionModel.js');
const fs = require('fs');
const path=require('path');
const Account =require("../../models/accountSchemaModel.js")
const Admin=require("../../models/adminModels/adminModel.js")
const mongoose = require("mongoose");
const UserComment = require("../../models/userCommentModel.js");
const UserView = require("../../models/userModels/userViewFeedsModel.js");
const CommentLike = require("../../models/commentsLikeModel.js");
const UserLanguage=require('../../models/userModels/userLanguageModel.js');
const  UserCategory=require('../../models/userModels/userCategotyModel.js');
const ProfileSettings=require('../../models/profileSettingModel')



exports.getAllFeedsByUserId = async (req, res) => {
  try {
    const rawUserId = req.Id || req.body.userId;
    const userId = rawUserId ? new mongoose.Types.ObjectId(rawUserId) : null;

    if (!rawUserId) return res.status(404).json({ message: "User ID Required" });

    // 0️⃣ Get hidden posts for this user
    const user = await User.findById(userId).select("hiddenPostIds").lean();
    const hiddenPostIds = user?.hiddenPostIds || [];

    // 1️⃣ Aggregate feeds with enrichment
    const feeds = await Feed.aggregate([
      { $match: { _id: { $nin: hiddenPostIds } } },

      // Sort newest first
      { $sort: { createdAt: -1 } },

      // Lookup creator account to get userId
      {
        $lookup: {
          from: "Accounts",
          localField: "createdByAccount",
          foreignField: "_id",
          as: "account"
        }
      },
      { $unwind: { path: "$account", preserveNullAndEmptyArrays: true } },

      // Lookup profile
      {
        $lookup: {
          from: "ProfileSettings",
          localField: "account.userId",
          foreignField: "userId",
          as: "profile"
        }
      },
      { $unwind: { path: "$profile", preserveNullAndEmptyArrays: true } },

      // Lookup counts
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: "$likedFeeds" },
            { $match: { $expr: { $eq: ["$likedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "likesCount"
        }
      },
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: "$downloadedFeeds" },
            { $match: { $expr: { $eq: ["$downloadedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "downloadsCount"
        }
      },
      {
        $lookup: {
          from: "UserFeedActions",
          let: { feedId: "$_id" },
          pipeline: [
            { $unwind: "$sharedFeeds" },
            { $match: { $expr: { $eq: ["$sharedFeeds.feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "sharesCount"
        }
      },

      // Lookup views
      {
        $lookup: {
          from: "UserViews",
          let: { feedId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "viewsCount"
        }
      },

      // Lookup comments count
      {
        $lookup: {
          from: "UserComments",
          let: { feedId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$feedId", "$$feedId"] } } },
            { $count: "count" }
          ],
          as: "commentsCount"
        }
      },

      // Project final fields
      {
        $project: {
          accountId:"$account._id",
          feedId: "$_id",
          type: 1,
          language: 1,
          category: 1,
          contentUrl: 1,
          createdAt: 1,
          likesCount: { $arrayElemAt: ["$likesCount.count", 0] },
          downloadsCount: { $arrayElemAt: ["$downloadsCount.count", 0] },
          shareCount: { $arrayElemAt: ["$sharesCount.count", 0] },
          viewsCount: { $arrayElemAt: ["$viewsCount.count", 0] },
          commentsCount: { $arrayElemAt: ["$commentsCount.count", 0] },
          userName: "$profile.userName",
          profileAvatar: "$profile.profileAvatar",
          createdByAccount: 1
        }
      }
    ]);

    // 2️⃣ Add user-specific actions (liked/saved) and format contentUrl
    const enrichedFeeds = feeds.map(feed => {
      const contentUrlFull = feed.contentUrl
      // Check user actions
      const userActionDoc = userId
        ? UserFeedActions.findOne({ userId, "likedFeeds.feedId": feed.feedId }).lean()
        : null;
      // For simplicity, you can populate isLiked/isSaved in another step if needed

      return {
        ...feed,
        contentUrl: contentUrlFull,
        timeAgo: feedTimeCalculator(feed.createdAt),
        profileAvatar: feed.profileAvatar,
        isLiked: false, // you can set after querying UserFeedActions
        isSaved: false
      };
    });

    res.status(200).json({ message: "Feeds retrieved successfully", feeds: enrichedFeeds });
  } catch (err) {
    console.error("Error in getAllFeedsByUserId:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};




exports.getFeedsByAccountId = async (req, res) => {
  try {
    const accountId = req.accountId || req.body.accountId;
    if (!accountId) return res.status(400).json({ message: "accountId required" });

    // 1️⃣ Find corresponding userId from Account
    const account = await Account.findById(accountId).lean();
    if (!account) return res.status(404).json({ message: "Account not found" });
    const userId = account.userId;


    // 2️⃣ Get user's feed language preference
    const userLang = await UserLanguage.findOne({ userId }).lean();
    const feedLangCode = userLang?.feedLanguageCode || null;

    // 3️⃣ Get user's category preferences
    const userCat = await UserCategory.findOne({ userId }).lean();
    const excludedCategories = (userCat?.nonInterestedCategories || []).map(c => c.toString());

    // 4️⃣ Filter feeds based on language and category
    const feedFilter = {};
    if (feedLangCode) feedFilter.language = feedLangCode;
    if (excludedCategories.length) feedFilter.category = { $nin: excludedCategories };

    const feeds = await Feed.find(feedFilter).sort({ createdAt: -1 }).lean();
    if (!feeds.length) return res.status(404).json({ message: "No feeds found" });

    const feedIds = feeds.map(f => f._id);
    const accountIds = feeds.map(f => f.createdByAccount);

    // 5️⃣ Aggregate total likes, shares, downloads
    const actionsAgg = await UserFeedActions.aggregate([
      { $project: { likedFeeds: 1, downloadedFeeds: 1, sharedFeeds: 1 } },
      {
        $facet: {
          likes: [
            { $unwind: { path: "$likedFeeds", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$likedFeeds", count: { $sum: 1 } } }
          ],
          downloads: [
            { $unwind: { path: "$downloadedFeeds", preserveNullAndEmptyArrays: true } },
            { $group: { _id: "$downloadedFeeds", count: { $sum: 1 } } }
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
      (actionsAgg[0].likes || []).forEach(l => { if (l._id) likesCount[l._id.toString()] = l.count; });
      (actionsAgg[0].downloads || []).forEach(d => { if (d._id) downloadsCount[d._id.toString()] = d.count; });
      (actionsAgg[0].shares || []).forEach(s => { if (s._id) sharesCount[s._id.toString()] = s.count; });
    }

    // 6️⃣ Get current account actions
    const userActionsDoc = await UserFeedActions.findOne({ accountId }).lean();
    const likedFeedIds = (userActionsDoc?.likedFeeds || []).map(f => f.toString());
    const savedFeedIds = (userActionsDoc?.savedFeeds || []).map(f => f.toString());

    // 7️⃣ Get views count
    const viewsAgg = await UserView.aggregate([
      { $match: { feedId: { $in: feedIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } }
    ]);
    const viewsCount = {};
    viewsAgg.forEach(v => { viewsCount[v._id.toString()] = v.count });

    // 8️⃣ Get comment counts
    const commentsAgg = await UserComment.aggregate([
      { $match: { feedId: { $in: feedIds } } },
      { $group: { _id: "$feedId", count: { $sum: 1 } } }
    ]);
    const commentsCount = {};
    commentsAgg.forEach(c => { commentsCount[c._id.toString()] = c.count });

    // 9️⃣ Get Accounts → Profile Settings
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
    accountsList.forEach(acc => { accountToUserId[acc._id.toString()] = acc.userId.toString(); });

    const userIdToProfile = {};
    profiles.forEach(p => { userIdToProfile[p.userId.toString()] = p; });

    // 🔟 Build final response
    const enrichedFeeds = feeds.map(feed => {
      const fid = feed._id.toString();
      const contentUrl = feed.contentUrl ;

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
        userName: profile?.userName || "Unknown",
        profileAvatar: profile?.profileAvatar,
          
      };
    });

    res.status(200).json({ message: "Filtered feeds retrieved successfully", feeds: enrichedFeeds });

  } catch (err) {
    console.error("Error fetching filtered feeds by accountId:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};



exports.getUserHidePost = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    if (!userId) {
      return res.status(400).json({ message: "userId is required" });
    }

    // 1️⃣ Find user
    const user = await User.findById(userId, "hiddenPostIds").lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // 2️⃣ If no hidden posts
    if (!user.hiddenPostIds || user.hiddenPostIds.length === 0) {
      return res.status(200).json({
        message: "No hidden posts found",
        data: [],
      });
    }

    // 3️⃣ Fetch hidden posts
    const hiddenPosts = await Feed.find(
      { _id: { $in: user.hiddenPostIds } },
      {
        _id: 1,
        title: 1,
        content: 1,
        contentUrl: 1,
        createdAt: 1,
        createdByAccount: 1,
      }
    ).lean();

    res.status(200).json({
      message: "Hidden posts fetched successfully",
      count: hiddenPosts.length,
      data: hiddenPosts,
    });
  } catch (err) {
    console.error("Error fetching hidden posts:", err);
    res.status(500).json({
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


















