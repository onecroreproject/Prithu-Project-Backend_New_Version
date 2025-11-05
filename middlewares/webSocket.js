const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/userModels/userModel");
const Session = require("../models/userModels/userSession-Device/sessionModel");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // ✅ Allow all frontend origins (change in prod)
      methods: ["GET", "POST"],
    },
    transports: ["websocket"], // 🚀 Fast and stable transport
  });

  // 🔐 Middleware to verify JWT
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const sessionId = socket.handshake.auth?.sessionId;

    if (!token) return next(new Error("No token provided"));
    if (!sessionId) return next(new Error("Session ID missing"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.sessionId = sessionId;
      next();
    } catch (err) {
      console.log("⚠️ Socket auth error:", err.message);
      next(new Error("Invalid or expired token"));
    }
  });

  // 🎯 When a user connects
  io.on("connection", async (socket) => {
    console.log(`✅ User connected: ${socket.userId} | session: ${socket.sessionId}`);

    // ➕ Join personal room
    socket.join(socket.userId);

    // 🟢 Mark specific session as online
    await Session.findByIdAndUpdate(socket.sessionId, {
      isOnline: true,
      lastSeenAt: new Date(),
    });

    // 🟢 Mark user as online (if not already)
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeenAt: new Date(),
    });

    // 🔔 Notify all clients that user is online
    io.emit("userOnline", { userId: socket.userId });

    // 🫀 Heartbeat from client (keep alive)
    socket.on("heartbeat", async () => {
      await Session.findByIdAndUpdate(socket.sessionId, {
        lastSeenAt: new Date(),
        isOnline: true,
      });
    });

    // 📨 Handle “markAsRead”
    socket.on("markAsRead", (userId) => {
      console.log(`📩 Notifications marked as read by ${userId}`);
      io.to(userId).emit("notificationRead", { userId });
    });

    // ❌ When a user disconnects
    socket.on("disconnect", async (reason) => {
      console.log(`❌ Disconnected: ${socket.userId} | session: ${socket.sessionId}`);

      // 1️⃣ Mark the current session offline
      await Session.findByIdAndUpdate(socket.sessionId, {
        isOnline: false,
        lastSeenAt: new Date(),
      });

      // 2️⃣ Check if the user still has any online sessions
      const activeSessions = await Session.find({
        userId: socket.userId,
        isOnline: true,
      });

      if (activeSessions.length === 0) {
        // 🟥 Mark user offline globally
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeenAt: new Date(),
        });
        io.emit("userOffline", { userId: socket.userId });
      } else {
        console.log(`🟡 User ${socket.userId} still has ${activeSessions.length} active session(s).`);
      }
    });
  });

  console.log("🚀 Socket.io initialized successfully");
};

/**
 * ✅ Helper to send notification to a specific user
 */
const sendNotification = (userId, notification) => {
  if (!io) return console.error("❌ Socket.io not initialized");
  console.log(`📢 Sending real-time notification to ${userId}`);
  io.to(userId).emit("newNotification", notification);
};

/**
 * ✅ Export getIO to access socket instance elsewhere
 */
module.exports = {
  initSocket,
  getIO: () => io,
  sendNotification,
};
