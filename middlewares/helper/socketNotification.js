const { getIO } = require("../webSocket");
const { sendFCMNotification } = require("./fcmNotificationhelper");
const Notification = require("../../models/notificationModel");
const User = require("../../models/userModels/userModel");
const ProfileSettings = require("../../models/profileSettingModel");

// 🔹 Emit socket event safely
exports.broadcastNotification = (receiverId, payload) => {
  try {
    const io = getIO();
    if (io) io.to(receiverId).emit("notification:new", payload);
  } catch (err) {
    console.error("Socket broadcast error:", err.message);
  }
};

// 🔹 Push notification to all registered devices
exports.pushFCMToUser = async (user, title, message, image) => {
  try {
    if (!user.fcmTokens?.length) return;
    await Promise.all(
      user.fcmTokens
        .filter(t => t?.token)
        .map(t => sendFCMNotification(t.token, title, message, image))
    );
  } catch (err) {
    console.error("FCM push error:", err.message);
  }
};

// 🔹 Create and send notification
exports.createAndSendNotification = async ({
  senderId,
  receiverId,
  type,
  title,
  message,
  entityId,
  entityType,
  image = "",
}) => {
  try {
    if (!receiverId || senderId?.toString() === receiverId?.toString()) return; // Skip self notifications

    // Fetch sender profile info
    const senderProfile = await ProfileSettings.findOne({ userId: senderId })
      .select("userName profileAvatar")
      .lean();

    const notification = await Notification.create({
      senderId,
      receiverId,
      type,
      title,
      message,
      entityId,
      entityType,
      image,
      isRead: false,
    });

    // Get receiver (for FCM)
    const receiver = await User.findById(receiverId).lean();
    if (receiver) {
      await exports.pushFCMToUser(receiver, title, message, image);
    }

    // Real-time socket emit
    exports.broadcastNotification(receiverId.toString(), {
      _id: notification._id,
      senderId,
      receiverId,
      type,
      title,
      message,
      image,
      createdAt: notification.createdAt,
      senderProfile: {
        userName: senderProfile?.userName || "Unknown User",
        avatar: senderProfile?.profileAvatar || "",
      },
    });

  } catch (err) {
    console.error("❌ Error creating notification:", err);
  }
};
