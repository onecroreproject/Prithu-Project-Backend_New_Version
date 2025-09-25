const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require('../../models/userModels/userModel');
const Device = require("../../models/userModels/userSession-Device/deviceModel");

module.exports = function (server) {
  const io = new Server(server, {
    cors: { origin: "*" },
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  // Track sockets per user
  const userSockets = new Map();

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = {
        id: decoded.id,
        role: decoded.role,
        userName: decoded.userName,
      };
      next();
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        return next(new Error("Token expired"));
      }
      return next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    const { id } = socket.user;
    console.log("✅ User connected:", id);

    // Track sockets
    if (!userSockets.has(id)) {
      userSockets.set(id, new Set());
    }
    userSockets.get(id).add(socket.id);

    // Mark online if first socket
    if (userSockets.get(id).size === 1) {
      await User.findByIdAndUpdate(id, { isOnline: true });
    }

    socket.on("disconnect", async () => {
      console.log("❌ User disconnected:", id);

      // Remove socket
      const sockets = userSockets.get(id);
      sockets.delete(socket.id);

      // If no sockets left → mark offline
      if (sockets.size === 0) {
        userSockets.delete(id);
        await User.findByIdAndUpdate(id, {
          isOnline: false,
          lastSeenAt: new Date(),
        });
      }
    });
  });

  return io;
};
