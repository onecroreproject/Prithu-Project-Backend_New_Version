const jwt = require("jsonwebtoken");
const Session = require("../models/userModels/userSession-Device/sessionModel");
const User = require("../models/userModels/userModel");
const { getIO } = require("../middlewares/webSocket");
const Device =require("../models/userModels/userSession-Device/deviceModel"); // Ensure this correctly exports from your socket setup

// 🔄 Refresh Access Token
exports.refreshAccessToken = async (req, res) => {
  try {
    const { refreshToken, deviceId, os, browser, deviceType } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    if (!deviceId) {
      return res.status(400).json({ error: "Device ID required" });
    }

    console.log("🔁 Refresh Token Request:", { refreshToken, deviceId });

    // 1️⃣ Find active session for this device
    const session = await Session.findOne({ refreshToken }).populate("deviceId");
    if (!session) {
      return res.status(401).json({ error: "Invalid session or refresh token" });
    }

    // 2️⃣ Verify refresh token validity
    jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET, async (err, decoded) => {
      if (err) {
        console.warn("⚠️ Invalid or expired refresh token");
        return res.status(401).json({ error: "Invalid or expired refresh token" });
      }

      const user = await User.findById(decoded.userId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // 3️⃣ Issue new access token
      const accessToken = jwt.sign(
        {
          userName: user.userName,
          userId: user._id,
          role: "User",
          referralCode: user.referralCode,
        },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // 4️⃣ Update Session info
      session.isOnline = true;
      session.lastSeenAt = new Date();
      await session.save();

      // 5️⃣ Update Device info (keep accurate OS/browser/session presence)
      let device = await Device.findOne({ userId: user._id, deviceId });

      const deviceName = `${os || device?.os || "Unknown OS"} - ${browser || device?.browser || "Unknown Browser"}`;

      if (device) {
        device.os = os || device.os;
        device.browser = browser || device.browser;
        device.deviceType = deviceType || device.deviceType;
        device.deviceName = deviceName;
        device.isOnline = true;
        device.lastActiveAt = new Date();
        await device.save();
      } else {
        // Create if missing (edge case — e.g., refresh from new browser)
        device = await Device.create({
          userId: user._id,
          deviceId,
          os: os || "Unknown OS",
          browser: browser || "Unknown Browser",
          deviceType: deviceType || "web",
          deviceName,
          ipAddress: req.ip,
          isOnline: true,
          lastActiveAt: new Date(),
        });
      }

      // 6️⃣ Update User status
      await User.findByIdAndUpdate(user._id, {
        isOnline: true,
        lastSeenAt: new Date(),
      });

      // 7️⃣ Notify via WebSocket
      const io = getIO();
      if (io) io.emit("userOnline", { userId: user._id });

      console.log(`✅ Token refreshed for user ${user.userName} (${device.deviceName})`);

      // 8️⃣ Return updated tokens + session info
      return res.json({
        success: true,
        message: "Access token refreshed successfully",
        accessToken,
        userId: user._id,
        deviceId: device.deviceId,
        deviceType: device.deviceType,
        deviceName: device.deviceName,
        os: device.os,
        browser: device.browser,
      });
    });
  } catch (error) {
    console.error("❌ Refresh token error:", error);
    return res.status(500).json({ error: error.message });
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



// controllers/sessionController.js
exports.userPresence = async (req, res) => {
  try {
   const userId=req.Id;
    const { sessionId, isOnline } = req.body;
    if (!userId || !sessionId)
      return res.status(400).json({ error: "userId and sessionId required" });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ error: "Session not found" });

    session.isOnline = isOnline;
    session.lastSeenAt = new Date();
    await session.save();

    await User.findByIdAndUpdate(userId, {
      isOnline,
      lastSeenAt: new Date(),
    });

    const io = getIO();
    io.emit(isOnline ? "userOnline" : "userOffline", { userId });

    res.json({ success: true, isOnline });
  } catch (err) {
    console.error("userPresence Error:", err);
    res.status(500).json({ error: err.message });
  }
};
