const mongoose = require("mongoose");
const { prithuDB } = require("../database");

const feedSchema = new mongoose.Schema(
  {
    // image | video
    type: { type: String, required: true },

    language: { type: String },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categories",
      required: true,
    },

    // Video duration (if video)
    duration: { type: Number, default: null },

    // Public URL of stored file
    contentUrl: { type: String, required: true },

    // Local filename for deletion / update
    localFilename: { type: String },

    // Optional: absolute local path
    localPath: { type: String },

    // Description
    dec: { type: String },

    // CLOUDINARY — remove this completely
    // cloudinaryId: { type: String },

    // Duplicate detection hash
    fileHash: { type: String, index: true },

    // Creator
    createdByAccount: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "roleRef",
      required: true,
      index: true,
    },

    roleRef: {
      type: String,
      enum: ["Admin", "Child_Admin", "User"],
      default: "User",
      index: true,
    },

    // Precomputed colors
    themeColor: {
      primary: { type: String, default: "#ffffff" },
      secondary: { type: String, default: "#cccccc" },
      accent: { type: String, default: "#999999" },
      gradient: {
        type: String,
        default: "linear-gradient(135deg, #ffffff, #cccccc, #999999)",
      },
      text: { type: String, default: "#000000" },
    },

    hashtags: [{ type: String, index: true }],

    // Stats
    statsId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedStats",
      index: true,
    },

    // Scheduling support
    isScheduled: { type: Boolean, default: false },
    scheduleDate: { type: Date, default: null, index: true },

    status: {
      type: String,
      enum: ["Pending", "Published", "Draft"],
      default: "Published",
    },
  },
  { timestamps: true }
);

feedSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// PERFORMANCE INDEXES
feedSchema.index({ createdAt: -1 });
feedSchema.index({ createdByAccount: 1 });
feedSchema.index({ roleRef: 1 });
feedSchema.index({ category: 1 });
feedSchema.index({ isScheduled: 1, scheduleDate: 1 });
feedSchema.index({ fileHash: 1 });
feedSchema.index({ language: 1 });
feedSchema.index({ hashtags: 1 });

module.exports = prithuDB.model("Feed", feedSchema, "Feeds");
