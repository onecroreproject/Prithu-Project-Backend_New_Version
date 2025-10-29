const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/userModels/userModel");
const Session = require("../models/userModels/userSession-Device/usersessionSchema");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // ✅ allow frontend clients
      methods: ["GET", "POST"],
    },
    transports: ["websocket"], // 🚀 Fast & stable
  });

  // 🔐 Middleware: Verify JWT from socket auth
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      console.log("⚠️ Socket auth error:", err.message);
      next(new Error("Invalid or expired token"));
    }
  });

  // 🎯 On new connection
  io.on("connection", async (socket) => {
    console.log("✅ Socket connected:", socket.userId, socket.id);

    // ➕ Join user-specific room
    socket.join(socket.userId);

    // 🟢 Mark user and session online
    await User.findByIdAndUpdate(socket.userId, { isOnline: true });
    await Session.updateMany({ userId: socket.userId }, { isOnline: true });

    // 🔔 Broadcast online event
    io.emit("userOnline", { userId: socket.userId });

    // 📨 Handle "markAsRead" from frontend
    socket.on("markAsRead", (userId) => {
      console.log(`📩 Notifications marked as read by ${userId}`);
      io.to(userId).emit("notificationRead", { userId });
    });

    // ❌ Handle disconnect
    socket.on("disconnect", async (reason) => {
      console.log("❌ Disconnected:", socket.userId, reason);
      await User.findByIdAndUpdate(socket.userId, { isOnline: false });
      await Session.updateMany({ userId: socket.userId }, { isOnline: false });
      io.emit("userOffline", { userId: socket.userId });
    });
  });

  console.log("🚀 Socket.io initialized");
};

/**
 * ✅ Helper to send notification to a specific user in real-time
 * @param {String} userId - The target user's ID
 * @param {Object} notification - The notification object
 */
const sendNotification = (userId, notification) => {
  if (!io) return console.error("❌ Socket.io not initialized");
  console.log(`📢 Sending real-time notification to ${userId}`);
  io.to(userId).emit("newNotification", notification);
};

module.exports = {
  initSocket,
  getIO: () => io,
  sendNotification,
};
