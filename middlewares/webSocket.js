// websocket.js
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const Session = require("../models/userModels/userSession-Device/usersessionSchema");
const User = require("../models/userModels/userModel");

let io;

function initWebSocket(server) {
  io = new Server(server, {
    cors: { origin: "*" }, // adjust to your frontend
  });

  // Middleware to verify JWT from socket handshake
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error("No token provided"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;

      // Find active session
      const session = await Session.findOne({ userId: decoded.userId, isOnline: true });
      if (!session) return next(new Error("Session not found or expired"));

      socket.sessionId = session._id;
      next();
    } catch (err) {
      next(new Error("Authentication error"));
    }
  });

  // Handle connection & disconnection
  io.on("connection", async (socket) => {
    console.log(`User connected: ${socket.userId}`);

    // Mark session & user online
    await Session.findByIdAndUpdate(socket.sessionId, {
      isOnline: true,
      lastSeenAt: new Date(),
    });
    await User.findByIdAndUpdate(socket.userId, { isOnline: true });

    // Emit online status to admin or friends
    io.emit("userOnline", { userId: socket.userId });

    // Heartbeat (optional)
    socket.on("heartbeat", async () => {
      await Session.findByIdAndUpdate(socket.sessionId, { lastSeenAt: new Date() });
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`User disconnected: ${socket.userId}`);

      // Mark session offline
      await Session.findByIdAndUpdate(socket.sessionId, {
        isOnline: false,
        lastSeenAt: new Date(),
      });

      // Check if user has other active sessions
      const activeSessions = await Session.find({ userId: socket.userId, isOnline: true });
      if (activeSessions.length === 0) {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: false,
          lastSeenAt: new Date(),
        });
      }

      // Notify admin/friends
      io.emit("userOffline", { userId: socket.userId });
    });
  });

  return io;
}

module.exports = initWebSocket;
