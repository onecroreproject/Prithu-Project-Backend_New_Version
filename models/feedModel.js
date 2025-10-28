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
    dec: { type: String },

    cloudinaryId: { type: String },
    fileHash: { type: String, index: true },

    createdByAccount: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "roleRef",
      required: true,
    },
    roleRef: {
      type: String,
      enum: ["Admin", "Child_Admin", "User"],
      default: "User",
    },

  
    isScheduled: { type: Boolean, default: false },
    scheduleDate: { type: Date, default: null },
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

module.exports = mongoose.model("Feed", feedSchema, "Feeds");
