const mongoose = require("mongoose");

const UserFeedActionsSchema = new mongoose.Schema(
  {
    // Either userId OR accountId will be present
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },

    // Track Likes
    likedFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", index: true },
        likedAt: { type: Date, default: Date.now },
      }
    ],

    // Track Saved
    savedFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", index: true },
        savedAt: { type: Date, default: Date.now },
      },
    ],

    // Track Downloads
    downloadedFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", index: true },
        downloadedAt: { type: Date, default: Date.now },
      },
    ],

    // Track Dislikes
    disLikeFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", index: true },
        dislikedAt: { type: Date, default: Date.now },
      },
    ],

    // Track Shares
    sharedFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", index: true },
        shareChannel: {
          type: String,
          enum: [
            "whatsapp",
            "facebook",
            "twitter",
            "instagram",
            "linkedin",
            "email",
            "copy_link",
            "other",
          ],
        },
        shareTarget: String,
        sharedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

/**
 * UNIQUE INDEXES — ensures 1 document per user
 */
UserFeedActionsSchema.index({ userId: 1 }, { unique: true, sparse: true });
UserFeedActionsSchema.index({ accountId: 1 }, { unique: true, sparse: true });

/**
 * HIGH-PERFORMANCE INDEXES FOR FAST QUERIES
 * Needed for $lookup performance in feed aggregation
 */
UserFeedActionsSchema.index({ "likedFeeds.feedId": 1 });
UserFeedActionsSchema.index({ "savedFeeds.feedId": 1 });
UserFeedActionsSchema.index({ "downloadedFeeds.feedId": 1 });
UserFeedActionsSchema.index({ "disLikeFeeds.feedId": 1 });
UserFeedActionsSchema.index({ "sharedFeeds.feedId": 1 });

module.exports = mongoose.model(
  "UserFeedActions",
  UserFeedActionsSchema,
  "UserFeedActions"
);
