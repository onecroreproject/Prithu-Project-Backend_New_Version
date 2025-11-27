const mongoose = require("mongoose");
const {prithuDB}=require("../../database");


const UserViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    feedId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Feed", 
      required: true 
    },

    watchDuration: { type: Number, default: 0 },

    viewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

/* --------------------------------------------
   🚀 PERFORMANCE INDEXES
--------------------------------------------- */

// 1️⃣ Count views for a feed VERY FAST
UserViewSchema.index({ feedId: 1 });

// 2️⃣ Track unique viewers (optional)
UserViewSchema.index({ userId: 1, feedId: 1 });

// 3️⃣ Get latest views for a feed fast
UserViewSchema.index({ feedId: 1, viewedAt: -1 });

// 4️⃣ Analytics: track user’s watch history
UserViewSchema.index({ userId: 1, viewedAt: -1 });

module.exports = prithuDB.model("UserView", UserViewSchema, "UserViews");
