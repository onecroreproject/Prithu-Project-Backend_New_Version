const jwt = require("jsonwebtoken");
const Session = require("../models/userModels/userSession-Device/usersessionSchema");
const User = require("../models/userModels/userModel");

exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ error: "Refresh token required" });

    // Find session with this refresh token
    const session = await Session.findOne({ refreshToken });
    if (!session) return res.status(401).json({ error: "Invalid refresh token" });

    // Verify refresh token
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) return res.status(401).json({ error: "Invalid or expired refresh token" });

      const user = await User.findById(decoded.userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Generate new access token
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

      // Optionally update lastActiveAt
      session.lastSeenAt = new Date();
      await session.save();

      res.json({ accessToken });
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(500).json({ error: error.message });
  }
};




exports.heartbeat = async (req, res) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: "Session ID required" });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Update session + user activity
    session.lastSeenAt = new Date();
    session.isOnline = true;
    await session.save();

    await User.findByIdAndUpdate(session.userId, { isOnline: true });

    // (Optional) emit event to other users if needed
    const { getIO } = require("../socket");
    const io = getIO();
    if (io) io.emit("userOnline", { userId: session.userId });

    res.json({ message: "Heartbeat recorded" });
  } catch (error) {
    console.error("Heartbeat error:", error);
    res.status(500).json({ error: error.message });
  }
};


