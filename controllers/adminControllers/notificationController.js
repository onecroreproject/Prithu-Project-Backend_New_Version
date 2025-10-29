const Notification = require("../../models/notificationModel");
const User = require("../../models/userModels/userModel");
const { broadcastNotification, pushFCMToUser } = require("../../middlewares/helper/socketNotification");

// 🔹 1️⃣ ADMIN → ALL USERS
exports.sendAdminNotification = async (req, res) => {
  try {
    const { title, message, image, adminId: adminIdFromBody } = req.body;
    const adminId = req.Id || adminIdFromBody;

    if (!adminId) return res.status(400).json({ error: "Admin ID missing" });
    if (!title || !message) return res.status(400).json({ error: "Title and message are required" });

    const users = await User.find({}, "_id fcmTokens platform");
    if (!users.length) return res.status(404).json({ message: "No users found to notify" });

    // Create notifications in bulk
    const notifications = users.map((u) => ({
      senderId: adminId,
      senderRoleRef: "Admin",
      receiverId: u._id,
      receiverRoleRef: "User",
      type: "ADMIN_ANNOUNCEMENT",
      title,
      message,
      image:
        "https://res.cloudinary.com/dzp2c7ed9/image/upload/v1760440686/feeds/images/gs6sr8k6ofthrbrqmvx9.jpg",
      platform: u.platform || "WEB",
    }));

    await Notification.insertMany(notifications);

    // Real-time + Push delivery
    for (const u of users) {
      broadcastNotification(u._id.toString(), { title, message, image });
      await pushFCMToUser(u, title, message, image);
    }

    res.status(200).json({ success: true, message: "✅ Admin notifications sent to all users" });
  } catch (err) {
    console.error("❌ Error sending admin notification:", err);
    res.status(500).json({ error: "Failed to send notifications" });
  }
};

// 🔹 2️⃣ USER → USER / ADMIN
exports.sendUserNotification = async (req, res) => {
  try {
    const { receiverId, type, title, message, image, entityId, entityType } = req.body;
    const senderId = req.Id;
    const senderRoleRef = req.role === "Admin" ? "Admin" : "User";

    const receiver = await User.findById(receiverId);
    if (!receiver) return res.status(404).json({ error: "Receiver not found" });
    const receiverRoleRef = receiver.role === "Admin" ? "Admin" : "User";

    const notification = await Notification.create({
      senderId,
      senderRoleRef,
      receiverId,
      receiverRoleRef,
      type,
      title,
      message,
      image,
      entityId,
      entityType,
      platform: receiver.platform || "WEB",
    });

    // Real-time + Push
    broadcastNotification(receiverId.toString(), notification);
    await pushFCMToUser(receiver, title, message, image);

    res.status(200).json({ success: true, message: "✅ Notification sent", notification });
  } catch (err) {
    console.error("❌ Error sending user notification:", err);
    res.status(500).json({ error: "Failed to send notification" });
  }
};


exports.getNotifications = async (req, res) => {
  try {
    const receiverId = req.Id;
    const receiverRole = req.role; 

    if (!receiverId || !receiverRole) {
      return res.status(400).json({ error: "Invalid token or missing role." });
    }

    // 🔹 Fetch notifications matching the logged-in user and role
    const notifications = await Notification.find({
      receiverId,
      receiverRoleRef: receiverRole,
    })
      .sort({ createdAt: -1 })
      .populate({
        path: "senderUserProfile senderAdminProfile senderChildAdminProfile feedInfo",
      });

    // 🧠 Format and unify sender info
    const formatted = notifications.map((n) => {
      const senderProfile =
        n.senderUserProfile ||
        n.senderAdminProfile ||
        n.senderChildAdminProfile;

      return {
        _id: n._id,
        title: n.title,
        message: n.message,
        image: n.image,
        isRead: n.isRead,
        type: n.type,
        createdAt: n.createdAt,
        sender: senderProfile
          ? {
              userName: senderProfile.userName,
              displayName: senderProfile.displayName,
              profileAvatar: senderProfile.profileAvatar,
            }
          : null,
        feedInfo: n.feedInfo || null,
      };
    });

    res.json({
      success: true,
      role: receiverRole,
      notifications: formatted,
    });
  } catch (err) {
    console.error("❌ getNotifications error:", err);
    res.status(500).json({ error: "Failed to get notifications" });
  }
};


// 🔹 4️⃣ MARK SINGLE NOTIFICATION AS READ
exports.markNotificationAsRead = async (req, res) => {
  try {
    const userId = req.Id;
    const role = req.role; // 'User' | 'Admin' | 'ChildAdmin'
    const { notificationId } = req.body;

    if (!notificationId)
      return res.status(400).json({ error: "Notification ID is required" });

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, receiverId: userId, receiverRoleRef: role },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification)
      return res.status(404).json({ error: "Notification not found or not authorized" });

    // 🔔 Real-time update
    broadcastNotification(userId.toString(), { type: "read", notificationId });

    res.json({ success: true, message: "✅ Notification marked as read", notification });
  } catch (err) {
    console.error("❌ Error marking notification as read:", err);
    res.status(500).json({ error: "Failed to mark notification as read" });
  }
};


// 🔹 2️⃣ MARK ALL NOTIFICATIONS AS READ (Based on Role)
exports.markAllRead = async (req, res) => {
  try {
    const userId = req.Id;
    const role = req.role;

    const result = await Notification.updateMany(
      { receiverId: userId, receiverRoleRef: role, isRead: false },
      { $set: { isRead: true } }
    );

    broadcastNotification(userId.toString(), { type: "read_all" });

    res.json({
      success: true,
      message: `✅ ${result.modifiedCount} notifications marked as read for ${role}`,
    });
  } catch (err) {
    console.error("❌ Error marking all as read:", err);
    res.status(500).json({ error: "Failed to mark all notifications as read" });
  }
};

// 🔹 3️⃣ SAVE OR UPDATE FCM TOKEN (Role-Aware)
exports.saveToken = async (req, res) => {
  try {
    const userId = req.Id;
    const role = req.role; // 'User' | 'Admin' | 'ChildAdmin'
    const { token, platform, topics = [] } = req.body;

    if (!userId || !token || !platform)
      return res.status(400).json({ message: "userId, token, and platform are required." });

    let model;
    if (role === "Admin") model = Admin;
    else if (role === "ChildAdmin") model = ChildAdmin;
    else model = User;

    const account = await model.findById(userId);
    if (!account) return res.status(404).json({ message: `${role} not found.` });

    const existingTokenIndex = account.fcmTokens.findIndex((t) => t.token === token);

    if (existingTokenIndex !== -1) {
      account.fcmTokens[existingTokenIndex].platform = platform;
      account.fcmTokens[existingTokenIndex].topics = topics;
      account.fcmTokens[existingTokenIndex].lastSeenAt = new Date();
    } else {
      account.fcmTokens.push({ token, platform, topics, lastSeenAt: new Date() });
    }

    await account.save();
    res.json({ success: true, message: `✅ FCM token saved successfully for ${role}.` });
  } catch (error) {
    console.error("❌ Error saving FCM token:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};




exports.deleteNotification = async (req, res) => {
  try {
    const userId = req.Id;
    const { notificationId } = req.body;

    if (!notificationId)
      return res.status(400).json({ error: "Notification ID required" });

    const deleted = await Notification.findOneAndDelete({
      _id: notificationId,
      receiverId: userId,
    });

    if (!deleted)
      return res.status(404).json({ error: "Notification not found" });

    res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error("deleteNotification Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 🔸 Clear all notifications of a user
exports.clearAllNotifications = async (req, res) => {
  try {
    const userId = req.Id;
    await Notification.deleteMany({ receiverId: userId });

    res.status(200).json({ success: true, message: "All notifications cleared" });
  } catch (error) {
    console.error("clearAllNotifications Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
