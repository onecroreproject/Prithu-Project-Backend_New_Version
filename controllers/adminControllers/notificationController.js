
const admin = require('../../lib/fireBaseAdmin');
const User = require('../../models/userModels/userModel');


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

// 2) Subscribe/unsubscribe token to topics (called on mode switch)
exports.switchNotification=async (req, res) => {
  try {
    const { token, subscribeTo = [], unsubscribeFrom = [] } = req.body;
    if (!token) return res.status(400).json({ message: 'token required' });

    // perform subscribe
    for (const topic of subscribeTo) {
      await admin.messaging().subscribeToTopic(token, topic);
    }
    for (const topic of unsubscribeFrom) {
      await admin.messaging().unsubscribeFromTopic(token, topic);
    }

    // persist new topic list in DB for that token
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const t = user.fcmTokens.find(x => x.token === token);
    if (t) {
      // recompute t.topics: add subscribeTo, remove unsubscribeFrom
      const set = new Set(t.topics || []);
      subscribeTo.forEach(s => set.add(s));
      unsubscribeFrom.forEach(s => set.delete(s));
      t.topics = Array.from(set);
      t.lastSeenAt = new Date();
      await user.save();
    }
    res.json({ ok: true, subscribed: subscribeTo, unsubscribed: unsubscribeFrom });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'subscribe error', err: err.message });
  }
}


exports.adminSentNotification = async (req, res) => {
  try {
    const { target, id, title, body, data = {}, ttlSeconds = 3600 } = req.body;

    let topic;
    if (target === 'allUsers') topic = 'allUsers';
    else if (target === 'allCreators') topic = 'allCreators';
    else if (target === 'user') topic = `user_${id}`;
    else if (target === 'creator') topic = `creator_${id}`;
    else return res.status(400).json({ message: 'invalid target' });

    const message = {
      topic: topic,
      notification: { title, body },
      data: { ...data },
      android: { ttl: ttlSeconds * 1000 },
      webpush: { headers: { TTL: String(ttlSeconds) } },
    };

    const result = await admin.messaging().send(message);

    res.json({ ok: true, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'send error', err: err.message });
  }
};

