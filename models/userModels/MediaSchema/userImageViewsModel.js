const mongoose = require("mongoose");

const imageViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    views: [
      {
        imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image", required: true },
        viewedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// Index for faster queries
imageViewSchema.index({ "views.imageId": 1 });
imageViewSchema.index({ userId: 1 });

module.exports = mongoose.model("ImageView", imageViewSchema, "ImageView");
