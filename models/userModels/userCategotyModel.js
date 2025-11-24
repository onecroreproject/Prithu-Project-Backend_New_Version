const mongoose = require("mongoose");

const UserCategorySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
      unique: true,
    },

    /**
     * 🚀 FAST lists with only ObjectIds
     * No extra objects → faster queries, less document size
     */
    interestedCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Categories", index: true }
    ],

    nonInterestedCategories: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Categories", index: true }
    ],

    /**
     * ⚡ OPTIONAL: Track updated times WITHOUT storing large objects
     * Key → categoryId
     * Value → timestamp
     */
    updatedAtMap: {
      type: Map,
      of: Date,
      default: {},
    },

    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/**
 * Extra index → high performance when filtering categories
 */
UserCategorySchema.index({ interestedCategories: 1 });
UserCategorySchema.index({ nonInterestedCategories: 1 });

module.exports = mongoose.model(
  "UserCategory",
  UserCategorySchema,
  "UserCategorys"
);
