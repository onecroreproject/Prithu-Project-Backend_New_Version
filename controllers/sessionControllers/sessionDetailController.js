
const Device = require("../../models/userModels/userSession-Device/deviceModel");
const jwt = require('jsonwebtoken');


exports.verifyToken = async (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1]; // Bearer TOKEN
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    // 1️⃣ Verify access token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 2️⃣ Attach user & device info
    req.user = decoded; // contains { userId, role, userName, ... }

    // Optional: Verify device session (if you're tracking by device)
    const deviceId = req.headers["x-device-id"]; // frontend should send this
    if (deviceId) {
      const device = await Device.findOne({ userId: decoded.userId, deviceId });
      if (!device) {
        return res.status(403).json({ message: "Invalid device session" });
      }
      req.device = device;
    }

    next();
  } catch (err) {
    // 3️⃣ Handle expired token
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    res.status(403).json({ message: "Invalid token" });
  }
};



exports.refreshToken = async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(401).json({ message: "No token provided" });

  try {
    // 1️⃣ Find user with this refresh token
    const user = await User.findOne({ refreshToken: token });
    if (!user) return res.status(403).json({ message: "Invalid refresh token" });

    // 2️⃣ Verify refresh token
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    // 3️⃣ Generate new access + refresh tokens
    const newAccessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const newRefreshToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "30d" }
    );

    // 4️⃣ Update DB with new refresh token (invalidate old one)
    user.refreshToken = newRefreshToken;
    await user.save();

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired refresh token" });
  }
};
