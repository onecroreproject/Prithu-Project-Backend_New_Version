const mongoose = require("mongoose");

const UserFeedActionsSchema = new mongoose.Schema(
  {
    // Either userId OR accountId will be present
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },

    // ✅ Track likes with timestamp
    likedFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed" },
        likedAt: { type: Date, default: Date.now },
      }
    ],

    // ✅ Track saved feeds with timestamp
    savedFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed" },
        savedAt: { type: Date, default: Date.now },
      },
    ],

    // ✅ Track downloads with timestamp
    downloadedFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed" },
        downloadedAt: { type: Date, default: Date.now },
      },
    ],

    // ✅ Track shares with timestamp + channel
    sharedFeeds: [
      {
        feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed" },
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
        shareTarget: { type: String }, // optional: group, timeline, direct, etc.
        sharedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

/**
 * ✅ Indexing for performance & uniqueness
 * - Either userId or accountId must be unique separately
 */
UserFeedActionsSchema.index({ userId: 1 }, { unique: true, sparse: true });
UserFeedActionsSchema.index({ accountId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model(
  "UserFeedActions",
  UserFeedActionsSchema,
  "UserFeedActions"
);
