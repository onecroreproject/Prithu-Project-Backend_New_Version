const mongoose = require("mongoose");
const Feed = require("../models/feedModel");
const VideoStats = require("../models/userModels/MediaSchema/videoViewStatusModel");
const ImageStats = require("../models/userModels/MediaSchema/imageViewModel");
const UserFeedActions = require("../models/userFeedInterSectionModel");
const CreatorFollower = require("../models/creatorFollowerModel");
const ProfileSettings = require("../models/profileSettingModel");
const TrendingCreators = require("../models/treandingCreators");

async function computeTrendingCreators() {
  try {

    // Define time window for "trending" (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

   const trendingCreators = await Feed.aggregate([
  { $match: { createdAt: { $gte: sevenDaysAgo } } },

  // Group feeds by creator
  { $group: { _id: "$createdByAccount", feedIds: { $push: "$_id" }, feedTypes: { $push: "$type" } } },

  // Lookup VideoStats only for feeds that are videos
  {
    $lookup: {
      from: "VideoStats",
      let: { feedIds: "$feedIds", feedTypes: "$feedTypes" },
      pipeline: [
        { $match: { $expr: { $and: [
          { $in: ["$videoId", "$$feedIds"] }
        ] } } },
      ],
      as: "videoStats",
    },
  },
  { $addFields: { totalVideoViews: { $sum: "$videoStats.totalViews" } } },

  // Lookup ImageStats only for feeds that are images
  {
    $lookup: {
      from: "ImageStats",
      let: { feedIds: "$feedIds", feedTypes: "$feedTypes" },
      pipeline: [
        { $match: { $expr: { $and: [
          { $in: ["$imageId", "$$feedIds"] }
        ] } } },
      ],
      as: "imageStats",
    },
  },
  { $addFields: { totalImageViews: { $sum: "$imageStats.totalViews" } } },

  // Likes for all feeds
  {
    $lookup: {
      from: "UserFeedActions",
      let: { feedIds: "$feedIds" },
      pipeline: [
        { $unwind: "$likedFeeds" },
        { $match: { $expr: { $in: ["$likedFeeds.feedId", "$$feedIds"] } } },
        { $group: { _id: null, totalLikes: { $sum: 1 } } },
      ],
      as: "likeActions",
    },
  },
  { $addFields: { totalLikes: { $arrayElemAt: ["$likeActions.totalLikes", 0] } } },

  // Shares for all feeds
  {
    $lookup: {
      from: "UserFeedActions",
      let: { feedIds: "$feedIds" },
      pipeline: [
        { $unwind: "$sharedFeeds" },
        { $match: { $expr: { $in: ["$sharedFeeds.feedId", "$$feedIds"] } } },
        { $group: { _id: null, totalShares: { $sum: 1 } } },
      ],
      as: "shareActions",
    },
  },
  { $addFields: { totalShares: { $arrayElemAt: ["$shareActions.totalShares", 0] } } },

  // Followers
  {
    $lookup: {
      from: "CreatorFollowers",
      localField: "_id",
      foreignField: "creatorId",
      as: "followers",
    },
  },
  {
    $addFields: {
      followerCount: {
        $cond: [
          { $gt: [{ $size: "$followers" }, 0] },
          { $size: { $arrayElemAt: ["$followers.followerIds", 0] } },
          0,
        ],
      },
    },
  },

  // Compute trending score
  {
    $addFields: {
      trendingScore: {
          $round: [
        {
          $add: [
            { $multiply: [{ $ifNull: ["$totalVideoViews", 0] }, 0.3] },
            { $multiply: [{ $ifNull: ["$totalImageViews", 0] }, 0.2] },
            { $multiply: [{ $ifNull: ["$totalLikes", 0] }, 0.2] },
            { $multiply: [{ $ifNull: ["$totalShares", 0] }, 0.2] },
            { $multiply: [{ $ifNull: ["$followerCount", 0] }, 0.1] },
          ]
        },
        0
      ]
      },
    },
  },

  // Profile lookup
  {
    $lookup: {
      from: "ProfileSettings",
      localField: "_id",
      foreignField: "accountId",
      as: "profile",
    },
  },
  {
    $addFields: {
      userName: { $arrayElemAt: ["$profile.userName", 0] },
      profileAvatar: { $arrayElemAt: ["$profile.profileAvatar", 0] },
    },
  },

  // Sort top 50
  { $sort: { trendingScore: -1 } },
  { $limit: 50 },
]);





    // Save/update results in TrendingCreators collection
    for (let creator of trendingCreators) {
     
     await TrendingCreators.findOneAndUpdate(
        { accountId: creator._id },
        {
          userName: creator.userName,
          profileAvatar: creator.profileAvatar,
          trendingScore: creator.trendingScore,
          totalVideoViews: creator.totalVideoViews || 0,
          totalImageViews: creator.totalImageViews || 0,
          totalLikes: creator.totalLikes || 0,
          totalShares: creator.totalShares || 0,
          followerCount: creator.followerCount || 0,
          lastUpdated: new Date(),
        },
        { upsert: true }
      );
    }
        
 
  } catch (err) {
    console.error("Error computing trending creators:", err);
  }
}

module.exports = computeTrendingCreators;
