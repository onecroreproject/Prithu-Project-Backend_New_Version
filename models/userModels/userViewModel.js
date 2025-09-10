const mongooser=require("mongoose")
const UserViewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }, // allow anonymous
    feedId: { type: mongoose.Schema.Types.ObjectId, ref: "Feed", required: true },
    watchDuration: { type: Number, default: 0 }, // seconds or ms
    viewedAt: { type: Date, default: Date.now }, // ✅ timestamp
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserView", UserViewSchema, "UserViews");