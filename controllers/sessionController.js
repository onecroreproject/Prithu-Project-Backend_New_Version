const jwt = require("jsonwebtoken");
const Session = require("../models/userModels/userSession-Device/usersessionSchema");
const User = require("../models/userModels/userModel");
const { getIO } = require("../middlewares/webSocket"); // Ensure this correctly exports from your socket setup

// 🔄 Refresh Access Token
exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken)
      return res.status(400).json({ error: "Refresh token required" });

    // 🔍 Find session with this refresh token
    const session = await Session.findOne({ refreshToken });
    if (!session)
      return res.status(401).json({ error: "Invalid refresh token" });

    // 🔐 Verify refresh token
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err)
        return res.status(401).json({ error: "Invalid or expired refresh token" });

      const user = await User.findById(decoded.userId);
      if (!user)
        return res.status(404).json({ error: "User not found" });

      // 🎟️ Generate new access token
      const accessToken = jwt.sign(
        {
          userName: user.userName,
          userId: user._id,
          role: user.role,
          referralCode: user.referralCode,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // 🕒 Update session activity
      session.lastSeenAt = new Date();
      session.isOnline = true;
      await session.save();

      // 🟢 Update user status
      await User.findByIdAndUpdate(user._id, { isOnline: true });

      // 📡 Notify all clients via WebSocket
      const io = getIO();
      if (io) io.emit("userOnline", { userId: user._id });

      res.json({ accessToken });
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: error.message });
  }
};

// 💓 Heartbeat (called periodically to confirm user is active)
exports.heartbeat = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId)
      return res.status(400).json({ error: "Session ID required" });

    const session = await Session.findById(sessionId);
    if (!session)
      return res.status(404).json({ error: "Session not found" });

    // 🕒 Update session + mark as online
    session.lastSeenAt = new Date();
    session.isOnline = true;
    await session.save();

    // 🟢 Update user online status
    await User.findByIdAndUpdate(session.userId, { isOnline: true });

    // 📡 Emit WebSocket event to all connected clients
    const io = getIO();
    if (io) io.emit("userOnline", { userId: session.userId });

    res.json({ message: "Heartbeat recorded" });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ error: error.message });
  }
};
