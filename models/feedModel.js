const mongoose = require("mongoose");

const feedSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // image/video
    language: { type: String, required: true },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Categories",
      required: true,
    },

    duration: { type: Number, default: null },
    contentUrl: { type: String, required: true },

    dec: { type: String }, // HTML description

    cloudinaryId: { type: String },
    fileHash: { type: String, index: true },

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

    // 🌈 Precomputed Theme Color (major performance upgrade)
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

    // 🔥 Precomputed Stats reference (1 lookup only)
    statsId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FeedStats",
      index: true,
    },

    // Scheduling
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

// 🚀 PERFORMANCE INDEXES
feedSchema.index({ createdAt: -1 });
feedSchema.index({ createdByAccount: 1 });
feedSchema.index({ roleRef: 1 });
feedSchema.index({ category: 1 });
feedSchema.index({ isScheduled: 1, scheduleDate: 1 });
feedSchema.index({ fileHash: 1 });
feedSchema.index({ language: 1 });

module.exports = mongoose.model("Feed", feedSchema, "Feeds");
