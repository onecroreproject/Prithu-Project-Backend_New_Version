
const admin = require('../../firebase/firebaseAdmin');
const User = require('../../models/userModels/userModel');
const AdminNotification = require("../../models/adminModels/adminNotificationSchema");
const UserNotification = require("../../models/userModels/userNotificationSchema");


// 1) Register token (save to user doc)
exports.notificationRegister= async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ message: 'token is required' });
    const userId = req.Id || req.body.userId;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const existing = user.fcmTokens.find(t => t.token === token);
    if (existing) {
      existing.platform = platform || existing.platform;
      existing.lastSeenAt = new Date();
    } else {
      user.fcmTokens.push({ token, platform });
    }
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'server error' });
  }
};




exports.adminSentNotification = async (req, res) => {
  try {
    const { target, id, title, body, data = {}, ttlSeconds = 3600 } = req.body;

    let topic;
    if (target === "allUsers") topic = "allUsers";
    else if (target === "allCreators") topic = "allCreators";
    else if (target === "user") topic = `user_${id}`;
    else if (target === "creator") topic = `creator_${id}`;
    else return res.status(400).json({ message: "invalid target" });

    const message = {
      topic,
      notification: { title, body },
      data: { ...data },
      android: { ttl: ttlSeconds * 1000 },
      webpush: { headers: { TTL: String(ttlSeconds) } },
    };

    // 1️⃣ Send push notification via FCM
    const result = await admin.messaging().send(message);

    // 2️⃣ Save to AdminNotification collection
    const adminNotificationDoc = await AdminNotification.create({
      targetType:
        target === "user"
          ? "singleUser"
          : target === "creator"
          ? "singleCreator"
          : target === "allUsers"
          ? "allUsers"
          : "allCreators",
      userId: target === "user" ? id : undefined,
      creatorId: target === "creator" ? id : undefined,
      title,
      body,
      data,
    });

    // 3️⃣ Save to UserNotification collection for relevant users
    let users = [];

    if (target === "allUsers") {
      users = await User.find({ roles: "user" }, "_id");
    } else if (target === "allCreators") {
      users = await User.find({ roles: "creator" }, "_id");
    } else if (target === "user" || target === "creator") {
      const user = await User.findById(id, "_id");
      if (user) users = [user];
    }

    const notificationsToInsert = users.map((u) => ({
      userId: u._id,
      title,
      body,
      data,
    }));

    if (notificationsToInsert.length > 0) {
      await UserNotification.insertMany(notificationsToInsert);
    }

    res.json({ ok: true, result, adminNotificationId: adminNotificationDoc._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "send error", err: err.message });
  }
};

