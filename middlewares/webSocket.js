const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const User = require("../models/userModels/userModel");
const Session = require("../models/userModels/userSession-Device/usersessionSchema");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*", // ✅ allow Expo / React Native app
      methods: ["GET", "POST"],
    },
    transports: ["websocket"], // 🔒 No HTTP long polling
  });

  // Middleware: verify JWT from socket auth
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token provided"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      console.log("Socket auth error:", err.message);
      next(new Error("Invalid or expired token"));
    }
  });

  io.on("connection", async (socket) => {
    console.log("✅ Socket connected:", socket.userId, socket.id);

    // Mark user + session online
    await User.findByIdAndUpdate(socket.userId, { isOnline: true });
    await Session.updateMany({ userId: socket.userId }, { isOnline: true });

    // Notify everyone
    io.emit("userOnline", { userId: socket.userId });

    // Handle disconnect
    socket.on("disconnect", async (reason) => {
      console.log("❌ Disconnected:", socket.userId, reason);
      await User.findByIdAndUpdate(socket.userId, { isOnline: false });
      await Session.updateMany({ userId: socket.userId }, { isOnline: false });
      io.emit("userOffline", { userId: socket.userId });
    });
  });

  console.log("🚀 Socket.io initialized");
};

module.exports = { initSocket, getIO: () => io };
