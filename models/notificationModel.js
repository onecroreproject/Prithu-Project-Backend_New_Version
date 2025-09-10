
const mongoose =require ("mongoose");

const NotificationSchema = new mongoose.Schema({
  to: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  type: { type: String, enum: ["ADMIN_MESSAGE","NEW_FEED","LIKE","DOWNLOAD","SHARE"] },
  data: {},
  seen: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.model("Notification", NotificationSchema,"Notifications");
