const mongoose = require("mongoose");
const {prithuDB}=require("../../../database");


const imageViewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },

    imageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Image",
      required: true,
      index: true
    },

    viewedAt: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  { timestamps: true }
);

// Compound index for fastest analytics queries
imageViewSchema.index({ userId: 1, imageId: 1 });
imageViewSchema.index({ imageId: 1, viewedAt: -1 }); // For recent viewers
imageViewSchema.index({ userId: 1, viewedAt: -1 }); // For user history

module.exports = prithuDB.model("UserImageView", imageViewSchema, "UserImageView");
