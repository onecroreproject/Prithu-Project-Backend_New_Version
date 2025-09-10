const mongoose = require("mongoose");

const UserCategorySchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true, 
    index: true 
  },

  // Categories user is interested in (with timestamp)
  interestedCategories: [
    {
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Categories", required: true },
      updatedAt: { type: Date, default: Date.now }
    }
  ],

  // Categories user is NOT interested in (with timestamp)
  nonInterestedCategories: [
    {
      categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Categories", required: true },
      updatedAt: { type: Date, default: Date.now }
    }
  ],

  active: { type: Boolean, default: true }
}, { timestamps: true });

// Ensure uniqueness per user
UserCategorySchema.index({ userId: 1 }, { unique: true });

module.exports = mongoose.model("UserCategory", UserCategorySchema, "UserCategorys");
